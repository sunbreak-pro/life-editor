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
 * typing. A press in another tab activates the new worker for this page too, and
 * that worker drops the old hashed files from the device, so a lazy screen this
 * page has not opened yet can no longer load. This page still does not reload by
 * itself: the band stays up, and its press has only the reload left to do.
 */

const SW_URL = "/sw.js";
/** A long-lived tab or a home-screen app asks for a new version this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

let waiting: ServiceWorker | null = null;
/** Another tab's press activated a newer version under this page. */
let replaced = false;
/** This page's own press is waiting for the new worker to take over. */
let applying = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function setWaiting(next: ServiceWorker | null): void {
  if (waiting === next) return;
  waiting = next;
  notify();
}

export function subscribeAppUpdate(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function isAppUpdateWaiting(): boolean {
  return waiting !== null || replaced;
}

/** Hand over to the waiting version. The page reloads once it has taken over. */
export function applyAppUpdate(): void {
  if (replaced) {
    window.location.reload();
    return;
  }
  if (waiting === null) return;
  applying = true;
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
    const found = registration.waiting;
    if (found === null || !navigator.serviceWorker.controller) return;
    // Replaced by a newer build, or the worker was removed: nothing to apply.
    found.addEventListener("statechange", () => {
      if (found.state === "redundant" && waiting === found) setWaiting(null);
    });
    setWaiting(found);
  };
  const track = (worker: ServiceWorker | null): void => {
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") offer();
    });
  };
  offer();
  // The update check a page load starts can be running before this listens.
  track(registration.installing);
  registration.addEventListener("updatefound", () =>
    track(registration.installing),
  );

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applying) {
      window.location.reload();
      return;
    }
    waiting = null;
    replaced = true;
    notify();
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
