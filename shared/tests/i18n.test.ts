// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { i18n, LANGUAGE_STORAGE_KEY } from "../src/i18n";

/*
 * W0-4: the shared i18next singleton must boot with both catalogs and
 * resolve en<->ja. This guards the cross-platform i18n base the web /
 * desktop / mobile hosts all consume.
 *
 * Scope: what the *runtime* does — initialization, `fallbackLng`, and plural
 * resolution through `t()` (plus the undo-label pin below, which is about a
 * silent `defaultValue` fallback rather than the catalogs' shape).
 * The catalogs' key sets (en / ja parity and the
 * `_other` requirement) are NOT checked here; `i18nKeys.test.ts` owns those,
 * since it already reads the JSON files to scan call sites (#778 — both
 * invariants used to be asserted in both files, each with its own plural
 * regex, so a change to one could leave the looser copy quietly green).
 */

describe("shared i18n", () => {
  it("is initialized with en + ja resources", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("ja", "translation")).toBe(true);
  });

  it("falls back to en and exposes the language storage key", () => {
    expect(i18n.options.fallbackLng).toContain("en");
    expect(LANGUAGE_STORAGE_KEY).toBe("life-editor-language");
  });

  /*
   * D-20260810-refactor-1: RoutineProvider now pushes onto the global undo
   * stack, and UndoRedoHost translates the applied command's label with
   * `t("undoRedo.labels.<label>", { defaultValue: label })`. A missing entry
   * is silent — the toast just shows the raw command name ("createRoutine")
   * — so the three routine labels are pinned in both catalogs here.
   */
  it("carries every routine undo label in both catalogs", () => {
    const labels = ["createRoutine", "updateRoutine", "deleteRoutine"];
    for (const lng of ["en", "ja"]) {
      for (const label of labels) {
        // getResource, not t(): `fallbackLng: en` answers for a missing ja
        // entry, which would hide the exact gap this test exists to catch.
        const entry = i18n.getResource(
          lng,
          "translation",
          `undoRedo.labels.${label}`,
        );
        expect(entry, `${lng}/${label}`).toBeTypeOf("string");
      }
    }
  });

  /*
   * #997: the two conversion labels are deliberately NOT in
   * TODO_HISTORY_LABELS (that closed union is for tree writes routed through
   * updateNode), so the lockstep test over that union does not reach them.
   * Same silent failure as the routine labels above — a missing entry just
   * shows the raw command name in the toast.
   */
  it("carries every conversion undo label in both catalogs", () => {
    const labels = ["convertEventToTodo", "convertTodoToEvent"];
    for (const lng of ["en", "ja"]) {
      for (const label of labels) {
        const entry = i18n.getResource(
          lng,
          "translation",
          `undoRedo.labels.${label}`,
        );
        expect(entry, `${lng}/${label}`).toBeTypeOf("string");
      }
    }
  });

  it("resolves the same key differently per language", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("section.todos")).toBe("Todos");
    await i18n.changeLanguage("ja");
    expect(i18n.t("section.todos")).toBe("Todo");
    // restore default so test ordering stays neutral
    await i18n.changeLanguage("en");
  });
});

/*
 * #680: "1 todos" shipped because the count key had a single form. The fix is
 * i18next's own plural resolution (en: one / other, ja: other), NOT a ternary
 * at the call site — so these assert through t() with a count, which is exactly
 * how KanbanView asks for the string.
 */
describe("shared i18n — plurals", () => {
  it("picks the singular form for count=1 in en", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("materials.todos.todoCount", { count: 1 })).toBe("1 todo");
    expect(i18n.t("materials.todos.todoCount", { count: 2 })).toBe("2 todos");
    expect(i18n.t("materials.todos.todoCount", { count: 0 })).toBe("0 todos");
  });

  it("keeps the one Japanese form at every count", async () => {
    await i18n.changeLanguage("ja");

    expect(i18n.t("materials.todos.todoCount", { count: 1 })).toBe("Todo 1 件");
    expect(i18n.t("materials.todos.todoCount", { count: 2 })).toBe("Todo 2 件");

    await i18n.changeLanguage("en");
  });

  /*
   * #1242: the same single-form key, in the Schedule toolbar's tag filter.
   * This one only ever reached an aria-label ("Filtered by 1 tags"), so
   * nothing on screen looked wrong and only a screen reader heard it — which
   * is why the assertion goes through t() with a count, the way
   * scheduleCopy's toolbarLabels builds that label.
   */
  it("picks the singular tag-filter label for count=1 in en", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("scheduleScreen.filterActive", { count: 1 })).toBe(
      "Filtered by 1 tag",
    );
    expect(i18n.t("scheduleScreen.filterActive", { count: 2 })).toBe(
      "Filtered by 2 tags",
    );
    expect(i18n.t("scheduleScreen.filterActive", { count: 0 })).toBe(
      "Filtered by 0 tags",
    );
  });

  it("keeps the one Japanese tag-filter form at every count", async () => {
    await i18n.changeLanguage("ja");

    expect(i18n.t("scheduleScreen.filterActive", { count: 1 })).toBe(
      "タグ 1 件で絞り込み中",
    );
    expect(i18n.t("scheduleScreen.filterActive", { count: 2 })).toBe(
      "タグ 2 件で絞り込み中",
    );

    await i18n.changeLanguage("en");
  });

  /*
   * #1276: the five remaining single-form `{{count}}` keys, split the same
   * way. Four of them reach the screen as visible text rather than an
   * aria-label — a toolbar label, two list counts and a destructive confirm —
   * and every call site already passes `count` without branching on it, so
   * the catalog is the only place a singular can come from.
   */
  it("picks the singular form for count=1 on the #1276 keys in en", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("scheduleScreen.repeatFilterHidden", { count: 1 })).toBe(
      "1 repeat hidden",
    );
    expect(i18n.t("scheduleScreen.repeatFilterHidden", { count: 3 })).toBe(
      "3 repeats hidden",
    );
    expect(i18n.t("materials.tags.usageCount", { count: 1 })).toBe("1 item");
    expect(i18n.t("materials.tags.usageCount", { count: 2 })).toBe("2 items");
    expect(i18n.t("connect.itemCount", { count: 1 })).toBe("1 item");
    expect(i18n.t("connect.itemCount", { count: 2 })).toBe("2 items");
    expect(
      i18n.t("todoDetail.todoDeleteCascadeConfirm", { name: "Trip", count: 1 }),
    ).toBe('Deleting "Trip" also deletes its 1 child todo. Delete anyway?');
    expect(
      i18n.t("itemConvert.childrenBlocked", { title: "Trip", count: 1 }),
    ).toBe(
      '"Trip" has 1 subtask, so it cannot become an event. Move or delete it first.',
    );
  });

  it("keeps the one Japanese form for the #1276 keys", async () => {
    await i18n.changeLanguage("ja");

    expect(i18n.t("scheduleScreen.repeatFilterHidden", { count: 1 })).toBe(
      "繰り返し 1 件を非表示",
    );
    expect(i18n.t("connect.itemCount", { count: 1 })).toBe("1 件");

    await i18n.changeLanguage("en");
  });
});
