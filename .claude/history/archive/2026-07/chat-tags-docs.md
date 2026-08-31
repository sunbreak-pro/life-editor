# HISTORY ARCHIVE (chat-tags-docs, 2026-07)

ローリングアーカイブ: `history/chat-tags-docs.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-07-30 - #474 plans/ の Status 棚卸しと archive 移動

#### 概要

`.claude/docs/vision/plans/` の 12 本を Issue / PR の state とコードに突き合わせ、完了していた 9 本を `archive/` へ移した（PR #485・レビュー待ち）。

#### 変更点

- **判定方法**: 判定の正は `gh issue list` / `gh pr list` の state ＋ コード実測。`git diff` / `git log` / `git cherry` は squash merge を未マージと誤判定するため不使用（CLAUDE.md §7.4）。12 本を並列 fan-out で調査し、COMPLETED 判定は全件メイン側で state を再実測して spot check（docs-consistency §5）
- **archive 移動**: COMPLETED 8 本（design-implementation-fanout / work-implementation / app-integration / layout-unification-fanout / event-routine-unification / layout-standard-v2 / life-tags-unification / open-issue-fanout）+ SUPERSEDED 1 本（link-ux-obsidian-style — 3 軸すべて別方式で着地しており Draft のままでは実態と矛盾）
- **plans/ 残置 3 本**: desktop-daily-driver（残は Mac 実機ゲート）/ schedule-redesign（#466〜#469 open）/ loop-engineering-harness（Phase 1〜3 未消化）の Status 行を実態へ修正
- **archive の enum 化 6 本**: `ARCHIVED` / `DONE` / `COMPLETED（Superseded）` / stale な `IN PROGRESS`（docs-consistency-cleanup・PR #178 merge 済みなのに残っていた）を enum に統一
- **参照の付け替え**: 移動で壊れる相対リンクと Parent 行（schedule-redesign / loop-harness / fanout-r2 / tier-1-core / tier-2-supporting / archive/SUMMARY.md / archive 3 本）を修正。`.claude/` 配下 161 本のリンクを解決して新規の壊れゼロを確認
- **chat-main へ回した判断**: claudedesign fan-out は COMPLETED 相当だが CLAUDE.md §6 が「デザイン追跡正本」と宣言しているため据え置き（D-20260730-tags-1）
- **申し送り**: `grep -n "^Status:"` は `**Status**:` 形式と blockquote 前置を取りこぼす（実際 2 本見落とし）。全数チェックは node で先頭 14 行を両形式で走査した

### 2026-07-30 - #368 WikiTags 一覧の名前フィルタ

#### 概要

アプリで唯一タグマスタ全件を並べるタグ編集パネルに、名前での絞り込み入力を追加した（PR #481 merged）。

#### 変更点

- **共有部品の切り出し**: `SidebarListControls` のフィルタ行を `shared/src/components/materials/SidebarFilterField.tsx` として独立させ、sidebar / modal の 2 プリセット（`size`）を持たせた。`SidebarListControls` は sort props 必須で「ソート無し・フィルタのみ」を表現できなかったため（スコープは D-20260728-main-3 で名前フィルタのみに縮小確定）
- **TagEditModal**: 追加行とリストの間にフィルタ行。大文字小文字を無視した部分一致（item 側 `TagPicker` と同規則）・一致 0 件は専用コピー・タグが 1 件も無いときはフィルタ行を出さない・開き直しでクエリ reset
- **i18n**: `materials.tags.filterPlaceholder` / `filterLabel` / `filterEmpty` を en / ja 両 catalog に追加
- **テスト**: `shared/tests/tagEditModalFilter.test.tsx` を 9 ケース新規追加（既存 `tagEditModalItems.test.tsx` の LABELS も追随）
- **横展開の申し送り**: `Connect/GraphControlPanel.tsx:177-198` のタグ pill 群も絞り込み無しなので outbox から起票依頼
