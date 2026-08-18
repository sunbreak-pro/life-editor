import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { useFirstAppearance } from "../src/hooks/useFirstAppearance";

/*
 * #1049 — the gate behind the section entrance animation.
 *
 * jsdom runs no animations, so what is testable is the decision, which is the
 * part with the actual rules: once per key, never replayed on a return visit,
 * and stable across the unrelated re-renders that would otherwise pull the
 * class off mid-fade.
 */

function Probe({ initial }: { initial: string }) {
  const [key, setKey] = useState(initial);
  const [, bump] = useState(0);
  const first = useFirstAppearance(key);
  return (
    <div>
      <output>{`${key}:${first ? "first" : "seen"}`}</output>
      <button type="button" onClick={() => setKey("a")}>
        a
      </button>
      <button type="button" onClick={() => setKey("b")}>
        b
      </button>
      <button type="button" onClick={() => bump((n) => n + 1)}>
        rerender
      </button>
    </div>
  );
}

const state = () => screen.getByRole("status").textContent;

describe("useFirstAppearance", () => {
  it("reports the very first key as a first appearance", () => {
    render(<Probe initial="a" />);
    expect(state()).toBe("a:first");
  });

  it("reports a newly visited key as a first appearance", () => {
    render(<Probe initial="a" />);
    fireEvent.click(screen.getByRole("button", { name: "b" }));
    expect(state()).toBe("b:first");
  });

  it("does not replay on a return visit", () => {
    render(<Probe initial="a" />);
    fireEvent.click(screen.getByRole("button", { name: "b" }));
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(state()).toBe("a:seen");
  });

  it("holds the answer across unrelated re-renders", () => {
    // The regression this guards: recomputing per render flips the answer to
    // false as soon as anything else updates, which yanks the animation class
    // off an element that is still fading in.
    render(<Probe initial="a" />);
    fireEvent.click(screen.getByRole("button", { name: "rerender" }));
    fireEvent.click(screen.getByRole("button", { name: "rerender" }));
    expect(state()).toBe("a:first");
  });
});
