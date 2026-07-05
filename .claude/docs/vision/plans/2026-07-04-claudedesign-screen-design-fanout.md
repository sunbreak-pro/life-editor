---
Status: IN_PROGRESS
Created: 2026-07-04
Branch: claude/design-ia
Owner-chat: frontend
---

# Plan: ClaudeDesign 全主要画面デザイン fan-out（brief 並列作成）

---

## Context

- **動機**: Web 版（desktop / mobile 両レイアウト）の全主要画面のデザイン案を ClaudeDesign（claude.ai/design）で作成する。そのために「ClaudeDesign へ渡すプロンプト + 前提条件」を各セッションが統一形式で整備する。プロンプトの品質・統一性がデザインの統一性を決めるため、共通前提（`_COMMON-CONTEXT.md`）とテンプレ（`_TEMPLATE.md`）を先に固定し、各画面の brief を並列セッションに fan-out する
- **IA ファースト（2026-07-05 決定）**: 個別画面の前に**ナビ構成（サイドバーのセクション + 各画面の header タブ）を先に固定**する。正本 = [`../../design/IA.md`](../../design/IA.md)。決定 3 点: ①サイドバー 6 セクション集約（Materials に Tasks / Notes / Daily / Tags の header タブ）②Trash はサイドバー最下部のユーティリティ枠 ③Mobile 固定 4 タブ = Schedule / Materials / Work / Analytics + More。全 brief は現行実装ではなく**この目標 IA** に向けてデザインする
- **制約**: コスト $0 / **ClaudeDesign はリポジトリを読めない → プロンプトは自己完結必須** / トークン名前空間は **`lumen-*`**・accent は Lumen blue `#1d4ed8`（PR #135・2026-07-05 merge。"Cobalt Ink" は系譜名。`tokens.css` が SSOT）/ Lumen 由来 4 部品（Toast・Sheet・Sidebar・Menu）は `shared/` 移植済み
- **事実確認（2026-07-04 偵察）**: web 実画面は 10 フラットセクション。正準 `SectionId` の `materials` は web では Tasks + Daily + Notes + Tags に分解されている（目標 IA で再統合）。desktop⇔mobile は `useMediaQuery("(min-width: 768px)")` による構造分岐（`shared/src/components/AppShell.tsx:65`）。セクション外にログイン画面（`web/src/AuthScreen.tsx`）とシェル横断 UI（CommandPalette / OfflineBanner / Toast）が存在する
- **Non-goals**: コード実装・トークン変更（brief 作成はドキュメントのみ）/ **terminal（機能ごと廃止をユーザー決定済み・2026-07-05 再確認。brief を作らない。CLAUDE.md §2/§5/§8・tier-1 の Terminal 記述の除去は別途 docs 整理）** / 生成デザインの `shared/` 移植と IA 実装リファクタ（生成結果を見てから別計画）/ Tier 3 凍結機能の新画面（Paper Boards / NotebookLM 等）

---

## Scope (Touchable Paths)

```
.claude/docs/design/**                     ← 基盤: README + _TEMPLATE + _COMMON-CONTEXT + IA.md / 各セッション: briefs/<section>.md のみ
.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md
```

各 fan-out セッションは **自分の `briefs/<section>.md` 1 ファイルのみ** 作成・編集可（単一書込者原則）。コード・トークン・要件ドキュメントは全セッション read-only。

---

## Workstreams（9 セッション）

