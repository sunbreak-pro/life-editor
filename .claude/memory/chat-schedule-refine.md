# MEMORY (chat-schedule-refine)

## 進行中

### ⏸️ #217 weekStartsOn prefs のカレンダー配線（着手日: 2026-07-16）

**対象**: `shared/src/hooks/useWeekStart.ts`（新規）/ `shared/src/index.ts` / `web/src/schedule/CalendarTab.tsx`

- 前回: 実装 + 検証完了（shared build/test 908 green・web build green）・PR #265 提出（Closes #217）
- 現在: PR #265 の merge 待ち（🛑 ユーザーゲート）
- 次: merge 後に chat-main 側で実ブラウザ確認（§7.4）。Settings 側の書き込み UI は chat-main へ起票依頼済み（outbox 2026-07-16）

## 直近の完了

- life-tags S3 完了確認（PR #244 merge・epic #225 closed・`NodeType="task"` 単一値を実測・main 取り込み後 shared 884/884 + web build green）✅（2026-07-12）
- schedule-refine orders 消化クローズ（#222-224 = PR #230 merge 済み・#185 Step 3-4 は別セッション chat-schedule-event-routine の PR #245 で完了・#185 closed。残 Step 5/6 = chat-main 領分）✅（2026-07-12）
- life-tags 統一 S2 — calendars の folder→tag rebind（#231 closed・PR #239 merge・db push 後 0020/0021 検証一致）✅（2026-07-11）

## 予定

（なし — section:schedule の open Issue キューは空。#217 の PR merge 待ちのみ）
