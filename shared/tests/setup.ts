// Vitest global setup: registers @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveClass, ...) and auto-cleans the DOM between
// component tests. Loaded via vitest.config.ts `setupFiles`.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
