# MEMORY (chat-shell-refine)

## 進行中

### ⏸️ #409 タグ編集パネルの新設 = PR #425（open = merge 待ち・着手日: 2026-07-27）

**対象**: `shared/src/components/{TagEditModal,SidebarNav,AppShell}.tsx` + 新規 `components/items/`（itemRole / ItemRoleBadge）+ 新規 `hooks/useTaggedItemIndex.ts` + `web/src/tags/TagEditorHost.tsx` + NotesView の導線撤去

- 前回: —
- 現在: PR #425 merge 待ち（merge = こうだいさん。ブランチ = claude/tags-409-tag-edit-panel）
- 次: merge 後に実ブラウザ実測を chat-main へ（§7.4）→ 続けて #412（同じ `itemRole` 契約を使うアイテム側の付け外し）

## 直近の完了

- #409 タグ編集パネル: leftSidebar のパレット直上に入口を新設し、タグのマスタ管理をグローバルなモーダルへ集約。モーダル内に「そのタグが付いているアイテム一覧 + 種類バッジ + 外すボタン」を追加。**種類表示の正本 = `shared/src/components/items/itemRole.ts`（#412 と共有する契約）**。Notes 側の旧導線は一本化のため撤去。gate 全緑（shared test 1191 / shared build / web build / web lint / docs-lint）。PR #425（open）✅（2026-07-27）
- #304 Epic close: 子 PR 1 #316 / 子 PR 2 #380 が両方 merged だったため main 実コードで DoD 全項目を実測確認 → body チェックボックス消し込み + 完了コメント + close (completed)。見送り = Routine。**docs PR #389 は merged 2026-07-26**（旧記載の「merge 待ち」は stale だったため訂正）✅（2026-07-26）
- #304 子 PR 2: schedule / daily / note の undoRedo 配線 + 子 PR 1 バグ修正（PR #380 **merged 2026-07-26**）✅（2026-07-26）

## 予定

- **#412 アイテム側のタグ付け外し UI**（section:tags open）— #409 で切った `itemRole` / `ItemRoleBadge` の契約をそのまま使う側。着手前に PR #425 の merge を待つ（同じ型を触るため）
- #368 WikiTags 一覧のソート・フィルタ — #409 で前提が変わったため設計申し送りコメントを投下済み（2026-07-27）。**判断はユーザー / chat-main 采配**（推奨 = スコープを「名前の絞り込みのみ」に絞る or DEFERRED。`SidebarListControls` の再利用ありきで決めないこと）
- shared-fix [all] 宛 open 2 件が残存（#363 docs 追随 sweep / #321 Mobile UI/UX Epic）— 次セッション開始時に自分の担当分を判断して着手
- merge 後の実ブラウザ実測は §7.4 に従い chat-main（worktree 側は build / 型検証 / vitest まで）
- ⚠️ `git stash@{0}` に「shell-refine stale snapshot before #409」を退避中（旧 claude/shell-refine-outbox-364 = PR #414 merged 済みブランチに残っていた staged 43 ファイル。main へ追いつく途中の残骸で固有の作業は無いと判定）。不要と確認できたら `git stash drop`
