import { Shield, Settings } from "lucide-react";
import { PWAInstallButton } from "./PWAInstallButton";
import { triggerHaptic } from "../utils/haptics";

interface HeaderProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
}

export function Header({ onOpenSettings, onGoHome }: HeaderProps) {
  return (
    <header className="bg-white border-b-2 border-[#C8D3E0]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(20);
            onGoHome();
          }}
          className="min-h-[56px] min-w-[56px] px-3 py-2 flex items-center gap-3 text-left whitespace-nowrap shrink-0 rounded-2xl hover:bg-slate-100 tactile-press cursor-pointer"
        >
          <Shield className="w-7 h-7 text-[#10243E] shrink-0" aria-hidden="true" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-[#10243E] whitespace-nowrap shrink-0">
            ElderGuard
          </span>
        </button>

        <div className="flex items-center gap-4 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenSettings();
            }}
            aria-label="Safety and Display Settings"
            className="min-h-[56px] min-w-[56px] px-4 py-2.5 flex items-center justify-center gap-2.5 text-[#10243E] bg-[#EEF2F5] border-2 border-[#9FB0C4] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer"
          >
            <Settings className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline text-base font-bold">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
