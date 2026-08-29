import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1183 — the task-list checkbox is sized, and sized in `em`.
 *
 * This is a stylesheet-only change with no DOM to assert against: jsdom has no
 * layout (CLAUDE.md §7.1), so a rendered checkbox measures 0×0 whatever the CSS
 * says, and the rule can be dropped in a merge without a single suite going
 * red. Reading the source text is the only check available — the same shape
 * fieldFontFloorLockstep.test.ts uses for the mobile font floor.
 *
 * The UNIT is half the point. A px size would come loose from the 1.6em line
 * box the label centres the checkbox inside (#883) as soon as the editor's font
 * changes — and it does change: the mobile floor raises it (#1134). In `em` the
 * two track each other, which is what keeps the box optically on the first
 * line of its item's text at every size.
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

describe("the Materials task-list checkbox keeps its size (#1183)", () => {
  it("declares an explicit box rather than leaving the UA default", () => {
    const rule = checkboxRule();
    expect(rule, "no width — back to the UA's ~13px").toMatch(/width:\s*[\d.]/);
    expect(rule, "no height — back to the UA's ~13px").toMatch(
      /height:\s*[\d.]/,
    );
  });

  it("sizes it in em, so it tracks the editor's font", () => {
    const rule = checkboxRule();
    expect(rule).toMatch(/width:\s*[\d.]+em/);
    expect(rule).toMatch(/height:\s*[\d.]+em/);
  });

  it("is bigger than the default it replaced", () => {
    const rule = checkboxRule();
    const width = Number(/width:\s*([\d.]+)em/.exec(rule)?.[1]);
    // 13px at the editor's 0.875rem body is ~0.93em, so anything at or under
    // that would be the shrink this Issue was filed to undo.
    expect(width).toBeGreaterThan(1);
    // And it still has to fit the 1.6em line box the label gives it.
    expect(width).toBeLessThan(1.6);
  });
});
