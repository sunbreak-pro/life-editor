# HISTORY (chat-work-impl)

### 2026-07-08 - Work（Pomodoro）目標 IA 実装（ClaudeDesign import → draft PR #166）

#### 概要

ClaudeDesign 生成の Work デザイン（project f93ba0cd / Work Pomodoro.dc.html）を DesignSync で import し、Pomodoro のタブなし単画面（Desktop 3 カード + rightSidebar 注入 / Mobile fullscreen + BottomSheet）を shared/src/components/ + web/src/work/WorkScreen.tsx に実装した。

#### 変更点

- **shared 新規**: PhaseBadge / SessionDots / SessionCompletionModal / PomodoroTaskSheet
- **shared リワーク**: PomodoroTimer（variant card/fullscreen・フェーズ色 countdown リング・一時停止中 ±5 分ピル）/ PomodoroTaskSelector（Menu 化 + 空・loading 状態）/ PomodoroSettings（2 ブロック + switch）/ AudioMixer（行リスタイル + role=switch の aria-checked 修正）
- **context**: ADJUST_REMAINING + adjustRemainingMinutes（一時停止中のみ・60 秒下限・時計非依存）
- **tokens.css**: `--color-lumen-phase-long-break` / `--color-lumen-on-vivid` 追加のみ（mint / 琥珀フィル上の WCAG AA 確保。既存値不変）
- **web 配線**: WorkScreen 書き換え（RightSidebarPortal に設定 + プリセット注入・isRunning 減光・完了モーダル）。MainScreen / シェル所有部品は diff 0
- **i18n**: en / ja 両 catalog に新キー（completion の序数は {{index}} — count は i18next 複数形トリガーのため回避）
- **検証**: shared build + 599 tests / web build pass・hex 直書き 0。QA 2 段構え（mini-plan アドバーサリアルレビュー → コントラスト B-1 / count I-2 を実装に反映、実装独立監査 PASS・Important の a11y 1 件 = Modal labelledBy を同一 PR で修正）
- **commit**: 815eaf6b → draft PR #166（merge・実画面目視はユーザーゲート）
