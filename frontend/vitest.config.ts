import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Pin the test-run timezone so JST characterization tests (dateKey,
    // schedule date keys, etc.) are deterministic regardless of the host /
    // CI machine timezone. Test infrastructure only — no production change.
    env: {
      TZ: "Asia/Tokyo",
    },
  },
});
