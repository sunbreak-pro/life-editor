import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ShortcutEditModal,
  type ShortcutRow,
  type ShortcutEditModalLabels,
} from "../src/components";

/*
 * Shortcut rebind modal. Capture starts on the row that opened it, a
 * conflicting key is warned (never committed), and Cancel restores the
 * open-time snapshot (an id with no override snapshot resets to default).
 */

const ROWS: ShortcutRow[] = [
  {
    id: "global:command-palette",
    category: "global",
    label: "コマンドパレットを開く",
    displayString: "⌘ + K",
    isModified: false,
  },
  {
    id: "nav:tasks",
    category: "navigation",
    label: "タスクへ移動",
    displayString: "⌘ + 1",
    isModified: false,
  },
  {
    id: "nav:schedule",
    category: "navigation",
    label: "スケジュールへ移動",
    displayString: "⌘ + 4",
    isModified: false,
  },
];

const LABELS: ShortcutEditModalLabels = {
  title: "キーボードショートカット",
  description: "行の「変更」を押し、割り当てたいキーを入力します",
  waiting: "キー入力を待機中 · Esc で中止",
  change: "変更",
  cancel: "キャンセル",
  reset: "リセット",
  modified: "変更済み",
  resetAll: "すべてリセット",
  done: "完了",
  conflictTemplate: "「{{action}}」に割り当て済みです",
  categories: { global: "全般", navigation: "移動", edit: "編集" },
};

function renderModal(props?: Partial<Parameters<typeof ShortcutEditModal>[0]>) {
  const onRebind = vi.fn();
  const onResetOne = vi.fn();
  const onResetAll = vi.fn();
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const getConflictLabel = vi.fn().mockReturnValue(null);
  render(
    <ShortcutEditModal
      open
      rows={ROWS}
      config={{}}
      onRebind={onRebind}
      onResetOne={onResetOne}
      onResetAll={onResetAll}
      onDone={onDone}
      onCancel={onCancel}
      getConflictLabel={getConflictLabel}
      labels={LABELS}
      {...props}
    />,
  );
  return {
    onRebind,
    onResetOne,
    onResetAll,
    onDone,
    onCancel,
    getConflictLabel,
  };
}

describe("ShortcutEditModal", () => {
  it("renders the category groups and every row label", () => {
    renderModal();
    expect(screen.getByText("全般")).toBeInTheDocument();
    expect(screen.getByText("移動")).toBeInTheDocument();
    expect(screen.getByText("スケジュールへ移動")).toBeInTheDocument();
  });

  it("begins capturing on the initial row (waiting hint shown)", () => {
    renderModal({ initialCaptureId: "nav:schedule" });
    expect(
      screen.getByRole("button", { name: LABELS.waiting }),
    ).toBeInTheDocument();
  });

  it("warns on a conflicting key and does not commit it", () => {
    const { onRebind, getConflictLabel } = renderModal({
      initialCaptureId: "nav:schedule",
    });
    getConflictLabel.mockReturnValue("タスクへ移動");
    fireEvent.keyDown(screen.getByRole("button", { name: LABELS.waiting }), {
      code: "KeyK",
      key: "k",
      metaKey: true,
    });
    expect(
      screen.getByText("「タスクへ移動」に割り当て済みです"),
    ).toBeInTheDocument();
    expect(onRebind).not.toHaveBeenCalled();
  });

  it("commits a non-conflicting key", () => {
    const { onRebind } = renderModal({ initialCaptureId: "nav:schedule" });
    fireEvent.keyDown(screen.getByRole("button", { name: LABELS.waiting }), {
      code: "KeyJ",
      key: "j",
      metaKey: true,
    });
    expect(onRebind).toHaveBeenCalledWith("nav:schedule", {
      code: "KeyJ",
      meta: true,
    });
  });

  it("restores the snapshot on Cancel (reset an id that had no override)", () => {
    const { onResetOne, onCancel } = renderModal({
      initialCaptureId: "nav:schedule",
    });
    // Commit a change first so the session marks nav:schedule as touched.
    fireEvent.keyDown(screen.getByRole("button", { name: LABELS.waiting }), {
      code: "KeyJ",
      key: "j",
      metaKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onResetOne).toHaveBeenCalledWith("nav:schedule");
    expect(onCancel).toHaveBeenCalled();
  });

  it("restores the snapshot on Cancel (rebind back an id that had an override)", () => {
    const { onRebind, onResetOne, onCancel } = renderModal({
      initialCaptureId: "nav:schedule",
      config: { "nav:schedule": { code: "KeyX", meta: true } },
    });
    // Change the already-overridden id, then cancel: it must be rebound back
    // to the open-time override (KeyX), not reset to its default.
    fireEvent.keyDown(screen.getByRole("button", { name: LABELS.waiting }), {
      code: "KeyJ",
      key: "j",
      metaKey: true,
    });
    expect(onRebind).toHaveBeenCalledWith("nav:schedule", {
      code: "KeyJ",
      meta: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onRebind).toHaveBeenLastCalledWith("nav:schedule", {
      code: "KeyX",
      meta: true,
    });
    expect(onResetOne).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
