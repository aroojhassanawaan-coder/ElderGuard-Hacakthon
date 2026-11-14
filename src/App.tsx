import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, X, ShieldCheck, Trash2, Radio, ShieldAlert } from "lucide-react";
import type { User } from "firebase/auth";
import { Header } from "./components/Header";
import { BottomNav, type AppTab } from "./components/BottomNav";
import { OfflineIndicator } from "./components/PWAInstallButton";
import { AnalysisReport } from "./components/AnalysisReport";
import { LiveShieldTab } from "./components/LiveShieldTab";
import { KinshipShieldTab } from "./components/KinshipShieldTab";
import { SafeChatTab } from "./components/SafeChatTab";
import { SettingsModal } from "./components/SettingsModal";
import { AlertOverlayModal } from "./components/AlertOverlayModal";
import { LinkInterceptorModal } from "./components/LinkInterceptorModal";
import { HoldToConfirmButton } from "./components/HoldToConfirmButton";
import { SAMPLE_SCENARIOS } from "./data/examplesAndLibrary";
import { triggerHaptic } from "./utils/haptics";
import {
  initGmailAuth,
  googleSignInForGmail,
  getGmailAccessToken,
  logoutGmail,
} from "./utils/gmailAuth";
import type {
  AlertSecurityLevel,
  LiveAlertItem,
  LiveAlertSource,
  ScamAnalysisResult,
  ScamChannel,
  TrustedContact,
  UrlInspectionDetail,
} from "./types/scam";

