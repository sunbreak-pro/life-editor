---
Status: IN_PROGRESS
Created: 2026-07-04
Branch: claude/design-fanout-plan
Owner-chat: frontend
---

# Plan: ClaudeDesign 全主要画面デザイン fan-out（brief 並列作成）

---

## Context

- **動機**: Web 版（desktop / mobile 両レイアウト）の全主要画面のデザイン案を ClaudeDesign（claude.ai/design）で作成する。そのために「ClaudeDesign へ渡すプロンプト + 前提条件」を各セッションが統一形式で整備する。プロンプトの品質・統一性がデザインの統一性を決めるため、共通前提（`_COMMON-CONTEXT.md`）とテンプレ（`_TEMPLATE.md`）を先に固定し、各画面の brief を並列セッションに fan-out する
- **制約**: コスト $0 / **ClaudeDesign はリポジトリを読めない → プロンプトは自己完結必須** / トークンは `ink-*` で確定済み（`tokens.css` が SSOT。info・warning・surface-sunken・radius・spacing スケールも定義済み）/ Lumen 由来 4 部品（Toast・Sheet・Sidebar・Menu）は `shared/` 移植済み
- **事実確認（2026-07-04 偵察）**: web 実画面は 10 セクション（tasks / daily / notes / schedule / connect / work / analytics / tags / settings / trash）。正準 `SectionId` の `materials` は web では **Tasks + Daily + Notes + Tags の 4 画面クラスタ**に分解されている。desktop⇔mobile は `useMediaQuery("(min-width: 768px)")` による構造分岐（`shared/src/components/AppShell.tsx:65`）
- **Non-goals**: コード実装・トークン変更（brief 作成はドキュメントのみ）/ terminal 画面（web 未移植・desktop 専用）/ trash 画面（単純リスト・優先度低）/ 生成デザインの `shared/` 移植（生成結果を見てから別計画）

---

## Scope (Touchable Paths)

```
.claude/docs/design/**                     ← 本 PR: README + _TEMPLATE + _COMMON-CONTEXT / 各セッション: briefs/<section>.md のみ
.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md
```

各 fan-out セッションは **自分の `briefs/<section>.md` 1 ファイルのみ** 作成・編集可（単一書込者原則）。コード・トークン・要件ドキュメントは全セッション read-only。

---

## Workstreams（6 セッション）

| #   | Section   | 対象画面                                                 | サイズ | 主な参照                                                                                 |
| --- | --------- | -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| D1  | schedule  | Routine 管理 + 週タイムグリッド + カレンダー             | M/L    | `web/src/schedule/`・`shared/src/components/schedule/WeekTimeGrid.tsx`・tier-1 §Schedule |
| D2  | materials | **4 画面クラスタ**: Tasks(Kanban) / Notes / Daily / Tags | **L**  | `web/src/{tasks,notes,daily,wikitag}/`・tier-1 §Tasks・§Notes・§Memo・tier-2 §WikiTags   |
| D3  | connect   | グラフキャンバス + バックリンク                          | M      | `web/src/connect/`・`shared/src/components/Connect/`・tier-2 §WikiTags                   |
| D4  | work      | Pomodoro タイマー + タスク選択 + AudioMixer              | M      | `web/src/work/WorkScreen.tsx`・tier-2 §Pomodoro・§Audio                                  |
| D5  | analytics | 4 タブ（overview / tasks / work / schedule）のグラフ群   | M/L    | `web/src/analytics/`・`shared/src/components/Analytics/`・tier-3 §Analytics              |
| D6  | settings  | Appearance / Language / Shortcuts                        | S      | `web/src/settings/SettingsScreen.tsx`・tier-2 §Theme・§i18n・§Shortcuts                  |

全ストリームの成果物は同一形式（`_TEMPLATE.md` 準拠・`_COMMON-CONTEXT.md` 埋め込み）。ファイルが互いに素なので全並列可。

---

## Steps

