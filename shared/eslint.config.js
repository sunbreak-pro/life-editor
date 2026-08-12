import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/*
 * ESLint for shared/ (#421). web/ has been linted in CI since #364, but the
 * code body lives HERE — so the larger half of the app was outside the net.
 *
 * The ruleset mirrors web/eslint.config.js with one deliberate omission:
 * eslint-plugin-react-refresh. Its `configs.vite` preset checks that a module
 * suitable for Fast Refresh exports components ONLY, which is a constraint on
 * a Vite app's own modules. shared/ is a tsc-built library consumed through a
 * barrel (components/index.ts) and full of modules that pair a component with
 * its contract (items/ItemRoleBadge + itemRole, Kanban builders + cards) —
 * exactly the shape the rule exists to reject. Applying it here would report
 * a design this package chose on purpose, not a defect.
 *
 * Everything web checks that describes real hazards — js.recommended,
 * typescript-eslint recommended, and the react-hooks rules that found the
 * violations behind this issue — applies unchanged.
 */
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // vitest runs with `globals: true` (vitest.config.ts), so describe / it /
    // expect / vi are ambient in the suites rather than imported.
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
]);
