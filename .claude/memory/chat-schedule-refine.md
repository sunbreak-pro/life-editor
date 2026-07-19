# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 section:schedule Issue キュー消化 #296→#297→#298→#299（着手日: 2026-07-19）

**対象**: `shared/src/components/`（Schedule 関連）+ `web/`
**計画書**: Epic #290（tracking — 子 Issue close ごとにチェックボックス更新）

- 前回: #296 実装完了（消失バグ・データ層6経路+表示層3経路）→ commit `39b51c99`・PR #309
- 現在: #297（Step 2 / A-2: task チップ drag/resize → `scheduledAt`/`scheduledEndAt` 双方向書き込み）実装完了。commit `d80e0b96`・shared 1069 tests + shared/web build + web eslint 全 green・role-qa 別コンテキスト PASS（Blocker なし・Nit 反映）。**ユーザー決定で PR #309 に #296 と同梱**（#296+#297 1 本・`Fixes #296, #297`・merge 待ち）。多日/overnight task drag の span 潰れは後追い Issue 起票を outbox で chat-main 依頼
- 次: #298（Step 3 rightSidebar 本日の Todo tray）。着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` 再確認

## 直近の完了

- #296 消失バグ + #297 A-2 双方向書き込み ✅（2026-07-20 — PR #309 に同梱・merge 待ち・実ブラウザ確認は merge 後 chat-main）
- section:schedule スプリント #281 #278 #279 #280 ✅（2026-07-19 — 全 Issue close・PR は branch `claude/schedule-refine` から提出・実ブラウザ確認は merge 後 chat-main）
- #217 weekStartsOn prefs のカレンダー配線 ✅（2026-07-18 — PR #265 merge 済み・実ブラウザ確認は chat-main 側）

## 予定

- （進行中キューに統合済み — #297 が旧「schedule-redesign Step 2」に対応。区切りごとに `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認）