| #   | Step                                                                         | Gate    | Acceptance                                      |
| --- | ---------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 0   | 統一基盤作成（本 PR: plan + README + \_TEMPLATE + \_COMMON-CONTEXT）         | 🤖 自律 | 本 PR が draft で存在                           |
| 1   | 基盤 PR merge                                                                | 🛑 人手 | merge 完了（fan-out はこれを待ってから起動）    |
| 2   | 6 セッション fan-out（briefs/<section>.md 作成 → draft PR ×6）               | 🤖 自律 | 各 brief が \_TEMPLATE §5 の AC 全充足          |
| 3   | orchestrator 整合監査（palette hex・フレーム仕様・語彙の統一 / report-only） | 🤖 自律 | 監査レポートで Critical 0                       |
| 4   | brief PR merge ×6                                                            | 🛑 人手 | 6 PR merged                                     |
| 5   | ユーザーが ClaudeDesign へプロンプト投入・デザイン生成                       | 🛑 人手 | 6 セクション × desktop/mobile × light/dark 生成 |
| 6   | 生成デザインの目視レビュー → brief §4 を iterate                             | 👀 目視 | ユーザー OK                                     |
| 7   | （別計画）DesignSync 同期 → `shared/` 移植                                   | —       | out of scope                                    |

---

## Acceptance Criteria (機械検証可能)

- [ ] `briefs/{schedule,materials,connect,work,analytics,settings}.md` が存在し、`_TEMPLATE.md` の §1〜§6 見出しを全て含む
- [ ] 各 brief の §4 に「Desktop 用」「Mobile 用」の両プロンプトがある
- [ ] 各 brief の §4 プロンプト本文（code fence 内）に `shared/src` / `web/src` / `.claude/` などのリポジトリパスが出現しない（自己完結の機械チェック）
- [ ] 全 brief のプロンプトに `_COMMON-CONTEXT.md` の palette hex（例: `#1f4fff` `#16161a`）が含まれ、`_COMMON-CONTEXT.md` と食い違う hex が無い
- [ ] 各 fan-out PR の diff が `briefs/<自分の section>.md` 1 ファイルのみ
- [ ] 本計画の全 PR を通じてコード変更 0（diff は `.claude/docs/**` のみ）

---

## Risks / Known Issues 参照

- **統一性 drift**: 各セッションが共通前提を「要約」して埋めると色・語彙がズレる → \_COMMON-CONTEXT は全文コピー必須と明記（\_TEMPLATE §5 AC で機械チェック）
- **tokens.css との乖離**: palette 変更時は tokens.css → \_COMMON-CONTEXT → 各 brief の順で同期（README に明記）
- **materials の肥大**: D2 は 4 画面 × 2 デバイス = 8 プロンプト。1 ファイル内で §4.1〜4.4 に分割可。セッションが長くなる場合は Tasks+Tags / Notes+Daily の 2 コミットに分けてよい

---

## References

- デザイン原則: `shared/design-system/PRINCIPLES.md`（不変式トップ 6・カラーシステム・透明度ポリシー）
- トークン実体: `shared/src/styles/tokens.css`
- フロント規約: `.claude/rules/frontend.md`
- 要件: `.claude/docs/requirements/tier-{1,2,3}-*.md`
- 分業の経緯: auto-memory `project_lumen_ui_claudedesign`（生成 = claude.ai/design / DesignSync = 同期専用 / 移植 = 別作業）

---

## Appendix: 各セッション起動プロンプト（貼り付け用）

> 共通ルール: 各セッションはドキュメント作成のみ（コード変更なし）。worktree 運用の場合は 4 ステップ
> （`git worktree add` → `cd` → `echo <branch> > .claude/comm/.session-branch` → `claude`）で開始し、
> `.claude/comm/.session-name` に `design-<section>` を宣言する。

