import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Volume2,
  RefreshCw,
  LogOut,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Lock,
} from "lucide-react";
import type { User } from "firebase/auth";
import type {
  LiveAlertItem,
  LiveAlertSource,
  UrlInspectionDetail,
} from "../types/scam";
import { triggerHaptic } from "../utils/haptics";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

interface LiveShieldTabProps {
  largePrint: boolean;
  monitoringEnabled: boolean;
  onToggleMonitoring: (enabled: boolean) => void;
  voiceAlertsEnabled: boolean;
  onToggleVoiceAlerts: (enabled: boolean) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onRequestNotifications: () => Promise<void>;
  wsConnected: boolean;
  alerts: LiveAlertItem[];
  onSelectAlert: (alert: LiveAlertItem) => void;
  onInspectUrl: (url: string, inspection?: UrlInspectionDetail) => void;
  onClearAlerts: () => Promise<void>;
  // Gmail props
  gmailUser: User | null;
  gmailTokenReady: boolean;
  gmailAutoPoll: boolean;
  onToggleGmailAutoPoll: (enabled: boolean) => void;
  gmailScanning: boolean;
  gmailStatus: string | null;
  gmailError: string | null;
  onGmailSignIn: () => Promise<void>;
  onGmailScanNow: () => Promise<void>;
  onGmailSignOut: () => Promise<void>;
  // Live message simulation / ingestion props
  onSimulateIncoming: (payload: {
    source: LiveAlertSource;
    sender: string;
    subject?: string;
    message: string;
    attachments?: Array<{ filename: string }>;
  }) => Promise<void>;
}

