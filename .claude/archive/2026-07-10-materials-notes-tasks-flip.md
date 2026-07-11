---
Status: COMPLETED
Created: 2026-07-10
Branch: claude/materials-refine
Owner-chat: materials-refine
Parent: 2026-07-05-design-implementation-fanout.md
---

# Plan: Materials — Notes / Tasks レイアウト反転（リスト = rightSidebar / 本文・詳細 = メイン）

## Context

- **動機**: ユーザー指示（2026-07-10）。Daily で確立した「サイドバー = 一覧 / メイン = 編集」の操作モデルを Notes / Tasks にも揃える。
  1. Notes: メインのノートツリーリストを rightSidebar へ移し、メインを Daily 同様の本文編集スペースにする。NoteDetailPanel のメタ UI（タイトル / ピン / 削除 / タグ / リンク）と RichTextEditor は**メイン編集画面に統合**（ユーザー選択済み）
  2. Tasks: 標準 = rightSidebar 縦リスト（Folder / Status / Tag グルーピング切替 + 折りたたみグループ見出し + 件数）+ メイン詳細。**従来の看板はビュー切替トグルで残す**（ユーザー選択 B）
- **確定済み設計判断**（role-pm 推奨を採用）:
  - **wide mount 時に `rightSidebar.open()`**: isOpen は非永続 false 始まりのため、auto-open しないとサイドバーのリスト = ナビ手段が見えない。Notes / Tasks(list) の View mount で open() を呼ぶ（context 経由・シェル無改変）
  - **board モード中の詳細は現状どおり sidebar**: 全幅ボードのメインに詳細を置く余地がないため、board = 現状挙動を丸ごと維持。detail の居場所がモードで変わる非対称は許容（目視ゲートでユーザー確認）
  - Notes メイン本文は既存 `NoteDetailPanel` を max-w-800px ラッパで再利用（必要なら variant prop を additive に追加）
  - 看板トグルは web/ 内の自作 2 択（list / board アイコン）。`SegmentedControl` には依存しない（#180 が触る予定のため結合回避）。永続キー `life-editor.tasks.layout-mode`・既定 `list`
  - グルーピング軸（folder/status/tag）とレイアウト軸（list/board）は直交。viewMode は既存 `persistKanbanViewMode` キーを両モード共有で流用。list モードの切替 UI は TaskListPanel 見出しに置く
  - 未選択時のメインは既存 `EmptyState`（選択 or 作成 CTA）
- **制約**: シェル所有物（MainScreen / AppShell / HeaderTabs / SegmentedControl / RightSidebar* / MobileDrawer / BottomTabBar / SidebarNav / NavItem / tokens.css）無改変 ／ `frontend/` FROZEN ／ lumen-* トークンのみ ／ i18n props 注入・en/ja 同数 ／ getDataService() 直呼び禁止 ／ Mobile（narrow）挙動は現状維持
- **Non-goals**: Daily / Tags タブの変更 ／ Mobile 導線の再設計 ／ シェル部品・トークン変更 ／ #181 layout standard adoption（#180 merge 後に別途）

## Scope (Touchable Paths)

```
web/src/notes/**
web/src/tasks/**
web/src/daily/**                           # PageContainer adoption（#181 materials 分）のみ
shared/src/components/materials/**        # TaskListPanel 新規 / NoteDetailPanel additive 変更
shared/src/components/index.ts            # barrel 追記のみ
shared/src/i18n/locales/{en,ja}.json      # キー追加のみ
shared/tests/**
.claude/docs/vision/plans/2026-07-10-materials-notes-tasks-flip.md
.claude/memory/chat-materials-refine.md
.claude/history/chat-materials-refine.md
```

## Steps