### D1: schedule

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-schedule` を宣言してください。

【ゴール】Schedule 画面（desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/schedule.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-schedule` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md`（この形式に完全準拠）
 2. `.claude/docs/design/briefs/_COMMON-CONTEXT.md`（§4 の全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 4. 要件: `.claude/docs/requirements/tier-1-core.md` の「## Feature: Schedule」(L78〜)
 5. 実装: `web/src/schedule/`（ScheduleView / ScheduleCalendarView / CalendarView）と `shared/src/components/schedule/WeekTimeGrid.tsx`
【画面固有の押さえどころ】
 - Desktop の主役は週タイムグリッド（空スロットクリック作成・ドラッグ移動・リサイズ）
 - Routine（daily / weekdays / interval / group の頻度型）と、そこから生成される Event の関係が視覚的に分かること
 - Mobile は Consumption + Quick capture: 今日のアジェンダ表示 + 最短手数の予定追加に絞る（週グリッドは移植しない）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。ClaudeDesign プロンプト本文にリポジトリパスを書かない（自己完結）
【Acceptance Criteria】_TEMPLATE.md §5 のチェックリスト全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — schedule）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（materials / connect / work / analytics / settings の brief）が走行中。それらのファイルには触れない。
```

### D2: materials（Tasks / Notes / Daily / Tags の 4 画面クラスタ）

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-materials` を宣言してください。

【ゴール】Materials クラスタ 4 画面 — Tasks(Kanban) / Notes / Daily / Tags —（各 desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/materials.md`（作成・編集してよいのはこのファイルのみ。§4 は 4.1〜4.4 のサブ画面構成に拡張してよい）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-materials` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 4. 要件: `.claude/docs/requirements/tier-1-core.md` の「## Feature: Tasks (TaskTree)」(L12〜)・「## Feature: Notes」(L148〜)・「## Feature: Memo」(L210〜)、`tier-2-supporting.md` の「## Feature: WikiTags」(L162〜)
 5. 実装: `web/src/tasks/KanbanView.tsx` + `shared/src/components/Kanban/`、`web/src/notes/NotesView.tsx`（MasterDetail + TipTap + パスワードロック）、`web/src/daily/DailyView.tsx`、`web/src/wikitag/WikiTagsManagementView.tsx`
【画面固有の押さえどころ】
 - Kanban: 全幅横スクロール・カード左端 4px ステータスバンド・空カラム状態
 - Notes: 階層ツリー + 一覧/詳細 2 枚組（MasterDetail）+ リッチテキスト。Daily: 日次ジャーナル
 - Mobile は Consumption + Quick capture: Notes/Daily は閲覧 + 最短メモ追加、Kanban は閲覧 + ステータス変更程度に絞る（DnD 前提の操作は落とす）
 - 4 画面が同じクラスタとして統一感を持つこと（リスト密度・見出し・空状態の意匠を揃える）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足（4 サブ画面それぞれに Desktop / Mobile ペア）
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — materials）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（schedule / connect / work / analytics / settings の brief）が走行中。それらのファイルには触れない。
```

### D3: connect

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-connect` を宣言してください。

【ゴール】Connect 画面（グラフ + バックリンク。desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/connect.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-connect` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 4. 要件: `.claude/docs/requirements/tier-2-supporting.md` の「## Feature: WikiTags」(L162〜。item-link モデルが Connect を駆動)
 5. 実装: `web/src/connect/ConnectScreen.tsx` と `shared/src/components/Connect/`（GraphCanvas = Canvas 2D + d3-force / GraphTopBar / GraphControlPanel / SelectedNodeCard / BacklinkView）
【画面固有の押さえどころ】
 - Desktop はフルスクリーンのグラフキャンバス（fluid・全幅）+ 検索/フィルタ TopBar + 選択ノードカード + force 調整パネル
 - ノード種別（project / note / daily / tag）の色分け・ローカルグラフ深度・リンク作成/削除の導線
 - Mobile は Consumption 特化: 力学グラフの操作は割り切り、検索 → ノード詳細 → バックリンク一覧の縦導線を主役にする（簡易グラフは任意）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — connect）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（schedule / materials / work / analytics / settings の brief）が走行中。それらのファイルには触れない。