export function LiveShieldTab({
  largePrint,
  monitoringEnabled,
  onToggleMonitoring,
  voiceAlertsEnabled,
  onToggleVoiceAlerts,
  notificationPermission,
  onRequestNotifications,
  wsConnected,
  alerts,
  onSelectAlert,
  onInspectUrl,
  onClearAlerts,
  gmailUser,
  gmailTokenReady,
  gmailAutoPoll,
  onToggleGmailAutoPoll,
  gmailScanning,
  gmailStatus,
  gmailError,
  onGmailSignIn,
  onGmailScanNow,
  onGmailSignOut,
  onSimulateIncoming,
}: LiveShieldTabProps) {
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [showPhoneGuide, setShowPhoneGuide] = useState(false);
  const [customSource, setCustomSource] = useState<LiveAlertSource>("WhatsApp");
  const [customSender, setCustomSender] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const redCount = alerts.filter((a) => a.alertLevel === "RED").length;
  const yellowCount = alerts.filter((a) => a.alertLevel === "YELLOW").length;

  const runSimulation = async (
    id: string,
    payload: {
      source: LiveAlertSource;
      sender: string;
      subject?: string;
      message: string;
      attachments?: Array<{ filename: string }>;
    }
  ) => {
    triggerHaptic(25);
    setSimulatingId(id);
    try {
      await onSimulateIncoming(payload);
    } finally {
      setSimulatingId(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim()) return;
    await runSimulation("custom", {
      source: customSource,
      sender: customSender.trim() || "Unknown Contact",
      message: customMessage.trim(),
    });
    setCustomMessage("");
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ingest/message`
      : "/api/ingest/message";

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <h1 className="font-display text-[26px] sm:text-[32px] leading-tight font-extrabold text-[#10243E]">
          Automatic Real-Time Shield
        </h1>
        <p className={`${bodySize} text-[#10243E]`}>
          ElderGuard checks incoming emails, WhatsApp alerts, and text messages automatically and warns you out loud before you click anything dangerous.
        </p>
      </div>

      {/* Protection & Alert Controls */}
      <section className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[#10243E] shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-2xl font-bold text-[#10243E]">
                Protection Controls
              </h2>
              <p className="text-base font-bold text-[#10243E]">
                {monitoringEnabled
                  ? wsConnected
                    ? "Live Alert Connection: Ready"
                    : "Connecting Live Alerts..."
                  : "Live Alerts Paused"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {redCount > 0 && (
              <span className="px-4 py-2 bg-red-700 text-white text-base font-extrabold rounded-xl">
                {redCount} Red Alert{redCount > 1 ? "s" : ""}
              </span>
            )}
            {yellowCount > 0 && (
              <span className="px-4 py-2 bg-amber-200 text-[#10243E] border-2 border-amber-600 text-base font-extrabold rounded-xl">
                {yellowCount} Warning{yellowCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Consent Toggle */}
          <div className="p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-extrabold text-[#10243E]">
                Automatic Scam Alerts
              </p>
              <p className="text-base text-[#10243E]">
                Only scans messages when you turn this ON
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={monitoringEnabled}
              onClick={() => {
                triggerHaptic(25);
                onToggleMonitoring(!monitoringEnabled);
              }}
              className={`min-h-[56px] min-w-[84px] px-5 py-3 rounded-2xl border-2 font-extrabold text-lg tactile-press shrink-0 cursor-pointer ${
                monitoringEnabled
                  ? "bg-emerald-800 border-emerald-950 text-white"
                  : "bg-white border-[#9FB0C4] text-[#10243E]"
              }`}
            >
              {monitoringEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* Voice Alerts Toggle */}
          <div className="p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-extrabold text-[#10243E] flex items-center gap-2">
                <Volume2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Spoken Voice Warnings</span>
              </p>
              <p className="text-base text-[#10243E]">
                Speaks Red and Yellow alerts out loud
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={voiceAlertsEnabled}
              onClick={() => {
                triggerHaptic(25);
                onToggleVoiceAlerts(!voiceAlertsEnabled);
              }}
              className={`min-h-[56px] min-w-[84px] px-5 py-3 rounded-2xl border-2 font-extrabold text-lg tactile-press shrink-0 cursor-pointer ${
                voiceAlertsEnabled
                  ? "bg-[#10243E] border-[#10243E] text-white"
                  : "bg-white border-[#9FB0C4] text-[#10243E]"
              }`}
            >
              {voiceAlertsEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Browser Notifications Permission */}
        {notificationPermission !== "unsupported" && (
          <div className="p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Bell className="w-6 h-6 text-[#10243E] shrink-0 mt-1" aria-hidden="true" />
              <div>
                <p className="font-display text-lg font-extrabold text-[#10243E]">
                  Pop-Up Screen Alerts
                </p>
                <p className="text-base text-[#10243E]">
                  {notificationPermission === "granted"
                    ? "Allowed. You will get Red Alerts even while using another tab."
                    : notificationPermission === "denied"
                      ? "Blocked by your browser settings. On-screen alerts inside ElderGuard still work."
                      : "Tap Enable so ElderGuard can pop up urgent warnings on your screen."}
                </p>
              </div>
            </div>
            {notificationPermission !== "granted" && notificationPermission !== "denied" && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  void onRequestNotifications();
                }}
                className="min-h-[56px] px-5 py-3 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press cursor-pointer"
              >
                Enable Screen Alerts
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gmail Inbox Shield */}
        <section className="lg:col-span-6 bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <Mail className="w-7 h-7 text-[#10243E] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold text-[#10243E]">
              Gmail Inbox Guard
            </h2>
          </div>

          <p className={`${bodySize} text-[#10243E]`}>
            With your permission, ElderGuard reads new Gmail senders, links, and attachment names to catch fake bank emails and lottery tricks.
          </p>

          {!gmailTokenReady ? (
            <div className="space-y-4">
              {/* Official Google Sign-In Styled Button (scaled for 50+ accessibility) */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  void onGmailSignIn();
                }}
                className="w-full min-h-[60px] px-5 py-3.5 bg-white hover:bg-slate-50 border-2 border-[#747775] rounded-2xl flex items-center justify-center gap-3.5 shadow-sm tactile-press cursor-pointer"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span className="font-sans text-lg font-bold text-[#1F1F1F]">
                  Sign in with Google
                </span>
              </button>

              {gmailUser && (
                <p className="text-base font-bold text-[#10243E]">
                  Signed in previously as {gmailUser.email}. Tap Sign in with Google above to start checking emails for this session.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl space-y-1">
                <p className="text-base font-extrabold text-emerald-950">
                  Gmail Connected Safely (Read-Only)
                </p>
                <p className="text-base font-bold text-[#10243E]">
                  {gmailUser?.email || "Google Account Connected"}
                </p>
              </div>

              <button
                type="button"
                disabled={gmailScanning}
                onClick={() => {
                  triggerHaptic(25);
                  void onGmailScanNow();
                }}
                className="w-full min-h-[60px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 disabled:bg-slate-400 rounded-2xl tactile-press cursor-pointer"
              >
                <RefreshCw
                  className={`w-6 h-6 shrink-0 ${gmailScanning ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {gmailScanning ? "Checking New Emails..." : "Check Gmail Inbox Now"}
              </button>

              <div className="p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-extrabold text-[#10243E]">
                    Auto-Check Every Minute
                  </p>
                  <p className="text-sm font-bold text-[#10243E]">
                    Watches for new scam emails automatically
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gmailAutoPoll}
                  onClick={() => {
                    triggerHaptic(20);
                    onToggleGmailAutoPoll(!gmailAutoPoll);
                  }}
                  className={`min-h-[56px] min-w-[80px] px-4 py-2.5 rounded-2xl border-2 font-extrabold text-base tactile-press cursor-pointer ${
                    gmailAutoPoll
                      ? "bg-[#10243E] border-[#10243E] text-white"
                      : "bg-white border-[#9FB0C4] text-[#10243E]"
                  }`}
                >
                  {gmailAutoPoll ? "ON" : "OFF"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  void onGmailSignOut();
                }}
                className="w-full min-h-[56px] px-5 py-3 inline-flex items-center justify-center gap-2.5 text-base font-bold text-[#10243E] bg-[#EEF2F5] border-2 border-[#9FB0C4] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
              >
                <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
                Disconnect Gmail
              </button>
            </div>
          )}

          {gmailStatus && (
            <p className="text-base font-bold text-emerald-950 bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4">
              {gmailStatus}
            </p>
          )}

          {gmailError && (
            <p
              role="alert"
              className="text-base font-bold text-red-950 bg-red-50 border-2 border-red-400 rounded-2xl p-4"
            >
              {gmailError}
            </p>
          )}
        </section>

        {/* WhatsApp & SMS Live Test & Bridge */}
        <section className="lg:col-span-6 bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-[#10243E] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold text-[#10243E]">
              Test Live Incoming Alerts
            </h2>
          </div>

          <p className={`${bodySize} text-[#10243E]`}>
            Tap any button below to simulate a real message arriving on WhatsApp, SMS, or Email and watch ElderGuard catch it automatically.
          </p>

          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              disabled={simulatingId !== null}
              onClick={() =>
                void runSimulation("wa-prize", {
                  source: "WhatsApp",
                  sender: "+91 98201 55412 (Unknown)",
                  message:
                    "Congratulations! You have won Rs. 50,000. Claim your prize here: suspicious-link.com",
                })
              }
              className="min-h-[60px] px-5 py-3.5 text-left text-lg font-extrabold text-red-950 bg-red-50 hover:bg-red-100 border-2 border-red-500 rounded-2xl tactile-press cursor-pointer disabled:opacity-60"
            >
              {simulatingId === "wa-prize"
                ? "Checking WhatsApp Alert..."
                : "Test WhatsApp: Rs. 50,000 Prize Scam"}
            </button>

            <button
              type="button"
              disabled={simulatingId !== null}
              onClick={() =>
                void runSimulation("sms-bank", {
                  source: "SMS",
                  sender: "BANK-ALERT",
                  message:
                    "URGENT: Your bank account check expired. Tap https://firstnational-account-check.com/login within 2 hours.",
                })
              }
              className="min-h-[60px] px-5 py-3.5 text-left text-lg font-extrabold text-amber-950 bg-amber-50 hover:bg-amber-100 border-2 border-amber-500 rounded-2xl tactile-press cursor-pointer disabled:opacity-60"
            >
              {simulatingId === "sms-bank"
                ? "Checking SMS Alert..."
                : "Test SMS: Fake Bank Link Warning"}
            </button>

            <button
              type="button"
              disabled={simulatingId !== null}
              onClick={() =>
                void runSimulation("email-attach", {
                  source: "Gmail",
                  sender: "billing-update@support-notice.xyz",
                  subject: "Your Account Receipt Attached",
                  message:
                    "Please open the attached file urgent-receipt.html right away to confirm your payment.",
                  attachments: [{ filename: "urgent-receipt.html" }],
                })
              }
              className="min-h-[60px] px-5 py-3.5 text-left text-lg font-extrabold text-red-950 bg-red-50 hover:bg-red-100 border-2 border-red-400 rounded-2xl tactile-press cursor-pointer disabled:opacity-60"
            >
              {simulatingId === "email-attach"
                ? "Checking Email Alert..."
                : "Test Email: Dangerous Attachment"}
            </button>

            <button
              type="button"
              disabled={simulatingId !== null}
              onClick={() =>
                void runSimulation("sms-safe", {
                  source: "SMS",
                  sender: "Oakridge Family Clinic",
                  message:
                    "Friendly reminder: Your checkup with Dr. Patel is tomorrow at 10:30 AM. Call our desk if you need changes.",
                })
              }
              className="min-h-[60px] px-5 py-3.5 text-left text-lg font-extrabold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500 rounded-2xl tactile-press cursor-pointer disabled:opacity-60"
            >
              {simulatingId === "sms-safe"
                ? "Checking Safe Message..."
                : "Test SMS: Safe Clinic Reminder"}
            </button>
          </div>

          {/* Custom Message Arrival Test */}
          <form onSubmit={(e) => void handleCustomSubmit(e)} className="border-t-2 border-[#DCE4EE] pt-4 space-y-3">
            <p className="text-base font-extrabold text-[#10243E]">
              Or send your own test incoming message:
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["WhatsApp", "SMS", "Gmail"] as LiveAlertSource[]).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setCustomSource(src)}
                  className={`min-h-[50px] px-3 py-2 rounded-xl border-2 text-base font-extrabold cursor-pointer ${
                    customSource === src
                      ? "bg-[#10243E] border-[#10243E] text-white"
                      : "bg-[#EEF2F5] border-[#C8D3E0] text-[#10243E]"
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customSender}
              onChange={(e) => setCustomSender(e.target.value)}
              placeholder="Sender (e.g. +1 555-0199 or Prize Desk)"
              className="w-full min-h-[52px] px-4 py-2.5 text-base text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-xl"
            />
            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Incoming message text with a link..."
              className="w-full p-3.5 text-base text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-xl"
            />
            <button
              type="submit"
              disabled={simulatingId !== null || !customMessage.trim()}
              className="w-full min-h-[56px] px-5 py-3 inline-flex items-center justify-center gap-2.5 text-lg font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] disabled:bg-slate-400 rounded-2xl tactile-press cursor-pointer"
            >
              <Send className="w-5 h-5 shrink-0" aria-hidden="true" />
              Trigger Live {customSource} Check
            </button>
          </form>
        </section>
      </div>

      {/* Live Alerts Feed */}
      <section className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-[#10243E]">
            Live Safety Alert History ({alerts.length})
          </h2>

          {alerts.length > 0 && (
            <HoldToConfirmButton
              label="Clear Alert History"
              confirmLabel="Tap again or hold to clear"
              variant="danger"
              onConfirm={() => void onClearAlerts()}
              icon={<Trash2 className="w-5 h-5 shrink-0" aria-hidden="true" />}
            />
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="p-6 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl space-y-2">
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              No live alerts yet.
            </p>
            <p className="text-base text-[#10243E]">
              Connect Gmail or tap any &ldquo;Test&rdquo; button above to see real-time Red, Yellow, and Green warnings appear automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((item) => {
              const isRed = item.alertLevel === "RED";
              const isYellow = item.alertLevel === "YELLOW";

              return (
                <article
                  key={item.id}
                  className={`p-5 rounded-3xl border-2 space-y-4 ${
                    isRed
                      ? "bg-red-50 border-red-600"
                      : isYellow
                        ? "bg-amber-50 border-amber-500"
                        : "bg-emerald-50 border-emerald-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {isRed ? (
                        <ShieldAlert className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
                      ) : isYellow ? (
                        <AlertTriangle className="w-8 h-8 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-8 h-8 text-emerald-900 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-lg text-sm font-extrabold ${
                              isRed
                                ? "bg-red-700 text-white"
                                : isYellow
                                  ? "bg-amber-300 text-[#10243E]"
                                  : "bg-emerald-800 text-white"
                            }`}
                          >
                            {item.alertLevel}
                          </span>
                          <span className="text-base font-extrabold text-[#10243E]">
                            {item.source}
                          </span>
                          <span className="text-sm font-bold text-[#10243E]">
                            {new Date(item.receivedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <h3 className="font-display text-xl font-extrabold text-[#10243E]">
                          {item.alertBannerText}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <p className="text-base font-bold text-[#10243E]">
                    From: {item.sender}
                    {item.subject ? ` | Subject: ${item.subject}` : ""}
                  </p>
                  <p className={`${bodySize} font-bold text-black`}>
                    {item.analysis.summary}
                  </p>

                  {item.urlInspections.length > 0 && (
                    <div className="space-y-2">
                      {item.urlInspections.map((insp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onInspectUrl(insp.url, insp)}
                          className="w-full min-h-[56px] px-4 py-3 bg-white border-2 border-[#10243E] hover:bg-slate-100 rounded-2xl flex items-center justify-between gap-3 text-left tactile-press cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Lock className="w-5 h-5 text-red-800 shrink-0" aria-hidden="true" />
                            <span className="text-base font-extrabold text-red-950 truncate">
                              {insp.url}
                            </span>
                          </div>
                          <span className="text-base font-extrabold text-blue-900 shrink-0 underline">
                            Open Safely
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onSelectAlert(item);
                    }}
                    className="w-full min-h-[56px] px-5 py-3 text-lg font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press cursor-pointer"
                  >
                    View Full Warning &amp; Voice Alert
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Honest Platform & Companion Phone Guide */}
      <section className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-7 space-y-4">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(18);
            setShowPhoneGuide((v) => !v);
          }}
          className="w-full min-h-[56px] flex items-center justify-between gap-4 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-7 h-7 text-[#10243E] shrink-0" aria-hidden="true" />
            <span className="font-display text-xl font-extrabold text-[#10243E]">
              How Background Phone Protection Works (Android &amp; iPhone)
            </span>
          </div>
          {showPhoneGuide ? (
            <ChevronUp className="w-6 h-6 text-[#10243E] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-6 h-6 text-[#10243E] shrink-0" aria-hidden="true" />
          )}
        </button>

        {showPhoneGuide && (
          <div className="space-y-4 pt-2 border-t-2 border-[#DCE4EE] text-[#10243E] text-base sm:text-lg leading-relaxed">
            <div className="p-4 bg-[#EEF2F5] rounded-2xl space-y-1.5">
              <p className="font-extrabold">Android Phones (Companion Bridge Ready)</p>
              <p>
                On Android, an installed helper app uses Android Notification Listener permission (for WhatsApp alerts), SMS Receive permission (for text messages), and Link Interception to forward incoming messages securely to this server endpoint:
              </p>
              <p className="font-mono text-sm bg-white p-3 rounded-xl border border-[#C8D3E0] break-all">
                POST {webhookUrl}
              </p>
            </div>

            <div className="p-4 bg-[#EEF2F5] rounded-2xl space-y-1.5">
              <p className="font-extrabold">iPhone &amp; iPad Limits (Apple Privacy Rules)</p>
              <p>
                Apple does not allow third-party apps to read WhatsApp messages in the background on iPhone. On iOS, protection works through Gmail connection (supported here), an iOS SMS Filter Extension for unknown senders, and the iOS Share Sheet / Safari blocker.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
