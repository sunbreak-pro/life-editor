import { describe, it, expect } from "vitest";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";

/*
 * #2223 — the narrow 朝刊/夕刊 band stays on screen while the paper scrolls.
 *
 * Briefing used to ask MainScreen for the band INSIDE its body
 * (`narrowHeaderInBody`, #318 / #879), so it scrolled away with the paper.
 * Without the flag MainScreen puts the band in the PageContainer header, the
 * place every other section's band sits. Whether it then holds still on a
 * real phone is the browser check chat-main runs; what jsdom can pin is that
 * the paper no longer asks for the in-body placement.
 */
describe("The Briefing band lives in the shell header (#2223)", () => {
  it("no longer asks for the band inside its body", () => {
    expect(SECTION_DESCRIPTORS.briefing.narrowHeaderInBody).not.toBe(true);
  });

  it("still has a narrow band with the tabs and the hamburger", () => {
    expect(SECTION_DESCRIPTORS.briefing.narrowHeader).toBe("tabs+hamburger");
    expect(SECTION_DESCRIPTORS.briefing.tabBand).toBe("briefing");
  });
});
