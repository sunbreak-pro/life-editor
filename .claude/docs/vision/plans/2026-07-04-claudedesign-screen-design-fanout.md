---
Status: IN_PROGRESS — **Web/Mobile UI の追跡正本**（旧 W-parity ロードマップ #121/#127 完了・archive 済でここへ一本化。#154・2026-07-05）
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

> 進行状況メモ（2026-07-05 再更新・第 2 波後）: work-order **10 オーダー中 9 本が merge 済み**（schedule #144 / auth #145 / terminal-docs #147 / trash #148 / materials #149 / settings #150 / analytics #151 / work #152 / shell #153。Terminal code 除去 Issue #146 起票済み）。**design-connect-v2 のみ第 2 波で未実行**（最終整合監査 C1: connect.md が v1 のまま = 旧 hex 9 行 + 旧 10 セクション指示）→ ユーザーが再起動済み・PR 待ち。監査の残指摘（M1: analytics タブピルが shell 下線標準と矛盾 / M2: analytics Status 昇格漏れ / m1: schedule・materials の「下線 or 塗り」両論併記）は audit-fixes ブランチで修正済み。監査レポート = `.claude/reports/2026-07-05-fanout-final-audit.md`（git 非追跡・md 正本）。

---

## Steps

| #   | Step                                                                                             | Gate    | Acceptance                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| 0   | 統一基盤作成（README + \_TEMPLATE + \_COMMON-CONTEXT + 本計画）                                  | 🤖 自律 | ✅ PR #134 merged（`53ae40fc`）                                                                        |
| 1   | **IA 決定**（サイドバー 6+2 / header タブ / Mobile 固定 4 タブ）→ `IA.md` 正本化                 | 👀 目視 | ✅ 2026-07-05 ユーザー 3 決定・本 PR に収載                                                            |
| 2   | \_COMMON-CONTEXT **v2** 化（accent を PR #135 に同期 + シェル構成を目標 IA へ差し替え）          | 🤖 自律 | ✅ 本 PR に収載                                                                                        |
| 3   | work-order fan-out（v2 改訂 ×6 + 新規 ×3 + terminal docs ×1 — §Work Orders の方式）              | 🤖 自律 | 🔄 9/10 完走（connect-v2 のみ未実行 → 再走中）                                                         |
| 4   | orchestrator 整合監査 + **v1 埋め込み brief の v2 改訂指示**（旧 hex・旧 10 セクション記述検出） | 🤖 自律 | ✅ 2026-07-05 監査済（C1 = connect 再走 / M1・M2・m1 = audit-fixes PR で修正 / m2 = ユーザー判断待ち） |
| 5   | brief PR merge ×9                                                                                | 🛑 人手 | 🔄 8/9 merged（connect-v2 待ち）+ terminal-docs #147                                                   |
| 6   | ユーザーが ClaudeDesign へプロンプト投入・デザイン生成                                           | 🛑 人手 | 9 brief × desktop/mobile × light/dark 生成                                                             |
| 7   | 生成デザインの目視レビュー → brief §4 を iterate                                                 | 👀 目視 | ユーザー OK                                                                                            |
| 8   | （別計画）DesignSync 同期 → `shared/` 移植・IA 実装リファクタ                                    | —       | out of scope                                                                                           |

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

## Work Orders（作業オーダー — 計画書 + slug 指定で起動）

> 2026-07-05 改定: 長大な貼り付けプロンプト方式を廃止。各セッションは**本節の共通プロトコル + 自分のオーダー**を読んでゴール（draft PR）まで自律実行する。v1 起動時の初版プロンプトは git 履歴（PR #134 / #139 時点の本ファイル）参照。

### 起動手順（ユーザー）

1. メインリポジトリで起動スクリプトを実行する（worktree / ブランチ / セッション標識を規約どおり自動作成）:

```bash
cd /Users/newlife/dev/apps/life-editor
bash .claude/scripts/design-work.sh <slug>    # 例: design-materials-v2
```

