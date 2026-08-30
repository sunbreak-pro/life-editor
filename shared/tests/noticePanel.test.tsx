import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoticePanel, type NoticeTone } from "../src/components";

/*
 * #1184 — the shared warning / notice / refusal band.
 *
 * What is worth pinning is what the five hand-rolled predecessors disagreed
 * about, since every one of those disagreements is invisible on screen:
 * whether the band interrupts a screen reader, whether it carries a glyph, and
 * whether its tone face is a real color or a class Tailwind never emitted.
 */

const TONES: NoticeTone[] = ["info", "success", "warning", "danger"];

describe("NoticePanel live region", () => {
  it.each([
    ["danger", "alert"],
    ["warning", "alert"],
    ["info", "status"],
    ["success", "status"],
  ] as const)("announces %s as %s", (tone, expected) => {
    render(<NoticePanel tone={tone} message="Something happened" />);
    expect(screen.getByRole(expected)).toHaveTextContent("Something happened");
  });

  it("lets the host override the tone-derived role", () => {
    // The auth surfaces rely on this: a successful password reset IS the
    // answer to a submit the user just made, so it interrupts even though
    // `success` is polite by default (shared/tests/authCard.test.tsx pins the
    // error half of the same pair).
    render(<NoticePanel tone="success" role="alert" message="Saved" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Saved");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("leaves aria-live off an assertive band", () => {
    // role="alert" already implies assertive; re-declaring politeness on it is
    // how a band ends up announced twice, or not at all.
    render(<NoticePanel tone="danger" message="Failed" />);
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBeNull();
    render(<NoticePanel tone="info" message="Heads up" />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

describe("NoticePanel glyph", () => {
  it("draws the tone's own glyph by default", () => {
    const { container } = render(
      <NoticePanel tone="danger" message="Failed" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("drops the glyph entirely for icon={null}", () => {
    // `null` is "no glyph", distinct from `undefined` = "use the tone's" — the
    // notes sidebar needs the dense one-line band.
    const { container } = render(
      <NoticePanel tone="danger" message="Failed" icon={null} />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });

  it("swaps in a host glyph", () => {
    const { container } = render(
      <NoticePanel
        tone="warning"
        message="Offline"
        icon={<svg data-testid="wifi-off" />}
      />,
    );
    expect(container.querySelector('[data-testid="wifi-off"]')).not.toBeNull();
  });
});

describe("NoticePanel action", () => {
  it("renders the single affordance and calls back", () => {
    const onClick = vi.fn();
    render(
      <NoticePanel
        message="Repeats are hidden"
        action={{ label: "Show them", onClick }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show them" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders no button when there is nothing to do about it", () => {
    render(<NoticePanel message="Repeats are hidden" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("NoticePanel tone face", () => {
  /*
   * A dynamic `bg-lumen-${tone}-subtle` is invisible to Tailwind's scanner, so
   * the utility is never emitted and the band renders TRANSPARENT rather than
   * erroring (§5 silent-transparent-fail). jsdom cannot see that — it has no
   * stylesheet — so this pins the two halves that would have to agree: the
   * literal class on the element, and the token behind it existing in both
   * theme scopes of tokens.css.
   */
  it.each(TONES)("puts the literal %s face on the panel", (tone) => {
    const { container } = render(<NoticePanel tone={tone} message="x" />);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain(`bg-lumen-${tone}-subtle`);
    expect(panel.className).toContain(`border-lumen-${tone}`);
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");
  const light = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/.exec(css);
  const dark = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);

  it.each(TONES)("maps --color-lumen-%s-subtle onto a real token", (tone) => {
    expect(css).toContain(
      `--color-lumen-${tone}-subtle: var(--color-${tone}-subtle)`,
    );
  });

  it.each(TONES)("defines --color-%s-subtle in both themes", (tone) => {
    // Missing from one side and that theme's band goes transparent, which is
    // exactly the failure no screenshot-free gate would otherwise catch.
    expect(light![1]).toContain(`--color-${tone}-subtle:`);
    expect(dark![1]).toContain(`--color-${tone}-subtle:`);
  });
});

describe("NoticePanel text variant", () => {
  /*
   * #1278 — the three in-form errors were bare <p>/<span> with a hand-typed
   * role and a hardcoded tone class. What the variant has to keep is
   * everything the band already centralised MINUS the chrome, so these pin
   * both halves: the live region is still DERIVED from the tone, and none of
   * the band's border / fill / glyph comes along for the ride.
   */
  it("keeps the tone-derived live region", () => {
    render(<NoticePanel variant="text" tone="danger" message="Failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    // Assertive already; re-declaring politeness is the double-announce bug.
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBeNull();
  });

  it("is polite for the tones that do not interrupt", () => {
    render(<NoticePanel variant="text" tone="info" message="Heads up" />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("draws no band: no border, no fill, no glyph", () => {
    const { container } = render(
      <NoticePanel variant="text" tone="danger" message="Failed" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).not.toContain("border");
    expect(el.className).not.toContain("bg-lumen");
    expect(container.querySelector("svg")).toBeNull();
  });

  it.each(TONES)("carries the literal %s text color", (tone) => {
    // Same silent-fail reasoning as the band's face: a built
    // `text-lumen-${tone}` is never emitted by Tailwind's scanner, and copy in
    // the default color is not a failure anyone would catch in review.
    const { container } = render(
      <NoticePanel variant="text" tone={tone} message="x" />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain(
      `text-lumen-${tone}`,
    );
  });

  it("takes the dense size for a chip row", () => {
    // LinkPanel's row is all text-xs. `cn` is concatenation, not
    // tailwind-merge, so this cannot be a className — the base text-sm would
    // win on source order (rules/frontend.md §Gotchas).
    const { container } = render(
      <NoticePanel variant="text" size="xs" message="x" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("text-xs");
    expect(el.className).not.toContain("text-sm");
  });

  it("exposes an id a field can describe itself by", () => {
    // NotePasswordDialog's two inputs point aria-describedby at this node;
    // without the prop the swap would silently drop that association.
    render(<NoticePanel variant="text" id="err-1" message="x" />);
    expect(screen.getByRole("status").getAttribute("id")).toBe("err-1");
  });
});
