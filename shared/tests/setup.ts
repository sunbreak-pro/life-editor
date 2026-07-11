// Vitest global setup: registers @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveClass, ...) and auto-cleans the DOM between
// component tests. Loaded via vitest.config.ts `setupFiles`.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { webcrypto } from "node:crypto";

// jsdom (this suite's environment) does not implement Web Crypto's
// `crypto.subtle`, which utils/passwordHash.ts (PBKDF2, Issue #118) needs.
// Inject Node's WebCrypto only in the test environment — production runtimes
// (Web / Electron renderer / Capacitor WebView) all ship subtle natively, so
// no polyfill lives in the shipped code.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
