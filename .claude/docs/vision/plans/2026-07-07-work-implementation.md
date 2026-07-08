---
Status: IN_PROGRESS
Created: 2026-07-07
Branch: claude/work-impl
Owner-chat: work-impl
Parent: 2026-07-05-design-implementation-fanout.md（作業オーダー work-impl）
---

# Plan: Work（Pomodoro）— 目標 IA 実装（ClaudeDesign import）

## Context

- デザインの正 = ClaudeDesign project `f93ba0cd` / `Work Pomodoro.dc.html`（Turn 1 = 全状態 12 フレーム、Turn 2 = Mobile ハンバーガー → 設定 drawer）。ローカル抽出: `/private/tmp/claude-501/-Users-newlife-dev-apps-life-editor--claude-worktrees-work-impl/06784b2d-be1f-4e5b-9199-3c336e70ac9b/scratchpad/work-pomodoro.dc.html`（行番号は本文中に記載。※取得 256KiB 上限で末尾の Mobile 一時停止フレームが数行欠け — Desktop 一時停止 + Mobile 通常から補完し、±5 分ピルを transport 上に置く）
- **最大の構成変更**: 現行の「画面内右カラム 320px に設定常時表示」を廃し、タイマー設定 + プリセットを**シェル標準 rightSidebar（Desktop）/ 左 drawer（Mobile・Turn 2）へ移す**。WorkScreen から `RightSidebarPortal` で注入するだけで両方に出る（toggle・drawer は MainScreen/AppShell が既設 — 触らない）
- Non-goals: シェル部品・`web/src/MainScreen.tsx` の編集（owner = shell-impl）/ History・Music・FREE モードの復活 / DataService 変更
- 既知の意図的逸脱（PR に明記）:
  1. `shared/src/context/`（timerReducer / TimerContextValue / TimerContext）に ±5 分調整の最小 API を追加 — オーダーの Touchable Paths 外だが brief AC4（tier-2 `:145`）の要件。DataService には触れない
  2. rightSidebar のパネルヘッダはシェル標準の「詳細」のまま（デザインは「タイマー設定」— per-section title は shell-impl への outbox 要望とし、パネル内ブロック見出しで代替）
  3. デザインのパレット外表現は既存トークンへ丸める（規約優先）

## デザイン仕様（実装スペック・色は必ずトークンで）

### フェーズ 3 色符号

| phase      | チップ                                                      | リング / 主ボタン                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WORK       | `bg-lumen-accent-subtle` + `text-lumen-accent`              | `lumen-accent`                                                                                                                                                                                       |
| BREAK      | `bg-lumen-chip-mint-bg` + `text-lumen-chip-mint-fg`         | `lumen-accent-secondary`                                                                                                                                                                             |
| LONG_BREAK | `bg-lumen-chip-progress-bg` + `text-lumen-chip-progress-fg` | 琥珀 = **tokens.css の @theme に `--color-lumen-phase-long-break: var(--color-chart-phase-long-break);` を 1 行追加**して `lumen-phase-long-break` 系 utility で使う（既存値の変更は禁止・追加のみ） |

- チップは pill（radius full・13px semibold・先頭に 6px ドット）。一時停止中はその右に別チップ「一時停止中」（`bg-lumen-surface-sunken` + `text-lumen-text-secondary`）を並べる（design 601-604）

### タイマーカード（Desktop・design 294-320 / 一時停止 600-632 / 空 1026-1051）