| #   | Section   | 対象画面                                                                 | サイズ | 主な参照                                                                                 |
| --- | --------- | ------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| D1  | schedule  | header タブ = Calendar（週グリッド）/ Routines                           | M/L    | `web/src/schedule/`・`shared/src/components/schedule/WeekTimeGrid.tsx`・tier-1 §Schedule |
| D2  | materials | header タブ 4 つ: Tasks(Kanban) / Notes / Daily / Tags                   | **L**  | `web/src/{tasks,notes,daily,wikitag}/`・tier-1 §Tasks・§Notes・§Memo・tier-2 §WikiTags   |
| D3  | connect   | グラフキャンバス + バックリンク                                          | M      | `web/src/connect/`・`shared/src/components/Connect/`・tier-2 §WikiTags                   |
| D4  | work      | Pomodoro タイマー + タスク選択 + AudioMixer（タブなし単画面）            | M      | `web/src/work/WorkScreen.tsx`・tier-2 §Pomodoro・§Audio                                  |
| D5  | analytics | 4 タブ（overview / tasks / work / schedule）のグラフ群                   | M/L    | `web/src/analytics/`・`shared/src/components/Analytics/`・tier-3 §Analytics              |
| D6  | settings  | Appearance / Language / Shortcuts（ユーティリティ枠）                    | S      | `web/src/settings/SettingsScreen.tsx`・tier-2 §Theme・§i18n・§Shortcuts                  |
| D7  | shell     | **IA の視覚化**: サイドバー 6+2 / ボトムタブ 4+More / ⌘K / OfflineBanner | M      | `IA.md`・`shared/src/components/AppShell.tsx` 他シェル部品・`web/src/MainScreen.tsx`     |
| D8  | auth      | ログイン / サインアップ（シェル外・未ログイン時の入口）                  | S      | `web/src/AuthScreen.tsx`・tier-1 §Cloud Sync                                             |
| D9  | trash     | ゴミ箱（5 カテゴリ復元・下部ユーティリティ枠）                           | S      | `web/src/trash/TrashScreen.tsx`・`shared/src/components/TrashView.tsx`・tier-2 §Trash    |

全ストリームの成果物は同一形式（`_TEMPLATE.md` 準拠・`_COMMON-CONTEXT.md` **v2** 埋め込み・`IA.md` の目標構成準拠）。ファイルが互いに素なので全並列可。~~D10 terminal~~ は機能廃止決定（2026-07-05）のため作らない。

> 進行状況メモ（2026-07-05 時点）: D1〜D6 は **v1 プロンプト（IA 決定前・旧 accent hex）で起動済み**。生成済み / 作成中の brief は Step 4 の監査で v2 準拠（IA 構成 + 新 accent hex + \_COMMON-CONTEXT v2 全文）へ改訂指示する。

---

## Steps

| #   | Step                                                                                             | Gate    | Acceptance                                        |
| --- | ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------- |
| 0   | 統一基盤作成（README + \_TEMPLATE + \_COMMON-CONTEXT + 本計画）                                  | 🤖 自律 | ✅ PR #134 merged（`53ae40fc`）                   |
| 1   | **IA 決定**（サイドバー 6+2 / header タブ / Mobile 固定 4 タブ）→ `IA.md` 正本化                 | 👀 目視 | ✅ 2026-07-05 ユーザー 3 決定・本 PR に収載       |
| 2   | \_COMMON-CONTEXT **v2** 化（accent を PR #135 に同期 + シェル構成を目標 IA へ差し替え）          | 🤖 自律 | ✅ 本 PR に収載                                   |
| 3   | 9 セッション fan-out（D1〜D6 = v1 起動済み / D7〜D9 = 本 PR merge 後に起動）                     | 🤖 自律 | 各 brief が \_TEMPLATE §5 の AC 全充足            |
| 4   | orchestrator 整合監査 + **v1 埋め込み brief の v2 改訂指示**（旧 hex・旧 10 セクション記述検出） | 🤖 自律 | 監査レポート Critical 0・全 brief が v2 / IA 準拠 |
| 5   | brief PR merge ×9                                                                                | 🛑 人手 | 9 PR merged                                       |
| 6   | ユーザーが ClaudeDesign へプロンプト投入・デザイン生成                                           | 🛑 人手 | 9 brief × desktop/mobile × light/dark 生成        |
| 7   | 生成デザインの目視レビュー → brief §4 を iterate                                                 | 👀 目視 | ユーザー OK                                       |
| 8   | （別計画）DesignSync 同期 → `shared/` 移植・IA 実装リファクタ                                    | —       | out of scope                                      |

---

## Acceptance Criteria (機械検証可能)

- [ ] `briefs/{schedule,materials,connect,work,analytics,settings,shell,auth,trash}.md` が存在し、`_TEMPLATE.md` の §1〜§6 見出しを全て含む
- [ ] 各 brief の §4 に「Desktop 用」「Mobile 用」の両プロンプトがある
- [ ] 各 brief の §4 プロンプト本文（code fence 内）に `shared/src` / `web/src` / `.claude/` などのリポジトリパスが出現しない（自己完結の機械チェック）
- [ ] 全 brief のプロンプト冒頭に `_COMMON-CONTEXT.md` **v2** の見出し（`v2 / 2026-07-05`）が含まれ、hex が v2 と一致する（旧 accent `#1f4fff` `#1a42d9` `#e1e6fb` が残っていない）
- [ ] 全 brief のナビ・タブ前提が `IA.md`（サイドバー 6+2 / header タブ / Mobile 4+More）と矛盾しない
- [ ] 各 fan-out PR の diff が `briefs/<自分の section>.md` 1 ファイルのみ
- [ ] 本計画の全 PR を通じてコード変更 0（diff は `.claude/docs/**` のみ）

