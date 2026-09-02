/*
 * One-shot file picker (#1404).
 *
 * The slash menu runs inside a ProseMirror plugin, not inside React, so there
 * is no rendered `<input type="file">` for it to drive. This builds one, opens
 * it, and throws it away — which is also what keeps the picker from
 * remembering the last selection between uses.
 *
 * MUST BE CALLED FROM A USER GESTURE. `input.click()` opens the OS dialog only
 * while the browser considers a gesture to be in progress, and the slash
 * entry's own Enter / click is that gesture. Anything that awaits before
 * calling this loses the gesture and the dialog silently never appears.
 *
 * CANCELLATION resolves null. The `cancel` event is what reports it, and it is
 * the reason this does not need a focus-based fallback: it has shipped in
 * Chrome 113+, Firefox 91+ and Safari 16.4+, which is every browser this app
 * runs in (the Electron shell is Chromium, and the phone's route in is the
 * public web URL). A browser without it simply leaves the promise pending —
 * the same outcome as today's "the user changed their mind", with the input
 * cleaned up either way by the caller navigating on.
 */
export function pickFile(accept?: string): Promise<File | null> {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    // Off-screen rather than `display: none`: a hidden input is ignored by
    // some engines' click handling, and this one must be clickable.
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", () => finish(input.files?.[0] ?? null), {
      once: true,
    });
    input.addEventListener("cancel", () => finish(null), { once: true });
    input.click();
  });
}
