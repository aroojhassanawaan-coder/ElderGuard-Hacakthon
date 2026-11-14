import { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Lock,
  Volume2,
  Square,
  Globe,
} from "lucide-react";
import type { AlertSecurityLevel, UrlInspectionDetail } from "../types/scam";
import { triggerHaptic } from "../utils/haptics";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

interface LinkInterceptorModalProps {
  isOpen: boolean;
  url: string;
  alertLevel: AlertSecurityLevel;
  reason: string;
  inspection?: UrlInspectionDetail;
  largePrint: boolean;
  onGoBack: () => void;
}

export function LinkInterceptorModal({
  isOpen,
  url,
  alertLevel,
  reason,
  inspection,
  largePrint,
  onGoBack,
}: LinkInterceptorModalProps) {
  const [unlockedOpenAnyway, setUnlockedOpenAnyway] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    setUnlockedOpenAnyway(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isOpen, url]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const safeHref =
    inspection?.normalizedUrl ||
    (/^https?:\/\//i.test(url) ? url : `https://${url}`);

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const isRed = alertLevel === "RED";
  const isYellow = alertLevel === "YELLOW";

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
    const spoken = isRed
      ? `Stop. Danger. This link may be a scam. Do not open it. ${reason} Tap Go Back to Safety.`
      : isYellow
        ? `Warning. Be careful before opening this link. ${reason} Tap Go Back to Safety if you are unsure.`
        : `Safe for now. No known threat was found. Still, no scan can promise 100 percent safety. ${reason}`;
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
    triggerHaptic(25);
    onGoBack();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-interceptor-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10243E]/90 p-4"
    >
      <div
        className={`w-full max-w-lg bg-white rounded-3xl border-4 p-6 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto ${
          isRed
            ? "border-red-700"
            : isYellow
              ? "border-amber-600"
              : "border-emerald-700"
        }`}
      >
        {/* Status Banner */}
        <div
          className={`p-5 rounded-2xl border-2 flex items-start gap-4 ${
            isRed
              ? "bg-red-50 border-red-600 text-red-950"
              : isYellow
                ? "bg-amber-50 border-amber-500 text-amber-950"
                : "bg-emerald-50 border-emerald-600 text-emerald-950"
          }`}
        >
          {isRed ? (
            <ShieldAlert className="w-10 h-10 text-red-800 shrink-0 mt-0.5" aria-hidden="true" />
          ) : isYellow ? (
            <AlertTriangle className="w-10 h-10 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-10 h-10 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <h2
              id="link-interceptor-title"
              className="font-display text-2xl sm:text-[26px] leading-tight font-extrabold"
            >
              {isRed
                ? "DANGER! Do Not Open This Link."
                : isYellow
                  ? "WARNING! Check Before Opening."
                  : "SAFE FOR NOW. Still Be Careful."}
            </h2>
            <p className="text-base font-bold text-[#10243E]">
              {isRed
                ? "ElderGuard stopped this page to protect your money and privacy."
                : isYellow
                  ? "We could not prove this website is safe."
                  : "No scan can guarantee 100 percent safety."}
            </p>
          </div>
        </div>

        {/* Locked Address Box */}
        <div className="p-4 bg-[#EEF2F5] border-2 border-[#9FB0C4] rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-base font-extrabold text-[#10243E]">
            <Lock className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Website you tried to open:</span>
          </div>
          <p className="text-lg font-extrabold text-red-950 break-all select-all">
            {url}
          </p>
        </div>

        {/* Plain-English Reason & Security Checks */}
        <div className="space-y-3">
          <p className={`${bodySize} font-bold text-black`}>{reason}</p>

          {inspection && (
            <div className="p-4 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl space-y-2 text-base font-bold text-[#10243E]">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>What our link check found:</span>
              </div>
              <ul className="space-y-1.5 pl-1">
                <li>
                  • Web lock symbol:{" "}
                  {inspection.usesHttps
                    ? "Uses a lock symbol, but fake sites use lock symbols too."
                    : "Missing basic web lock protection."}
                </li>
                <li>
                  • Website age:{" "}
                  {inspection.domainAgeDays !== null
                    ? `${inspection.domainAgeDays} days old${
                        inspection.domainAgeDays < 90 ? " (very new, risky)" : ""
                      }.`
                    : "Age unknown. Treat unknown sites carefully."}
                </li>
                {inspection.redirectChain.length > 0 && (
                  <li>
                    • Hidden forwarding: Sends you through {inspection.redirectChain.length} other page(s).
                  </li>
                )}
                {inspection.suspiciousFlags.map((flag, idx) => (
                  <li key={idx}>• {flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Voice Playback */}
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

        {/* Primary Safe Exit */}
        <button
          type="button"
          onClick={handleClose}
          className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-xl font-extrabold text-white bg-emerald-800 hover:bg-emerald-900 border-2 border-emerald-950 rounded-2xl shadow-md tactile-press cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
          Go Back to Safety
        </button>

        {/* Friction-Protected Dangerous Option */}
        <div className="border-t-2 border-[#DCE4EE] pt-5 space-y-4">
          <p className="text-base font-bold text-[#10243E]">
            Only open if you are 100 percent sure who sent this:
          </p>

          {!unlockedOpenAnyway ? (
            <HoldToConfirmButton
              label="Open Anyway (Not Recommended)"
              confirmLabel="Hold or tap again to unlock link"
              variant="danger"
              onConfirm={() => setUnlockedOpenAnyway(true)}
              icon={<ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />}
              className="w-full"
            />
          ) : (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl space-y-3">
              <p className="text-base font-extrabold text-red-950">
                Final warning. Never type passwords, card numbers, or personal details on this page.
              </p>
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic(25)}
                className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-2.5 text-lg font-extrabold text-white bg-red-800 hover:bg-red-900 rounded-2xl tactile-press"
              >
                <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
                Continue to Website Anyway
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
