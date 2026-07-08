# HISTORY (chat-connect-impl)

### 2026-07-08 - Connect 画面 target IA 実装（draft PR #167）

#### 概要

ClaudeDesign import（ConnectFrame2 = Desktop / ConnectMobile = Mobile）を正本に Connect 画面（グラフ + バックリンク）を刷新。グラフ本体（Canvas 2D + d3-force）は不変のまま、Desktop は shell rightSidebar 統合、Mobile はピークシート + 設定ボトムシートを新設した。

#### 変更点

- **Desktop**: GraphTopBar（フロート HUD）廃止 → ConnectHeader（ヘッダー行）/ GraphLegend（種別凡例）/ ズームピル / GraphStates（loading/empty/nomatch）新設。GraphControlPanel・BacklinkView を ConnectSidebarPanel（RightSidebarPortal 注入）の 2 タブへ移設し、`panelOpen` 二重管理を撤去（shell `isOpen` に一本化・Cmd+F 導線張り替え）
- **Mobile**: NodeDetailSheet（非モーダルピークシート・つながり/バックリンク 2 タブ・IME ガード付きリンク編集）+ GraphSettingsSheet（モーダル・共有 BottomSheet + compact GraphControlPanel 流用）+ nodeSizeScale 1.7（描画のみのタッチ拡大）
- **host**: ConnectScreen に loaded フラグ（初回ロードの一瞬空表示バグ解消）+ 新 labels 注入
- **i18n**: `connect.*` 新キーを en/ja 両 catalog に追加。未参照ラベルフィールド 5 件 prune・デッド IconButton 削除
- **品質**: role-pm 要件分解 → engineer 2 段（Desktop/Mobile）→ role-qa 独立監査 PASS with nits（Should-fix = Mobile 設定シートの compact 化を反映）。commits f32c7ba8 / 12aceff0 / df556af3
