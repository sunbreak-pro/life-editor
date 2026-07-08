import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsDetailPanel } from "../src/components";

/*
 * Settings rightSidebar body. Pure presentation: renders the appearance
 * preview (tasks) + the tips list from injected copy.
 */
describe("SettingsDetailPanel", () => {
  it("renders the preview tasks, summary, and tips", () => {
    render(
      <SettingsDetailPanel
        fontPx={16}
        tasks={[
          { label: "買い物リストを作る", done: false },
          { label: "コーヒー豆を注文する", done: true },
          { label: "夕食の下ごしらえをする", done: false },
        ]}
        tips={[
          { title: "変更は即時保存されます", body: "保存ボタンはありません。" },
          { title: "文字サイズは本文に反映", body: "本文の可読性だけを調整。" },
          {
            title: "⌘K から検索・変更",
            body: "コマンドパレットでも変更できます。",
          },
        ]}
        labels={{
          previewHeading: "現在の外観",
          windowTitle: "今日のタスク",
          previewTitle: "今日のタスク",
          appearanceSummary: "テーマ: ライト · 文字サイズ 16px（4/10）",
          tipsHeading: "ヒント",
        }}
      />,
    );
    expect(screen.getByText("現在の外観")).toBeInTheDocument();
    expect(screen.getByText("ヒント")).toBeInTheDocument();
    expect(screen.getByText("買い物リストを作る")).toBeInTheDocument();
    expect(screen.getByText("コーヒー豆を注文する")).toBeInTheDocument();
    expect(
      screen.getByText("テーマ: ライト · 文字サイズ 16px（4/10）"),
    ).toBeInTheDocument();
    expect(screen.getByText("変更は即時保存されます")).toBeInTheDocument();
    expect(screen.getByText("⌘K から検索・変更")).toBeInTheDocument();
  });
});
