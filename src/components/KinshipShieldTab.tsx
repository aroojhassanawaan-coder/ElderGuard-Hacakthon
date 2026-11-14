import { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  Mic,
  MicOff,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Check,
  Edit3,
  Volume2,
  Square,
} from "lucide-react";
import type { KinshipConfig, KinshipVerificationResult } from "../types/scam";
import { triggerHaptic } from "../utils/haptics";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

interface KinshipShieldTabProps {
  largePrint: boolean;
}

const KINSHIP_STORAGE_KEY = "elderguard_kinship_code_v1";

const DEFAULT_KINSHIP: KinshipConfig = {
  question: "What is our family's secret code word?",
  passphrase: "Blueberry Pancakes",
  updatedAt: new Date().toISOString(),
};

const PRESET_CHALLENGES = [
  {
    label: "Favorite Breakfast",
    question: "What is our family's secret breakfast phrase?",
    passphrase: "Blueberry Pancakes",
  },
  {
    label: "First Family Pet",
    question: "What was our first dog's name?",
    passphrase: "Barnaby",
  },
  {
    label: "Grandma's Street",
    question: "What street did Grandma live on?",
    passphrase: "Maple Lane",
  },
];

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function KinshipShieldTab({ largePrint }: KinshipShieldTabProps) {
  const [config, setConfig] = useState<KinshipConfig>(() => {
    try {
      const saved = localStorage.getItem(KINSHIP_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as KinshipConfig) : DEFAULT_KINSHIP;
    } catch {
      return DEFAULT_KINSHIP;
    }
  });

  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState(config.question);
  const [draftPassphrase, setDraftPassphrase] = useState(config.passphrase);
  const [savedNotice, setSavedNotice] = useState(false);

  const [challengeActive, setChallengeActive] = useState(false);
  const [callerReply, setCallerReply] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<KinshipVerificationResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KINSHIP_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage errors
    }
  }, [config]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [verificationResult]);

  const handleToggleSpeech = () => {
    if (
      !verificationResult ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
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
      verificationResult.SPEECH_SUMMARY?.trim() ||
      `${verificationResult.headline} ${verificationResult.explanation} ${verificationResult.recommendedAction}`;

    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.rate = 0.88;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const handleSaveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftPassphrase.trim()) return;
    triggerHaptic([25, 20, 25]);
    setConfig({
      question:
        draftQuestion.trim() || "What is our family's secret code word?",
      passphrase: draftPassphrase.trim(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditingSetup(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleStartSpeech = () => {
    triggerHaptic(20);
    setSpeechError(null);
    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setSpeechError(
        "Voice typing is not available on this browser. Please type what the caller said in the box below."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setCallerReply(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setSpeechError("Could not hear clearly. Please try again or type their answer.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const evaluateCallerReply = async (replyText: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) {
      setEvalError("Please type or speak what the caller replied first.");
      return;
    }

    triggerHaptic(25);
    setIsEvaluating(true);
    setEvalError(null);
    setVerificationResult(null);

    try {
      const response = await fetch("/api/verify-caller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretQuestion: config.question,
          expectedPassphrase: config.passphrase,
          callerReply: trimmed,
        }),
      });

      const data = (await response.json()) as KinshipVerificationResult & {
        error?: string;
      };
      if (!response.ok || data.error) {
        throw new Error(data.error || "Could not check the caller's reply right now.");
      }

      setVerificationResult(data);
      if (data.verdict === "DEEPFAKE_ALERT") {
        triggerHaptic([60, 40, 60]);
      } else {
        triggerHaptic(30);
      }
    } catch (err) {
      setEvalError(
        err instanceof Error ? err.message : "Could not check the caller's reply right now."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <h1 className="font-display text-[26px] sm:text-[32px] leading-tight font-extrabold text-[#10243E]">
          Family Voice Shield
        </h1>
        <p className={`${bodySize} text-[#10243E]`}>
          Phone scammers can copy a grandchild&apos;s voice, but they do not know your private family secret. Ask your secret question if someone calls in a panic.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Setup Card */}
        <section className="lg:col-span-5 bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-[#10243E] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold text-[#10243E]">
              Family Secret Word
            </h2>
          </div>

          {!isEditingSetup ? (
            <div className="space-y-5">
              <div className="p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl space-y-4">
                <div>
                  <p className="text-base font-bold text-[#10243E]">
                    Question to ask out loud
                  </p>
                  <p className={`${bodySize} font-bold text-black mt-1`}>
                    {config.question}
                  </p>
                </div>
                <div className="border-t-2 border-[#C8D3E0] pt-4">
                  <p className="text-base font-bold text-[#10243E]">
                    Only real family knows this answer
                  </p>
                  <p className="font-display text-2xl font-extrabold text-blue-900 mt-1">
                    {config.passphrase}
                  </p>
                </div>
              </div>

              {savedNotice && (
                <div className="flex items-center gap-2.5 text-lg font-bold text-emerald-900">
                  <Check className="w-6 h-6" aria-hidden="true" />
                  <span>Family Secret Word saved safely.</span>
                </div>
              )}

              <p className={`${bodySize} text-[#10243E]`}>
                Tell this secret phrase to your children and grandchildren in person.
              </p>

              <HoldToConfirmButton
                label="Change Secret Word"
                confirmLabel="Tap again or hold to edit"
                onConfirm={() => {
                  setDraftQuestion(config.question);
                  setDraftPassphrase(config.passphrase);
                  setIsEditingSetup(true);
                }}
                icon={<Edit3 className="w-5 h-5 shrink-0" aria-hidden="true" />}
                className="w-full"
              />
            </div>
          ) : (
            <form onSubmit={handleSaveSetup} className="space-y-5">
              <div className="space-y-2.5">
                <span className="block text-base font-bold text-[#10243E]">
                  Pick a quick idea:
                </span>
                <div className="grid grid-cols-1 gap-3">
                  {PRESET_CHALLENGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        triggerHaptic(18);
                        setDraftQuestion(preset.question);
                        setDraftPassphrase(preset.passphrase);
                      }}
                      className="min-h-[56px] px-4 py-3 text-left text-base font-bold bg-[#EEF2F5] hover:bg-slate-200 border-2 border-[#C8D3E0] text-[#10243E] rounded-2xl tactile-press cursor-pointer"
                    >
                      {preset.label}: &ldquo;{preset.passphrase}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="kinship-question"
                  className="block text-lg font-bold text-[#10243E]"
                >
                  Question to Ask Caller
                </label>
                <input
                  id="kinship-question"
                  type="text"
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                  className="w-full min-h-[56px] px-4 py-3 text-lg text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="kinship-passphrase"
                  className="block text-lg font-bold text-[#10243E]"
                >
                  Secret Answer
                </label>
                <input
                  id="kinship-passphrase"
                  type="text"
                  required
                  value={draftPassphrase}
                  onChange={(e) => setDraftPassphrase(e.target.value)}
                  placeholder="e.g., Blueberry Pancakes"
                  className="w-full min-h-[56px] px-4 py-3 text-lg text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="submit"
                  className="min-h-[58px] px-5 py-3.5 text-lg font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press cursor-pointer"
                >
                  Save Secret
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setIsEditingSetup(false);
                  }}
                  className="min-h-[58px] px-5 py-3.5 text-lg font-bold text-[#10243E] bg-[#EEF2F5] border-2 border-[#9FB0C4] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Live Call Challenge Mode */}
        <section className="lg:col-span-7 bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-8 space-y-6">
          {!challengeActive ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display text-[24px] sm:text-[28px] font-bold text-[#10243E]">
                  Is Someone Calling in a Panic Asking for Money?
                </h2>
                <p className={`${bodySize} text-[#10243E]`}>
                  Put the phone on speaker and tap below. We will walk you through checking if it is really your family member.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  setChallengeActive(true);
                  setVerificationResult(null);
                  setCallerReply("");
                  setEvalError(null);
                }}
                className="w-full min-h-[64px] px-6 py-4 inline-flex items-center justify-center gap-3 text-xl font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl shadow-md tactile-press cursor-pointer"
              >
                <PhoneCall className="w-7 h-7 shrink-0" aria-hidden="true" />
                Verify Caller Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calm Down First Screen */}
              <div className="bg-[#EEF2F5] border-2 border-[#10243E] rounded-3xl p-5 sm:p-6 space-y-4">
                <p className="font-display text-xl sm:text-2xl font-extrabold text-[#10243E]">
                  Take a deep breath. You are in control.
                </p>
                <p className={`${bodySize} text-[#10243E]`}>
                  Ask the caller this question out loud, then type or speak their response below:
                </p>
                <div className="p-5 bg-white border-2 border-[#9FB0C4] rounded-2xl">
                  <p className="font-display text-2xl font-extrabold text-black">
                    &ldquo;{config.question}&rdquo;
                  </p>
                </div>
              </div>

              {/* Reply Input + Mic */}
              <div className="space-y-4">
                <label
                  htmlFor="caller-reply-input"
                  className="block font-display text-xl font-bold text-[#10243E]"
                >
                  What did the caller say back?
                </label>

                <button
                  type="button"
                  onClick={handleStartSpeech}
                  className={`w-full min-h-[60px] px-5 py-3.5 inline-flex items-center justify-center gap-3 text-lg font-extrabold rounded-2xl border-2 tactile-press cursor-pointer ${
                    isListening
                      ? "bg-red-700 border-red-800 text-white"
                      : "bg-[#EEF2F5] border-[#10243E] text-[#10243E] hover:bg-slate-200"
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-6 h-6 shrink-0" aria-hidden="true" />
                      Listening... Tap to Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 shrink-0" aria-hidden="true" />
                      Tap to Listen With Microphone
                    </>
                  )}
                </button>

                <textarea
                  id="caller-reply-input"
                  rows={3}
                  value={callerReply}
                  onChange={(e) => setCallerReply(e.target.value)}
                  placeholder="Or type what the caller answered here..."
                  className={`w-full p-4 text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl placeholder:text-slate-600 ${bodySize}`}
                />

                {speechError && (
                  <p
                    role="alert"
                    className="text-lg font-bold text-amber-950 bg-amber-50 border-2 border-amber-400 rounded-2xl p-4"
                  >
                    {speechError}
                  </p>
                )}

                <div className="space-y-3 pt-1">
                  <span className="block text-base font-bold text-[#10243E]">
                    Try a practice reply:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const sample =
                          "I can't remember right now, I'm hurt, stop asking me questions and just send the money right now!";
                        setCallerReply(sample);
                        void evaluateCallerReply(sample);
                      }}
                      className="min-h-[58px] px-4 py-3 text-base font-bold text-red-950 bg-red-50 border-2 border-red-400 hover:bg-red-100 rounded-2xl tactile-press cursor-pointer"
                    >
                      Test Scammer Excuse
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `It's ${config.passphrase}, Grandma!`;
                        setCallerReply(sample);
                        void evaluateCallerReply(sample);
                      }}
                      className="min-h-[58px] px-4 py-3 text-base font-bold text-emerald-950 bg-emerald-50 border-2 border-emerald-500 hover:bg-emerald-100 rounded-2xl tactile-press cursor-pointer"
                    >
                      Test Real Family Reply
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isEvaluating || !callerReply.trim()}
                onClick={() => void evaluateCallerReply(callerReply)}
                className="w-full min-h-[64px] px-6 py-4 text-xl font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] disabled:bg-slate-400 disabled:cursor-not-allowed rounded-2xl tactile-press cursor-pointer"
              >
                {isEvaluating ? "Checking Reply Calmly..." : "Check Caller Reply"}
              </button>

              {evalError && (
                <p
                  role="alert"
                  className="text-lg font-bold text-red-950 bg-red-50 border-2 border-red-400 rounded-2xl p-4"
                >
                  {evalError}
                </p>
              )}

              {verificationResult && (
                <div
                  aria-live="polite"
                  className={`border-2 rounded-3xl p-6 space-y-5 ${
                    verificationResult.verdict === "VERIFIED_FAMILY"
                      ? "bg-emerald-50 border-emerald-500 text-[#10243E]"
                      : verificationResult.verdict === "UNCLEAR"
                        ? "bg-amber-50 border-amber-500 text-[#10243E]"
                        : "bg-red-50 border-red-500 text-[#10243E]"
                  }`}
                >
                  {verificationResult.verdict !== "VERIFIED_FAMILY" && (
                    <div className="p-4 bg-white border-2 border-[#10243E] rounded-2xl">
                      <p className="font-display text-lg sm:text-xl font-extrabold text-[#10243E]">
                        Take a deep breath. You are in control.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-base sm:text-lg font-extrabold tracking-wide ${
                        verificationResult.verdict === "VERIFIED_FAMILY"
                          ? "bg-white border-emerald-700 text-emerald-950"
                          : verificationResult.verdict === "UNCLEAR"
                            ? "bg-white border-amber-700 text-amber-950"
                            : "bg-red-800 border-red-950 text-white"
                      }`}
                    >
                      <span>
                        {verificationResult.verificationStatus ??
                          (verificationResult.verdict === "VERIFIED_FAMILY"
                            ? "VERIFIED FAMILY"
                            : verificationResult.verdict === "UNCLEAR"
                              ? "ASK PASSPHRASE AGAIN"
                              : "⚠️ DEEPFAKE IMPERSONATION WARNING")}
                      </span>
                    </div>

                    <div className="flex items-start gap-4">
                      {verificationResult.verdict === "VERIFIED_FAMILY" ? (
                        <CheckCircle2 className="w-10 h-10 text-emerald-900 shrink-0" aria-hidden="true" />
                      ) : verificationResult.verdict === "UNCLEAR" ? (
                        <AlertTriangle className="w-10 h-10 text-amber-900 shrink-0" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="w-10 h-10 text-red-900 shrink-0" aria-hidden="true" />
                      )}
                      <h3 className="font-display text-[24px] sm:text-[28px] leading-tight font-extrabold text-[#10243E]">
                        {verificationResult.verdict === "VERIFIED_FAMILY"
                          ? "SAFE TO PROCEED. Real family."
                          : verificationResult.verdict === "UNCLEAR"
                            ? "PAUSE. Ask again."
                            : "STOP. Likely fake voice scam."}
                      </h3>
                    </div>
                  </div>

                  {typeof window !== "undefined" && "speechSynthesis" in window && (
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

                  <p className={`${bodySize} font-bold text-black`}>
                    {verificationResult.explanation}
                  </p>

                  {verificationResult.SPEECH_SUMMARY && (
                    <div className="p-4 sm:p-5 bg-white border-2 border-[#9FB0C4] rounded-2xl space-y-1.5">
                      <p className="text-base font-extrabold text-[#10243E] flex items-center gap-2">
                        <Volume2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>Calm Voice Summary</span>
                      </p>
                      <p className={`${bodySize} text-[#10243E]`}>
                        {verificationResult.SPEECH_SUMMARY}
                      </p>
                    </div>
                  )}

                  {verificationResult.evasionTacticsDetected.length > 0 && (
                    <ul className={`space-y-2.5 ${bodySize} text-[#10243E]`}>
                      {verificationResult.evasionTacticsDetected.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="font-display font-extrabold tabular-nums">
                            {idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="p-5 bg-white border-2 border-[#10243E] rounded-2xl">
                    <p className={`${bodySize} font-extrabold text-[#10243E]`}>
                      What to do now: {verificationResult.recommendedAction}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
