import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useClaudeLauncher } from "../src/hooks/useClaudeLauncher";

/*
 * Host half of the Claude Code launcher (#1211).
 *
 * The shared card is deliberately ignorant here: it takes a sentence and shows
 * it. Which sentence — and whether one comes back at all — is this hook's job,
 * so it is where the two ways the feature can lie live. A failure that reads
 * as a success, and a rejection that escapes as an unhandled promise instead
 * of a message, both look fine in the component's own tests.
 */

const t = (key: string) => key;

/**
 * What `getDataService()` answers (#2120). Null = it throws, the way it does
 * without Supabase credentials — the default here, so the #1211 cases below
 * launch without customization exactly as before.
 */
let dataService: Record<string, unknown> | null = null;

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({ t }),
    getDataService: () => {
      if (!dataService) throw new Error("no credentials");
      return dataService;
    },
  };
});

const bridge = {
  getClaudeProjectPath: vi.fn(),
  launchClaude: vi.fn(),
};

beforeEach(() => {
  bridge.getClaudeProjectPath.mockReset().mockResolvedValue("");
  bridge.launchClaude.mockReset().mockResolvedValue({ ok: true });
  (window as unknown as { desktop?: unknown }).desktop = bridge;
});

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop;
  dataService = null;
});

describe("useClaudeLauncher", () => {
  it("reports unavailable without the desktop bridge", async () => {
    // The browser and the Capacitor shells. `available` is what withholds the
    // sidebar row and the Settings field on both.
    delete (window as unknown as { desktop?: unknown }).desktop;
    const { result } = renderHook(() => useClaudeLauncher());

    expect(result.current.available).toBe(false);
    await expect(result.current.launch()).resolves.toBe(
      "settings.ai.errorUnavailable",
    );
  });

  it("treats an older desktop build without the launcher as unavailable", async () => {
    // `window.desktop` exists but predates #1211 — showing the button would
    // invoke a channel main has no handler for.
    (window as unknown as { desktop?: unknown }).desktop = {
      getTheme: vi.fn(),
    };
    const { result } = renderHook(() => useClaudeLauncher());
    expect(result.current.available).toBe(false);
  });

  it("seeds the field with the folder the last launch saved", async () => {
    bridge.getClaudeProjectPath.mockResolvedValue("/home/u/life-editor");
    const { result } = renderHook(() => useClaudeLauncher());

    await waitFor(() =>
      expect(result.current.projectPath).toBe("/home/u/life-editor"),
    );
  });

  it("does not overwrite what the user typed while the read was in flight", async () => {
    let resolveRead: (value: string) => void = () => {};
    bridge.getClaudeProjectPath.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRead = resolve;
      }),
    );
    const { result } = renderHook(() => useClaudeLauncher());

    act(() => result.current.setProjectPath("/typed/by/hand"));
    await act(async () => {
      resolveRead("/saved/earlier");
    });

    expect(result.current.projectPath).toBe("/typed/by/hand");
  });

  it("sends no folder at all when launching without one", async () => {
    // The sidebar row. An empty string would read as "the user cleared the
    // field"; absent means "use whatever main already saved".
    const { result } = renderHook(() => useClaudeLauncher());
    await result.current.launch();
    expect(bridge.launchClaude).toHaveBeenCalledWith({});
  });

  it("sends the folder it was given", async () => {
    const { result } = renderHook(() => useClaudeLauncher());
    await result.current.launch("/home/u/life-editor");
    expect(bridge.launchClaude).toHaveBeenCalledWith({
      projectPath: "/home/u/life-editor",
    });
  });

  it("resolves to null on success, so the card can say a terminal opened", async () => {
    const { result } = renderHook(() => useClaudeLauncher());
    await expect(result.current.launch("/x")).resolves.toBeNull();
  });

  it("turns each failure code into its own sentence", async () => {
    const { result } = renderHook(() => useClaudeLauncher());
    const cases = [
      ["no-project-path", "settings.ai.errorNoPath"],
      ["invalid-project-path", "settings.ai.errorInvalidPath"],
      ["claude-not-found", "settings.ai.errorNotFound"],
      ["spawn-failed", "settings.ai.errorSpawnFailed"],
    ] as const;

    for (const [code, key] of cases) {
      bridge.launchClaude.mockResolvedValue({ ok: false, error: code });
      await expect(result.current.launch("/x")).resolves.toBe(key);
    }
  });

  it("still says something for a code this build does not know", async () => {
    // A newer main naming a failure we have no wording for. Silence would be
    // the one outcome the user cannot act on.
    bridge.launchClaude.mockResolvedValue({
      ok: false,
      error: "tomorrows-code",
    });
    const { result } = renderHook(() => useClaudeLauncher());
    await expect(result.current.launch("/x")).resolves.toBe(
      "settings.ai.errorSpawnFailed",
    );
  });

  it("answers with a sentence when the invoke itself rejects", async () => {
    // Not a throw: the card calls this from a click handler, and a rejection
    // there would escape as an unhandled promise with nothing on screen.
    bridge.launchClaude.mockRejectedValue(new Error("No handler registered"));
    const { result } = renderHook(() => useClaudeLauncher());

    await expect(result.current.launch("/x")).resolves.toBe(
      "settings.ai.errorUnavailable",
    );
  });

  describe("customization (#2120)", () => {
    it("hands main the saved rules, memories and skills", async () => {
      dataService = {
        fetchAiRule: vi.fn().mockResolvedValue({ body: "be brief" }),
        fetchAiMemories: vi
          .fn()
          .mockResolvedValue([{ id: "m1", body: "likes tea", sortOrder: 0 }]),
        fetchAiSkills: vi.fn().mockResolvedValue([
          {
            id: "s1",
            slug: "weekly-review",
            description: "Fridays",
            body: "# Steps",
            createdAt: "",
            updatedAt: "",
          },
        ]),
      };
      const { result } = renderHook(() => useClaudeLauncher());
      await act(async () => {
        await result.current.launch("/home/u/repo");
      });
      expect(bridge.launchClaude).toHaveBeenCalledWith({
        projectPath: "/home/u/repo",
        customization: {
          rules: "be brief",
          memories: ["likes tea"],
          skills: [
            { slug: "weekly-review", description: "Fridays", body: "# Steps" },
          ],
        },
      });
    });

    it("sends empty rules when nothing is saved yet", async () => {
      dataService = {
        fetchAiRule: vi.fn().mockResolvedValue(null),
        fetchAiMemories: vi.fn().mockResolvedValue([]),
        fetchAiSkills: vi.fn().mockResolvedValue([]),
      };
      const { result } = renderHook(() => useClaudeLauncher());
      await act(async () => {
        await result.current.launch();
      });
      expect(bridge.launchClaude).toHaveBeenCalledWith({
        customization: { rules: "", memories: [], skills: [] },
      });
    });

    it("still launches when the read fails", async () => {
      dataService = {
        fetchAiRule: vi.fn().mockRejectedValue(new Error("offline")),
        fetchAiMemories: vi.fn().mockResolvedValue([]),
        fetchAiSkills: vi.fn().mockResolvedValue([]),
      };
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useClaudeLauncher());
      let answer: string | null = "unset";
      await act(async () => {
        answer = await result.current.launch();
      });
      expect(answer).toBeNull();
      expect(bridge.launchClaude).toHaveBeenCalledWith({});
      spy.mockRestore();
    });
  });
});
