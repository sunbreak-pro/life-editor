# HISTORY (chat-materials-impl)

### 2026-07-08 - Materials 4 タブ再構成（target IA / ClaudeDesign import）

#### 概要

Materials セクションの 4 タブ（Tasks / Notes / Daily / Tags）を ClaudeDesign 生成デザイン（8 キャンバス）+ materials brief 準拠で再実装し、draft PR を提出した。isWide 分岐 + RightSidebarPortal の統一パターンで Desktop 詳細パネル活用と Mobile 責務削減を実現。

#### 変更点

- **shared 新規部品（9 種）**: EmptyState / SkeletonList / StatusFilterChips / ExcerptListItem / DateStrip / QuickAddSheet / NoteDetailPanel / DailyEntriesPanel / TagGroupsPanel（全て純プレゼンテーション・props 注入・テスト付き）
- **Tasks**: Kanban 意匠合わせ（タグチップ・件数ピル・空カラム）+ Desktop 詳細を TaskDetailModal から rightSidebar へ + Mobile 縦リスト（チップフィルタ + 60% ステータス Sheet + QuickAdd）
- **Notes**: MasterDetail 撤去 → 中央 800px ツリーカード + NoteDetailPanel portal + Mobile 92% 閲覧シート（hydrate ゲート付き）
- **Daily**: エディタカード + DailyEntriesPanel portal + Mobile DateStrip + i18n 全面追い付き + blur 保存の差分ガード
- **Tags**: タグ一覧カード（hover アクション: rename/ColorPicker/削除）+ TagGroupsPanel portal + Mobile 閲覧 + i18n 全面追い付き
- **品質**: role-qa 独立監査（初回 FAIL → 修正 commit 2eacc47c → 再監査 PASS）。shared test 627 全緑・web build 緑・hex 0・en/ja parity 1961=1961
- **記録**: 計画書 `2026-07-08-materials-impl.md`（Status: Review・merge 後に archive 予定）・shell への CTA slot 要望を outbox 送付
