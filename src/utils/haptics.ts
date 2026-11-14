export function triggerHaptic(pattern: number | number[] = 25) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration permission restrictions
    }
  }
}