- Card radius 12 / padding 22px 24px / 中央寄せ縦積み gap 20（一時停止時 12）
- リング: 200px・r=86・stroke 10・`stroke-linecap="round"`・track = `lumen-surface-sunken`・`rotate(-90deg)`。**弧 = 残り時間の割合**: C = 2πr（variant の r から算出。card=86 → ≈540.4 / fullscreen=120 → ≈754.0。literal 禁止・`2 * Math.PI * r` で動的計算）、`strokeDasharray = C`・`dashoffset = C × progress/100`（progress = 経過%。idle は offset 0 = 満円 → 経過とともに弧が減る countdown 方向。現行実装の「経過弧が増える」向きとは意図的に逆）。一時停止中は弧 `opacity-50`・MM:SS を `text-lumen-text-secondary` に
- 中央: MM:SS（mono 40px semibold）+ 下に `/ 25:00`（13px `text-lumen-text-tertiary`・タイマー設定の分数から host が整形）
- SessionDots: 10px 円 × `sessionsBeforeLongBreak`。filled = `bg-lumen-accent`（フェーズ非追従・常に accent）、unfilled = `border-2 border-lumen-border-strong`。右に「今日 2 / 4 セッション」（既存キー `work.sidebar.sessionsProgress`・13px secondary）。filled 数 = `completedSessions % sessionsBeforeLongBreak`（LONG_BREAK 中で mod=0 かつ completed>0 なら全塗り）
- 一時停止中のみ: 「−5 分」「＋5 分」ピル（h-32px・border `lumen-border-strong`・13px semibold）を dots と transport の間に表示
- transport: リセット / スキップ = 44px 円 outline（border-strong・icon 18px・idle 時 `opacity-45` + disabled）、主ボタン = h-44px pill px-28（フェーズ色 bg・前景は WORK = `text-lumen-on-accent`、BREAK / LONG_BREAK = `text-lumen-on-vivid`（mint / 琥珀は両テーマとも中間トーンで白だと light テーマの WCAG AA を割るため、両テーマ濃色インクの on-vivid を新設して使う）・15px semibold・icon+ラベル: 開始 Play / 一時停止 Pause / 再開 Play）。lucide: RotateCcw / SkipForward

### 記録先タスクカード（design 321-324 / 空 1053-1059 / ローディング: skeleton 360×38 + 120×14 `bg-lumen-surface-sunken`）

- Card padding 16px 20px・行: ラベル「記録先タスク」（13px semibold secondary）+ 右へ
  - 選択済み: チップ `bg-lumen-chip-task-bg` + `text-lumen-chip-task-fg`（radius 8・タスク名 + X クリア）
  - 未選択: トリガーボタン（max-w-360px・border・radius 8・py-9 px-12・「タスクを選択…」+ ChevronDown）→ 既存 `Menu`/`MenuItem` のドロップダウン（native select 廃止）
  - 候補 0 件: トリガー `opacity-55` + disabled、下に補足行「紐付けられるタスクがありません。Materials でタスクを作成すると選べるようになります。」（12px tertiary）

### 環境音カード（design 325-357・Desktop のみ）

- 行 = 36px アイコントグル（ON: `bg-lumen-accent text-lumen-on-accent border-lumen-accent` / OFF: `bg-lumen-bg border-lumen-border-strong text-lumen-text-secondary`）+ 名前 w-56px + range スライダー + 数値（mono 13px tertiary・右寄せ w-32px）
- OFF 行: 名前/スライダー/数値を `opacity-45`・スライダー disabled。スライダーは native range 維持で `accent-color: var(--color-accent)` を基本に、可能なら track/thumb をトークンで寄せる（無理はしない）

### rightSidebar 中身（design 361-407・`RightSidebarPortal` 経由）

- 2 ブロック（両方 `bg-lumen-bg-secondary` + border + radius 6 + p-12・見出し 13px semibold secondary）:
  1. **タイマー設定**: 2 列 grid × 5 フィールド（作業（分）/ 休憩（分）/ 長い休憩（分）/ セット内セッション / 1 日の目標。既存 `Input type="number"` 流用可）+「休憩を自動で開始」の**スイッチ**（36×20 pill・`role="switch"`・ON = `bg-lumen-accent`。checkbox から置換）
  2. **プリセット**: 行 = 名前（14px semibold）+ mono ミニ表記 `25·5·15·×4`（12px tertiary）+「適用」（accent 13px semibold text button）+ Trash2 アイコン。0 件 = 破線ボックス「プリセットはまだありません」（design 1120）。下に保存フォーム（Input + 保存ボタン）
- **タイマー稼働中（isRunning）はブロック全体を `opacity-[0.55]` に減光**（操作は無効化しない・design 367）。一時停止/idle は減光なし

### Mobile（<768px・Turn 2 が正・design 25-73 / 1573-1617 / 1670-）