```

### D4: work

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-work` を宣言してください。

【ゴール】Work 画面（Pomodoro タイマー。desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/work.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-work` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 4. 要件: `.claude/docs/requirements/tier-2-supporting.md` の「## Feature: Pomodoro Timer」(L112〜)・「Audio Mixer」(L20〜)
 5. 実装: `web/src/work/WorkScreen.tsx`（grid lg:grid-cols-[1fr_320px]）と shared の PomodoroTimer / PomodoroTaskSelector / PomodoroSettings / AudioMixer
【画面固有の押さえどころ】
 - フェーズ WORK / BREAK / LONG_BREAK の視覚的区別・セッション進捗・プリセット CRUD（右 320px パネル）
 - History / Music / FREE モードは意図的に廃止済み — 復活させない
 - Mobile はタイマー主役の全画面 + タスク選択のみ。**AudioMixer は Mobile 非搭載**（Audio Provider は Mobile 省略）なので出さない
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — work）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（schedule / materials / connect / analytics / settings の brief）が走行中。それらのファイルには触れない。
```

### D5: analytics

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-analytics` を宣言してください。

【ゴール】Analytics 画面（4 タブ。desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/analytics.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-analytics` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`（グラフ カテゴリ 10 色はテーマ固定）
 4. 要件: `.claude/docs/requirements/tier-3-experimental.md` の「## Feature: Analytics」(L39〜)
 5. 実装: `web/src/analytics/AnalyticsScreen.tsx`（DateRange 単位 fetch + labels 注入）と `shared/src/components/Analytics/`（AnalyticsView の 4 タブ = overview / tasks / work / schedule、StatCard・WorkTimeHeatmap・StreakDisplay・各種 Trend チャート、PeriodSelector = day / week / month）
【画面固有の押さえどころ】
 - タブごとのカード + チャート群（recharts）。empty（noSessions / noData）と loading（schedule タブの範囲別 fetch スケルトン）状態が多い画面
 - チャート色はカテゴリ 10 色（テーマ固定）で符号化。色だけに頼らない凡例・ラベル
 - Mobile は Consumption 専用: 今日のダッシュボード + 主要カードの縦積みに絞る（ヒートマップ等の広幅チャートは横スクロールか省略を判断）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — analytics）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（schedule / materials / connect / work / settings の brief）が走行中。それらのファイルには触れない。
```

### D6: settings

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-settings` を宣言してください。

【ゴール】Settings 画面（desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/settings.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-settings` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 4. 要件: `.claude/docs/requirements/tier-2-supporting.md` の「## Feature: Theme」(L329〜)・「## Feature: i18n」(L364〜)・「## Feature: Shortcuts」(L400〜)
 5. 実装: `web/src/settings/SettingsScreen.tsx`（単一縦カラム space-y-10）と shared の SettingsAppearance / SettingsLanguage / SettingsShortcuts
【画面固有の押さえどころ】
 - Appearance（light/dark + フォントサイズ 10 段）/ Language（en/ja）/ Shortcuts（リバインド表 + コンフリクト検出）の 3 ブロック
 - 旧 frontend の portal ベース 25 サブセクションは非移植 — 現行の簡潔な縦一列を洗練させる方向で
 - Mobile はほぼ同一の縦リストで成立する画面。ただし Shortcuts はキーボード前提なので Mobile では非表示か閲覧のみにする判断を明記
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — settings）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（schedule / materials / connect / work / analytics の brief）が走行中。それらのファイルには触れない。
```

---

## Worklog

- 2026-07-04: 偵察（Explore）で web 10 セクション構成・ink トークン全リスト・Lumen 4 部品移植済みを確認。基盤ドキュメント（README / \_TEMPLATE / \_COMMON-CONTEXT / 本計画）を作成し draft PR 化。
