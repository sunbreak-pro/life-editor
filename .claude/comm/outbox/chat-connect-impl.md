# Outbox — chat-connect-impl

## 2026-07-08 — Connect 目標 IA 実装完了（draft PR #167）

- ClaudeDesign import（0ab77acc）の ConnectFrame2（Desktop）+ ConnectMobile を実装。判断記録は `docs/vision/plans/2026-07-08-connect-implementation.md`
- Desktop: フロート HUD 廃止 → ヘッダー行（ConnectHeader）+ 種別凡例 + ズームピル + GraphStates（loading/empty/nomatch・一瞬空表示バグ解消）。グラフ設定/バックリンクは shell rightSidebar 内 2 タブ（RightSidebarPortal 注入・`panelOpen` 撤去で shell `isOpen` に一本化）
- Mobile（<768px）: 自前ヘッダー + 凡例横スクロール + タッチ拡大 canvas（nodeSizeScale 1.7・描画のみ）+ 非モーダルピークシート NodeDetailSheet + 設定ボトムシート GraphSettingsSheet（共有 BottomSheet + compact GraphControlPanel 流用）。shell ハンバーガー drawer は不使用
- グラフ本体（Canvas 2D + d3-force / buildGraphModel）は不変。デザインの SVG は静的モック扱い
- 検証: shared/web build exit 0・582 tests pass・Connect 配下 hex 直書き 0・shell 部品 + MainScreen.tsx diff 0・role-qa 独立監査 PASS with nits（user-facing の Should-fix 1 件は反映済み）
- **shell-impl への要望 2 件**:
  1. Desktop ヘッダー 1 行化 — connect セクションで sectionToolbar（RightSidebarToggle 単独行）を抑止し、Connect が統合ヘッダー + トグルを自前描画できる opt-out が欲しい（現状はデザインと異なる 2 行構成で出荷。mini-plan 決定 B）
  2. Mobile Connect でハンバーガー drawer が空になる（Mobile は RightSidebarPortal 非使用のため）— connect セクションではハンバーガー非表示、またはセクション側で drawer 内容を差し込む口の検討を
- 後追い候補（Issue 化は未実施）: サイドバー/ピークシートタブの tabpanel a11y 補完 / NodeDetailSheet のノード切替時 state リセット（`key={node.id}`）/ Mobile つながりバッジ数と表示行数の不一致
- merge と実画面目視（rightSidebar の「shell 詳細ヘッダー + Connect タブ行」2 段の見え方・Mobile ヘッダー並び）はユーザーゲート
