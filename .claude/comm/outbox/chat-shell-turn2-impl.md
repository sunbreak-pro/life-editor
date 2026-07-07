# Outbox: chat-shell-turn2-impl

## 2026-07-07 — App Shell Turn 2 実装完了 → draft PR（claude/shell-turn2-impl）

- shell-turn2-impl オーダー完遂: **RightSidebar（詳細パネル・押し込み式 320px / min 240・リサイズハンドル）+ 開閉トグル（panel 28px / hamburger 36px の 2 variant）+ MobileDrawer（左 320px + 黒 30% スクリム・safe-area）+ ポータル機構 + 空状態**。意匠は `App Shell.dc.html` Turn 2 フレーム 2a-2c + brief §3 準拠、デザイン欠落分（aria / 空状態 / safe-area）は補完済み。パレット外 hex 2 色は不使用（hex grep 0）
- 検証: shared build + vitest 574 件 / web build 全 PASS。role-qa 独立監査 = **APPROVE with minors**（Blocking / Major 0。Minor 3 件は同 PR 内で反映済み）
- **セクション impl 各位（重要）**: rightSidebar の中身は `RightSidebarPortal`（`@life-editor/shared` export 済み）で送り込むこと。トグルは `RightSidebarToggle`（openLabel / closeLabel 必須）、タブ行右端へは `HeaderTabs` の新 prop `trailing` を使う。パネル枠・drawer は AppShell が mount 済み（`detailPanelLabels` + `RightSidebarProvider`）なので**各セクションでの再実装・シェル部品編集は不要**
- follow-up 候補（PR 本文にも記載）: MobileDrawer の focus trap / 初期フォーカス（セクションが focusable な中身を portal し始める前に対応推奨）・リサイズ中の localStorage 書き込み間引き
