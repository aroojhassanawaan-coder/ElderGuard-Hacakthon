import { useState, useRef, useEffect } from "react";
import { triggerHaptic } from "../utils/haptics";

interface HoldToConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: "neutral" | "danger";
  className?: string;
  icon?: React.ReactNode;
  holdDurationMs?: number;
}

/**
 * Tremor-safe button requiring either:
 * 1. Pressing and holding for ~750ms (smooth progress fill), OR
 * 2. A deliberate double-tap (first tap arms for 3.5s, second tap confirms).
 * Prevents accidental single-tap tremors from triggering destructive or reset actions.
 */
export function HoldToConfirmButton({
  label,
  confirmLabel = "Tap again or hold to confirm",
  onConfirm,
  variant = "neutral",
  className = "",
  icon,
  holdDurationMs = 750,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isArmed, setIsArmed] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const armTimeoutRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);

  const stopHoldAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      stopHoldAnimation();
      if (armTimeoutRef.current !== null) {
        window.clearTimeout(armTimeoutRef.current);
      }
    };
  }, []);

  const executeConfirm = () => {
    stopHoldAnimation();
    setIsArmed(false);
    if (armTimeoutRef.current !== null) {
      window.clearTimeout(armTimeoutRef.current);
    }
    triggerHaptic([35, 30, 35]);
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 600);
    onConfirm();
  };

  const handlePointerDown = () => {
    holdTriggeredRef.current = false;
    startTimeRef.current = performance.now();
    triggerHaptic(15);

    const step = (now: number) => {
      if (startTimeRef.current === null) return;
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setProgress(pct);
      if (pct >= 100) {
        holdTriggeredRef.current = true;
        executeConfirm();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const handlePointerUpOrCancel = () => {
    stopHoldAnimation();
  };

  const handleClick = () => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    if (isArmed) {
      executeConfirm();
      return;
    }

    // First deliberate tap arms the button for 3.5 seconds
    triggerHaptic(20);
    setIsArmed(true);
    if (armTimeoutRef.current !== null) {
      window.clearTimeout(armTimeoutRef.current);
    }
    armTimeoutRef.current = window.setTimeout(() => {
      setIsArmed(false);
    }, 3500);
  };

  const baseColors =
    variant === "danger"
      ? isArmed
        ? "bg-red-700 text-white border-red-800"
        : "bg-red-50 text-red-950 border-red-400 hover:bg-red-100"
      : isArmed
        ? "bg-[#10243E] text-white border-[#10243E]"
        : "bg-white text-[#10243E] border-[#9FB0C4] hover:bg-slate-100";

  const fillBarColor =
    variant === "danger" ? "bg-red-700/25" : "bg-blue-800/20";

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onClick={handleClick}
      aria-label={`${label}. Hold for 1 second or tap twice to confirm.`}
      className={`relative overflow-hidden min-h-[58px] min-w-[58px] px-5 py-3.5 rounded-2xl border-2 font-bold text-base sm:text-lg inline-flex items-center justify-center gap-2.5 select-none tactile-press cursor-pointer ${baseColors} ${
        justConfirmed ? "ring-4 ring-emerald-500" : ""
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 transition-none pointer-events-none ${fillBarColor}`}
        style={{ width: `${progress}%` }}
      />
      <span className="relative z-10 inline-flex items-center gap-2.5">
        {icon}
        <span>{isArmed ? confirmLabel : label}</span>
      </span>
    </button>
  );
}