2. スクリプトの表示どおり `cd .claude/worktrees/<slug> && claude` で新規セッションを開始し、最初のメッセージに次の 1 行だけ貼る:

```text
計画書 .claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md の作業オーダー <slug> をゴールまで実行してください。
```

スクリプトを使わない場合は CLAUDE.md §7.4 の 4 ステップを手動実行する（worktree = `.claude/worktrees/<slug>`・branch = `claude/<slug>`・`.session-name` = `<slug>`）。

### セッション共通プロトコル（全オーダー必読）

1. **自己確認**: SessionStart hook の identity 表示で worktree = `.claude/worktrees/<slug>` / branch = `claude/<slug>` を確認する。不一致なら作業せずユーザーに報告して停止
2. **必読順**: 本計画書全体 → 自分のオーダー → オーダーの【必読】列挙ファイル
3. **単一書込者**: 編集してよいのは自分のオーダーの【成果物】のみ。他の briefs/\*.md・コード・トークン・要件ドキュメントは read-only。並行セッションが多数走行中
4. **ClaudeDesign プロンプト不変式**（design-\* オーダー共通）: brief §4 のプロンプトは自己完結（リポジトリパスを書かない）/ 冒頭に `_COMMON-CONTEXT.md` **v2** を全文埋め込み（要約禁止・見出しに「v2 / 2026-07-05」）/ ナビ前提は `IA.md` / 色は hex 直書き
5. **完了プロトコル**: `_TEMPLATE.md` §5 AC 自己チェック（v2 改訂は下記の機械チェックも）→ task-tracker 記録 → draft PR 作成（タイトルはレジストリ記載のもの）→ 自分の outbox（`.claude/comm/outbox/chat-<slug>.md`）へ要約 append → ユーザーへ報告。**self-merge 禁止・main 直接 push 禁止**。PR diff は【成果物】+ 自分の tracker ファイルのみに保つ

### v2 改訂の共通手順（design-\*-v2 オーダー共通）

1. brief §4 の全プロンプト冒頭の共通前提ブロックを `_COMMON-CONTEXT.md` の **v2** に全文差し替え（要約禁止）
2. 旧 accent 系 hex を一掃（§1〜§4 全体が対象）: `#1f4fff`→`#1d4ed8` / `#1a42d9`→`#1e40af` / `#e1e6fb`→`#dbeafe` / dark `#5b82ff`→`#5b8cff` / `#7596ff`→`#7aa2ff` / task チップ bg `#e3e7ff`→`#dbeafe`・fg `#2330b0`→`#1e40af`
3. ナビ・タブ前提を `IA.md` の目標構成へ揃える（各オーダーの【IA 固有】参照）。旧「10 フラットセクション」前提の記述を残さない
4. `_TEMPLATE.md` §5 の AC を再充足（自己完結 / Desktop + Mobile / light + dark / 状態網羅）

完了前の機械チェック（両方 pass するまで PR を出さない）:

```bash
grep -c "v2 / 2026-07-05" .claude/docs/design/briefs/<section>.md        # 期待: 1 以上
grep -icE "#1f4fff|#1a42d9|#e1e6fb|#5b82ff|#7596ff|#e3e7ff|#2330b0" .claude/docs/design/briefs/<section>.md || echo OK   # 期待: OK（旧 hex 0 件）
```

### 作業レジストリ（10 オーダー・互いに素・全並列可）