- ハンバーガー・drawer・下部タブは**シェルが既設**（MainScreen の sectionToolbar + AppShell）— WorkScreen は本体のみ
- 1 カラム全画面: フェーズチップ（+一時停止チップ）→ リング **270px・r=120・stroke 12**・MM:SS 52px → dots + カウンタ → タスクチップ（未選択時は「タスクを選ぶ」ボタン → **BottomSheet** に候補リスト + 「選択を外す」行）→ スペーサ → transport（52px 円 ×2 + **主ボタン 72px 円 icon-only**・`shadow-lumen-md` 程度）。一時停止中は ±5 分ピルを transport の上に
- 環境音ミキサー・設定編集パネルは**画面内に出さない**（設定は drawer = portal 経由で共通表示）
- 縦配置: 親高さに依存する `flex-1` スペーサは AppShell の高さチェーンを確認し、届かなければ固定 margin で近似（無理な h-screen 直書きはしない）

### 完了モーダル（新規 SessionCompletionModal・design 967-986）

- WORK 完了（completedSessions 増加）を WorkScreen が useEffect + prev ref で検知して表示（マウント時初期化で誤発火防止）
- 幅 400px・中央・完全不透明・黒 30% バックドロップ（既存 `Modal` を土台に可）: 44px 円アイコン（accent-subtle 地 + Timer icon accent）→ タイトル「セッション {{index}} が完了しました」（17px bold）→ 本文（task あり/なしで出し分け・分数と次休憩分数を差し込み）→ SessionDots → ボタン縦積み: 「休憩を開始」（accent・Play icon・h-44・radius 8）/「もう 1 セッション」（outline h-44）/「閉じる」（ghost h-36）
- 挙動: 休憩を開始 = `start()`（ADVANCE 済みで phase は既に休憩）/ もう 1 セッション = `setPhase("WORK")` → `start()` / 閉じる = 閉じるのみ。autoStartBreaks ON でも表示してよい

### ±5 分調整（reducer 拡張）

- `timerReducer.ts` に `{ type: "ADJUST_REMAINING"; deltaMinutes: number }` を追加: **`!isRunning` のときのみ** `durationSeconds` を補正。`remainingAfter = max(60, remaining + delta*60)` → `durationSeconds = elapsed + remainingAfter`（残り 1 分未満に落とさない・running 中は no-op）
- `TimerContextValue` に `adjustRemainingMinutes(delta: number): void` を追加し Provider で dispatch
- UI 表示条件 = 一時停止中（`!isRunning && progress > 0`）のみ

## Steps

- [ ] 1. tokens.css @theme に `--color-lumen-phase-long-break` を追加（1 行・値変更なし）
- [ ] 2. timerReducer + TimerContextValue + TimerContext に ADJUST_REMAINING / adjustRemainingMinutes を追加
- [ ] 3. 新規部品: `PhaseBadge.tsx` / `SessionDots.tsx` / `SessionCompletionModal.tsx` / `PomodoroTaskSheet.tsx`（BottomSheet ベースの Mobile 候補ピッカー）
- [ ] 4. リワーク: `PomodoroTimer.tsx`（variant "card"|"fullscreen"・±5・dots・totalFormatted・isPaused）/ `PomodoroTaskSelector.tsx`（Menu ドロップダウン + empty/loading）/ `PomodoroSettings.tsx`（2 ブロック + switch + presets 空状態）/ `AudioMixer.tsx`（行リスタイル）
- [ ] 5. barrel（components/index.ts・必要なら src/index.ts）に新規部品を export
- [ ] 6. i18n en/ja 両 catalog に新キー追加（下記）・既存キー（work.phase / work.controls / work.sidebar.sessionsProgress / pomodoro.* / audioMixer.*）は流用
- [ ] 7. `web/src/work/WorkScreen.tsx` 書き換え: isWide 分岐（768px・既存 hook があれば流用/なければ matchMedia）・Desktop 3 カード縦積み max-w-720 中央・`RightSidebarPortal` に設定（isRunning で減光）・Mobile fullscreen + BottomSheet・完了モーダル配線。**MainScreen は不変更**
- [ ] 8. テスト: `pomodoroTimer.test.tsx` / `pomodoroTaskSelector.test.tsx` / `pomodoroSettings.test.tsx` / `sessionCompletionModal.test.tsx` / `audioMixer.test.tsx` 新規 + `timerReducer.test.ts` に ADJUST ケース追加（既存パターンは segmentedControl.test.tsx / components.test.tsx 準拠）

