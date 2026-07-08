## 2026-07-08 — Work（Pomodoro）目標 IA 実装完了（draft PR #166）

- ClaudeDesign project f93ba0cd の Work Pomodoro.dc.html を import し、work.md §3-§4 + mini-plan `docs/vision/plans/2026-07-07-work-implementation.md` に沿って実装。shared 新規: PhaseBadge / SessionDots / SessionCompletionModal / PomodoroTaskSheet。リワーク: PomodoroTimer / PomodoroTaskSelector / PomodoroSettings / AudioMixer。TimerContext に ±5 分 API（ADJUST_REMAINING）追加
- **tokens.css に additive 2 行**: `lumen-phase-long-break`（琥珀）/ `lumen-on-vivid`（mint・琥珀フィル上の濃色インク。白は light テーマで AA 割れのため）。他レーンでも鮮色フィルに白文字を載せる場合は on-vivid を使うこと
- **Modal.tsx に additive prop `labelledBy`**（自前見出しでダイアログに名前を付ける口。既存の title 挙動は不変）
- **shell-impl への要望**: rightSidebar パネルヘッダの per-section title 対応（デザインは「タイマー設定」を想定・現状はシェル標準「詳細」固定のまま実装）。あわせて tab-less 単画面（work）で RightSidebarToggle が最上部右端に出る現仕様の維持をお願いします（WorkScreen は Portal 注入のみでトグル非所有）
- 検証: shared build + 599 tests / web build pass・hex 0・シェル所有部品 diff 0・role-qa 独立監査 PASS。merge と実画面目視はユーザーゲート