---

## Risks / Known Issues 参照

- **v1 埋め込み brief の旧化**: D1〜D6 は v1（旧 accent hex `#1f4fff` 系・旧 10 セクションシェル記述）で走った。放置すると生成デザインの色とナビが本番とズレる → Step 4 監査で機械検出（旧 hex grep + v2 見出し有無）し、各セッションへ改訂指示
- **統一性 drift**: 各セッションが共通前提を「要約」して埋めると色・語彙がズレる → \_COMMON-CONTEXT は全文コピー必須（\_TEMPLATE §5 AC で機械チェック）
- **tokens.css との乖離**: palette 変更時は tokens.css → \_COMMON-CONTEXT → 各 brief の順で同期（README に明記）。#135 の accent 変更で実際に発生した
- **materials の肥大**: D2 は 4 画面 × 2 デバイス = 8 プロンプト。1 ファイル内で §4.1〜4.4 に分割可
- **shell と各画面の二重定義**: D7（枠 + header タブの標準意匠）と D1〜D6（中身）が同じ要素を別々にデザインすると衝突する。タブ UI の形状・アクティブ表現は D7 が定義し、各画面 brief はそれを参照する
- **1 worktree 複数セッションの混線**: 同一 worktree で複数 design セッションを回すと、ブランチ切替と `git add` の巻き込みで brief が他ブランチに混入する（2026-07-05 に実際に発生: analytics brief が settings ブランチに commit される等）。**1 chat = 1 worktree = 1 branch（CLAUDE.md §7.4）を推奨**

---

## References

- ナビ構成の正本: `.claude/docs/design/IA.md`（2026-07-05 ユーザー承認）
- デザイン原則: `shared/design-system/PRINCIPLES.md`（不変式トップ 6・カラーシステム §3.3 Lumen・透明度ポリシー）
- トークン実体: `shared/src/styles/tokens.css`
- フロント規約: `.claude/rules/frontend.md`
- 要件: `.claude/docs/requirements/tier-{1,2,3}-*.md`
- 分業の経緯: auto-memory `project_lumen_ui_claudedesign`（生成 = claude.ai/design / DesignSync = 同期専用 / 移植 = 別作業）

---

## Appendix: 各セッション起動プロンプト（貼り付け用）

> 共通ルール: 各セッションはドキュメント作成のみ（コード変更なし）。**1 セッション = 1 worktree = 1 ブランチ**で開始し（`git worktree add` → `cd` → `echo <branch> > .claude/comm/.session-branch` → `claude`）、`.claude/comm/.session-name` に `design-<section>` を宣言する。
> **v2 共通必読**: 全セッションは `_COMMON-CONTEXT.md`（v2）に加えて **`.claude/docs/design/IA.md`（目標ナビ構成の正本）** を必読とし、現行実装ではなく IA の目標構成に向けてデザインする。
> 並行ストリームは D1〜D9 の全 brief。**briefs/ 配下の自分以外のファイルに触れない**ルールは全セッション共通。
> ⚠️ D1〜D6 の下記プロンプトは初版（v1・IA 決定前）の記録。**未起動 / 再起動時は「v2 共通必読」を必ず追加**し、\_COMMON-CONTEXT は v2 を埋め込むこと。

### D1: schedule（v1 で起動済み）

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-schedule` を宣言してください。

【ゴール】Schedule 画面（desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/schedule.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-schedule` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md`（この形式に完全準拠）
 2. `.claude/docs/design/briefs/_COMMON-CONTEXT.md`（§4 の全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `.claude/docs/design/IA.md`（目標ナビ構成: Schedule は Calendar / Routines の header タブ）
 4. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 5. 要件: `.claude/docs/requirements/tier-1-core.md` の「## Feature: Schedule」(L78〜)
 6. 実装: `web/src/schedule/`（ScheduleView / ScheduleCalendarView / CalendarView）と `shared/src/components/schedule/WeekTimeGrid.tsx`
【画面固有の押さえどころ】
 - Desktop の主役は週タイムグリッド（空スロットクリック作成・ドラッグ移動・リサイズ）
 - Routine（daily / weekdays / interval / group の頻度型）と、そこから生成される Event の関係が視覚的に分かること
 - Mobile は Consumption + Quick capture: 今日のアジェンダ表示 + 最短手数の予定追加に絞る（週グリッドは移植しない）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。ClaudeDesign プロンプト本文にリポジトリパスを書かない（自己完結）
【Acceptance Criteria】_TEMPLATE.md §5 のチェックリスト全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — schedule）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（他の design-brief セッション）が走行中。briefs/ 配下の自分以外のファイルには触れない。
```

