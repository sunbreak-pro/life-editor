/**
 * localStorage-backed feature toggles for Pomodoro / Free-session UX.
 * Extracted so component files only export components (react-refresh).
 */
const STORAGE_KEY_POMODORO_ENABLED = "pomodoroEnabled";
const STORAGE_KEY_FREE_SAVE_DIALOG = "freeSessionSaveDialogEnabled";

export function isPomodoroEnabled(): boolean {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY_POMODORO_ENABLED) !== "false"
    );
  } catch {
    return true;
  }
}

export function setPomodoroEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(STORAGE_KEY_POMODORO_ENABLED);
    else window.localStorage.setItem(STORAGE_KEY_POMODORO_ENABLED, "false");
  } catch {
    /* ignore */
  }
}

export function isFreeSessionSaveDialogEnabled(): boolean {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY_FREE_SAVE_DIALOG) !== "false"
    );
  } catch {
    return true;
  }
}

export function setFreeSessionSaveDialogEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(STORAGE_KEY_FREE_SAVE_DIALOG);
    else window.localStorage.setItem(STORAGE_KEY_FREE_SAVE_DIALOG, "false");
  } catch {
    /* ignore */
  }
}