| #   | Step                                                                                                                  | Gate | Acceptance           |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---- | -------------------- |
| N1  | i18n キー追加（materials.notes.* のメイン編集・空状態文言 en/ja）                                                     | 🤖   | 両 catalog 同数      |
| N2  | Notes 反転本体（tree → RightSidebarPortal / NoteDetailPanel+editor → メイン / mount open() / EmptyState）             | 🤖   | shared+web build 緑  |
| N3  | Notes サイドバー幅ポリッシュ（検索+フォルダ作成行リフロー・240px 耐性）                                               | 🤖   | build 緑・目視       |
| T1  | TaskListPanel 新規（純プレゼン・グループ見出し+折りたたみ+件数+行）+ barrel + tests + i18n                            | 🤖   | shared build+test 緑 |
| T2  | Tasks layout-mode 配線（list/board トグル・localStorage・list = TaskListPanel+メイン TaskDetailPanel / board = 現状） | 🤖   | build 緑             |
| T3  | list モードのグルーピング切替 + 空状態 + ポリッシュ                                                                   | 🤖   | build 緑             |
| V   | session-verifier → playwright-ui-verifier（wide/narrow・list/board・DnD）→ role-qa 独立監査                           | 🤖   | AC 全消化            |
| PR  | tracker END → draft PR → 目視確認                                                                                     | 👀   | ユーザー確認         |
| M   | PR merge                                                                                                              | 🛑   | ユーザー操作         |

コミットはステップ単位・pathspec 明示（`git add -A` 禁止）。

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` / `npm run test` / `cd web && npm run build` すべて exit 0
- [ ] `git diff origin/main --name-only` に frontend/ とシェル所有ファイル（MainScreen / AppShell / HeaderTabs / SegmentedControl / RightSidebar* / MobileDrawer / BottomTabBar / SidebarNav / NavItem / tokens.css）が含まれない
- [ ] 変更 .tsx/.ts に hex 直書き 0（`#[0-9a-fA-F]{3,8}` grep・lumen トークンのみ）
- [ ] en.json / ja.json の新規キー集合が一致
- [ ] NotesView / KanbanView / TaskListPanel に `getDataService(` 出現 0
- [ ] playwright 検証: list モード（sidebar リスト + メイン詳細 + auto-open + 未選択空状態）/ board モード（看板全幅 + DnD + sidebar 詳細）/ Notes tree DnD が sidebar 幅で動作 / narrow の Notes・Tasks が現状維持 / console error 0
- [ ] 完了時: 本計画 Status 更新 + archive 移動 + per-chat memory 更新（DoD）

## Risks

- **#180 layout-standard との並行**: 直接衝突ファイルなし（#180 は幅/gutter/タブ帯/SegmentedControl、rightSidebar 機構への言及なしを確認済み）。共有 barrel は追記のみで最小化。merge 順が逆になったら rebase で追随
- **detail 居場所のモード非対称**（list=メイン / board=sidebar）: 目視ゲートでユーザー確認。NG なら board 中は詳細モーダル等へ切替を検討
- **Notes tree の 240px 耐性**: truncate + hover-only アクションで吸収。N3 でポリッシュ
- worktree dotenv 欠落（memory `worktree-supabase-treeshake`）: build は型検証目的。dev 確認時は main の web/.env.local をコピー

## References

- role-pm レポート（2026-07-10・本チャット）/ Explore 構造調査（同）
- 手本: `web/src/daily/DailyView.tsx`（EditorCard + DailyEntriesPanel）
- 規約: `.claude/rules/frontend.md` / brief: `.claude/docs/design/briefs/materials.md`
- 前段実装: `2026-07-08-materials-impl.md`（Status: Review・4 タブ + rightSidebar 詳細パネル）

## Worklog

- 2026-07-10: 計画作成。ユーザー確定 2 点（Notes メタはメイン統合 / Tasks 看板はトグル残し・標準 list）。role-pm 分解 → auto-open / board 非対称は推奨採用。#180 の rightSidebar 無関与を実測確認
- 2026-07-11: N1〜N3 / T1〜T3 実装完了（8 commits）。role-qa PASS（Blocking 0）・playwright 全 14 項目検証（BLOCKING 0）。origin/main merge（#186〜#188 = layout standard v1）→ build/test 全緑。追加対応: MAJOR-1（folder グルーピングに root 未分類バケット追加）/ MINOR-4（wide→narrow 境界でドロワー残留 → close）/ a11y count ラベル / PageContainer adoption（#181 materials 分・NotesView+DailyView の二重ラップ剥がし + KanbanView）。MAJOR-2（409 sync・既存データ層）は本 PR 対象外 — Issue 起票はユーザー判断待ち
