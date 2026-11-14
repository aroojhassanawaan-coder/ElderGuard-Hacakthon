import { useState } from "react";
import { Download, Smartphone, WifiOff, X } from "lucide-react";
import { useOnlineStatus, usePWAInstall } from "../hooks/usePWAInstall";
import { triggerHaptic } from "../utils/haptics";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          triggerHaptic(25);
          void install();
        }}
        className="inline-flex items-center gap-2.5 px-4 py-2.5 min-h-[56px] min-w-[56px] text-base font-bold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span>Save App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic(20);
          setShowGuideModal(true);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[56px] min-w-[56px] text-base font-bold text-[#10243E] bg-[#EEF2F5] border-2 border-[#9FB0C4] hover:bg-slate-200 rounded-2xl tactile-press whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{isIOS ? "Save to iPhone" : "Save App"}</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/75 p-4"
        >
          <div className="w-full max-w-md bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2
                id="pwa-install-title"
                className="font-display text-2xl font-bold text-[#10243E]"
              >
                Save ElderGuard to Your Home Screen
              </h2>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setShowGuideModal(false);
                }}
                aria-label="Close instructions"
                className="min-h-[56px] min-w-[56px] flex items-center justify-center text-[#10243E] bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer shrink-0"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-4 text-[19px] leading-relaxed text-[#10243E]">
                <li>
                  <strong>1.</strong> Tap the <strong>Share</strong> icon (square with an arrow pointing up) at the bottom of Safari.
                </li>
                <li>
                  <strong>2.</strong> Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  <strong>3.</strong> Tap <strong>Add</strong> in the top corner.
                </li>
              </ol>
            ) : (
              <ol className="space-y-4 text-[19px] leading-relaxed text-[#10243E]">
                <li>
                  <strong>1.</strong> Open your browser menu (the three dots in the top corner).
                </li>
                <li>
                  <strong>2.</strong> Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                setShowGuideModal(false);
              }}
              className="w-full min-h-[60px] px-6 py-4 text-lg font-bold text-white bg-[#10243E] hover:bg-[#1B3A63] rounded-2xl tactile-press cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="bg-amber-100 border-b-2 border-amber-500 text-[#10243E] px-4 py-3 text-center text-base sm:text-lg font-bold flex items-center justify-center gap-3"
    >
      <WifiOff className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span>You are offline — Built-in safety checks and family tools still work.</span>
    </div>
  );
}
