// Vitest global setup for the web suite: auto-clean the DOM between component
// tests. Loaded via vitest.config.ts `setupFiles`.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
