import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ChevronRight,
  ScanSearch,
  ExternalLink,
  X,
  Volume2,
  Square,
} from "lucide-react";
import { SAFE_CHAT_MESSAGES } from "../data/examplesAndLibrary";
import type { SafeChatMessage, ScamChannel } from "../types/scam";
import { triggerHaptic } from "../utils/haptics";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

interface SafeChatTabProps {
  largePrint: boolean;
  onScanMessage: (messageText: string, channel: ScamChannel) => void;
}

interface BlockedLinkModalState {
  url: string;
  reason: string;
  senderName: string;
  fullText: string;
  channel: ScamChannel;
  isRisky: boolean;
}

export function SafeChatTab({ largePrint, onScanMessage }: SafeChatTabProps) {
  const [selectedId, setSelectedId] = useState<string>(SAFE_CHAT_MESSAGES[0].id);
  const [mobileShowingThread, setMobileShowingThread] = useState(false);
  const [linkModal, setLinkModal] = useState<BlockedLinkModalState | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [unlockedOpenAnyway, setUnlockedOpenAnyway] = useState(false);

  const handleToggleSpeech = (modalState: BlockedLinkModalState) => {
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
    const script = modalState.isRisky
      ? `Hello. Take a deep breath. Stop. ElderGuard blocked this link. ${modalState.reason} Close this popup and stay safe.`
      : `Hello. Good news. This link looks safe for now. Remember no scan guarantees 100 percent safety. ${modalState.reason}`;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.88;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const closeLinkModal = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setUnlockedOpenAnyway(false);
    setLinkModal(null);
  };

  const activeMessage: SafeChatMessage =
    SAFE_CHAT_MESSAGES.find((m) => m.id === selectedId) ?? SAFE_CHAT_MESSAGES[0];

  const bodySize = largePrint
    ? "text-[21px] leading-relaxed"
    : "text-[19px] leading-relaxed";

  const handleSelectConversation = (msgId: string) => {
    triggerHaptic(20);
    setSelectedId(msgId);
    setMobileShowingThread(true);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <h1 className="font-display text-[26px] sm:text-[32px] leading-tight font-extrabold text-[#10243E]">
          Practice Safe Inbox
        </h1>
        <p className={`${bodySize} text-[#10243E]`}>
          Pick a message below and tap the big blue link box inside. ElderGuard stops dangerous websites before they can open.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chunky Inbox List */}
        <div
          className={`lg:col-span-5 space-y-4 ${
            mobileShowingThread ? "hidden lg:block" : "block"
          }`}
        >
          {SAFE_CHAT_MESSAGES.map((msg) => {
            const isSelected = msg.id === activeMessage.id;
            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleSelectConversation(msg.id)}
                className={`w-full text-left p-5 min-h-[84px] rounded-3xl border-2 flex items-center justify-between gap-4 tactile-press cursor-pointer ${
                  isSelected
                    ? "bg-[#10243E] border-[#10243E] text-white"
                    : "bg-white border-[#C8D3E0] text-[#10243E] hover:border-[#10243E]"
                }`}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-extrabold truncate">
                      {msg.senderName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sm font-bold">{msg.channel}</span>
                  </div>
                  <p
                    className={`text-base truncate ${
                      isSelected ? "text-slate-100" : "text-[#10243E]"
                    }`}
                  >
                    {msg.preview}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span>{msg.receivedAt}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        isSelected
                          ? "text-white underline"
                          : msg.isScam
                            ? "text-red-800"
                            : "text-emerald-900"
                      }
                    >
                      {msg.isScam ? "Warning Example" : "Safe Example"}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-6 h-6 shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* Active Conversation Card */}
        <div
          className={`lg:col-span-7 bg-white border-2 border-[#C8D3E0] rounded-3xl overflow-hidden flex flex-col justify-between ${
            mobileShowingThread ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="p-5 sm:p-6 bg-[#EEF2F5] border-b-2 border-[#C8D3E0] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(18);
                  setMobileShowingThread(false);
                }}
                aria-label="Back to message list"
                className="lg:hidden min-h-[56px] min-w-[56px] px-4 flex items-center justify-center gap-2 font-bold text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl tactile-press cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" aria-hidden="true" />
                <span>Back</span>
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#10243E] truncate">
                  {activeMessage.senderName}
                </h2>
                <p className="text-base font-bold text-[#10243E]">
                  {activeMessage.senderHandle} <span aria-hidden="true">·</span>{" "}
                  {activeMessage.channel}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-5">
            {activeMessage.bodyParts.map((part, idx) => {
              if (part.type === "text") {
                return (
                  <p key={idx} className={`${bodySize} text-black font-bold`}>
                    {part.value}
                  </p>
                );
              }
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic([35, 25, 35]);
                    setLinkModal({
                      url: part.url,
                      reason: part.riskReason,
                      senderName: activeMessage.senderName,
                      fullText: activeMessage.fullText,
                      channel:
                        activeMessage.channel === "WhatsApp" ? "WhatsApp" : "Text / SMS",
                      isRisky: part.isRisky,
                    });
                  }}
                  className="w-full min-h-[64px] p-4 sm:p-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-800 rounded-2xl text-left flex items-center justify-between gap-4 tactile-press cursor-pointer"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="block text-sm font-bold text-blue-950">
                      Tap here to test what happens when you click this link:
                    </span>
                    <span className="block text-lg font-extrabold text-blue-900 underline break-all">
                      {part.label}
                    </span>
                  </div>
                  <ExternalLink className="w-6 h-6 text-blue-900 shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-6 bg-[#EEF2F5] border-t-2 border-[#C8D3E0]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                onScanMessage(
                  activeMessage.fullText,
                  activeMessage.channel === "WhatsApp" ? "WhatsApp" : "Text / SMS"
                );
              }}
              className="w-full min-h-[60px] px-6 py-4 inline-flex items-center justify-center gap-3 text-lg font-extrabold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press cursor-pointer"
            >
              <ScanSearch className="w-6 h-6 shrink-0" aria-hidden="true" />
              Check This Message With ElderGuard
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Link Blocker Warning Modal */}
      {linkModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="blocked-link-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/85 p-4"
        >
          <div
            className={`w-full max-w-lg bg-white rounded-3xl border-4 p-6 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto ${
              linkModal.isRisky ? "border-red-600" : "border-emerald-600"
            }`}
          >
            {linkModal.isRisky && (
              <div className="p-4 bg-[#EEF2F5] border-2 border-[#10243E] rounded-2xl">
                <p className="font-display text-xl font-extrabold text-[#10243E]">
                  Take a deep breath. You are in control.
                </p>
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {linkModal.isRisky ? (
                  <ShieldAlert className="w-10 h-10 text-red-800 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-emerald-800 shrink-0" aria-hidden="true" />
                )}
                <h2
                  id="blocked-link-title"
                  className={`font-display text-2xl sm:text-[26px] leading-tight font-extrabold ${
                    linkModal.isRisky ? "text-red-950" : "text-emerald-950"
                  }`}
                >
                  {linkModal.isRisky
                    ? "STOP. ElderGuard Blocked This Link."
                    : "SAFE TO PROCEED."}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  closeLinkModal();
                }}
                aria-label="Close popup"
                className="min-h-[56px] min-w-[56px] flex items-center justify-center text-[#10243E] bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>

            {typeof window !== "undefined" && "speechSynthesis" in window && (
              <button
                type="button"
                onClick={() => handleToggleSpeech(linkModal)}
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
                    Read This Out Loud to Me
                  </>
                )}
              </button>
            )}

            <div
              className={`p-4 rounded-2xl border-2 flex items-center gap-3 text-base sm:text-lg font-bold break-all ${
                linkModal.isRisky
                  ? "bg-red-50 border-red-400 text-red-950"
                  : "bg-emerald-50 border-emerald-400 text-emerald-950"
              }`}
            >
              <Lock className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span>{linkModal.url}</span>
            </div>

            <p className={`${bodySize} text-black font-bold`}>{linkModal.reason}</p>

            <div className="grid grid-cols-1 gap-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  closeLinkModal();
                }}
                className={`w-full min-h-[60px] px-6 py-4 text-lg font-extrabold text-white rounded-2xl tactile-press cursor-pointer ${
                  linkModal.isRisky
                    ? "bg-emerald-800 hover:bg-emerald-900"
                    : "bg-emerald-800 hover:bg-emerald-900"
                }`}
              >
                Go Back &amp; Stay Safe
              </button>

              {linkModal.isRisky && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    const text = linkModal.fullText;
                    const ch = linkModal.channel;
                    closeLinkModal();
                    onScanMessage(text, ch);
                  }}
                  className="w-full min-h-[60px] px-6 py-4 text-lg font-extrabold text-[#10243E] bg-[#EEF2F5] border-2 border-[#10243E] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
                >
                  Check Full Message With ElderGuard
                </button>
              )}

              <div className="border-t-2 border-[#DCE4EE] pt-4 space-y-3">
                {!unlockedOpenAnyway ? (
                  <HoldToConfirmButton
                    label="Open Anyway (Not Recommended)"
                    confirmLabel="Hold or tap again to unlock"
                    variant="danger"
                    onConfirm={() => setUnlockedOpenAnyway(true)}
                    icon={<ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />}
                    className="w-full"
                  />
                ) : (
                  <a
                    href={linkModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[58px] px-5 py-3.5 inline-flex items-center justify-center gap-2.5 text-lg font-extrabold text-white bg-red-800 hover:bg-red-900 rounded-2xl tactile-press"
                  >
                    <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
                    Continue to Website Anyway
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
