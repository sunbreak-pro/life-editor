import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AiCustomizationValidationError } from "@life-editor/shared";
import { useAiCustomization } from "../src/settings/useAiCustomization";

/*
 * Host half of the Claude customization editor (#2119). The shared editor
 * takes "a sentence or null" from every write; this hook is where the
 * DataService answer becomes that sentence, and where the lists are read —
 * only while the editor is open, and again after each write.
 */

const t = (key: string) => key;

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({ t }),
    // No SyncProvider in a hook test; the domain counter stays at 0.
    useSyncDomains: () => 0,
  };
});

function makeDs() {
  return {
    fetchAiRule: vi.fn().mockResolvedValue({
      body: "be brief",
      createdAt: "",
      updatedAt: "",
    }),
    fetchAiMemories: vi.fn().mockResolvedValue([]),
    fetchAiSkills: vi.fn().mockResolvedValue([]),
    saveAiRule: vi.fn().mockResolvedValue({}),
    createAiMemory: vi.fn().mockResolvedValue({}),
    updateAiMemory: vi.fn().mockResolvedValue({}),
    reorderAiMemories: vi.fn().mockResolvedValue(undefined),
    deleteAiMemory: vi.fn().mockResolvedValue(undefined),
    createAiSkill: vi.fn().mockResolvedValue({}),
    updateAiSkill: vi.fn().mockResolvedValue({}),
    deleteAiSkill: vi.fn().mockResolvedValue(undefined),
  };
}

let ds: ReturnType<typeof makeDs>;
beforeEach(() => {
  ds = makeDs();
});

describe("useAiCustomization", () => {
  it("reads nothing while the editor is closed", () => {
    const { result } = renderHook(() => useAiCustomization(ds, false));
    expect(ds.fetchAiRule).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("reads the three lists once the editor opens", async () => {
    const { result } = renderHook(() => useAiCustomization(ds, true));
    await waitFor(() =>
      expect(result.current.data).toEqual({
        rule: { body: "be brief", createdAt: "", updatedAt: "" },
        memories: [],
        skills: [],
      }),
    );
    expect(result.current.loadError).toBeNull();
  });

  it("says so when the read fails", async () => {
    ds.fetchAiSkills.mockRejectedValue(new Error("offline"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAiCustomization(ds, true));
    await waitFor(() =>
      expect(result.current.loadError).toBe(
        "settings.aiCustomization.loadFailed",
      ),
    );
    spy.mockRestore();
  });

  it("says so when there is no DataService at all", () => {
    const { result } = renderHook(() => useAiCustomization(null, true));
    expect(result.current.loadError).toBe(
      "settings.aiCustomization.loadFailed",
    );
  });

  it("resolves null on a successful write and reads again", async () => {
    const { result } = renderHook(() => useAiCustomization(ds, true));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    let answer: string | null = "unset";
    await act(async () => {
      answer = await result.current.createMemory("likes tea");
    });
    expect(answer).toBeNull();
    expect(ds.createAiMemory).toHaveBeenCalledWith("likes tea");
    await waitFor(() => expect(ds.fetchAiMemories).toHaveBeenCalledTimes(2));
  });

  it("turns a validation refusal into its sentence", async () => {
    ds.createAiSkill.mockRejectedValue(
      new AiCustomizationValidationError("slug", "taken", "createAiSkill"),
    );
    const { result } = renderHook(() => useAiCustomization(ds, true));
    let answer: string | null = null;
    await act(async () => {
      answer = await result.current.createSkill({
        slug: "review",
        description: "d",
        body: "",
      });
    });
    expect(answer).toBe("settings.aiCustomization.issue.taken");
  });

  it("turns any other failure into the generic sentence", async () => {
    ds.deleteAiSkill.mockRejectedValue(new Error("500"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAiCustomization(ds, true));
    let answer: string | null = null;
    await act(async () => {
      answer = await result.current.deleteSkill("aiskill-1");
    });
    expect(answer).toBe("settings.aiCustomization.saveFailed");
    spy.mockRestore();
  });

  it("routes each write to its DataService method", async () => {
    const { result } = renderHook(() => useAiCustomization(ds, true));
    await act(async () => {
      await result.current.saveRule("r");
      await result.current.updateMemory("m1", "b");
      await result.current.deleteMemory("m1");
      await result.current.updateSkill("s1", { body: "v2" });
    });
    expect(ds.saveAiRule).toHaveBeenCalledWith("r");
    expect(ds.updateAiMemory).toHaveBeenCalledWith("m1", "b");
    expect(ds.deleteAiMemory).toHaveBeenCalledWith("m1");
    expect(ds.updateAiSkill).toHaveBeenCalledWith("s1", { body: "v2" });
  });
});
