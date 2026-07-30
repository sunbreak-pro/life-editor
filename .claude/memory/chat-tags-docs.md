# MEMORY (chat-tags-docs)

## 進行中

### 🔧 #482 Stop hook（stop-check.sh）の廃止（着手日: 2026-07-30）

**対象**: `.claude/settings.json` / `.claude/hooks/stop-check.sh` / `.claude/CLAUDE.md` §7.3 / `.claude/docs/vision/plans/_TEMPLATE.md`
**ブランチ**: `claude/chore-remove-stop-hook`（origin/main = a7ff58c0 から。前提の #474 は PR #485 merged で着手条件クリア）

- 前回: #368 QA 追随（PR #489）が merged
- 現在: hooks.Stop エントリ削除 + stop-check.sh 削除 + docs 2 ファイルの hook 前提文言を除去
- 次: JSON 妥当性 / grep 残存確認 → commit → PR（Fixes #482）

## 直近の完了

- #472 Undo/Redo のモバイル導線 ✅（2026-07-30・PR #487 merged / Issue closed）
- #474 plans/ の Status 棚卸しと archive 移動 ✅（2026-07-30・PR #485 merged / Issue closed）
- #368 WikiTags 一覧の名前フィルタ ✅（2026-07-30・PR #481 + QA 追随 #489 merged）

## 予定

- #473 コマンドパレットのモバイルタッチ導線（Epic #321 Phase 2 / mobile-scope #17）
