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
      "src/components/ColorPicker.tsx",
      "src/components/CommandPalette.tsx",
      "src/components/ShortcutEditModal.tsx",
      "src/components/TagEditModal.tsx",
      "src/components/TaskAddDialog.tsx",
      "src/components/materials/QuickAddSheet.tsx",
      "src/context/TimerContext.tsx",
      "src/hooks/useCalendarsAPI.ts",
      "src/hooks/useRoutinesAPI.ts",
      "src/hooks/useScheduleItemsAPI.ts",
      "src/hooks/useTaggedItemIndex.ts",
      "src/hooks/useTaskTreeAPI.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    /*
     * react-hooks/refs — 10 files down to 1 (#505). The nine that went were
     * all the same two shapes: a callback/value mirrored into a ref while
     * rendering (moved to a dep-less effect — every reader runs after the
     * commit, so the value they see is unchanged), and one lazy ref init
     * (now a useState initializer, which React can see runs exactly once).
     * useFrozenNoteSortKey kept its render-time snapshot semantics — losing
     * them re-opens #366 — by moving to state adjusted during render.
     *
     * The one left is NOT the same shape: useGraphInteraction reads
     * `simRef.current` inside a DEPENDENCY ARRAY, to re-attach its canvas
     * listeners when the d3 simulation is replaced. A ref read during render
     * cannot do that job — it holds whatever the previous commit left, so the
     * dep only changes on the render AFTER the swap, if one happens at all.
     * Fixing it means the listeners reading `simRef.current` at event time
     * instead of capturing it (which also makes the dep unnecessary), and that
     * is a change to the Connect graph canvas with no test around it. Left for
     * its own PR rather than folded into a lint sweep.
     */
    files: ["src/components/Connect/graph/useGraphInteraction.ts"],
    rules: { "react-hooks/refs": "off" },
  },
  {
    files: ["src/components/Connect/graph/useGraphSimulation.ts"],
    rules: { "react-hooks/immutability": "off" },
  },
]);
