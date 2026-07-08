# HISTORY (chat-shell-turn2-impl)

### 2026-07-07 - App Shell Turn 2 — RightSidebar 詳細パネル + Mobile drawer 実装

#### 概要

design-implementation-fanout の shell-turn2-impl オーダーを完遂。ClaudeDesign Turn 2 フレーム（2a-2c）+ brief §3「rightSidebar 標準」に沿って、詳細パネルのポータル機構・開閉トグル・Mobile ハンバーガー drawer を shared/ に新設し、web ホストへ配線した（draft PR 提出・self-merge なし）。

#### 変更点

- **shared 新規（8）**: RightSidebarContext（Pattern A 3 ファイル・isOpen 非永続 / width localStorage 永続 / contentCount 登録機構）・RightSidebar（押し込み式 320px・min 240 / max 560 clamp・左端 6px リサイズハンドル・aria）・RightSidebarContents（パネル / drawer 共有の 48px ヘッダー + 空状態 + portal target・barrel 非公開）・RightSidebarPortal（optional hook で Provider 不在は no-op）・RightSidebarToggle（panel 28px PanelRight / hamburger 36px Menu・open で accent + accent-subtle・aria-label が open/close で切替）・MobileDrawer（左 320px + 黒 30% スクリム・safe-area 3 辺・role=dialog）
- **shared 改修**: HeaderTabs に trailing スロット（tablist 外に配置する a11y 構造）・AppShell に optional detailPanelLabels（未指定は完全後方互換）・index 3 種 export・i18n en/ja に detailPanel.{title,open,close,empty,resize}
- **web**: MainScreen に RightSidebarProvider を mount し全 7 セクションへトグル配線（Materials = タブ行内 / 他 6 = 補完標準のツールバー行。fluid セクションの h-full 保全）
- **テスト**: rightSidebar / mobileDrawer / rightSidebarToggle の 3 ファイル新規 + headerTabs trailing smoke。shared 574 件 / build×2 / hex grep 0 で全 PASS
- **QA**: role-qa 独立監査 = APPROVE with minors。Minor 3 件（トグル aria-label の状態反映・リサイズハンドル専用 aria-label・rounded トークン統一）は同 PR 内で反映済み。MobileDrawer の focus trap は各セクションが中身を portal し始める前の follow-up として PR 本文に記載
