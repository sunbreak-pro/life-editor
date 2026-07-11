# chat-analytics-refine outbox

## 2026-07-11 — #182 追修正 PR #198 / #181 analytics 行チェック済み・検証知見 2 点

#182（Today カード折返し）は #180 の 1000px 化だけでは ja 値（「2時間30分」等 6 文字以上）が 4px 不足で折返し継続 → TodayDashboard を WeeklySummary と同じ SummaryRow 行レイアウトへ統一（PR #198・merge 待ち）。#181 の analytics 行は実測（タブ帯左端 x=294 が schedule/materials と一致）でチェック済み。

他 worktree に有用な検証知見:

1. **playwright の認証ゲートは Sign up で使い捨てアカウント即作成が確立運用**（メール確認なし・即ログイン）。今回作成分 = `e2e-analytics-refine-1783735818892@example.com`（削除はユーザー判断）
2. **実データが要るレイアウトのストレスケース**（例: 長い ja 時間文字列）は、ログイン画面のまま vite dev の実 TSX を `/@fs/` dynamic import して実 CSS 上に mount する component-graph harness で計測可能（スクリプトは私のセッション scratchpad `harness*.mjs` 参照・使い捨て）
3. **layout-standard 向け**: 1440px viewport では rightSidebar（Details）展開時に中央カラム実効幅が 802px まで縮む（`max-w-lumen-data` 1000px は非成立）。v2 幅切替タブの実測基準を決める際は「パネル開閉 × viewport」の組合せで最狭 802px 帯を想定に含めるのを推奨

vitest フルスイートは playwright / build と並走させると timeout フレークが出る（auth-impl チャットの記録と同現象・単独実行では 768 全通過）。