| slug                   | 旧 ID | 内容                                             | 成果物（これのみ編集可）      | PR タイトル                                           |
| ---------------------- | ----- | ------------------------------------------------ | ----------------------------- | ----------------------------------------------------- |
| `design-schedule-v2`   | D1'   | schedule brief v2 改訂                           | `briefs/schedule.md`          | docs: design brief schedule — v2 (IA + Lumen accent)  |
| `design-materials-v2`  | D2'   | materials brief v2 改訂（改訂幅最大）            | `briefs/materials.md`         | docs: design brief materials — v2 (IA + Lumen accent) |
| `design-connect-v2`    | D3'   | connect brief v2 改訂                            | `briefs/connect.md`           | docs: design brief connect — v2 (IA + Lumen accent)   |
| `design-work-v2`       | D4'   | work brief v2 改訂                               | `briefs/work.md`              | docs: design brief work — v2 (IA + Lumen accent)      |
| `design-analytics-v2`  | D5'   | analytics brief v2 改訂                          | `briefs/analytics.md`         | docs: design brief analytics — v2 (IA + Lumen accent) |
| `design-settings-v2`   | D6'   | settings brief v2 改訂（salvage 済み v1 が前提） | `briefs/settings.md`          | docs: design brief settings — v2 (IA + Lumen accent)  |
| `design-shell`         | D7    | シェル brief 新規（IA 視覚化 + タブ標準）        | `briefs/shell.md`             | docs: design brief — shell                            |
| `design-auth`          | D8    | auth brief 新規                                  | `briefs/auth.md`              | docs: design brief — auth                             |
| `design-trash`         | D9    | trash brief 新規                                 | `briefs/trash.md`             | docs: design brief — trash                            |
| `docs-terminal-retire` | T1    | Terminal 廃止の docs 反映 + code 除去 Issue 起票 | `CLAUDE.md`・`tier-1-core.md` | docs: retire Terminal feature per 2026-07-05 decision |

（briefs のパスは `.claude/docs/design/briefs/`。全オーダーはドキュメントのみ・コード変更なし。Gate: 🤖 = draft PR まで ／ 🛑 merge・ClaudeDesign 投入はユーザー）

### オーダー詳細

#### design-schedule-v2 / design-connect-v2 / design-work-v2 / design-analytics-v2（v2 改訂・軽量 4 本）

【手順】= 上記「v2 改訂の共通手順」のみ。差分は【IA 固有】:

- **schedule**: Schedule = Calendar（週グリッド）/ Routines の header タブ構成。カレンダー台帳管理（現 CalendarView）の置き場（第 3 タブ or Routines 内）の提案を §3 に含める
- **connect**: Connect は本流 5 セクションの一つ。Graph 主タブ + Backlinks（独立タブ or 選択ノード時サイドパネルの提案は維持可）
- **work**: Work はタブなし単画面。シェル記述はサイドバー本流 5 + ユーティリティ枠の目標構成で書く
- **analytics**: 4 タブ（Overview / Tasks / Work / Schedule）は維持。シェル記述のみ目標 IA へ。グラフのカテゴリ 10 色（テーマ固定）は変更なし

#### design-materials-v2（v2 改訂・最重量）

【手順】= v2 改訂の共通手順 + 構成の再編:

- Tasks / Notes / Daily / Tags は独立 4 セクションではなく **Materials 1 セクションの header タブ 4 つ**（IA 決定①）。タブ切替を前提に §4 各プロンプトの画面説明を再構成する
- 4 タブ間の統一意匠（新規作成導線・リスト密度・空状態の扱い）を §3 に明記する

#### design-settings-v2（v2 改訂・salvage 前提）

- 前提: v1 brief は PR #142 で salvage 済み。§6 に「accent hex が旧く resync 要」の自己注記あり
- 【手順】= v2 改訂の共通手順（§6 の注記どおり）
- 【IA 固有】Settings はサイドバー最下部のユーティリティ枠（Trash と並置）・タブなし縦一列
- 完了後、§6 の resync 注記を「対応済み（v2）」へ更新し Status を Ready にする

#### design-shell（新規・他 brief の基準）

