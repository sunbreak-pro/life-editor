# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- Layout Standard v2 §1 タブ帯 lift — analytics（PR #235・Refs #208）✅（2026-07-11）— タブ帯を標準 SectionHeader へ lift（MainScreen 最小配線 = schedule #205 の作法）/ AnalyticsView controlled 時に in-body HeaderTabs 撤去（期間セレクタは data 列右端）/ `ANALYTICS_TAB_ORDER` を shared 公開（SSOT）。§4 は §5 fluid 統一で moot。shared 846/846 + web build pass。残り = chat-main runtime + PR merge（外部）
- #182 Today カード折返しの実測 + 追修正（SummaryRow 縦積み化・PR #198 merged・#182 closed）・#181 analytics 行チェック ✅（2026-07-11）

## 予定

- #208 の最終 close: chat-main の runtime 確認（wide タブ帯がタイトル兼務・二重「分析」無し・パネル開閉・#182 再発監視）通過で close。PR #235 merge はこうだいさん操作
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補）
- 後続: life-tags（兄弟計画・着手は合図待ち）— タグ別集計は候補
