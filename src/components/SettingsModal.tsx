import { useState } from "react";
import { X, Check } from "lucide-react";
import type { TrustedContact } from "../types/scam";
import { triggerHaptic } from "../utils/haptics";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  largePrint: boolean;
  onToggleLargePrint: (value: boolean) => void;
  trustedContact: TrustedContact;
  onSaveTrustedContact: (contact: TrustedContact) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  largePrint,
  onToggleLargePrint,
  trustedContact,
  onSaveTrustedContact,
}: SettingsModalProps) {
  const [name, setName] = useState(trustedContact.name);
  const [phone, setPhone] = useState(trustedContact.phone);
  const [email, setEmail] = useState(trustedContact.email);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic([25, 20, 25]);
    onSaveTrustedContact({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10243E]/80 p-4"
    >
      <div className="w-full max-w-lg bg-white border-2 border-[#C8D3E0] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="settings-modal-title"
            className="font-display text-2xl font-extrabold text-[#10243E]"
          >
            Display &amp; Trusted Helper
          </h2>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onClose();
            }}
            aria-label="Close settings"
            className="min-h-[56px] min-w-[56px] flex items-center justify-center text-[#10243E] bg-[#EEF2F5] border-2 border-[#C8D3E0] hover:bg-slate-200 rounded-2xl tactile-press cursor-pointer shrink-0"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Display Size */}
        <div className="p-5 bg-[#EEF2F5] border-2 border-[#C8D3E0] rounded-2xl flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg font-extrabold text-[#10243E]">
              Extra-Large Print
            </p>
            <p className="text-base text-[#10243E]">
              Makes all letters even bigger and easier to read
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={largePrint}
            onClick={() => {
              triggerHaptic(25);
              onToggleLargePrint(!largePrint);
            }}
            className={`min-h-[56px] min-w-[84px] px-5 py-3 rounded-2xl border-2 font-extrabold text-lg tactile-press shrink-0 cursor-pointer ${
              largePrint
                ? "bg-[#10243E] border-[#10243E] text-white"
                : "bg-white border-[#9FB0C4] text-[#10243E]"
            }`}
          >
            {largePrint ? "ON" : "OFF"}
          </button>
        </div>

        {/* Trusted Helper Contact */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold text-[#10243E]">
              Trusted Family Helper
            </h3>
            <p className="text-base text-[#10243E]">
              Save a daughter, son, or trusted friend here so you can message or call them in one tap.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="family-name"
              className="block text-lg font-bold text-[#10243E]"
            >
              Helper&apos;s Name (e.g., Sarah)
            </label>
            <input
              id="family-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sarah"
              className="w-full min-h-[56px] px-4 py-3 text-lg text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="family-phone"
              className="block text-lg font-bold text-[#10243E]"
            >
              Mobile Phone Number
            </label>
            <input
              id="family-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555-234-5678"
              className="w-full min-h-[56px] px-4 py-3 text-lg text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="family-email"
              className="block text-lg font-bold text-[#10243E]"
            >
              Email Address (optional)
            </label>
            <input
              id="family-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
              className="w-full min-h-[56px] px-4 py-3 text-lg text-[#10243E] bg-white border-2 border-[#9FB0C4] rounded-2xl"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[60px] px-6 py-4 inline-flex items-center justify-center gap-2.5 text-xl font-extrabold text-white bg-blue-800 hover:bg-blue-900 rounded-2xl tactile-press cursor-pointer"
          >
            {saved ? (
              <>
                <Check className="w-6 h-6" aria-hidden="true" />
                Saved!
              </>
            ) : (
              "Save Settings"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
