# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 section:schedule スプリント — Issues #281 #278 #279 #280（着手日: 2026-07-19）

**対象**: `shared/src/components/`（Schedule 系）+ `web/`
**計画書**: `.claude/docs/vision/plans/2026-07-14-schedule-redesign.md`（関連正本）

- 前回: #279 Repeats 可視化 + this/future/all 範囲ダイアログ実装（QA 4 観点監査の指摘全反映・shared 964 tests + 両 build green・コミット済み）
- 現在: #281 / #278 / #279 の Issue close + push
- 次: #280 責務分離リファクタ（CalendarTab 分解 + vitest・behavior-preserving）

## 直近の完了

- #217 weekStartsOn prefs のカレンダー配線 ✅（2026-07-18 — PR #265 merge 済み・実ブラウザ確認は chat-main 側）
- life-tags S3 完了確認（PR #244 merge・epic #225 closed・`NodeType="task"` 単一値を実測・main 取り込み後 shared 884/884 + web build green）✅（2026-07-12）
- schedule-refine orders 消化クローズ（#222-224 = PR #230 merge 済み・#185 Step 3-4 は別セッション chat-schedule-event-routine の PR #245 で完了・#185 closed。残 Step 5/6 = chat-main 領分）✅（2026-07-12）

## 予定

- schedule-redesign Step 2（Task↔Schedule 双方向書き込み = 計画書 §4-A-2 / Step 3）— #280 完了後。Issue は chat-main が追って起票（`gh issue list --label section:schedule --state open` を区切りで確認）
