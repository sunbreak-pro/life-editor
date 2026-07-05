# HISTORY (chat-design-connect)

### 2026-07-05 - Connect 画面デザイン brief 作成

#### 概要

Connect 画面（ノードグラフ + バックリンク、Desktop + Mobile）の ClaudeDesign 用デザイン brief を `.claude/docs/design/briefs/connect.md` に新規作成した。並行 brief ストリーム（schedule / materials / work / analytics / settings）の connect レーン。

#### 変更点

- **brief 新規作成**: `_TEMPLATE.md` 準拠の 6 章構成。§1-2 は要件（tier-2 WikiTags）と現行実装（`web/src/connect/ConnectScreen.tsx` + `shared/src/components/Connect/`）から `file:line` 引用付きで作成
- **Desktop プロンプト**: フルスクリーン Canvas + 浮遊 HUD 構造を踏襲しつつ、種別凡例チップ新設・loading 状態新設・バックリンクパネルを選択時のみ表示に変更する方針。通常 / 空 / ローディング / フィルタ 0 件 / エラートーストの 5 状態
- **Mobile プロンプト**: Consumption 特化。力学グラフ操作・force 調整・リンク編集を落とし、検索 → ノード詳細 BottomSheet → バックリンク一覧の縦導線を主役に。簡易 1-hop ローカルグラフは任意
- **既知ドリフト記録**: `_COMMON-CONTEXT.md` の accent 系 4 値が tokens.css（2026-07-05 lumen 化 PR #135）より古いことを brief §6 に記録（共通ブロックは改変禁止のためそのまま埋め込み、追随更新は別 PR 対応）
