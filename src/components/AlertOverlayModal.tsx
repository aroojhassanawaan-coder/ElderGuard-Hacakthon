import { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  Square,
  Lock,
  ArrowLeft,
  Users,
  X,
} from "lucide-react";
import type { LiveAlertItem, UrlInspectionDetail } from "../types/scam";
import { triggerHaptic } from "../utils/haptics";

interface AlertOverlayModalProps {
  alert: LiveAlertItem | null;
  largePrint: boolean;
  onDismiss: () => void;
  onInspectUrl: (url: string, inspection?: UrlInspectionDetail) => void;
  onEscalateToFamily: (alert: LiveAlertItem) => void;
}

export function AlertOverlayModal({
  alert,
  largePrint,
  onDismiss,
  onInspectUrl,
  onEscalateToFamily,
}: AlertOverlayModalProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [alert?.id]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!alert) return null;

  const isRed = alert.alertLevel === "RED";
  const isYellow = alert.alertLevel === "YELLOW";
  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const handleToggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    triggerHaptic(20);
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const spoken =
      alert.analysis.SPEECH_SUMMARY ||
      `${alert.alertHeadline} ${alert.alertBannerText} ${alert.analysis.summary}`;
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.rate = 0.88;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleClose = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    triggerHaptic(20);
    onDismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="realtime-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/85 p-4"
    >
      <div
        className={`w-full max-w-xl bg-white rounded-3xl border-4 p-6 sm:p-8 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto ${
          isRed
            ? "border-red-700"
            : isYellow
              ? "border-amber-600"
              : "border-emerald-700"
        }`}
      >
        {/* Top Banner */}
        <div
          className={`p-5 rounded-2xl border-2 space-y-2 ${
            isRed
              ? "bg-red-700 border-red-900 text-white"
              : isYellow
                ? "bg-amber-100 border-amber-600 text-[#10243E]"
                : "bg-emerald-50 border-emerald-600 text-[#10243E]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {isRed ? (
                <ShieldAlert className="w-10 h-10 shrink-0 text-white" aria-hidden="true" />
              ) : isYellow ? (
                <AlertTriangle className="w-10 h-10 shrink-0 text-amber-800" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-10 h-10 shrink-0 text-emerald-800" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wider">
                  New {alert.source} Message Checked
                </p>
                <h2
                  id="realtime-alert-title"
                  className="font-display text-2xl sm:text-[28px] leading-tight font-extrabold"
                >
                  {isRed
                    ? "RED ALERT. POSSIBLE SCAM!"
                    : isYellow
                      ? "YELLOW WARNING. BE CAREFUL."
                      : "GREEN. SAFE FOR NOW."}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close warning popup"
              className="min-h-[56px] min-w-[56px] flex items-center justify-center bg-white text-[#10243E] border-2 border-[#10243E] hover:bg-slate-100 rounded-2xl tactile-press cursor-pointer shrink-0"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <p className="text-lg sm:text-xl font-extrabold pt-1">
            {alert.alertBannerText}
          </p>
        </div>

        {/* Sender & Subject */}
        <div className="p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl space-y-1.5 text-[#10243E]">
          <p className="text-base font-extrabold">
            From: <span className="font-bold">{alert.sender}</span>
          </p>
          {alert.subject && (
            <p className="text-base font-extrabold">
              Subject: <span className="font-bold">{alert.subject}</span>
            </p>
          )}
          <p className="text-base text-[#10243E] pt-1">
            &ldquo;{alert.messagePreview}&rdquo;
          </p>
        </div>

        {/* Physical Doorstep & Courier Fraud Callout */}
        {alert.analysis.isDoorstepCourierScam && (
          <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-700 rounded-2xl space-y-2.5">
            <p className="font-display text-xl font-extrabold text-red-950">
              SEVERE PHYSICAL SAFETY &amp; DOORSTEP COURIER SCAM
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.doorstepCourierStatement ??
                "No legitimate bank, police department, or tech company ever sends a courier to pick up cash or cards from your home."}
            </p>
            <div className="p-3.5 bg-red-900 text-white rounded-xl">
              <p className={`${bodySize} font-extrabold`}>
                {alert.analysis.doorstepCourierAction ??
                  "Lock your door, refuse entry, and call family or local law enforcement immediately."}
              </p>
            </div>
          </div>
        )}

        {/* Remote Access / Safe Account Critical Callout */}
        {alert.analysis.isRemoteSafeAccountScam && (
          <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-700 rounded-2xl space-y-3">
            <p className="font-display text-xl font-extrabold text-red-950">
              CRITICAL: Phantom Hacker / Virtual Bank Scam
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.remoteSafeAccountExplanation ??
                "Real banks never ask you to install remote control software or transfer money to a safe account."}
            </p>
            <div className="p-3.5 bg-red-900 text-white rounded-xl">
              <p className={`${bodySize} font-extrabold`}>
                {alert.analysis.remoteSafeAccountInstruction ??
                  "Close the app, hang up immediately, and call the phone number printed on the back of your credit card."}
              </p>
            </div>
          </div>
        )}

        {/* Inheritance & Sweepstakes Advance-Fee Callout */}
        {alert.analysis.isInheritanceSweepstakesScam && (
          <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-700 rounded-2xl space-y-2.5">
            <p className="font-display text-xl font-extrabold text-red-950">
              ADVANCE-FEE INHERITANCE &amp; SWEEPSTAKES SCAM
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.inheritanceGoldenRule ??
                "You never have to pay money (taxes, fees, or shipping) to collect a legitimate prize or inheritance."}
            </p>
            <div className="p-3.5 bg-red-900 text-white rounded-xl">
              <p className={`${bodySize} font-extrabold`}>
                {alert.analysis.advanceFeeWarning ??
                  "This is an Advance-Fee Scam. Once you pay the fake fee, the scammers disappear."}
              </p>
            </div>
          </div>
        )}

        {/* Predatory Subscription & Micro-Fee Callout */}
        {alert.analysis.isPredatorySubscriptionScam && (
          <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-700 rounded-2xl space-y-2.5">
            <p className="font-display text-xl font-extrabold text-[#10243E]">
              PREDATORY SUBSCRIPTION &amp; MICRO-FEE AUDITOR
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.subscriptionMerchantNote ??
                "This charge shows signs of predatory negative option billing. Dispute unwanted charges using the number on the back of your bank card."}
            </p>
          </div>
        )}

        {/* Crypto ATM / Gift Card / Wire Financial Laundering Callout */}
        {alert.analysis.isCryptoGiftCardScam && (
          <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-700 rounded-2xl space-y-2.5">
            <p className="font-display text-xl font-extrabold text-red-950">
              HIGH-RISK PAYMENT RAIL &amp; LAUNDERING TACTIC
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.cryptoGiftCardStatement ??
                "No legitimate business, utility company, court, or government agency ever accepts payment via gift cards or Bitcoin ATMs."}
            </p>
            <p className="text-base font-bold text-[#10243E]">
              Legitimate institutions never ask you to move money to a safe account or pay via crypto/gift cards.
            </p>
          </div>
        )}

        {/* Module 4: Long-Con Romance & Recovery Scam Callout */}
        {(alert.analysis.isRomanceInvestmentScam || alert.analysis.isRecoveryScam) && (
          <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-700 rounded-2xl space-y-2.5">
            <p className="font-display text-xl font-extrabold text-red-950">
              {alert.analysis.isRecoveryScam
                ? "SECONDARY EXPLOITATION WARNING — RECOVERY SCAM"
                : "LONG-CON ROMANCE & FAKE INVESTMENT WARNING"}
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {alert.analysis.secondaryExploitationWarning ??
                (alert.analysis.isRecoveryScam
                  ? "Real fraud helpers never charge an upfront fee to get lost money back. Scammers often return pretending to rescue you."
                  : "Never send money or crypto to someone you only met online. Warm friendship mixed with secret investing is a classic long con.")}
            </p>
            {alert.analysis.longConRedFlags && alert.analysis.longConRedFlags.length > 0 && (
              <ul className="space-y-1.5 text-base font-bold text-[#10243E] pt-1">
                {alert.analysis.longConRedFlags.map((flag, idx) => (
                  <li key={idx}>• {flag}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Plain English Explanation */}
        <div className="space-y-3">
          {isRed &&
            !alert.analysis.isDoorstepCourierScam &&
            !alert.analysis.isRemoteSafeAccountScam &&
            !alert.analysis.isInheritanceSweepstakesScam &&
            !alert.analysis.isPredatorySubscriptionScam &&
            !alert.analysis.isCryptoGiftCardScam &&
            !alert.analysis.isRomanceInvestmentScam &&
            !alert.analysis.isRecoveryScam && (
              <p className={`${bodySize} font-extrabold text-red-950`}>
                This message may be fraudulent. Do not click this link. It could steal your personal information or banking details.
              </p>
            )}
          <p className={`${bodySize} font-bold text-black`}>
            {alert.analysis.summary}
          </p>
          {alert.analysis.reasons.length > 0 && (
            <ul className={`space-y-2 text-[#10243E] ${bodySize}`}>
              {alert.analysis.reasons.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-extrabold">{idx + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Suspicious Attachments */}
        {alert.attachments && alert.attachments.some((a) => a.isSuspicious) && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl space-y-2">
            <p className="text-lg font-extrabold text-red-950">
              Dangerous Email Attachment Found
            </p>
            {alert.attachments
              .filter((a) => a.isSuspicious)
              .map((att, idx) => (
                <p key={idx} className="text-base font-bold text-[#10243E]">
                  • {att.filename}: {att.reason}
                </p>
              ))}
          </div>
        )}

        {/* Detected Links Protected Behind Interceptor */}
        {(alert.urlInspections.length > 0 || (alert.analysis.detectedUrls?.length ?? 0) > 0) && (
          <div className="p-4 bg-red-50 border-2 border-red-400 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-red-950">
              <Lock className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Links Found (Protected Before Opening)</span>
            </div>
            {(alert.urlInspections.length > 0
              ? alert.urlInspections
              : (alert.analysis.detectedUrls ?? []).map((u) => ({
                  url: u,
                  normalizedUrl: u,
                  usesHttps: u.startsWith("https://"),
                  hostname: u,
                  domainAgeDays: null,
                  domainCreatedDate: null,
                  redirectChain: [],
                  suspiciousFlags: [],
                  reputationVerdict: "UNKNOWN" as const,
                }))
            ).map((insp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  onInspectUrl(insp.url, insp);
                }}
                className="w-full min-h-[56px] p-3.5 bg-white border-2 border-red-400 hover:border-[#10243E] rounded-xl text-left flex items-center justify-between gap-3 tactile-press cursor-pointer"
              >
                <span className="text-base font-extrabold text-red-950 break-all">
                  {insp.url}
                </span>
                <span className="text-sm font-extrabold text-[#10243E] shrink-0 underline">
                  Inspect
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-sm font-bold text-[#10243E]">
          {alert.safetyDisclaimer}
        </p>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3.5 pt-1">
          {typeof window !== "undefined" && "speechSynthesis" in window && (
            <button
              type="button"
              onClick={handleToggleSpeech}
              className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-bold text-[#10243E] bg-[#EEF2F5] border-2 border-[#10243E] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
            >
              {isSpeaking ? (
                <>
                  <Square className="w-6 h-6 shrink-0" aria-hidden="true" />
                  Stop Reading Aloud
                </>
              ) : (
                <>
                  <Volume2 className="w-6 h-6 shrink-0" aria-hidden="true" />
                  Read Warning Out Loud
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic(25);
              onEscalateToFamily(alert);
            }}
            className="w-full min-h-[60px] px-5 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press cursor-pointer"
          >
            <Users className="w-6 h-6 shrink-0" aria-hidden="true" />
            Ask My Family Member About This
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[62px] px-5 py-4 inline-flex items-center justify-center gap-3 text-xl font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
            Go Back &amp; Stay Safe
          </button>
        </div>
      </div>
    </div>
  );
}
