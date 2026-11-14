import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Volume2,
  Square,
  Lock,
  Users,
  PhoneCall,
  Copy,
  Check,
  X,
  RotateCcw,
  Landmark,
  MonitorOff,
  Banknote,
  MessageSquare,
  HeartHandshake,
  Home,
  CreditCard,
  Gift,
} from "lucide-react";
import type {
  SafetyVerdict,
  ScamAnalysisResult,
  TrustedContact,
  UrlInspectionDetail,
} from "../types/scam";
import { triggerHaptic } from "../utils/haptics";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

interface AnalysisReportProps {
  result: ScamAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  originalMessage: string;
  largePrint: boolean;
  trustedContact: TrustedContact;
  onOpenSettings: () => void;
  onClearAndReset: () => void;
  onInspectUrl?: (url: string, inspection?: UrlInspectionDetail, alertLevel?: "RED" | "YELLOW" | "GREEN", reason?: string) => void;
}

function getVerdictBanner(verdict: SafetyVerdict) {
  switch (verdict) {
    case "Safe":
      return {
        headline: "SAFE TO PROCEED.",
        sublabel: "No scam warning signs found.",
        containerClass: "bg-emerald-50 border-emerald-500 text-[#10243E]",
        headlineClass: "text-emerald-950",
        meterClass: "bg-emerald-700",
        Icon: CheckCircle2,
      };
    case "Caution":
      return {
        headline: "PAUSE. Check carefully.",
        sublabel: "Please check before replying.",
        containerClass: "bg-amber-50 border-amber-500 text-[#10243E]",
        headlineClass: "text-amber-950",
        meterClass: "bg-amber-600",
        Icon: AlertTriangle,
      };
    case "Danger":
      return {
        headline: "STOP. Likely scam.",
        sublabel: "Do not tap links or send money.",
        containerClass: "bg-red-50 border-red-500 text-[#10243E]",
        headlineClass: "text-red-950",
        meterClass: "bg-red-700",
        Icon: ShieldAlert,
      };
  }
}

