import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TODO_CHECKBOX_ICON_PX } from "@life-editor/shared";

/*
 * #1183 → #1368 — the task-list checkbox is sized, and sized to MATCH.
 *
 * This is a stylesheet-only rule with no DOM to assert against: jsdom has no
 * layout (CLAUDE.md §7.1), so a rendered checkbox measures 0×0 whatever the CSS
 * says, and the rule can be dropped in a merge without a single suite going
 * red. Reading the source text is the only check available — the same shape
 * fieldFontFloorLockstep.test.ts uses for the mobile font floor.
 *
 * What changed with #1368 is the UNIT, and why. #1183 sized it in `em` so it
 * tracked the editor's font, which the mobile floor raises (#1134). The size
 * that matters now is the one every OTHER todo checkbox draws — the paper's
 * carryover rows and the Schedule tray both render <TodoStatusCheckbox> — and
 * that is a px. So the lockstep runs across the package boundary: the number in
 * the stylesheet has to be the number the component exports, and this file is
 * what fails when someone changes one of them.
 *
 * #883's constraint survives the switch and is asserted below: the box still
 * has to fit inside the 1.6em line box its label centres it in, or it stops
 * sitting on the first line of its own text.
 */

const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(
  resolve(here, "../src/index.css"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The declaration block of the task-list checkbox rule. */
function checkboxRule(): string {
  const marker =
    '.note-editor .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {';
  const start = indexCss.indexOf(marker);
  expect(start, "the task-list checkbox rule is gone").toBeGreaterThan(-1);
  const end = indexCss.indexOf("}", start);
  return indexCss.slice(start + marker.length, end);
}

describe("the Materials task-list checkbox keeps its size (#1183 / #1368)", () => {
  it("declares an explicit box rather than leaving the UA default", () => {
    const rule = checkboxRule();
    expect(rule, "no width — back to the UA's ~13px").toMatch(/width:\s*\S/);
    expect(rule, "no height — back to the UA's ~13px").toMatch(/height:\s*\S/);
  });

  it("is the same size the shared todo checkbox draws", () => {
    const rule = checkboxRule();
    const declared = Number(
      /--todo-checkbox-size:\s*(\d+(?:\.\d+)?)px/.exec(rule)?.[1],
    );
    expect(declared, "no --todo-checkbox-size in the rule").not.toBeNaN();
    expect(declared).toBe(TODO_CHECKBOX_ICON_PX);
    // Declared once and used for both axes — a rule that repeats the number
    // can go half-stale.
    expect(rule).toMatch(/width:\s*var\(--todo-checkbox-size\)/);
    expect(rule).toMatch(/height:\s*var\(--todo-checkbox-size\)/);
  });

  it("still fits the line box its label centres it in (#883)", () => {
    // The editor body is 0.875rem = 14px and the label is 1.6em tall, so the
    // box has 22.4px to sit in. The mobile floor only ever raises the font,
    // which makes that box taller — this is the tight case.
    expect(TODO_CHECKBOX_ICON_PX).toBeLessThanOrEqual(0.875 * 16 * 1.6);
  });

  it("is bigger than the default it replaced", () => {
    // 13px is roughly what the UA drew before #1183.
    expect(TODO_CHECKBOX_ICON_PX).toBeGreaterThan(13);
  });

  it("wears the same two marks the React control does", () => {
    const rule = checkboxRule();
    // lucide's `circle` — masked, not drawn by the UA, which is what makes the
    // shape identical to <TodoStatusCheckbox> rather than merely similar.
    expect(rule).toMatch(/mask:\s*var\(--todo-checkbox-mark\)/);
    expect(rule).toContain("circle cx='12' cy='12' r='10'");
    // and lucide's `circle-check` for the checked state.
    expect(indexCss).toContain("path d='m9 12 2 2 4-4'");
  });
});