### i18n 追加キー（en / ja 両方）

`work.status.paused`（Paused / 一時停止中）・`work.controls.resume`（Resume / 再開）・`work.controls.subtractFive`（−5 min / −5 分）・`work.controls.addFive`（+5 min / ＋5 分）・`work.taskSelector.emptyHint`（No tasks to link. Create a task in Materials to select one. / 紐付けられるタスクがありません。Materials でタスクを作成すると選べるようになります。）・`work.taskSelector.select`（Choose a task / タスクを選ぶ）・`work.taskSelector.clearSelection`（Clear selection / 選択を外す）・`work.completion.title`（Session {{index}} complete / セッション {{index}} が完了しました。変数名は `count` 禁止 — i18next の複数形トリガーで `title_one`/`title_other` 参照に化けるため序数は非予約名で渡す）・`work.completion.body`（Logged {{minutes}} min to “{{task}}”. Take a {{breakMinutes}}-minute break. / 「{{task}}」に {{minutes}} 分を記録しました。{{breakMinutes}} 分の休憩を挟みましょう。）・`work.completion.bodyNoTask`・`work.completion.startBreak`（Start break / 休憩を開始）・`work.completion.oneMore`（One more session / もう 1 セッション）・`work.completion.close`（Close / 閉じる）・`work.settings.presetsEmpty`（No presets yet / プリセットはまだありません）

## Files

| File                                                 | Operation | Notes                                                      |
| ---------------------------------------------------- | --------- | ---------------------------------------------------------- |
| shared/src/styles/tokens.css                         | edit      | phase-long-break / on-vivid の追加のみ（既存値の変更禁止） |
| shared/src/context/timerReducer.ts                   | edit      | ADJUST_REMAINING                                           |
| shared/src/context/TimerContextValue.ts              | edit      | adjustRemainingMinutes                                     |
| shared/src/context/TimerContext.tsx                  | edit      | dispatch 配線                                              |
| shared/src/components/PhaseBadge.tsx                 | new       | フェーズ/一時停止チップ                                    |
| shared/src/components/SessionDots.tsx                | new       | props: total / filled / label                              |
| shared/src/components/SessionCompletionModal.tsx     | new       | Modal ベース                                               |
| shared/src/components/PomodoroTaskSheet.tsx          | new       | BottomSheet 候補ピッカー                                   |
| shared/src/components/PomodoroTimer.tsx              | rework    | variant card/fullscreen                                    |
| shared/src/components/PomodoroTaskSelector.tsx       | rework    | Menu 化 + 状態                                             |
| shared/src/components/PomodoroSettings.tsx           | rework    | 2 ブロック + switch                                        |
| shared/src/components/AudioMixer.tsx                 | rework    | 行リスタイル                                               |
| shared/src/components/index.ts                       | edit      | export 追加                                                |
| shared/src/index.ts                                  | edit      | 必要なら re-export                                         |
| shared/src/i18n/locales/en.json / ja.json            | edit      | 新キー                                                     |
| web/src/work/WorkScreen.tsx                          | rewrite   | host 配線                                                  |
| shared/tests/（timer/selector/settings/modal/mixer） | new/edit  | 上記 Step 8                                                |

## Verification（機械検証）

- [ ] `cd shared && npm run build && npm run test` pass
- [ ] `cd web && npm run build` pass
- [ ] 新規/リワークした component ファイルに hex 直書き 0（`grep -nE "#[0-9a-fA-F]{3,8}"`・tokens.css 除外）
- [ ] シェル部品（AppShell/SidebarNav/NavItem/BottomTabBar/BottomSheet/HeaderTabs/SegmentedControl/RightSidebar*/MobileDrawer/MainScreen.tsx）の diff = 0
- [ ] 新設 UI 文字列が en / ja 両 catalog に存在
- [ ] i18n props 経由（shared 部品内で useTranslation 不使用）・Card 等の背景不透明維持
