import confetti from "canvas-confetti";
import { STORAGE_KEYS } from "../constants/storageKeys";

export function fireTaskCompleteConfetti() {
  const stored = localStorage.getItem(STORAGE_KEYS.CONFETTI_ENABLED);
  if (stored === "false") return;

  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
    disableForReducedMotion: true,
  });
}