const SETTINGS_STORAGE_KEY = "elderguard_settings_v1";
const SHIELD_PREFS_KEY = "elderguard_live_shield_prefs_v1";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("scanner");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [largePrint, setLargePrint] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return Boolean((JSON.parse(saved) as { largePrint?: boolean }).largePrint);
      }
    } catch {
      // Ignore storage error
    }
    return false;
  });

  const [trustedContact, setTrustedContact] = useState<TrustedContact>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { trustedContact?: TrustedContact };
        if (parsed.trustedContact) return parsed.trustedContact;
      }
    } catch {
      // Ignore storage error
    }
    return { name: "", phone: "", email: "" };
  });

  const [channel, setChannel] = useState<ScamChannel>("Any");
  const [messageText, setMessageText] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [result, setResult] = useState<ScamAnalysisResult | null>(null);
  const [analyzedMessage, setAnalyzedMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-Time Protection & Alert State
  const [monitoringEnabled, setMonitoringEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SHIELD_PREFS_KEY);
      if (saved) return Boolean((JSON.parse(saved) as { monitoringEnabled?: boolean }).monitoringEnabled ?? true);
    } catch {
      // Ignore
    }
    return true;
  });

  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SHIELD_PREFS_KEY);
      if (saved) return Boolean((JSON.parse(saved) as { voiceAlertsEnabled?: boolean }).voiceAlertsEnabled ?? true);
    } catch {
      // Ignore
    }
    return true;
  });

  const [gmailAutoPoll, setGmailAutoPoll] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertItem[]>([]);
  const [activeAlertOverlay, setActiveAlertOverlay] = useState<LiveAlertItem | null>(null);
  const [interceptedLink, setInterceptedLink] = useState<{
    url: string;
    alertLevel: AlertSecurityLevel;
    reason: string;
    inspection?: UrlInspectionDetail;
  } | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission;
  });

  // Gmail OAuth state (token stays strictly in memory via gmailAuth.ts)
  const [gmailUser, setGmailUser] = useState<User | null>(null);
  const [gmailTokenReady, setGmailTokenReady] = useState(false);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<string | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const monitoringRef = useRef(monitoringEnabled);
  const voiceAlertsRef = useRef(voiceAlertsEnabled);
  monitoringRef.current = monitoringEnabled;
  voiceAlertsRef.current = voiceAlertsEnabled;

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ largePrint, trustedContact })
      );
    } catch {
      // Ignore storage error
    }
  }, [largePrint, trustedContact]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SHIELD_PREFS_KEY,
        JSON.stringify({ monitoringEnabled, voiceAlertsEnabled })
      );
    } catch {
      // Ignore storage error
    }
  }, [monitoringEnabled, voiceAlertsEnabled]);

  useEffect(() => {
    const unsubscribe = initGmailAuth(
      (user) => {
        setGmailUser(user);
        setGmailTokenReady(true);
      },
      (user) => {
        setGmailUser(user);
        setGmailTokenReady(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerIncomingWarningEffects = useCallback((alert: LiveAlertItem) => {
    if (alert.alertLevel === "RED") {
      triggerHaptic([140, 60, 140, 60, 200]);
    } else if (alert.alertLevel === "YELLOW") {
      triggerHaptic([70, 40, 70]);
    } else {
      triggerHaptic(30);
    }

    if (
      voiceAlertsRef.current &&
      (alert.alertLevel === "RED" || alert.alertLevel === "YELLOW") &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
      const spoken =
        alert.analysis.SPEECH_SUMMARY ||
        `${alert.alertHeadline} ${alert.alertBannerText}`;
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }

    if (
      (alert.alertLevel === "RED" || alert.alertLevel === "YELLOW") &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const title =
          alert.alertLevel === "RED"
            ? "RED ALERT. Possible Scam!"
            : "YELLOW WARNING. Be Careful.";
        const notif = new Notification(title, {
          body: `${alert.source} from ${alert.sender}: ${alert.alertBannerText}`,
          tag: alert.id,
        });
        notif.onclick = () => {
          window.focus();
          setActiveAlertOverlay(alert);
        };
      } catch {
        // Ignore browser notification restrictions inside iframes
      }
    }

    if (alert.alertLevel === "RED" || alert.alertLevel === "YELLOW") {
      setActiveAlertOverlay(alert);
    }
  }, []);

  // Real-time WebSocket subscription for incoming alerts
  useEffect(() => {
    if (!monitoringEnabled) {
      setWsConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/alerts`);

      ws.onopen = () => {
        if (!disposed) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as
            | { type: "alerts:init"; alerts: LiveAlertItem[] }
            | { type: "alerts:new"; alert: LiveAlertItem }
            | { type: "alerts:ack"; alertId: string }
            | { type: "alerts:clear" };

          if (payload.type === "alerts:init") {
            setLiveAlerts(payload.alerts);
          } else if (payload.type === "alerts:new") {
            setLiveAlerts((prev) => {
              if (prev.some((a) => a.id === payload.alert.id)) return prev;
              return [payload.alert, ...prev].slice(0, 50);
            });
            if (monitoringRef.current) {
              triggerIncomingWarningEffects(payload.alert);
            }
          } else if (payload.type === "alerts:ack") {
            setLiveAlerts((prev) =>
              prev.map((a) =>
                a.id === payload.alertId ? { ...a, acknowledged: true } : a
              )
            );
          } else if (payload.type === "alerts:clear") {
            setLiveAlerts([]);
            setActiveAlertOverlay(null);
          }
        } catch {
          // Ignore malformed ws event
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [monitoringEnabled, triggerIncomingWarningEffects]);

  const handleRequestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    } catch {
      // Ignore permission rejection
    }
  };

  const handleGmailSignIn = async () => {
    setGmailError(null);
    setGmailStatus(null);
    try {
      const { user } = await googleSignInForGmail();
      setGmailUser(user);
      setGmailTokenReady(true);
      setGmailStatus(
        `Connected safely as ${user.email || "Google user"}. Tap Check Gmail Inbox Now to scan recent emails.`
      );
    } catch (err) {
      setGmailError(
        err instanceof Error
          ? err.message
          : "Could not finish Google sign-in right now."
      );
    }
  };

  const handleGmailScanNow = useCallback(async () => {
    const token = getGmailAccessToken();
    if (!token) {
      setGmailTokenReady(false);
      setGmailError("Please sign in with Google again to check your emails.");
      return;
    }

    setGmailScanning(true);
    setGmailError(null);
    try {
      const resp = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentGranted: true,
          seenIds: liveAlerts.map((a) => a.id),
        }),
      });
      const data = (await resp.json()) as {
        scannedCount?: number;
        newAlerts?: LiveAlertItem[];
        error?: string;
      };

      if (resp.status === 401) {
        setGmailTokenReady(false);
        setGmailAutoPoll(false);
        throw new Error(
          data.error || "Please sign in with Google again to renew email access."
        );
      }

      if (!resp.ok || data.error) {
        throw new Error(data.error || "Could not check Gmail right now.");
      }

      const foundNew = data.newAlerts?.length ?? 0;
      setGmailStatus(
        foundNew > 0
          ? `Checked ${data.scannedCount ?? foundNew} inbox emails and added ${foundNew} new scan result(s).`
          : `Checked ${data.scannedCount ?? 0} recent inbox emails. No new unread items found.`
      );
    } catch (err) {
      setGmailError(
        err instanceof Error ? err.message : "Could not check Gmail right now."
      );
    } finally {
      setGmailScanning(false);
    }
  }, [liveAlerts]);

  useEffect(() => {
    if (!gmailAutoPoll || !gmailTokenReady || !monitoringEnabled) return;
    const timer = setInterval(() => {
      void handleGmailScanNow();
    }, 60_000);
    return () => clearInterval(timer);
  }, [gmailAutoPoll, gmailTokenReady, monitoringEnabled, handleGmailScanNow]);

  const handleGmailSignOut = async () => {
    setGmailAutoPoll(false);
    await logoutGmail();
    setGmailUser(null);
    setGmailTokenReady(false);
    setGmailStatus("Gmail disconnected safely.");
    setGmailError(null);
  };

  const handleSimulateIncoming = async (payload: {
    source: LiveAlertSource;
    sender: string;
    subject?: string;
    message: string;
    attachments?: Array<{ filename: string }>;
  }) => {
    const resp = await fetch("/api/ingest/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        consentGranted: true,
      }),
    });
    const data = (await resp.json()) as { alert?: LiveAlertItem; error?: string };
    if (data.alert) {
      setLiveAlerts((prev) => {
        if (prev.some((a) => a.id === data.alert!.id)) return prev;
        return [data.alert!, ...prev].slice(0, 50);
      });
      // Always show the alert overlay immediately for interactive tests even if monitoring was toggled or ws raced
      setActiveAlertOverlay(data.alert);
    }
  };

  const handleDismissAlertOverlay = async () => {
    const current = activeAlertOverlay;
    setActiveAlertOverlay(null);
    if (current && !current.acknowledged) {
      setLiveAlerts((prev) =>
        prev.map((a) => (a.id === current.id ? { ...a, acknowledged: true } : a))
      );
      try {
        await fetch("/api/alerts/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertId: current.id }),
        });
      } catch {
        // Ignore ack error
      }
    }
  };

  const handleClearAlerts = async () => {
    setLiveAlerts([]);
    setActiveAlertOverlay(null);
    try {
      await fetch("/api/alerts", { method: "DELETE" });
    } catch {
      // Ignore
    }
  };

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Please choose a PNG, JPG, or WEBP picture.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("That picture is over 5 MB. Please choose a smaller picture.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) {
        setUploadError("Could not read that picture. Please try another one.");
        return;
      }
      triggerHaptic(25);
      setImagePreviewUrl(dataUrl);
      setImageBase64(dataUrl.slice(commaIndex + 1));
      setImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
          return;
        }
      }
    }
  };

  const clearImage = () => {
    setImagePreviewUrl(null);
    setImageBase64(null);
    setImageMimeType(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearAll = () => {
    setMessageText("");
    setChannel("Any");
    clearImage();
    setResult(null);
    setAnalyzedMessage("");
    setAnalysisError(null);
  };

  const runAnalysis = async (
    textToAnalyze: string,
    selectedChannel: ScamChannel,
    imgData: string | null,
    imgMime: string | null
  ) => {
    if (!textToAnalyze.trim() && !imgData) {
      setAnalysisError("Please paste a message or upload a picture first.");
      return;
    }

    triggerHaptic(25);
    setIsLoading(true);
    setAnalysisError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToAnalyze,
          channel: selectedChannel,
          imageBase64: imgData ?? undefined,
          imageMimeType: imgMime ?? undefined,
        }),
      });

      const data = (await response.json()) as ScamAnalysisResult & { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error || "Could not finish checking this message right now.");
      }

      setResult(data);
      setAnalyzedMessage(textToAnalyze || "(Picture uploaded)");
      if (data.verdict === "Danger") {
        triggerHaptic([55, 35, 55]);
      } else {
        triggerHaptic(30);
      }
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Something went wrong while checking the message."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runAnalysis(messageText, channel, imageBase64, imageMimeType);
  };

  const handleTriggerSampleOrChat = (msg: string, msgChannel: ScamChannel) => {
    triggerHaptic(22);
    setActiveTab("scanner");
    setMessageText(msg);
    setChannel(msgChannel);
    clearImage();
    setAnalysisError(null);
    void runAnalysis(msg, msgChannel, null, null);
  };

  const unreadAlertsCount = liveAlerts.filter(
    (a) => !a.acknowledged && (a.alertLevel === "RED" || a.alertLevel === "YELLOW")
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF2F5] text-[#10243E]">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onGoHome={() => setActiveTab("scanner")}
      />
      <OfflineIndicator />

      {/* Top Real-Time Shield Status Bar */}
      <div className="bg-white border-b-2 border-[#C8D3E0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-base font-extrabold text-[#10243E]">
            {unreadAlertsCount > 0 ? (
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" aria-hidden="true" />
            ) : (
              <Radio
                className={`w-5 h-5 shrink-0 ${
                  monitoringEnabled && wsConnected ? "text-emerald-800" : "text-slate-600"
                }`}
                aria-hidden="true"
              />
            )}
            <span>
              {unreadAlertsCount > 0
                ? `${unreadAlertsCount} Urgent Scam Alert${unreadAlertsCount > 1 ? "s" : ""} Waiting`
                : monitoringEnabled
                  ? wsConnected
                    ? "Live Scam Shield: ON & Watching"
                    : "Live Scam Shield: Connecting"
                  : "Live Scam Shield: Paused"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setActiveTab("liveshield");
            }}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-base font-extrabold border-2 tactile-press cursor-pointer ${
              unreadAlertsCount > 0
                ? "bg-red-700 border-red-900 text-white"
                : "bg-[#EEF2F5] border-[#9FB0C4] text-[#10243E] hover:bg-slate-200"
            }`}
          >
            {unreadAlertsCount > 0 ? "Review Alerts" : "Open Live Shield"}
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-32">
        {activeTab === "scanner" && (
          <div className="space-y-6">
            <div className="space-y-2 max-w-3xl">
              <h1 className="font-display text-[26px] sm:text-[32px] leading-tight font-extrabold text-[#10243E] text-balance">
                Check a Message or Link
              </h1>
              <p className={`${bodySize} text-[#10243E]`}>
                Paste any text message, WhatsApp chat, email, or picture below. We will tell you in plain words if it is safe.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Scanner Input Card */}
              <form
                onSubmit={handleScanSubmit}
                onPaste={handlePaste}
                className="lg:col-span-6 bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <label
                      htmlFor="scam-message-textarea"
                      className="block font-display text-xl font-bold text-[#10243E]"
                    >
                      Paste a message or describe a scary phone call
                    </label>

                    <textarea
                      id="scam-message-textarea"
                      rows={5}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Paste a suspicious text, email, or WhatsApp message—or describe a call from someone claiming to be police, tax agents, or courts..."
                      className={`w-full p-4 text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl placeholder:text-slate-600 resize-y ${bodySize}`}
                    />
                  </div>

                  {/* Screenshot Upload / Paste */}
                  <div className="space-y-3">
                    {imagePreviewUrl ? (
                      <div className="p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <img
                            src={imagePreviewUrl}
                            alt="Uploaded picture preview"
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 object-cover rounded-xl border-2 border-[#9FB0C4] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-lg font-extrabold text-[#10243E] truncate">
                              Picture attached
                            </p>
                            <p className="text-base text-[#10243E]">
                              We will read the words inside this picture
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(20);
                            clearImage();
                          }}
                          aria-label="Remove picture"
                          className="min-h-[56px] min-w-[56px] flex items-center justify-center text-red-900 bg-white border-2 border-red-300 hover:bg-red-50 rounded-2xl tactile-press shrink-0 cursor-pointer"
                        >
                          <X className="w-6 h-6" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-3 p-4 min-h-[62px] border-2 border-dashed border-[#6E85A3] bg-[#EEF2F5] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer">
                        <Upload className="w-6 h-6 text-[#10243E] shrink-0" aria-hidden="true" />
                        <span className="text-lg font-bold text-[#10243E]">
                          Add a Picture or Screenshot
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleImageFile(e.target.files?.[0])}
                          className="sr-only"
                        />
                      </label>
                    )}

                    {uploadError && (
                      <p
                        role="alert"
                        className="text-lg font-bold text-red-950 bg-red-50 border-2 border-red-400 rounded-2xl p-4"
                      >
                        {uploadError}
                      </p>
                    )}
                  </div>

                  {/* 3 One-Tap Practice Examples with generous 16px gaps */}
                  <div className="space-y-3 border-t-2 border-[#DCE4EE] pt-5">
                    <span className="block text-base font-bold text-[#10243E]">
                      Or try one of these examples:
                    </span>
                    <div className="grid grid-cols-1 gap-4">
                      {SAMPLE_SCENARIOS.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() =>
                            handleTriggerSampleOrChat(sample.message, sample.channel)
                          }
                          className="min-h-[58px] px-5 py-3.5 text-lg font-bold text-[#10243E] bg-[#EEF2F5] hover:bg-slate-200 border-2 border-[#9FB0C4] rounded-2xl text-left tactile-press cursor-pointer"
                        >
                          Try: {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || (!messageText.trim() && !imageBase64)}
                    className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-xl font-extrabold text-white bg-blue-800 hover:bg-blue-900 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-2xl shadow-md tactile-press cursor-pointer"
                  >
                    <ShieldCheck className="w-7 h-7 shrink-0" aria-hidden="true" />
                    {isLoading ? "Checking Message..." : "Check If This Is Safe"}
                  </button>

                  {(messageText.length > 0 || imageBase64) && (
                    <HoldToConfirmButton
                      label="Clear Text Box"
                      confirmLabel="Tap again or hold to clear"
                      variant="danger"
                      onConfirm={handleClearAll}
                      icon={<Trash2 className="w-5 h-5 shrink-0" aria-hidden="true" />}
                      className="w-full"
                    />
                  )}
                </div>
              </form>

              {/* Result Panel */}
              <div className="lg:col-span-6">
                <AnalysisReport
                  result={result}
                  isLoading={isLoading}
                  error={analysisError}
                  originalMessage={analyzedMessage}
                  largePrint={largePrint}
                  trustedContact={trustedContact}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onClearAndReset={handleClearAll}
                  onInspectUrl={(url, inspection, level = "YELLOW", reason = "Check this link carefully before opening.") =>
                    setInterceptedLink({
                      url,
                      inspection,
                      alertLevel: level,
                      reason,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "liveshield" && (
          <LiveShieldTab
            largePrint={largePrint}
            monitoringEnabled={monitoringEnabled}
            onToggleMonitoring={setMonitoringEnabled}
            voiceAlertsEnabled={voiceAlertsEnabled}
            onToggleVoiceAlerts={setVoiceAlertsEnabled}
            notificationPermission={notificationPermission}
            onRequestNotifications={handleRequestNotifications}
            wsConnected={wsConnected}
            alerts={liveAlerts}
            onSelectAlert={(alert) => setActiveAlertOverlay(alert)}
            onInspectUrl={(url, inspection) =>
              setInterceptedLink({
                url,
                inspection,
                alertLevel:
                  inspection?.reputationVerdict === "MALICIOUS"
                    ? "RED"
                    : inspection?.reputationVerdict === "CLEAN"
                      ? "GREEN"
                      : "YELLOW",
                reason:
                  inspection?.suspiciousFlags[0] ||
                  "ElderGuard checked this link before opening.",
              })
            }
            onClearAlerts={handleClearAlerts}
            gmailUser={gmailUser}
            gmailTokenReady={gmailTokenReady}
            gmailAutoPoll={gmailAutoPoll}
            onToggleGmailAutoPoll={setGmailAutoPoll}
            gmailScanning={gmailScanning}
            gmailStatus={gmailStatus}
            gmailError={gmailError}
            onGmailSignIn={handleGmailSignIn}
            onGmailScanNow={handleGmailScanNow}
            onGmailSignOut={handleGmailSignOut}
            onSimulateIncoming={handleSimulateIncoming}
          />
        )}

        {activeTab === "kinship" && <KinshipShieldTab largePrint={largePrint} />}

        {activeTab === "safechat" && (
          <SafeChatTab
            largePrint={largePrint}
            onScanMessage={handleTriggerSampleOrChat}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        unreadAlertsCount={unreadAlertsCount}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        largePrint={largePrint}
        onToggleLargePrint={setLargePrint}
        trustedContact={trustedContact}
        onSaveTrustedContact={setTrustedContact}
      />

      <AlertOverlayModal
        alert={activeAlertOverlay}
        largePrint={largePrint}
        onDismiss={() => void handleDismissAlertOverlay()}
        onInspectUrl={(url, inspection) => {
          const level = activeAlertOverlay?.alertLevel ?? "RED";
          const reason =
            activeAlertOverlay?.analysis.summary ||
            "This link may be dangerous. Do not open unless you trust the sender.";
          setInterceptedLink({
            url,
            inspection,
            alertLevel: level,
            reason,
          });
        }}
        onEscalateToFamily={(alert) => {
          setActiveAlertOverlay(null);
          setActiveTab("scanner");
          setMessageText(alert.fullMessage);
          setAnalyzedMessage(alert.fullMessage);
          setResult(alert.analysis);
        }}
      />

      <LinkInterceptorModal
        isOpen={Boolean(interceptedLink)}
        url={interceptedLink?.url ?? ""}
        alertLevel={interceptedLink?.alertLevel ?? "RED"}
        reason={interceptedLink?.reason ?? ""}
        inspection={interceptedLink?.inspection}
        largePrint={largePrint}
        onGoBack={() => setInterceptedLink(null)}
      />
    </div>
  );
}
