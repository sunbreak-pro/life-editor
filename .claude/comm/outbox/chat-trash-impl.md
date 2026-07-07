## 2026-07-08 — Trash 目標 IA 実装完了（draft PR #164）

- ClaudeDesign project ea99bd45 の Trash.dc.html を DesignSync で import し、brief §3-§4 / IA.md と突き合わせて実装（fan-out 計画書の trash-impl オーダー）
- shared: **TrashView フル書き換え** — ページヘッダ（説明 + 全 N 件）/ 空カテゴリ畳み / 件数バッジ / 危険度非対称（復元 = ラベル付き secondary・完全削除 = icon-only danger + 確認必須）/ カスケード警告 / 行単位 TrashBusy スピナー / 768px で Modal ↔ BottomSheet。**TrashViewLabels が破壊的変更**（emptyCategory 廃止・description / totalCount / emptyDescription / restoring / deleting / cascadeWarning 追加）— 他レーンで TrashView を使う場合は新形 labels が必要
- web: TrashScreen に skeleton ローディング / 再読込付きエラーカード / per-row busy を実装。i18n は en / ja 両 catalog に trash.* 新キー追加
- 規約優先の丸め 5 点（outline→secondary / サイズ DS スケール化 / Modal danger 円アイコン省略 / 警告ボックスの palette 外 border 破棄 / mobile 全画面ヘッダはシェル領分）は PR 本文に記載
- 検証: shared build + trash 系 48 tests pass / web build pass / hex 直書き 0。シェル所有部品（AppShell / HeaderTabs / MainScreen 等）は無変更。merge と実画面目視はユーザーゲート
