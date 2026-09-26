/*
 * Hand a JSON value to the user as a downloaded file (#1988).
 *
 * `Blob` + a temporary `<a download>` works the same in a browser tab and in
 * the Electron renderer: the browser saves to its download folder, and
 * Electron raises its own `will-download` save dialog — the desktop shell
 * needs nothing extra. The object URL is revoked on the next tick rather than
 * immediately, because Safari reads it after the click handler returns.
 */
export function saveJsonFile(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
