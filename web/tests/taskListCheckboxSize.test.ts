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

/**
 * The text between `marker` and the brace that closes it. `close` is "}" for a
 * plain rule and "\n}" for an @media block, whose inner rules close first.
 */
function block(marker: string, close = "}"): string {
  const start = indexCss.indexOf(marker);
  expect(start, `no rule matching \`${marker}\``).toBeGreaterThan(-1);
  return indexCss.slice(start + marker.length, indexCss.indexOf(close, start));
}

/** The declaration block of the task-list checkbox rule. */
function checkboxRule(): string {
  return block(
    '.note-editor .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {',
  );
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

  /*
   * The two things `appearance: none` + `mask` took away, and where they had
   * to be put back. Both were found by review AFTER the mask landed, and
   * neither shows up in any rendered assertion: jsdom has no layout, and a
   * ring that IS declared but silently clipped looks identical to one that is
   * declared correctly. Source text is the only guard.
   */
  it("puts the focus ring on the label, which no mask clips", () => {
    expect(block("> label:has(input:focus-visible) {")).toMatch(/outline:/);
    // NOT on the input: a mask composites the whole element it paints, and an
    // outline is painted outside the border box where the mask's alpha is 0 —
    // so a ring declared there is drawn and then thrown away. A box-shadow
    // ring, which is the shape the Tailwind-style fix takes, goes the same way.
    expect(
      checkboxRule(),
      "a ring on the masked input would be clipped away",
    ).not.toMatch(/outline:|box-shadow:/);
  });

  it("stays visible in forced colours, in the user's own palette", () => {
    // Forced colours force every background-color to Canvas, and this mark IS
    // a background-color — without an opt-out the box is a hole at both
    // states. What it opts into has to be system colours, never ours.
    // The sheet holds more than one forced-colours block now (#1606 added one
    // for the attachment chip's delete button), so pick THIS one by what it is
    // about rather than by it being the first.
    const forced = indexCss
      .split("@media (forced-colors: active) {")
      .slice(1)
      .map((rest) => rest.slice(0, rest.indexOf("\n}")))
      .find((rule) => rule.includes('input[type="checkbox"]'));
    expect(forced, "no forced-colours block for the checkbox").toBeDefined();
    expect(forced).toContain("forced-color-adjust: none");
    expect(forced).toMatch(/background-color:\s*CanvasText/);
    expect(forced).toMatch(/background-color:\s*Highlight/);
  });
});

/*
 * The TOUCH target, below the app's 768px breakpoint (#1523).
 *
 * The audit's measurement was `label` 20 x 25.6 against the paper's 49.5 and
 * the Schedule tray's 50 — the same todo, three sizes, and the smallest one on
 * the surface with the least precise pointer. Source text again: jsdom has no
 * layout, so a rendered label measures 0 x 0 whatever the rule says.
 *
 * Every number below is derived from `TOUCH_TARGET_PX` rather than written out,
 * so the floor moves in one place if it ever moves.
 */
describe("the Materials task-list checkbox is thumb-sized on narrow (#1523)", () => {
  /** The touch floor from mobile-scope.md, in px. */
  const TOUCH_TARGET_PX = 44;
  const rem = (px: number) => `${px / 16}rem`;
  const AREA = '  .note-editor .ProseMirror ul[data-type="taskList"] li > label::before {';

  /**
   * The narrow-width block the touch rules live in — found FROM those rules
   * rather than from the first `@media (max-width: 767px)` in the file, which
   * is the mobile font floor and has nothing to do with this.
   */
  function narrow(): string {
    const inner = indexCss.indexOf(AREA);
    expect(inner, "no narrow-width task-list rules").toBeGreaterThan(-1);
    // Not `pointer: coarse`: the app's own convention is the 768px WIDTH
    // breakpoint (ItemLinkMenu's `max-md:min-h-11`), and the audit that found
    // this ran a desktop browser resized to 390px — which reports a fine
    // pointer and would have seen no change at all under a pointer query.
    const start = indexCss.lastIndexOf("@media (max-width: 767px) {", inner);
    expect(
      start,
      "the touch rules are outside the 768px breakpoint",
    ).toBeGreaterThan(-1);
    return indexCss.slice(start, indexCss.indexOf("\n}", start));
  }

  it("gives the row the room, so two areas cannot overlap", () => {
    // Without this the 44px areas of consecutive items would reach into each
    // other and a tap near the boundary would toggle the wrong todo.
    const row = block(
      '  .note-editor .ProseMirror ul[data-type="taskList"] li {',
      "\n  }",
    );
    expect(row).toContain(`min-height: ${rem(TOUCH_TARGET_PX)}`);
  });

  it("puts the area on the label rather than making the label taller", () => {
    // A taller label would re-centre the box inside it and drop it off the
    // first line of its own text (#883). A pseudo-element leaves the 1.6em
    // line box — and therefore the alignment — exactly as it was.
    const rule = block(AREA, "\n  }");
    expect(rule).toMatch(/position: absolute/);
    expect(rule).toContain(`height: ${rem(TOUCH_TARGET_PX)}`);
    // Centred on the box it belongs to, not hung off its top edge.
    expect(rule).toMatch(/top: 50%/);
    expect(rule).toMatch(/transform: translateY\(-50%\)/);
  });

  it("keeps the area inside the checkbox's own column", () => {
    // The pseudo-element spans the label's width, so widening the label is what
    // stops the area covering the first characters of the text beside it.
    expect(narrow()).toContain(`min-width: ${rem(TOUCH_TARGET_PX)}`);
  });

  it("leaves the drawn box the size the shared control draws", () => {
    // Only the TARGET grows. A 44px mark would be a different checkbox from the
    // one the paper and the tray draw, which is the opposite of #1368.
    expect(narrow()).not.toMatch(/--todo-checkbox-size/);
  });
});