- 【ゴール】アプリシェル（全画面共通の枠。desktop + mobile）の brief を `_TEMPLATE.md` 準拠で新規作成する。2026-07-05 決定の目標 IA を初めて視覚化し、**header タブの標準意匠（タブ形状・アクティブ表現・件数バッジ有無）を定義**する — 他の全 brief が参照する基準になる
- 【必読（共通 + 追加）】`IA.md`（**最重要**: サイドバー本流 5 + ユーティリティ枠 Settings / Trash + フッター ⌘K / user / SignOut。Mobile 固定 4 タブ + More）/ 実装: `shared/src/components/` の AppShell.tsx（wideQuery 768px・fluidContent）・SidebarNav.tsx（展開 240px・折畳 64px）・NavItem.tsx・BottomTabBar.tsx・BottomSheet.tsx・CommandPalette.tsx・Toast.tsx、`web/src/MainScreen.tsx`・`web/src/components/OfflineBanner.tsx`
- 【押さえどころ】Desktop = IA どおりの 6+2 サイドバー（本流とユーティリティ枠の視覚分離・折畳 64px のアイコンのみ表示・ブランドヘッダ）／ header タブ標準の例として Materials の 4 タブを載せる ／ Mobile = 下部タブ 4 + More（ボトムシートに Connect / Settings / Trash・safe-area 対応）／ 横断オーバーレイ = CommandPalette（⌘K）・Toast スタック位置・OfflineBanner ／ 中身（各セクション画面）はダミーで良い — **主役は枠と header タブの標準**
- 【AC 追加】`IA.md` との完全一致

#### design-auth（新規）

- 【ゴール】ログイン / サインアップ画面（シェル外・未ログイン時の入口。desktop + mobile）の brief を `_TEMPLATE.md` 準拠で新規作成する
- 【必読（共通 + 追加）】`IA.md`（auth はシェル外の位置づけ）/ 要件: `tier-1-core.md` の「## Feature: Cloud Sync」/ 実装: `web/src/AuthScreen.tsx`（Phase 1 minimal: Email + Password・signIn/signUp トグル・busy/error 状態・中央寄せカード）
- 【押さえどころ】アプリの第一印象を決める画面。Lumen blue + ミント差し色を最初に見せる場だが、N=1 個人ツールなのでマーケ的装飾（ヒーロー画像等)は不要 ／ signIn ⇔ signUp 切替・入力エラー・busy 状態・パスワードマネージャ前提の autocomplete ／ Desktop / Mobile とも中央寄せカードのレスポンシブ単一で成立（構造分岐不要の判断を brief に明記）

#### design-trash（新規）

- 【ゴール】Trash 画面（ソフトデリート復元。desktop + mobile）の brief を `_TEMPLATE.md` 準拠で新規作成する
- 【必読（共通 + 追加）】`IA.md`（Trash はサイドバー最下部のユーティリティ枠）/ 要件: `tier-2-supporting.md` の「## Feature: Trash (ソフトデリート復元)」/ 実装: `web/src/trash/TrashScreen.tsx`（5 カテゴリを並列 fetch・restore/permanentDelete 後に再取得）・`shared/src/components/TrashView.tsx`
- 【押さえどころ】5 カテゴリ（tasks / notes / dailies / routines / events）のグループ表示・件数・空状態 ／「復元」= 主導線・「完全削除」= danger 色 + 確認ステップの非対称な危険度・busy（連打防止）／ ユーティリティ枠らしく控えめ・実務的なトーン（本流セクションほどの visual weight を持たせない）／ Mobile はレスポンシブ単一の単純リストで良い判断を明記

#### docs-terminal-retire（docs 整理・brief ではない）

- 【ゴール】Terminal 機能廃止（2026-07-05 ユーザー決定）をドキュメントへ反映する。コード変更なし
- 【成果物】`.claude/CLAUDE.md` と `.claude/docs/requirements/tier-1-core.md` の 2 ファイルのみ
  - CLAUDE.md: §2（Terminal 記述の除去。**MCP Server は存続** — 接続経路の記述を調整）/ §5（アプリ内ターミナル起動の記述を削除 or 置換）/ §8 Tier-1 の Terminal（機能数 7→6・退役注記）
  - tier-1-core.md: 「## Feature: Terminal + Claude Code 起動」に Status: RETIRED (2026-07-05) を付す（本文は履歴として保持）
  - `IA.md` との整合を確認（廃止記述が既にあるため変更不要のはず）
