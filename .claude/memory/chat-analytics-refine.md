# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- #356 analytics「今日」境界の要否判断 — 暦日固定で確定（PR #378・merge 待ち）✅（2026-07-26）— day-start hour 追随は見送り（根拠 = 全バケツが暦日キー / 片側だけ変えると深夜セッションが「今日」から外れる。実測込みで Issue #356 にコメント記録済み）。判断をコードに残すため 6 箇所を `todayCalendarKey()` へ統一（挙動不変）+ 決定 pin テスト新規。role-qa PASS（Blocking 0・Should-fix 4 件は全て取り込み）。残り = merge（こうだいさん）→ Issue close
- #334 folder 集計 → タグ集計への置換（PR #359・merge 待ち）✅（2026-07-26）— `findRootFolder` の無ガード祖先たどりを関数ごと退役し `aggregateWorkTimeByTag`（`wiki_tag_assignments` 起点）へ。`TagWorkTimeChart` 改称 / i18n `analytics.tagTime.*` / AnalyticsView props を配列化。role-qa PASS（Blocking 0）、指摘の「top-N 打ち切りで捨てた分が消える」は `other` バケツで修正。残り = merge → close → chat-main 実ブラウザ確認
- Layout Standard v2 §1 タブ帯 lift — analytics（PR #235・#208 は closed 済）✅（2026-07-11）

## 予定

- PR #359 / #378 の merge 後: Issue #334 / #356 を close（merge はこうだいさん操作）
- chat-main へ起票依頼済みの別件フォロー: 完了 Todo の「今日」が UTC 日基準（`completedAt.substring(0,10)` vs ローカル暦日キーの非対称。JST では朝 8 時までの完了が前日カウント）— 起票されたら analytics レーンで対応
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）