### D2: materials（v1 で起動済み）

```text
（初版プロンプトは PR #134 時点の本ファイル履歴を参照。再起動時は D1 と同形式で
 IA.md 必読 + _COMMON-CONTEXT v2 を前提に、Tasks(Kanban) / Notes / Daily / Tags の
 4 header タブを 1 セクション "Materials" として統一意匠でデザインする）
```

### D3: connect（v1 で起動済み・PR あり）／ D4: work・D5: analytics・D6: settings（v1 で起動済み）

```text
（同上 — 初版は git 履歴参照。改訂は Step 4 監査の指示に従う）
```

### D7: shell（アプリの枠 = IA の視覚化。本 PR merge 後に起動）

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-shell` を宣言してください。

【ゴール】アプリシェル（全画面共通の枠。desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる。
このシェルは 2026-07-05 決定の目標 IA（ナビ構成）を初めて視覚化するもので、他の全 brief が参照する基準になる
【成果物】`.claude/docs/design/briefs/shell.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-shell` を切る
【必読（この順）】
 1. `.claude/docs/design/IA.md`（**最重要**: サイドバー本流 5 = Schedule / Materials / Connect / Work / Analytics + 下部ユーティリティ枠 = Settings / Trash + フッター ⌘K / user / SignOut。Mobile 固定 4 タブ + More）
 2. `.claude/docs/design/briefs/_TEMPLATE.md` / 3. `_COMMON-CONTEXT.md`（v2。全プロンプト冒頭に全文埋め込み。要約禁止）
 4. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 5. 実装: `shared/src/components/` の AppShell.tsx（wideQuery 768px・fluidContent）/ SidebarNav.tsx（展開 240px・折畳 64px）/ NavItem.tsx / BottomTabBar.tsx / BottomSheet.tsx / CommandPalette.tsx / Toast.tsx と、`web/src/MainScreen.tsx`・`web/src/components/OfflineBanner.tsx`
【画面固有の押さえどころ】
 - Desktop: IA どおりの 6+2 サイドバー（本流とユーティリティ枠の視覚分離・折畳 64px 時のアイコンのみ表示・ブランドヘッダ）
 - **header タブの標準意匠を定義する**（タブ形状・アクティブ表現・件数バッジ有無）。例として Materials の 4 タブを載せる。他 brief はこの定義を参照する
 - Mobile: 下部タブバー = Schedule / Materials / Work / Analytics + More（ボトムシートに Connect / Settings / Trash。safe-area 対応）
 - 横断オーバーレイ: CommandPalette（⌘K・セクション移動）/ Toast スタック位置 / OfflineBanner（オフライン時の帯）
 - 中身（各セクション画面）はダミーのプレースホルダで良い。**この brief の主役は枠と header タブの標準**
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない（自己完結）
【Acceptance Criteria】_TEMPLATE.md §5 全充足 + IA.md との完全一致
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — shell）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（他の design-brief セッション）が走行中。briefs/ 配下の自分以外のファイルには触れない。
```

### D8: auth（ログイン画面。本 PR merge 後に起動）

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-auth` を宣言してください。

【ゴール】ログイン / サインアップ画面（desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/auth.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-auth` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（v2。全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `.claude/docs/design/IA.md`（auth はシェル外の全画面である位置づけを確認）
 4. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 5. 要件: `.claude/docs/requirements/tier-1-core.md` の「## Feature: Cloud Sync」(L392〜)
 6. 実装: `web/src/AuthScreen.tsx`（Phase 1 minimal: Email + Password・signIn/signUp トグル・busy/error 状態・中央寄せカード）