- 【あわせて】コード側の除去（`SectionId` の "terminal"・shortcut 除外リスト・i18n の terminal 文言。FROZEN の frontend/ は対象外）は本オーダーでは実施せず、`gh issue create -R sunbreak-pro/life-editor` で起票する（対象ファイル一覧と DoD を明記・label は既存 `type:*` から選択）
- 【注意】「MCP も廃止」と誤読される記述にしないこと

---

## Worklog

- 2026-07-04: 偵察（Explore）で web 10 セクション構成・トークン全リスト・Lumen 4 部品移植済みを確認。基盤ドキュメント（README / \_TEMPLATE / \_COMMON-CONTEXT / 本計画）を作成し draft PR #134 化。
- 2026-07-05: PR #134 merge（`53ae40fc`）。直後に PR #135（`ink-*` → `lumen-*` rename + **accent を Lumen blue `#1d4ed8` へ変更**）が merge され、\_COMMON-CONTEXT v1 の accent 系 hex（`#1f4fff` 等）と「ink-\*」記述が旧化。
- 2026-07-05: ユーザー決定で **IA ファースト**化（①サイドバー 6 セクション集約 ②Trash はユーティリティ枠 ③Mobile 固定 4 タブ = Schedule / Materials / Work / Analytics）→ `IA.md` 正本化。D7 shell / D8 auth / D9 trash を追加。**D10 terminal は機能廃止決定のため対象外**（一時 D10 として起案した 2f7b3c8e は破棄）。\_COMMON-CONTEXT を v2 化（accent 同期 + 目標シェル構成）。D1〜D6 は v1 プロンプトで起動済みのため Step 4 監査で v2 準拠へ改訂指示する。
- 2026-07-05: 教訓: 同一 worktree での複数 design セッション運用により、brief の他ブランチ混入・計画 commit の迷子が発生（Risks に追記）。以後の起動は 1 chat = 1 worktree = 1 branch を推奨。
- 2026-07-05（続）: fan-out 第 1 波の全 PR merge 完了（#136〜#141）。機械チェックで v1 brief 5 本の v2 改訂要を確認し、改訂プロンプト D1'〜D6' + terminal 廃止 docs 整理プロンプトを発行。settings brief（305 行・完成品だが未 commit）と design セッション 4 本ぶんの tracker 記録（memory / history / outbox 計 12 ファイル）を本ブランチに salvage。frontend worktree の迷子複製（schedule / work / materials = main と同一）は掃除。
- 2026-07-05（続 2）: ユーザー要望「計画書 + 作業名の指定だけでセッションがゴールまで働く形」を受け、**work-order 方式へ改定**。Appendix の貼り付けプロンプト群を廃し、§Work Orders（共通プロトコル + v2 改訂共通手順 + 作業レジストリ 10 slug + オーダー詳細）に集約。worktree / ブランチ / セッション標識を 1 コマンドで用意する起動スクリプト `.claude/scripts/design-work.sh` を追加（slug 規約: worktree = `.claude/worktrees/<slug>`・branch = `claude/<slug>`・session-name = `<slug>`）。全オーダーは PR #142 merge 後に起動可。
- 2026-07-05（続 3）: 第 2 波完了 — work-order 9 本が完走・merge（#144〜#153。Terminal code 除去 Issue #146 起票込み）。orchestrator 最終整合監査で **design-connect-v2 の未実行**（C1・PR もブランチも不存在）を検出 → ユーザーが再起動。残指摘 M1（analytics のタブピルが shell 下線標準と矛盾）/ M2（analytics Status=Draft 昇格漏れ）/ m1（schedule・materials の「下線 or 塗り」両論併記）を audit-fixes ブランチで一括修正。m2（settings のショートカット例が旧ナビ語彙 = 現行実装準拠）はユーザー判断待ちで保留。あわせて ClaudeDesign へのファイル受け渡し調査を実施（本命 = GitHub リポジトリのデザインシステムインポート / 次点 = DesignSync 直接アップロード・要 /design-login / .md チャット添付は要実測）。
