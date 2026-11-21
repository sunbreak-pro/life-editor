import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddPill } from "@life-editor/shared";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";

/*
 * #2793 — the Notes tab and its "+ ノート" create pill were both announced as
 * "ノート". NotesView passes `materials.notes.addCta` as the visible text and
 * `materials.notes.addAria` as the spoken name (pinned against the key in
 * notesView.test.tsx); this file pins the real catalog strings, which that
 * suite cannot see because it stubs `t` to return the key.
 */

describe("note create pill's accessible name (#2793)", () => {
  it.each([
    ["ja", ja, "ノートを作成", "ノート"],
    ["en", en, "Create note", "Note"],
  ])(
    "reads %s as the action while the visible text stays short",
    (_l, cat, name, visible) => {
      const notes = cat.materials.notes;
      expect(notes.addAria).toBe(name);
      expect(notes.addCta).toBe(visible);

      render(
        <AddPill
          onClick={() => {}}
          label={notes.addCta}
          ariaLabel={notes.addAria}
        />,
      );
      const pill = screen.getByRole("button", { name });
      expect(pill.textContent).toBe(visible);
      // The tab is named by the bare label; the pill must not answer to it.
      expect(screen.queryByRole("button", { name: visible })).toBeNull();
    },
  );
});
