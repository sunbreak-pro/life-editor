# MEMORY (chat-tags-docs)

## 進行中

### 🔧 #472 Undo/Redo のモバイル導線（着手日: 2026-07-30）

**対象**: `shared/src/components/AppShell.tsx` / `web/src/MainScreen.tsx` / `web/src/HeaderUndoRedo.tsx` / `.claude/docs/requirements/mobile-scope.md`
**ブランチ**: `claude/mobile-472-undo-redo`（origin/main = ac8d5430 から。#465 = PR #479 は merge 済みで着手条件クリア）

- 前回: #474 の PR #485 を作成（レビュー待ち）
- 現在: 狭幅の導線候補を実測中（AppShell の narrow 分岐 / BottomTabBar の More / MobileDrawer のどこに置くか）
- 次: 導線を決めて実装 → `mobile-scope.md` #16 行を実態へ追随 → Epic #321 Phase 2 の該当行にチェック → 根拠を Issue コメント

### ⏸️ #474 plans/ の Status 棚卸しと archive 移動（着手日: 2026-07-30）

**対象**: `.claude/docs/vision/plans/` / `.claude/archive/`
**ブランチ**: `claude/docs-474-plans-status`（PR #485 open）

- 前回: 12 本を Issue / PR の state + コード実測で判定（`git diff` 判定は禁止ルールどおり不使用）
- 現在: PR #485 レビュー待ち。COMPLETED 8 本 + SUPERSEDED 1 本を archive 移動・IN PROGRESS 3 本は Status 行を修正・archive の enum 違反 6 本も修正済み
- 次: merge 後に Issue #474 の close を確認。claudedesign fan-out 1 本は **D-20260730-tags-1** として chat-main の判断待ち（動かしていない）

## 直近の完了

- #368 WikiTags 一覧の名前フィルタ ✅（2026-07-30・PR #481 merged）

## 予定

- #473 コマンドパレットのモバイルタッチ導線（Epic #321 Phase 2 / mobile-scope #17）
