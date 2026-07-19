# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 section:schedule Issue キュー消化 #296→#297→#298→#299（着手日: 2026-07-19）

**対象**: `shared/src/components/`（Schedule 関連）+ `web/`
**計画書**: Epic #290（tracking — 子 Issue close ごとにチェックボックス更新）

- 前回: #296 消失バグ + #297 A-2 双方向書き込み（PR #309 に同梱・`Fixes #296, #297`）→ **merge 済み**（origin/main `d56852c0`）
- 現在: #298（Step 3 rightSidebar 本日の Todo tray）着手。main 取り込み完了（notes/wikitags 系の別チャット成果も内包）
- 次: #298 実装 → session-verifier → role-qa → PR。着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` 再確認済み

## 直近の完了

- #296 消失バグ + #297 A-2 双方向書き込み ✅（2026-07-20 — PR #309 merge 済み・main `d56852c0`・実ブラウザ確認は chat-main）
- section:schedule スプリント #281 #278 #279 #280 ✅（2026-07-19 — 全 Issue close・PR は branch `claude/schedule-refine` から提出・実ブラウザ確認は merge 後 chat-main）
- #217 weekStartsOn prefs のカレンダー配線 ✅（2026-07-18 — PR #265 merge 済み・実ブラウザ確認は chat-main 側）

## 予定

- （進行中キューに統合済み — #297 が旧「schedule-redesign Step 2」に対応。区切りごとに `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認）
