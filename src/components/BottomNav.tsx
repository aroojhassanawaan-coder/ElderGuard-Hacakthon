import { ShieldCheck, PhoneCall, MessageSquareWarning, Radio } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

export type AppTab = "scanner" | "liveshield" | "kinship" | "safechat";

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  unreadAlertsCount?: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  unreadAlertsCount = 0,
}: BottomNavProps) {
  const tabs: Array<{
    id: AppTab;
    shortLabel: string;
    fullLabel: string;
    Icon: typeof ShieldCheck;
    badge?: number;
  }> = [
    {
      id: "scanner",
      shortLabel: "Check Text",
      fullLabel: "Check Message",
      Icon: ShieldCheck,
    },
    {
      id: "liveshield",
      shortLabel: "Live Shield",
      fullLabel: "Live Auto Shield",
      Icon: Radio,
      badge: unreadAlertsCount,
    },
    {
      id: "kinship",
      shortLabel: "Voice Shield",
      fullLabel: "Family Voice",
      Icon: PhoneCall,
    },
    {
      id: "safechat",
      shortLabel: "Safe Inbox",
      fullLabel: "Safe Inbox",
      Icon: MessageSquareWarning,
    },
  ];

  return (
    <nav
      aria-label="Main Safety Tools"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#C8D3E0] shadow-[0_-6px_24px_rgba(16,36,62,0.10)]"
    >
      <div className="max-w-5xl mx-auto px-2 sm:px-6 grid grid-cols-4 gap-2 sm:gap-4 py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic(22);
                onChangeTab(tab.id);
              }}
              aria-current={isActive ? "page" : undefined}
              className={`relative min-h-[60px] min-w-[60px] px-1.5 sm:px-2 py-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 tactile-press cursor-pointer ${
                isActive
                  ? "bg-[#10243E] border-[#10243E] text-white font-bold"
                  : "bg-[#EEF2F5] border-transparent text-[#10243E] hover:border-[#9FB0C4] font-bold"
              }`}
            >
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute top-1.5 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-700 text-white text-xs font-extrabold flex items-center justify-center">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
              <Icon
                className={`w-6 h-6 shrink-0 ${isActive ? "text-white" : "text-[#10243E]"}`}
                aria-hidden="true"
              />
              <span className="text-xs sm:text-sm leading-tight whitespace-nowrap truncate max-w-full">
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.fullLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
