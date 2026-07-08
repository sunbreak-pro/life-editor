# Outbox — chat-materials-impl

## 2026-07-08 → chat-shell-turn2-impl: Materials タブ行 trailing slot の追加要望

- **背景**: materials デザイン（ClaudeDesign 8 キャンバス）では、新規作成 CTA（Tasks「+ タスクを追加」/ Notes「+ ノート」/ Tags「+ タグ」/ Daily「今日へ」）が**タブ行右端（PanelRight トグルの左）**に置かれている。タブ行は `web/src/MainScreen.tsx`（shell 所有・編集禁止）が `HeaderTabs trailing={<RightSidebarToggle/>}` で描画しているため、materials-impl 側からは注入できない。
- **暫定対応**: materials-impl は各タブのコンテンツ先頭アクション行に CTA を置いて実装を進める（mini-plan `2026-07-08-materials-impl.md` 差分宣言 #1）。
- **要望**: MainScreen の materials タブ行 trailing に、セクション側から CTA を注入できる slot（例: portal target `<div id>` を trailing 内に置く / もしくは shared に `HeaderTabsActionsPortal` 追加）を検討してほしい。追加されたら materials 側で CTA をタブ行へ昇格させる。
- 併せて Mobile: デザインのページタイトルヘッダー（ハンバーガー + "Materials" 22px bold + "+" 32px accent）は現行シェル標準（ハンバーガー + SegmentedControl 1 行）と異なる。シェル標準を変える場合は materials 側も追随する（現状は現行標準で実装）。

## 2026-07-08 → all: materials-impl 完了報告（draft PR #170）

- **成果物**: draft PR https://github.com/sunbreak-pro/life-editor/pull/170（`feat: materials — target IA implementation (ClaudeDesign import)`・8 commits・base main）
- **内容**: Materials 4 タブ（Tasks/Notes/Daily/Tags）を ClaudeDesign 8 キャンバス + brief 準拠で再実装。isWide 分岐 + RightSidebarPortal 統一パターン。新規 shared 部品 9 種（EmptyState/SkeletonList/StatusFilterChips/ExcerptListItem/DateStrip/QuickAddSheet/NoteDetailPanel/DailyEntriesPanel/TagGroupsPanel — 他セクションでも流用可）。Daily/Tags の i18n 追い付き込み
- **品質**: role-qa 独立監査 初回 FAIL → 修正（2eacc47c）→ 再監査 PASS。shared test 627 全緑・web build 緑・hex 0・en/ja parity 1961=1961・シェル所有ファイル無変更（ベース f04e7f08 比）
- **他チャットへの共有事項**: `shared/src/components/index.ts` に `export * from "./materials"` を追記済み（追記のみ・既存行無変更）。locales は `materials.*` namespace を追加。Kanban カードのタグチップ意匠を変更（色 tint → bg-secondary ピル + 色ドット）— Kanban を参照する画面があれば見た目が変わる
- **merge はユーザー判断**（self-merge しない）。機能後退 2 点（Daily タグ/リンク UI 撤去・Tags グループ rename/delete 未実装）を PR 本文に明記済み
