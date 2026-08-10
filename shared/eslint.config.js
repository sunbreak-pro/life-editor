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

  /*
   * BASELINE (#421) — the violations that already existed the day shared/
   * entered CI, quarantined to the exact files that carry them.
   *
   * Why a baseline instead of fixing them in this PR: every rule below reports
   * a behavioral pattern (reading or writing a ref during render, setting
   * state inside an effect, mutating a value React expects to be immutable).
   * Changing them is a render-timing change across the app's core contexts —
   * UndoRedo, Timer, TaskTree, Schedule — and this worktree can only run build
   * + vitest; nothing here can tell whether a "fix" broke the screen. Landing
   * the net first means every NEW file is checked from today, which is the
   * part that stops the debt from growing.
   *
   * Why per-file lists and not a blanket severity downgrade: turning the rules
   * to "warn" globally would silence them for new code too. Listed this way
   * the exceptions are a shrinking to-do — deleting a path from a list is how
   * a fix gets recorded, and a NEW violation in an unlisted file still fails
   * CI. Do not append to these lists; fix the file instead.
   */
  {
    files: [
      "src/context/TimerContext.tsx",
      "src/hooks/useCalendarsAPI.ts",
      "src/hooks/useRoutinesAPI.ts",
      "src/hooks/useScheduleItemsAPI.ts",
      "src/hooks/useTaggedItemIndex.ts",
      "src/hooks/useTaskTreeAPI.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);