export function AnalysisReport({
  result,
  isLoading,
  error,
  originalMessage,
  largePrint,
  trustedContact,
  onOpenSettings,
  onClearAndReset,
  onInspectUrl,
}: AnalysisReportProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showOfficialModal, setShowOfficialModal] = useState(false);
  const [showRemoteExitSteps, setShowRemoteExitSteps] = useState(false);
  const [checkedHaltSteps, setCheckedHaltSteps] = useState<number[]>([]);
  const [smsTemplateDraft, setSmsTemplateDraft] = useState("");
  const [copiedAlert, setCopiedAlert] = useState(false);

  useEffect(() => {
    setShowFamilyModal(false);
    setShowOfficialModal(false);
    setShowRemoteExitSteps(false);
    setCheckedHaltSteps([]);
    setSmsTemplateDraft("");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [result]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const handleToggleSpeech = () => {
    if (!result || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    triggerHaptic(20);

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const banner = getVerdictBanner(result.verdict);
    const spoken =
      result.SPEECH_SUMMARY?.trim() ||
      [
        result.verdict !== "Safe"
          ? "Take a deep breath. You are in control."
          : "Good news.",
        `${banner.headline}`,
        result.summary,
      ].join(" ");

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.rate = 0.88;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-8 space-y-6 h-full"
      >
        <div className="space-y-4 animate-pulse">
          <div className="h-24 w-full bg-[#EEF2F5] rounded-2xl" />
          <div className="h-6 w-52 bg-slate-200 rounded" />
          <div className="h-5 w-full bg-slate-200 rounded" />
          <div className="h-5 w-5/6 bg-slate-200 rounded" />
        </div>
        <p className={`${bodySize} text-[#10243E] font-bold`}>
          Checking this message calmly for you...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        role="alert"
        className="bg-white border-2 border-red-400 rounded-3xl p-6 sm:p-8 space-y-4 h-full"
      >
        <div className="flex items-center gap-3 text-red-950">
          <ShieldAlert className="w-8 h-8 shrink-0" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold">
            Could Not Finish Checking
          </h2>
        </div>
        <p className={`${bodySize} text-[#10243E]`}>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 h-full">
        <div className="space-y-5">
          <h2 className="font-display text-[26px] leading-snug font-bold text-[#10243E]">
            Your Clear Answer Appears Here
          </h2>
          <p className={`${bodySize} text-[#10243E]`}>
            Paste any text, email, or picture of a message on the left, then tap the big blue button to check if it is safe.
          </p>
          <ul className={`space-y-4 text-[#10243E] pt-2 ${bodySize}`}>
            <li className="flex items-start gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-[#10243E] shrink-0 mt-1" aria-hidden="true" />
              <span>Big, unmistakable <strong>Safe</strong> or <strong>Stop</strong> sign</span>
            </li>
            <li className="flex items-start gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-[#10243E] shrink-0 mt-1" aria-hidden="true" />
              <span>Plain, everyday words with no confusing computer talk</span>
            </li>
            <li className="flex items-start gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-[#10243E] shrink-0 mt-1" aria-hidden="true" />
              <span>Locks unsafe links so trembling hands cannot tap them by mistake</span>
            </li>
          </ul>
        </div>
      </section>
    );
  }

  const banner = getVerdictBanner(result.verdict);
  const BannerIcon = banner.Icon;
  const detectedUrls = result.detectedUrls ?? [];
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const familyButtonLabel = trustedContact.name
    ? `Send this to ${trustedContact.name}`
    : "Send this to my daughter/son";

  const callHelperLabel = trustedContact.name
    ? `Call ${trustedContact.name}`
    : "Call my trusted helper";

  const personalizedTrustedAllyMessage = result.trustedAllyMessage
    ? result.trustedAllyMessage.replace(
        /\[Family Member\]/g,
        trustedContact.name?.trim() || "there"
      )
    : null;

  const buildTrustedAllySmsTemplate = () => {
    const contactGreeting = trustedContact.name?.trim()
      ? `Hi ${trustedContact.name.trim()},`
      : "Hi there,";
    const reasonLines =
      result.reasons.length > 0
        ? result.reasons.map((reason) => `- ${reason}`).join("\n")
        : `- ${result.summary}`;

    return [
      `${contactGreeting} I checked a message with ElderGuard and paused before taking any action.`,
      `Verdict: ${result.verdict.toUpperCase()} (${banner.headline} ${result.scamType}, Risk score: ${result.riskScore}/100)`,
      `Key risk reasons:\n${reasonLines}`,
      personalizedTrustedAllyMessage ||
        "Everything is okay—I did not send money or tap any links. Could we look at this together as a quick second pair of eyes?",
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const alertMessageText = personalizedTrustedAllyMessage
    ? personalizedTrustedAllyMessage
    : [
        `Hi${trustedContact.name ? ` ${trustedContact.name}` : ""}, I checked a message with ElderGuard.`,
        `Result: ${banner.headline} (Risk score: ${result.riskScore} out of 100).`,
        `What it says: ${result.summary}`,
        originalMessage ? `Message I received: "${originalMessage.slice(0, 220)}"` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

  const activeSmsBody = smsTemplateDraft || buildTrustedAllySmsTemplate();

  const handleOpenTrustedAllyShare = () => {
    triggerHaptic([25, 20, 25]);
    setSmsTemplateDraft(buildTrustedAllySmsTemplate());
    setShowFamilyModal(true);
  };

  const handleCopyAlert = async (textToCopy = alertMessageText) => {
    triggerHaptic(25);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedAlert(true);
      setTimeout(() => setCopiedAlert(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <section
      aria-live="polite"
      className="bg-white border-2 border-[#C8D3E0] rounded-3xl p-5 sm:p-8 space-y-6 h-full"
    >
      {/* Calm Down First Screen Banner */}
      {result.verdict !== "Safe" && (
        <div className="bg-[#EEF2F5] border-2 border-[#10243E] rounded-2xl p-5 space-y-2">
          <p className="font-display text-xl sm:text-2xl font-extrabold text-[#10243E]">
            {(result.isDoorstepCourierScam ||
              result.isRemoteSafeAccountScam ||
              result.isInheritanceSweepstakesScam ||
              result.isPredatorySubscriptionScam ||
              result.isCryptoGiftCardScam ||
              result.isRomanceInvestmentScam ||
              result.isRecoveryScam ||
              result.isAuthorityScam) &&
            result.psychologicalAnchor
              ? result.psychologicalAnchor
              : "Take a deep breath. You are in control."}
          </p>
          {!result.isDoorstepCourierScam &&
            !result.isAuthorityScam &&
            !result.isRemoteSafeAccountScam &&
            !result.isInheritanceSweepstakesScam &&
            !result.isPredatorySubscriptionScam &&
            !result.isCryptoGiftCardScam &&
            !result.isRomanceInvestmentScam &&
            !result.isRecoveryScam && (
              <p className={`${bodySize} text-[#10243E]`}>
                Nothing bad has happened just from reading this message. Take your time and follow the calm steps below.
              </p>
            )}
        </div>
      )}

      {/* Verdict Banner + Score Meter */}
      <div className={`border-2 rounded-3xl p-5 sm:p-6 space-y-5 ${banner.containerClass}`}>
        <div className="flex items-start gap-4">
          <BannerIcon
            className={`w-10 h-10 shrink-0 mt-0.5 ${banner.headlineClass}`}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2
              className={`font-display text-[26px] sm:text-[30px] leading-tight font-extrabold tracking-tight ${banner.headlineClass}`}
            >
              {banner.headline}
            </h2>
            <p className="text-lg font-bold text-[#10243E]">
              {banner.sublabel} {result.scamType}.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-lg font-bold text-[#10243E]">
            <span>Danger Meter</span>
            <span className="text-xl font-extrabold tabular-nums">
              {result.riskScore} out of 100
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={result.riskScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Danger meter score"
            className="w-full h-5 bg-white border-2 border-[#9FB0C4] rounded-full overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 ${banner.meterClass}`}
              style={{ width: `${Math.max(5, result.riskScore)}%` }}
            />
          </div>
        </div>

        {canSpeak && (
          <button
            type="button"
            onClick={handleToggleSpeech}
            className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-bold text-[#10243E] bg-white border-2 border-[#10243E] hover:bg-slate-100 rounded-2xl tactile-press cursor-pointer"
          >
            {isSpeaking ? (
              <>
                <Square className="w-6 h-6 shrink-0" aria-hidden="true" />
                Stop Reading Aloud
              </>
            ) : (
              <>
                <Volume2 className="w-6 h-6 shrink-0" aria-hidden="true" />
                Read This Out Loud to Me
              </>
            )}
          </button>
        )}
      </div>

      {/* Plain Language Summary & Spoken Audio Script */}
      <div className="space-y-4">
        <p className={`${bodySize} text-black font-bold`}>{result.summary}</p>
        {result.safetyDisclaimer && (
          <p className="text-base font-bold text-[#10243E]">
            {result.safetyDisclaimer}
          </p>
        )}
        {result.SPEECH_SUMMARY && (
          <div className="p-4 sm:p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl space-y-1.5">
            <p className="text-base font-extrabold text-[#10243E] flex items-center gap-2">
              <Volume2 className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Calm Voice Summary</span>
            </p>
            <p className={`${bodySize} text-[#10243E]`}>{result.SPEECH_SUMMARY}</p>
          </div>
        )}
      </div>

      {/* Physical Doorstep & Courier Fraud Detector */}
      {result.isDoorstepCourierScam && (
        <div className="bg-red-50 border-2 border-red-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <Home className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
                Severe Physical Safety &amp; Financial Scam
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                Doorstep Courier &amp; In-Home Visit Warning
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-red-400 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
              Unbreakable Safety Fact
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.doorstepCourierStatement ??
                "No legitimate bank, police department, or tech company ever sends a courier to pick up cash or cards from your home."}
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-red-900 border-2 border-red-950 rounded-2xl space-y-2 text-white">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-100">
              Immediate Action for Your Safety
            </p>
            <p className={`${bodySize} font-extrabold text-white`}>
              {result.doorstepCourierAction ??
                "Lock your door, refuse entry to anyone asking for cash, gold, cards, or home computer access, and call a family member or local law enforcement immediately."}
            </p>
          </div>

          <a
            href="tel:911"
            onClick={() => triggerHaptic([45, 30, 45])}
            className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-lg sm:text-xl font-extrabold text-white bg-red-800 hover:bg-red-900 border-2 border-red-950 rounded-2xl shadow-md tactile-press"
          >
            <PhoneCall className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Lock Door &amp; Call Emergency Services (911)</span>
          </a>
        </div>
      )}

      {/* Module 5: Remote Access & Safe Account Fraud Detector */}
      {result.isRemoteSafeAccountScam && (
        <div className="bg-red-50 border-2 border-red-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <MonitorOff className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
                Critical Scam Flag
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                Phantom Hacker / Virtual Bank Scam
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-red-400 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
              Why This Is Always a Scam
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.remoteSafeAccountExplanation ??
                "Real banks never ask you to install remote control software or transfer money to a safe account."}
            </p>
            <p className="text-base font-bold text-[#10243E] pt-1">
              Legitimate institutions never ask you to move money to a safe account or pay via crypto/gift cards.
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-red-900 border-2 border-red-950 rounded-2xl space-y-2 text-white">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-100">
              Strict Safety Instruction
            </p>
            <p className={`${bodySize} font-extrabold text-white`}>
              {result.remoteSafeAccountInstruction ??
                "Close the app, hang up immediately, and call the phone number printed on the back of your credit card."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(25);
              setShowRemoteExitSteps((prev) => !prev);
            }}
            aria-expanded={showRemoteExitSteps}
            className="w-full min-h-[60px] px-5 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-[#10243E] bg-white border-2 border-[#10243E] hover:bg-slate-100 rounded-2xl tactile-press cursor-pointer"
          >
            <MonitorOff className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>
              {showRemoteExitSteps
                ? "Hide Safe Exit Steps"
                : "How to Close Screen-Sharing Safely"}
            </span>
          </button>

          {showRemoteExitSteps && (
            <ol className={`space-y-3 p-4 bg-white border-2 border-[#C8D3E0] rounded-2xl text-[#10243E] font-bold ${bodySize}`}>
              <li>1. Close AnyDesk, TeamViewer, or QuickSupport right now, or turn off your Wi-Fi.</li>
              <li>2. Hang up the call. Do not stay on the line even if they sound angry or urgent.</li>
              <li>3. Flip over your physical credit or debit card and call only the number printed on the back.</li>
            </ol>
          )}
        </div>
      )}

      {/* Module 3: Fintech & Payment Rail Security Auditor (Crypto ATM, Gift Cards, Wire Transfers & Cash Couriers) */}
      {result.isCryptoGiftCardScam && (
        <div className="bg-red-50 border-2 border-red-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <Banknote className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
                High-Risk Payment Rail &amp; Laundering Tactic
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                Blocked Payment Method: Gift Cards, Crypto ATM, Wire Transfer or Cash Courier
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-red-400 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
              Important Fact
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.cryptoGiftCardStatement ??
                "No legitimate business, utility company, court, or government agency ever accepts payment via gift cards or Bitcoin ATMs."}
            </p>
            <p className="text-base font-bold text-[#10243E] pt-1">
              Legitimate institutions never ask you to move money to a safe account or pay via crypto/gift cards.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-display text-xl font-extrabold text-[#10243E]">
              Simple Checklist to Stop Before Losing Cash
            </h4>
            <div className="space-y-3">
              {(result.haltTransactionChecklist ?? []).map((step, idx) => {
                const isChecked = checkedHaltSteps.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => {
                      triggerHaptic(22);
                      setCheckedHaltSteps((prev) =>
                        prev.includes(idx)
                          ? prev.filter((item) => item !== idx)
                          : [...prev, idx]
                      );
                    }}
                    className={`w-full min-h-[58px] p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 tactile-press cursor-pointer ${
                      isChecked
                        ? "bg-emerald-50 border-emerald-700 text-emerald-950"
                        : "bg-white border-red-400 hover:border-[#10243E] text-[#10243E]"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        isChecked
                          ? "bg-emerald-700 border-emerald-800 text-white"
                          : "bg-white border-[#10243E] text-transparent"
                      }`}
                    >
                      <Check className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className={`${bodySize} font-bold`}>{step}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Module 4: Long-Con Romance & Recovery Scam Detector */}
      {(result.isRomanceInvestmentScam || result.isRecoveryScam) && (
        <div className="bg-red-50 border-2 border-red-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <HeartHandshake className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
                {result.isRecoveryScam && result.isRomanceInvestmentScam
                  ? "SECONDARY EXPLOITATION & LONG-CON SCAM WARNING"
                  : result.isRecoveryScam
                    ? "SECONDARY EXPLOITATION WARNING — RECOVERY SCAM"
                    : "LONG-CON ROMANCE & FAKE INVESTMENT WARNING"}
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                {result.isRecoveryScam
                  ? "Warning Against Secondary Exploitation"
                  : "Online Friend &amp; Fake Investment Warning"}
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-red-500 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
              Protect Yourself Gently
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.secondaryExploitationWarning ??
                (result.isRecoveryScam
                  ? "Real fraud helpers never charge an upfront fee to get lost money back. Scammers often come back pretending to rescue you."
                  : "Never send money or crypto to someone you only met online. Warm friendship mixed with secret investing is a classic long con.")}
            </p>
          </div>

          {result.longConRedFlags && result.longConRedFlags.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-display text-xl font-extrabold text-[#10243E]">
                Clear Signs to Watch Out For
              </h4>
              <ul className="space-y-2.5">
                {result.longConRedFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className={`p-3.5 bg-white border-2 border-red-400 rounded-2xl text-[#10243E] font-bold flex items-start gap-3 ${bodySize}`}
                  >
                    <span className="font-display font-extrabold text-red-900 shrink-0 tabular-nums">
                      {idx + 1}.
                    </span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Predatory Subscription & Micro-Fee Auditor */}
      {result.isPredatorySubscriptionScam && (
        <div className="bg-amber-50 border-2 border-amber-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <CreditCard className="w-8 h-8 text-amber-950 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-amber-950">
                Predatory Subscription &amp; Micro-Fee Auditor
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-[#10243E]">
                Merchant &amp; Recurring Billing Check
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-amber-500 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-amber-950">
              Merchant Analysis
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.subscriptionMerchantNote ??
                "This charge shows signs of predatory negative option billing. Never call the phone number printed on an unexpected receipt."}
            </p>
          </div>

          {result.subscriptionCancellationRoadmap &&
            result.subscriptionCancellationRoadmap.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-display text-xl font-extrabold text-[#10243E]">
                  Simple Cancellation &amp; Bank Dispute Roadmap
                </h4>
                <ol className="space-y-2.5">
                  {result.subscriptionCancellationRoadmap.map((step, idx) => (
                    <li
                      key={idx}
                      className={`p-3.5 bg-white border-2 border-[#C8D3E0] rounded-2xl text-[#10243E] font-bold flex items-start gap-3 ${bodySize}`}
                    >
                      <span className="font-display font-extrabold text-[#10243E] shrink-0 tabular-nums">
                        {idx + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
        </div>
      )}

      {/* Inheritance & Sweepstakes Tax Scam Detector */}
      {result.isInheritanceSweepstakesScam && (
        <div className="bg-red-50 border-2 border-red-700 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <Gift className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
                Advance-Fee Fraud Detector
              </p>
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                Inheritance, Lottery &amp; Sweepstakes Tax Scam
              </h3>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white border-2 border-red-400 rounded-2xl space-y-2">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-900">
              The Golden Rule of Fraud
            </p>
            <p className={`${bodySize} font-bold text-[#10243E]`}>
              {result.inheritanceGoldenRule ??
                "You never have to pay money (taxes, fees, or shipping) to collect a legitimate prize or inheritance."}
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-red-900 border-2 border-red-950 rounded-2xl space-y-2 text-white">
            <p className="text-sm font-extrabold uppercase tracking-wider text-red-100">
              Stark Warning
            </p>
            <p className={`${bodySize} font-extrabold text-white`}>
              {result.advanceFeeWarning ??
                "This is an Advance-Fee Scam. Once you pay the fake fee, the scammers disappear."}
            </p>
          </div>
        </div>
      )}

      {/* Module 3: Digital Arrest & Authority Impersonation Defender */}
      {result.isAuthorityScam && (
        <div className="bg-red-50 border-2 border-red-600 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <Landmark className="w-8 h-8 text-red-900 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="font-display text-[22px] sm:text-[24px] leading-snug font-extrabold text-red-950">
                2 Unbreakable Rules of Real Government Agencies
              </h3>
              <p className="text-base font-bold text-[#10243E]">
                Anyone breaking these rules on the phone is a scammer, no matter what badge or title they claim:
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {(result.governmentRules ?? []).map((rule, idx) => (
              <div
                key={idx}
                className={`p-4 bg-white border-2 border-red-400 rounded-2xl text-[#10243E] font-bold flex items-start gap-3.5 ${bodySize}`}
              >
                <span className="font-display font-extrabold text-red-900 shrink-0 tabular-nums">
                  Rule {idx + 1}:
                </span>
                <span>{rule}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic([45, 30, 45]);
              setShowOfficialModal(true);
            }}
            className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-lg sm:text-xl font-extrabold text-white bg-red-800 hover:bg-red-900 border-2 border-red-950 rounded-2xl shadow-md tactile-press cursor-pointer"
          >
            <PhoneCall className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Hang Up Now &amp; Call Official Number</span>
          </button>
        </div>
      )}

      {/* Locked Web Addresses */}
      {detectedUrls.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-3 text-red-950 font-display font-extrabold text-xl">
            <Lock className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Unsafe Web Link Locked</span>
          </div>
          <p className={`${bodySize} text-[#10243E]`}>
            This website is locked so your finger cannot open it by accident. Tap to inspect details safely.
          </p>
          <div className="space-y-3">
            {detectedUrls.map((url, idx) => {
              const inspection = result.urlInspections?.find((u) => u.url === url);
              const level =
                result.alertLevel ??
                (result.verdict === "Danger"
                  ? "RED"
                  : result.verdict === "Caution"
                    ? "YELLOW"
                    : "GREEN");
              return onInspectUrl ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic(22);
                    onInspectUrl(url, inspection, level, result.summary);
                  }}
                  className="w-full min-h-[58px] flex items-center justify-between gap-3 px-4 py-4 bg-white border-2 border-red-400 hover:border-[#10243E] rounded-2xl text-left text-base sm:text-lg font-bold text-red-950 break-all tactile-press cursor-pointer"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Lock className="w-5 h-5 shrink-0 text-red-800" aria-hidden="true" />
                    <span className="truncate">{url}</span>
                  </span>
                  <span className="text-base font-extrabold text-[#10243E] shrink-0 underline">
                    Inspect
                  </span>
                </button>
              ) : (
                <div
                  key={idx}
                  aria-disabled="true"
                  className="select-none pointer-events-none flex items-center gap-3 px-4 py-4 bg-white border-2 border-red-400 rounded-2xl text-base sm:text-lg font-bold text-red-950 break-all"
                >
                  <Lock className="w-5 h-5 shrink-0 text-red-800" aria-hidden="true" />
                  <span>{url}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plain-Language Reasons */}
      <div className="space-y-4 border-t-2 border-[#DCE4EE] pt-6">
        <h3 className="font-display text-[22px] font-bold text-[#10243E]">
          {result.verdict === "Safe" ? "Why This Looks Safe" : "Why This Is Risky"}
        </h3>
        <ul className="space-y-3.5">
          {result.reasons.map((reason, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-3.5 text-[#10243E] ${bodySize}`}
            >
              <span className="font-display font-extrabold text-[#10243E] tabular-nums shrink-0">
                {idx + 1}.
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What to Do Next */}
      <div className="space-y-4 border-t-2 border-[#DCE4EE] pt-6">
        <h3 className="font-display text-[22px] font-bold text-[#10243E]">
          Safe Steps to Take
        </h3>
        <div className="space-y-3.5">
          {result.safeCTAs.map((step, idx) => (
            <div
              key={idx}
              className={`p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl text-[#10243E] font-bold ${bodySize}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      {/* Module 7: Trusted Ally & Family Escalation Generator */}
      <div className="space-y-4 border-t-2 border-[#DCE4EE] pt-6">
        <h3 className="font-display text-[22px] font-bold text-[#10243E]">
          Want a Trusted Family Member as a Second Pair of Eyes?
        </h3>

        {personalizedTrustedAllyMessage && (
          <div className="p-4 sm:p-5 bg-[#EEF2F5] border-2 border-[#9FB0C4] rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-[#10243E]">
              <MessageSquare className="w-5 h-5 shrink-0" aria-hidden="true" />
              <p className="font-display text-lg font-extrabold">
                Calm Text Message Ready to Share
              </p>
            </div>
            <p className={`${bodySize} text-[#10243E] bg-white border-2 border-[#C8D3E0] rounded-2xl p-4`}>
              {personalizedTrustedAllyMessage}
            </p>
            <button
              type="button"
              onClick={() => void handleCopyAlert()}
              className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-[#10243E] bg-white border-2 border-[#10243E] hover:bg-slate-100 rounded-2xl tactile-press cursor-pointer"
            >
              {copiedAlert ? (
                <>
                  <Check className="w-6 h-6 text-emerald-800" aria-hidden="true" />
                  Calm Message Copied!
                </>
              ) : (
                <>
                  <Copy className="w-6 h-6" aria-hidden="true" />
                  Copy Calm Message for Family
                </>
              )}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            onClick={handleOpenTrustedAllyShare}
            className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-lg sm:text-xl font-extrabold text-white bg-blue-800 hover:bg-blue-900 border-2 border-blue-950 rounded-2xl shadow-md tactile-press cursor-pointer"
          >
            <Users className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>Share with Trusted Ally</span>
          </button>

          {trustedContact.phone ? (
            <a
              href={`tel:${trustedContact.phone}`}
              onClick={() => triggerHaptic(25)}
              className="w-full min-h-[60px] px-6 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-[#10243E] bg-[#EEF2F5] border-2 border-[#10243E] hover:bg-slate-200 rounded-2xl tactile-press"
            >
              <PhoneCall className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{callHelperLabel} ({trustedContact.phone})</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onOpenSettings();
              }}
              className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-bold text-[#10243E] bg-[#EEF2F5] border-2 border-[#9FB0C4] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
            >
              <PhoneCall className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{callHelperLabel}. Add Number</span>
            </button>
          )}
        </div>
      </div>

      {/* Tremor-Safe Reset Action */}
      <div className="border-t-2 border-[#DCE4EE] pt-5">
        <HoldToConfirmButton
          label="Clear & Check Another Message"
          confirmLabel="Tap again or keep holding to clear"
          onConfirm={onClearAndReset}
          icon={<RotateCcw className="w-5 h-5 shrink-0" aria-hidden="true" />}
          className="w-full"
        />
      </div>

      {/* Guided Family / Trusted Ally SMS Escalation Modal */}
      {showFamilyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="family-escalation-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/80 p-4"
        >
          <div className="w-full max-w-lg bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2
                  id="family-escalation-title"
                  className="font-display text-2xl font-extrabold text-[#10243E]"
                >
                  Share with Trusted Ally
                </h2>
                {trustedContact.name || trustedContact.phone ? (
                  <p className="text-base font-bold text-[#10243E]">
                    To: {trustedContact.name || "Trusted Ally"}
                    {trustedContact.phone ? ` (${trustedContact.phone})` : ""}
                  </p>
                ) : (
                  <p className="text-base font-bold text-amber-950">
                    No trusted contact saved yet. You can still copy or edit this text message.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setShowFamilyModal(false);
                }}
                aria-label="Close trusted ally message box"
                className="min-h-[56px] min-w-[56px] flex items-center justify-center text-[#10243E] bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="trusted-ally-sms-textarea"
                className={`${bodySize} font-bold text-[#10243E] block`}
              >
                Ready-to-send SMS text message with the verdict and risk reasons:
              </label>
              <textarea
                id="trusted-ally-sms-textarea"
                rows={7}
                value={activeSmsBody}
                onChange={(e) => setSmsTemplateDraft(e.target.value)}
                className="w-full p-4 bg-[#EEF2F5] border-2 border-[#9FB0C4] rounded-2xl text-base sm:text-lg text-[#10243E] leading-relaxed resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {trustedContact.phone && (
                <a
                  href={`sms:${encodeURIComponent(trustedContact.phone)}?body=${encodeURIComponent(activeSmsBody)}`}
                  onClick={() => triggerHaptic(25)}
                  className="w-full min-h-[60px] px-5 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press"
                >
                  <MessageSquare className="w-6 h-6 shrink-0" aria-hidden="true" />
                  <span>Open SMS to {trustedContact.name || trustedContact.phone}</span>
                </a>
              )}

              {trustedContact.email && (
                <a
                  href={`mailto:${encodeURIComponent(trustedContact.email)}?subject=${encodeURIComponent("Please check this message with me")}&body=${encodeURIComponent(activeSmsBody)}`}
                  onClick={() => triggerHaptic(25)}
                  className="w-full min-h-[60px] px-5 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press"
                >
                  Open Email to {trustedContact.name || "Trusted Ally"}
                </a>
              )}

              <button
                type="button"
                onClick={() => void handleCopyAlert(activeSmsBody)}
                className="w-full min-h-[60px] px-5 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-[#10243E] bg-[#EEF2F5] border-2 border-[#10243E] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
              >
                {copiedAlert ? (
                  <>
                    <Check className="w-6 h-6 text-emerald-800" aria-hidden="true" />
                    Copied! Ready to Paste
                  </>
                ) : (
                  <>
                    <Copy className="w-6 h-6" aria-hidden="true" />
                    Copy SMS Template
                  </>
                )}
              </button>

              {!trustedContact.phone && !trustedContact.email && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setShowFamilyModal(false);
                    onOpenSettings();
                  }}
                  className="w-full min-h-[58px] px-5 py-3.5 text-lg font-bold text-blue-900 bg-blue-50 border-2 border-blue-300 hover:bg-blue-100 rounded-2xl tactile-press cursor-pointer"
                >
                  Add Trusted Ally Phone Number
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Official Government & Agency Directory Modal */}
      {showOfficialModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="official-numbers-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/85 p-4"
        >
          <div className="w-full max-w-lg bg-white border-4 border-[#10243E] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2
                  id="official-numbers-title"
                  className="font-display text-2xl font-extrabold text-[#10243E]"
                >
                  Hang Up First. You Are Safe.
                </h2>
                <p className="text-base font-bold text-[#10243E]">
                  Never call back a number from caller ID or a text. Tap a real official number below if you want peace of mind:
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setShowOfficialModal(false);
                }}
                aria-label="Close official numbers"
                className="min-h-[56px] min-w-[56px] flex items-center justify-center text-[#10243E] bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              {result.officialAgencyHint && (
                <a
                  href={`tel:${result.officialAgencyHint.officialNumber}`}
                  onClick={() => triggerHaptic(25)}
                  className="block p-5 bg-blue-50 border-2 border-blue-800 hover:bg-blue-100 rounded-2xl space-y-1 tactile-press"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl font-extrabold text-[#10243E]">
                      {result.officialAgencyHint.agencyName}
                    </span>
                    <PhoneCall className="w-6 h-6 text-blue-900 shrink-0" aria-hidden="true" />
                  </div>
                  <p className="text-xl font-extrabold text-blue-900 tabular-nums">
                    Call {result.officialAgencyHint.officialNumber}
                  </p>
                  <p className="text-base text-[#10243E]">
                    {result.officialAgencyHint.note}
                  </p>
                </a>
              )}

              {[
                {
                  name: "National Elder Fraud Hotline",
                  number: "1-833-372-8311",
                  desc: "Free U.S. Department of Justice support for adults 50+",
                },
                {
                  name: "IRS Official Tax Helpline (US)",
                  number: "1-800-829-1040",
                  desc: "Official Internal Revenue Service line",
                },
                {
                  name: "Canada Revenue Agency (CRA)",
                  number: "1-800-959-8281",
                  desc: "Official CRA individual tax line",
                },
                {
                  name: "Social Security Administration",
                  number: "1-800-772-1213",
                  desc: "Official Social Security helpline",
                },
              ]
                .filter(
                  (item) =>
                    item.number !== result.officialAgencyHint?.officialNumber
                )
                .map((agency) => (
                  <a
                    key={agency.number}
                    href={`tel:${agency.number}`}
                    onClick={() => triggerHaptic(25)}
                    className="block p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:border-[#10243E] rounded-2xl space-y-1 tactile-press"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold text-[#10243E]">
                        {agency.name}
                      </span>
                      <PhoneCall className="w-5 h-5 text-[#10243E] shrink-0" aria-hidden="true" />
                    </div>
                    <p className="text-lg font-extrabold text-blue-900 tabular-nums">
                      Call {agency.number}
                    </p>
                    <p className="text-sm font-bold text-[#10243E]">{agency.desc}</p>
                  </a>
                ))}
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setShowOfficialModal(false);
              }}
              className="w-full min-h-[60px] px-6 py-4 text-lg font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press cursor-pointer"
            >
              Close &amp; Return
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
