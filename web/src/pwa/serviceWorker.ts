import { isNativeMobile } from "@life-editor/shared";

/*
 * Registers the Service Worker on the public web build (#2334 — plan P1c step
 * 2) and offers a new version when one is waiting.
 *
 * Written by hand rather than through `virtual:pwa-register`: this module is in
 * the bundle Desktop builds too (electron-vite renders web/src/main.tsx with its
 * own config), and only web/vite.config.ts has the plugin that provides it.
 *
 * WHEN A NEW VERSION IS FOUND it waits (`registerType: "prompt"`) and the app
 * shows a band. Only the press applies it, so nothing reloads under someone's
 * typing. A tab that did not press keeps running on the files it has, even when
 * another tab's press activates the new worker.
 */

const SW_URL = "/sw.js";
/** A long-lived tab or a home-screen app asks for a new version this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function setWaiting(next: ServiceWorker | null): void {
  if (waiting === next) return;
  waiting = next;
  for (const listener of listeners) listener();
}

export function subscribeAppUpdate(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function isAppUpdateWaiting(): boolean {
  return waiting !== null;
}

/** Hand over to the waiting version. The page reloads once it has taken over. */
export function applyAppUpdate(): void {
  if (waiting === null) return;
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => window.location.reload(),
    { once: true },
  );
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Web only: not the iOS shell, not Desktop, and only over http(s), which also
 * rules out `file://` and `capacitor://`. A dev server is left alone as well:
 * the plugin writes no worker there, and its 404 would only fail noisily.
 */
export function shouldRegisterServiceWorker(isProduction: boolean): boolean {
  if (!isProduction) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (isNativeMobile()) return false;
  if ("desktop" in window || /\bElectron\b/.test(navigator.userAgent))
    return false;
  const { protocol } = window.location;
  return protocol === "https:" || protocol === "http:";
}

function watch(registration: ServiceWorkerRegistration): void {
  // With no controller this is the first install, and there is nothing to replace.
  const offer = (): void => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      setWaiting(registration.waiting);
    }
  };
  offer();
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed") offer();
    });
  });

  let lastCheck = Date.now();
  const check = (): void => {
    if (document.hidden || Date.now() - lastCheck < UPDATE_CHECK_MS) return;
    lastCheck = Date.now();
    void registration.update().catch(() => {
      // Offline, most likely. The next check asks again.
    });
  };
  document.addEventListener("visibilitychange", check);
  setInterval(check, UPDATE_CHECK_MS);
}

export function registerAppServiceWorker(
  isProduction: boolean = import.meta.env.PROD,
): void {
  if (!shouldRegisterServiceWorker(isProduction)) return;
  void navigator.serviceWorker
    .register(SW_URL)
    .then(watch)
    .catch((e: unknown) => {
      // The app still works online without it.
      console.warn("[pwa] register", e);
    });
}
