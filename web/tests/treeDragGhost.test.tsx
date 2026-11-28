import { describe, it, expect, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@life-editor/shared";
import { TreeDragGhost } from "../src/components/TreeDragGhost";

const originalLanguage = i18n.language;
afterAll(async () => {
  await i18n.changeLanguage(originalLanguage);
});

describe("TreeDragGhost (#2870)", () => {
  it("shows the grabbed title as is", () => {
    render(<TreeDragGhost title="Kitchen rebuild" />);
    expect(screen.getByText("Kitchen rebuild")).toBeTruthy();
  });

  it("names an empty title in the UI language", async () => {
    await i18n.changeLanguage("ja");
    render(<TreeDragGhost title="" />);
    expect(screen.getByText("無題")).toBeTruthy();
  });
});