【画面固有の押さえどころ】
 - アプリの第一印象を決める画面。Lumen blue + ミント差し色のブランドを最初に見せる場だが、N=1 個人ツールなのでマーケ的な装飾は不要（ヒーロー画像・お客様の声などは入れない）
 - signIn ⇔ signUp のモード切替、入力エラー / busy（送信中）状態、パスワードマネージャ前提の autocomplete
 - Desktop / Mobile とも中央寄せカードのレスポンシブ単一で成立する画面（構造分岐は不要。その判断を brief に明記）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — auth）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（他の design-brief セッション）が走行中。briefs/ 配下の自分以外のファイルには触れない。
```

### D9: trash（ゴミ箱。本 PR merge 後に起動）

```text
あなたは sunbreak-pro/life-editor の新規セッションです。ドキュメント作成タスク（コード変更なし）。
最初に `.claude/comm/.session-name` に `design-trash` を宣言してください。

【ゴール】Trash 画面（ソフトデリート復元。desktop + mobile）の ClaudeDesign 用デザイン brief を 1 ファイル完成させる
【成果物】`.claude/docs/design/briefs/trash.md`（作成・編集してよいのはこのファイルのみ）
【base ブランチ】最新 origin/main を fetch して `claude/design-brief-trash` を切る
【必読（この順）】
 1. `.claude/docs/design/briefs/_TEMPLATE.md` / 2. `_COMMON-CONTEXT.md`（v2。全プロンプト冒頭に全文埋め込み。要約禁止）
 3. `.claude/docs/design/IA.md`（Trash はサイドバー最下部のユーティリティ枠 — 2026-07-05 決定）
 4. `shared/design-system/PRINCIPLES.md` / `shared/src/styles/tokens.css`
 5. 要件: `.claude/docs/requirements/tier-2-supporting.md` の「## Feature: Trash (ソフトデリート復元)」(L477〜)
 6. 実装: `web/src/trash/TrashScreen.tsx`（5 カテゴリを並列 fetch・restore/permanentDelete 後に再取得）と `shared/src/components/TrashView.tsx`
【画面固有の押さえどころ】
 - 5 カテゴリ（tasks / notes / dailies / routines / events）のグループ表示。カテゴリごとの件数と空状態
 - 「復元」と「完全削除」の非対称な危険度: 完全削除は danger 色 + 確認ステップ、復元は主導線。busy（連打防止）状態あり
 - ユーティリティ枠の画面として控えめ・実務的なトーン（本流セクションほどの visual weight を持たせない）
 - Mobile は Consumption + 復元操作のみで成立する単純リスト（レスポンシブ単一で良い判断を明記）
【Gate】🤖 brief 作成 + draft PR まで ／ 🛑 merge・ClaudeDesign への投入はユーザー
【禁止】他の briefs/*.md・コード・トークン・要件ドキュメントの変更。プロンプト本文にリポジトリパスを書かない
【Acceptance Criteria】_TEMPLATE.md §5 全充足
【完了時】task-tracker で記録 → draft PR 作成（タイトル: docs: design brief — trash）→ `.claude/comm/outbox/` に要約 append
並行ストリーム（他の design-brief セッション）が走行中。briefs/ 配下の自分以外のファイルには触れない。
```

---

## Worklog

- 2026-07-04: 偵察（Explore）で web 10 セクション構成・トークン全リスト・Lumen 4 部品移植済みを確認。基盤ドキュメント（README / \_TEMPLATE / \_COMMON-CONTEXT / 本計画）を作成し draft PR #134 化。
- 2026-07-05: PR #134 merge（`53ae40fc`）。直後に PR #135（`ink-*` → `lumen-*` rename + **accent を Lumen blue `#1d4ed8` へ変更**）が merge され、\_COMMON-CONTEXT v1 の accent 系 hex（`#1f4fff` 等）と「ink-\*」記述が旧化。
- 2026-07-05: ユーザー決定で **IA ファースト**化（①サイドバー 6 セクション集約 ②Trash はユーティリティ枠 ③Mobile 固定 4 タブ = Schedule / Materials / Work / Analytics）→ `IA.md` 正本化。D7 shell / D8 auth / D9 trash を追加。**D10 terminal は機能廃止決定のため対象外**（一時 D10 として起案した 2f7b3c8e は破棄）。\_COMMON-CONTEXT を v2 化（accent 同期 + 目標シェル構成）。D1〜D6 は v1 プロンプトで起動済みのため Step 4 監査で v2 準拠へ改訂指示する。
- 2026-07-05: 教訓: 同一 worktree での複数 design セッション運用により、brief の他ブランチ混入・計画 commit の迷子が発生（Risks に追記）。以後の起動は 1 chat = 1 worktree = 1 branch を推奨。
