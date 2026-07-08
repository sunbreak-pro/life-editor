---
Status: Draft
Created: 2026-07-07
Branch: claude/docs-issue-cleanup
Owner-chat: docs-issue-cleanup
Parent: (なし)
Previous: 2026-07-04-github-issues-migration-plan.md（Issue 運用移行）
---

# Plan: docs 全域の矛盾解消と再発防止（consistency cleanup）

> 2026-07-07 に監査サブエージェント 5 体 + メインの実測裁定で洗い出した docs の矛盾・鮮度切れ約 60 件を、
> 7 フェーズで解消する計画。**実装は次セッション**。監査は本ブランチ（origin/main より 6 コミット遅れ）
> 時点のスナップショットに対して行ったため、Phase 0 の main 合流と再検証を必ず最初に行うこと。

---

## Context

- **動機**: 直近 72 時間で大型の方針転換が連続した（ink→lumen トークン改名 #135 / Terminal 退役 #147 / Issue 運用移行 #132 / W-parity 決着 #154）。各転換の docs への波及が部分的にしか行われず、正本系（CLAUDE.md / 移行 SSOT / vision）・plans・requirements・agents/skills・per-chat memory の全層に矛盾が堆積している。
- **制約**: docs のみ（コード変更 0）。コスト $0。skill-lib（`~/dev/Claude/skill-lib/`）は別リポジトリのため本 PR の diff に含められない。per-chat memory は単一書込者原則があり、他チャットのファイル更新はユーザー認可が必要。
- **Non-goals**: Terminal のコード除去（#146 で追跡・コード作業）／connect brief の v2 再実行（main で対応済み #157-#158）／docs-lint の本格実装（本計画では候補提示と Issue 起票まで）。

### 本ブランチの前提状態（重要）

- この枝には **#154/#155 対応の docs コミット 3 つが PR 未作成のまま**載っている（43dc04eb / 8d22b6c0 / ef8e1990）。Issue #154/#155 が open なのは close 漏れではなく「修正が main 未着」のため。本計画の PR に相乗りさせて一括で届ける。
- origin/main は 6 コミット先行（#157-#162。**2026-07-07 監査時点のスナップショット** — 以後も main は先行し続けるため、実装セッションでは Phase 0 冒頭で ahead/behind を再計測する）。**connect brief の v1 残置（監査 high）は main で解消済み**。briefs / IA / fan-out 系プランは #161 で v3 同期されているため、該当 findings は merge 後に再検証してから直す。

---

## Scope (Touchable Paths)

```
.claude/CLAUDE.md
.claude/2026-05-04-cross-platform-migration.md
.claude/docs/**
.claude/archive/**
.claude/agents/**                 # symlink の削除・付替えのみ（実体は agents-lib — 下記）
.claude/skills/parallel-orchestrator/**
.claude/comm/README.md
.claude/automation/dev-schedule.md
.claude/memory/chat-*.md          # Phase 6 のみ・ユーザー認可後
.claude/settings.json             # Phase 5 の hook パス統一を採る場合のみ
.claude/docs/vision/plans/2026-07-07-docs-consistency-cleanup.md
```

**Scope 外だが本計画が指示する別作業**（repo 外・別コミット）:

```
~/dev/Claude/skill-lib/projects/life-editor/frontend-react-designer/**   # notion-* → lumen-* 全面改訂（計 53 箇所）
~/dev/Claude/skill-lib/projects/life-editor/session-loader/**            # 参照切れ 3 件修正
~/dev/Claude/agents-lib/projects/life-editor/*.md                        # 監査 agents 3 本の実体（M-01〜M-03。書き換えはこちら側）
```

---

## Steps

| #   | Step                                              | Gate    | Acceptance                                                      |
| --- | ------------------------------------------------- | ------- | --------------------------------------------------------------- |
| 0   | origin/main を merge し、🔁印 findings を再検証   | 🤖      | conflict 0 or 解消済み・再検証表を Worklog に記録               |
| 1   | 正本系（CLAUDE.md / SSOT / vision）の矛盾修正     | 🤖      | 下記 AC の grep 検証が全て 0 件                                 |
| 2   | plans/ 棚卸し（archive 移動 11 + 改組 + SUMMARY） | 👀→🤖   | plans/ に Status=COMPLETED/SHIPPED のファイル 0                 |
| 3   | known-issues INDEX の役割再定義と状態整合         | 🤖      | INDEX の Status 集計 = 個別ファイル Status                      |
| 4   | requirements / briefs の追随修正                  | 🤖      | 節番号旧参照・旧トークン名・退役未注記 = 0                      |
| 5   | agents / skills / hooks / comm の整備             | 👀→🤖   | 幽霊参照 0・agents 3 本の処遇決定を反映                         |
| 6   | memory / 台帳の実態同期（cross-lane）             | 🛑→🤖   | ユーザー認可後、merged-PR 5 件の stale 記述 0・regen-index 実行 |
| 7   | 再発防止ルール追記 + docs-lint Issue 起票         | 🤖      | ルール追記 diff + Issue URL                                     |
| 8   | PR 作成 → main merge（#154/#155 の DoD 消化含む） | 🛑 人手 | PR merge・#154/#155 close                                       |

### Phase 0 — main 合流と再検証（最初に必ず）

- [ ] `git merge origin/main`（conflict は plans/fan-out 系・comm/memory の可能性大。docs のみなので両取り基本）
- [ ] 🔁印の findings（R-13〜R-16 と P 系の fan-out 隣接分）を merge 後ツリーで再検証し、解消済みは表から消し込む
- [ ] main で新規追加された `2026-07-05-design-implementation-fanout.md` / `2026-07-05-shell-implementation.md` は**現役プラン**として棚卸し対象から除外

### Phase 1 — 正本系の矛盾修正

| ID   | ファイル:行                        | 問題                                                                                                                                          | 修正                                                                                                                                    | sev  |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A-01 | SSOT:39, :239                      | W0 記述がトークンを `ink-*` と記載（正は `lumen-*`、実測 lumen 68 ファイル in shared/src・web 込み 91 / ink 0）                               | `lumen-*` に修正（:239 は「当時の仮称」注記でも可）                                                                                     | high |
| A-02 | coding-principles.md:69-76         | Mobile 省略 Provider「6 種（WikiTag 含む）」+ 配置先 `frontend/src/hooks/`（FROZEN 违反誘発）                                                 | 5 種に修正・配置先を `shared/src/hooks/` へ                                                                                             | high |
| A-03 | core.md:28, :68, :108, :111        | アプリ内ターミナル（portable-pty）を現役根拠として記述・Provider 列に CalendarTags/WikiTag 残存・SQLite SSOT 前提                             | 失効ヘッダの反転点一覧に「Terminal 退役 2026-07-05 / WikiTag は Mobile 有効 / CalendarTags は DU-F で撤去 / データ層は Supabase」を追記 | med  |
| A-04 | coding-principles.md:19, :47, :151 | 「正本は CLAUDE.md §7.2」（現 §7.2 はコミット規約）「詳細は §6.3/§6.4」（小節不存在）                                                         | 参照先を add-ipc-channel スキル / rules/frontend.md に差し替え                                                                          | med  |
| A-05 | CLAUDE.md:65, :69                  | 委譲先 `session-manager` / `git-orchestrator` がどこにも実在しない幽霊参照（automation/README.md:67 も同様）                                  | 実在する session-loader / task-tracker / session-verifier、git-workflow / git-branch-flow / git-conflict-resolver の直接列挙に変更      | med  |
| A-06 | SSOT:289-307, :386, :405           | Status 行「Phase 2 完了」に対し本文チェックボックスが全て未チェック等、実績未反映 3 箇所                                                      | 実績どおり `[x]` 化・文言更新                                                                                                           | med  |
| A-07 | SSOT:2 付近, :410                  | Terminal 退役の決定日が SSOT に無く CLAUDE.md と出所二重・Phase 5 完了判定が退役前提のまま                                                    | 決定日 2026-07-05 を SSOT に明記し完了判定に再設計待ち注記                                                                              | med  |
| A-08 | SSOT:234, :438-441                 | 廃止済み `refactor/web-first-v2` 前提の本文・「task-tracker(MEMORY.md/HISTORY.md)」の旧方式記述                                               | main + worktree 運用（§7.4）・per-chat tracker（§9）参照へ書き換え                                                                      | med  |
| A-09 | CLAUDE.md:22                       | Mobile 省略 Provider 5 種に CalendarTags が残るが、CalendarTagsProvider は DU-F で全プラットフォーム撤去済み（MainScreen.tsx:325 で確認済み） | コード側の残存有無を確認のうえリストを実態（4 種 + 撤去注記）へ                                                                         | med  |
| A-10 | CLAUDE.md:5, :9                    | ⚠️ Active Migration 節の旧ブランチ経緯（web-first-v2 / PR #3-9）が「変わらない事実のみ」の自己規則に反して残存                                | 経緯 1 行を削除し SSOT へ委譲                                                                                                           | low  |
| A-11 | core.md:68                         | 「ADR-0005」参照が宙に浮く（coding-principles に 0005 の章なし）                                                                              | 0005 要旨（ラッピング方式）を coding-principles に追補し参照差し替え                                                                    | low  |
| A-12 | CLAUDE.md:21 vs SSOT:57 他         | Desktop 対象 OS が「macOS / Windows」vs SSOT「+ Linux AppImage」                                                                              | どちらかに統一（ユーザー確認 → 判断待ち D-9）                                                                                           | low  |
| A-13 | db-conventions.md:8, §10           | 「§11 以降を追記していく」が未来形のまま・「version カラムは遺物」注記が CLAUDE.md 側にのみ存在                                               | 現在形に修正・遺物注記を §10 に転記                                                                                                     | low  |
| A-14 | coding-principles.md §6            | 「W0 案 A」が archive 移動後は自己完結で読めない                                                                                              | 「frontend/ FROZEN 決定（2026-06-07・詳細 archive/）」等に置換                                                                          | low  |
| A-15 | CLAUDE.md:109 / tier-1:210         | Tier1 の「Daily」と tier-1-core.md 見出し「Memo」が名寄せ不能                                                                                 | 見出しを「Daily (Memo)」に改名                                                                                                          | low  |

### Phase 2 — plans/ 棚卸し（実プラン 19 本。Status 文字面は全件実測裁定済み）

**archive/ へ移動（Status 正規化込み・11 件）** — 🤖:

- [ ] 2026-05-16-phase2-core-migration（IN PROGRESS→COMPLETED/superseded。SSOT が Phase 2 完了宣言済み・S5 は DU レーンへ吸収）
- [ ] 2026-06-06-web-phase2-s9-mobile-responsive（In-Progress→COMPLETED。pass1 = PR #49 merge 済。目視残は fan-out 後の実装レーンへ委ねる旨を SSOT 側と 1 行整合）
- [ ] 2026-05-25-data-unification-g-notes-daily-unified（「G2 進行中」→COMPLETED。実態は G1-G4 = PR #29/#30/#31/#36 全 merge 済。**SSOT L2 の「DU-G G2 進行中」も追随修正**・Parent/Previous の archive パス切れも修正）
- [ ] 2026-05-16-frontend-refactor-pre-migration（In-progress→COMPLETED。全 Phase 消化・3-3/3-4 取り下げ済み。:96 の phase5-giant 参照は「PR #17 で廃案・削除」注記へ）
- [ ] 2026-05-16-reminders-rich-editor-connect（→SUPERSEDED。Tauri/D1 前提で残作業は実行不能。完了分 = PR #7 データ層・残 UI は web/shared 側で要再起票）
- [ ] 2026-05-17-ui-ux-quality-remediation（→CLOSED。M0/M1 done・M2-M4 は frontend FROZEN で対象消滅。a11y 知見は fan-out 側へ引き継ぎ注記。phase5-giant 参照切れも修正）
- [ ] 2026-05-23-cleanup-and-consolidation（READY FOR PR→COMPLETED。PR #13/#15 merge 済）
- [ ] 2026-05-25-worktree-rollout-and-cleanup（Draft→COMPLETED。全タスク決着・PR #33）
- [ ] 2026-05-31-autonomous-routine-fixes（Active→COMPLETED。PR #42 merge 済）
- [ ] 2026-07-04-github-issues-migration-plan（EXECUTED→COMPLETED。残 = Project UI 手動 2 点 + Orca 目視 → D-3 で処遇決定）
- [ ] 2026-05-23-memory-history-per-chat-split（IN_PROGRESS→COMPLETED (with deviations)。運用は確立済みだが計画から 3 点逸脱: INDEX は git 非追跡 regen 方式・旧 MEMORY/HISTORY は凍結でなく削除・Phase 4 は §7.4 で不要化。逸脱を Worklog に固定し、CLAUDE.md §9 / comm/README のリンクを archive パスへ更新）

**plans/ 残置のまま修正（5 件）** — 🤖:

- [ ] 2026-05-24-multi-chat-worktree-policy: Status Draft→**ACTIVE (adopted policy)** へ正規化・充足済み AC をチェック（CLAUDE.md §7.4 から現役参照のため残置が低コスト。vision/ 直下への改組は代替案 → D-2）
- [ ] 2026-05-23-cleanup-and-consolidation-deletion-targets: REFERENCE として残置妥当。cloud/ 行にのみ「✅ 2026-06-28 先行撤去済」を記入
- [ ] 2026-05-26-link-ux-obsidian-style: SKELETON 残置妥当。Parent/Previous の archive パス切れ修正 + 「fan-out で前提 UI が変わるため fan-out 後に再評価」注記
- [ ] 2026-06-19-step1-desktop-daily-driver: active 維持妥当（コード merge 済 #95・Mac 実機ゲート待ち）。リンク切れ 2 本（phase3 の archive 移動先 / reports HTML への相対パス誤り — 実体は `docs/reports/` に現存し `../../reports/` が正）と Project path `/home/user/...` の残骸を修正
- [ ] 2026-07-04-claudedesign-screen-design-fanout: Scope 記述の `_TEMPLATE` / `_COMMON-CONTEXT` を実パス（`briefs/` 配下）表記に修正

**要判断（判断待ち D-3）** — 👀:

- [ ] 2026-06-05-mobile-first-section-unification（FROZEN・正本ポインタが archive 済みの旧 W-parity SSOT を指す）: ポインタを fan-out 計画へ更新のうえ archive 推奨
- [ ] 2026-05-26-autonomous-dev-routine（Status Active だが核心の Night Routine 登録が `trig_PENDING` のまま 5 週間）: 登録を実施するか、BLOCKED (registration pending) へ更新して実態明示
- [ ] 2026-05-23-filechanged-comm-watch（DRAFT・6 週間未着手。FileChanged hook は settings.json 未登録）: 継続なら「.session-name 等の部品は per-chat 側で実装済み」を反映、やらないなら DEFERRED 明記で archive

**その他**:

- [ ] archive/SUMMARY.md: 2026-05-24 以降の archive 入り約 30 ファイルが索引欠落 + :5 の参照先 `.claude/HISTORY-archive.md` が削除済み。追記 or 「以前の索引」への役割再定義（判断待ち D-4）+ 参照を per-chat history/ + git 履歴へ書き換え
- [ ] plans/_TEMPLATE.md:13: stop-check.sh の scope-drift 照合は未実装のため「(将来)」と弱めるか hook 側 Issue 化
- [ ] data-unification-g 内の known-issues/014 参照に「013 へ統合済み」注記

### Phase 3 — known-issues / Issue 運用整備

| ID   | 対象                         | 問題                                                                                              | 修正                                                                           |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| K-01 | CLAUDE.md:118 + INDEX.md:6   | 「Fixed の凍結アーカイブ（参照専用）」と「環境系 Active（026/028）の置き場」が両立しない          | 役割を「Fixed 凍結アーカイブ ＋ 環境系（Issue 化対象外）の管理台帳」に再定義   |
| K-02 | INDEX.md:45                  | 012 が Fixed 掲載だが実ファイルは Mitigated（本命 = client pagination 未実施）                    | Mitigated 区分を新設 or 残課題を Issue 化して Fixed 確定（判断待ち D-5）       |
| K-03 | INDEX.md:19                  | 027（plaintext password）が Active 掲載で GitHub #118 と二重管理                                  | 「追跡は #118 へ移行済み（本文は参照用）」の注記行に置換                       |
| K-04 | INDEX.md:18, :75             | 028 の実ファイル Status は Workaround で Active 集計とずれ                                        | (Workaround) 注記 + 集計修正                                                   |
| K-05 | INDEX.md:28                  | 006 Monitoring だが追跡先 #120 は CLOSED                                                          | 「#120 close 済み・移行で解消見込み」注記に変更                                |
| K-06 | INDEX.md:9 vs :22            | 「#117/#119 は close 済み・Issue に積まない」と「028→#117 / 026→#119 へ移行済み」が矛盾する読み味 | 脚注を「Issue 追跡は 027→#118 のみ・026/028 は本ディレクトリが正」に書き分け   |
| K-07 | INDEX.md:87                  | 新規起票手順が旧運用（INDEX へ連番追加）のまま冒頭宣言と衝突                                      | 「環境系（Issue 化対象外）のみ。プロダクトバグは GitHub Issue へ」の限定を明記 |
| K-08 | known-issues/_TEMPLATE.md:34 | References が不存在の `docs/adr/`・`feature_plans/`・`HISTORY.md` を指す                          | `docs/vision/plans/`・`history/chat-<self>.md`・Issue 番号に差し替え           |

### Phase 4 — requirements / briefs 追随

| ID   | 対象                    | 問題                                                                                  | 修正                                                        | 状態 |
| ---- | ----------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| R-01 | tier-2:209, :12         | File Explorer の退役が未反映（「○基本完成」「Phase 4 で再評価」と現役に読める）       | tier-1 の Terminal と同形式で「✗RETIRED（本文は履歴）」注記 | ✅   |
| R-02 | tier-2:6                | Tier2 機能数 12 vs CLAUDE.md の 11（橋渡し注記なし）                                  | 「File Explorer 退役 → 実効 11」注記                        | ✅   |
| R-03 | tier-2:168, :187        | WikiTags「Desktop only」が CLAUDE.md「Mobile でも有効」と矛盾                         | Platform/Boundary を現行方針へ                              | ✅   |
| R-04 | tier-1:341, :358        | MCP Server の Purpose/AC1 が退役済みターミナル導線を現役として記述                    | 「導線は 2026-07-05 退役・再設計中」注記                    | ✅   |
| R-05 | requirements 全体       | CLAUDE.md 節番号の旧参照が系統的に残存（§11 / §5=Platform 時代 / §10.x 等 15 箇所超） | 現行 §0-9 構成へ一括更新（sed + 目視）                      | ✅   |
| R-06 | ios-additions:3         | ヘッダ「ALL DONE」が本文（M/C 系未着手・Done 項目も AC 未チェック）と食い違い         | 実態どおり「G 系のみ Done」へ                               | ✅   |
| R-07 | ios-additions:9         | mobile-porting.md / mobile-data-parity.md へのリンク切れ 2 本                         | 歴史参照注記付きプレーンテキスト化                          | ✅   |
| R-08 | ios-additions:125, :544 | WikiTag を省略 Provider に列挙・notion-*/ink-bg 残存                                  | 5 種リスト整合・lumen 表記 or 歴史注記                      | ✅   |
| R-09 | tier-2:338, :360        | Theme の `ink-*` 旧トークン名残存                                                     | `lumen-*` へ更新                                            | ✅   |
| R-10 | tier-2:491              | ソフトデリート対象リストが 3 文書で三様（CLAUDE.md §4 / tier-2 / trash brief）        | CLAUDE.md §4 を正と宣言し tier-2 に注記                     | ✅   |
| R-11 | tier-1 / tier-3 各所    | 不存在の archive/adr/dropped パス参照多数                                             | 各ファイル冒頭に「旧構成の歴史参照・現存せず」一括注記      | ✅   |
| R-12 | requirements/README:68  | テンプレが不存在の `feature_plans/` を指す                                            | `docs/vision/plans/` へ更新                                 | ✅   |
| R-13 | design/README:9 ほか    | サイドバー「6+2」表記が IA.md / shell.md の「本流 5 + ユーティリティ 2」と不一致      | 表記統一                                                    | 🔁   |
| R-14 | briefs/_TEMPLATE:4      | Section 列挙に shell / auth / trash が無い                                            | 列挙追記                                                    | 🔁   |
| R-15 | briefs/settings:167     | ショートカット例が旧 10 セクション語彙（m2 = ユーザー判断待ちの既知保留）             | 判断待ち D-7                                                | 🔁   |
| R-16 | briefs/connect          | v1 残置（監査時 high）                                                                | **main #157/#158 で解消済み** → merge 後に確認のみ          | 🟢   |

### Phase 5 — agents / skills / hooks / comm

| ID   | 対象                                      | 問題                                                                                                                  | 修正                                                | 状態 |
| ---- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---- |
| M-01 | agents/life-editor-ipc-validator.md       | Tauri IPC（src-tauri / FROZEN の frontend/src/services）前提・「CLAUDE.md §7.2 の 4 点同期」参照も現存しない          | retire を推奨（判断待ち D-1）                       | 📦   |
| M-02 | agents/life-editor-migration-validator.md | 監査対象の cloud/db/migrations が退役済みで不存在                                                                     | supabase/migrations 基準へ書き換え or retire（D-1） | 📦   |
| M-03 | agents/life-editor-sync-auditor.md        | §3.2/§4.1 参照が現構成と不一致・「version カラム期待値 11」が §3.3「遺物・未使用」と直接矛盾                          | items_meta LWW 基準へ全面改訂 or retire（D-1）      | 📦   |
| M-04 | skills/parallel-orchestrator/SKILL.md:90  | `notion-*` トークン必須と記載（正は lumen-*）                                                                         | lumen-* へ修正（repo 内・本 PR）                    | ✅   |
| M-05 | skill-lib: frontend-react-designer        | 全編 notion-*（**計 53 箇所** = SKILL.md 10 + references/ 43）+ frontend/src 前提。symlink 経由で自動ロードされ誤誘導 | lumen-* / shared/src 前提へ全面改訂                 | 📦   |
| M-06 | skill-lib: session-loader                 | 不存在のグローバル skill 参照・ai-integration.md 参照切れ・known-issues Active 確認が旧ポリシー                       | 3 箇所修正（Active 確認は `gh issue list` へ）      | 📦   |
| M-07 | CLAUDE.md §7.3                            | settings.json 登録済みの pre-commit-index-guard.sh が docs 上どこにも言及なし                                         | hooks 連動行に追記                                  | ✅   |
| M-08 | settings.json:9                           | Stop/SessionStart hook だけ main への絶対パスで `${CLAUDE_PROJECT_DIR}` と混在（worktree 側 hook が無音で使われない） | 意図確認のうえ統一 or 注記（判断待ち D-6）          | ✅   |
| M-09 | comm/README.md                            | 必須ファイル `.session-branch` の説明が皆無（`.session-name` のみ）                                                   | 一節追加                                            | ✅   |

> ⚠️ M-01〜M-03 の `.claude/agents/*.md` は **3 本とも実体が `~/dev/Claude/agents-lib/` への symlink**（skill-lib と同じ repo 外構造）。retire = repo 内の symlink 削除（本 PR に入る）、書き換え = agents-lib 側の編集（本 PR の diff には現れない・別コミット）。原因分析 #3 と同根のため取り違えないこと。

### Phase 6 — memory / 台帳の実態同期（🛑 ユーザー認可後に実施）

merge 済み PR を「open・merge 待ち」と主張し続ける per-chat memory 5 件。単一書込者原則に反するため、
**cross-lane reconciliation としてユーザー認可を得てから**一括更新 → `hooks/regen-index.sh` 実行。

- [ ] chat-main.md（PR #106 → MERGED）
- [ ] chat-connect.md（PR #107 → MERGED・worktree connect-link-ui は prune 済み）
- [ ] chat-db-hardening.md（PR #109 → MERGED）
- [ ] chat-frontend.md（PR #111 → MERGED・ink→lumen 再改名も未反映）
- [ ] chat-lumen-shared.md（PR #113 → MERGED）
- [ ] automation/dev-schedule.md: 「今週」が 2026-06-21 週のまま停止 → schedule-management で再生成 or 休止注記（判断待ち D-8）
- [ ] worktree `docs`（branch docs/structure-notes）が台帳外レーン → `.session-name` 宣言 or prune（判断待ち D-8）

### Phase 7 — 再発防止（ルール化 + 機械化候補）

- [ ] **数値の非複製原則**を CLAUDE.md §0 か coding-principles に 1 行追加: 「個数・列挙はコード or 単一 SSOT のみに書き、他文書は参照にする（『一覧はコードが正』と書くなら数字を併記しない）」
- [ ] **改名・退役 sweep チェックリスト**を rules/ に新設: 対象 grep = `.claude/**` + `~/dev/Claude/skill-lib/projects/life-editor/**` + `~/dev/Claude/agents-lib/projects/life-editor/**`（symlink 先の実体まで含める）。ink→lumen で 3 世代（notion→ink→lumen）が併存した実例を記録
- [ ] **plans/ Status 語彙の enum 化**: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)。表記ゆれ（In-progress / IN-PROGRESS / EXECUTED / READY FOR PR / SKELETON / FROZEN 等の自由語彙）を禁止し、grep 可能にする
- [ ] **PR merge 時の docs 追随を DoD 化**: known-issue テンプレ / plans テンプレに「対応 plan・memory の Status 更新」チェック行を追加
- [ ] **docs-lint 機械化候補を Issue 起票**（実装は別セッション）: (a) 相対リンク実在 (b) 旧トークン名残存 (c) plans frontmatter enum (d) COMPLETED の plans/ 残置検出 — stop-check か CI に載せる
- [ ] **サブエージェント監査の検証必須則**を rules/ に固定: 監査報告の file:line は必ず実測で spot check（今回の監査でも同一エージェントが SectionId「除去済み」等の偽 findings を混入させた実例あり）

---

## なぜ矛盾が生まれるか（設計・ハーネス上の構造要因）

今回の約 60 件は個別ミスではなく、以下の 8 つの構造要因から機械的に発生している。

1. **事実の多層複製**: 同じ事実（トークン名・機能数・Provider 一覧）が SSOT → CLAUDE.md 要約 → vision → requirements → briefs → skills の最大 6 層に転記される。1 つの決定に対し更新箇所が N 箇所になり、どこかが必ず漏れる。「一覧はコードが正」と書きながら数字も併記する自己矛盾パターンが典型（→ Phase 7 非複製原則）。
2. **改名・退役イベントに波及手順が無い**: ink→lumen 改名（#135）は rules/frontend.md を直したが、SSOT・tier-2・skill-lib へは波及しなかった。結果 notion→ink→lumen の 3 世代が現存（→ sweep チェックリスト）。
3. **リポジトリ境界をまたぐ参照**: skills/ と agents/ の実体は symlink 先の skill-lib / agents-lib（別リポジトリ）にあり、life-editor の PR レビューや docs 監査から構造的に漏れる。しかもスキルは自動ロードされ「強い指示」として古い規範を注入する。これはハーネスの仕様（スキル＝システム指示に近い優先度）× 運用（symlink 分離）の掛け算で生じる。実際、本計画書の初稿自体が agents 3 本を「repo 内」と誤分類しており、QA レビューで是正された（死角の実証例）。
4. **完了イベントが docs 更新をトリガーしない**: PR merge / Issue close と plans Status・memory・SSOT チェックボックスが非連動。特に per-chat memory は単一書込者原則のため、**チャットが役目を終えると更新者が構造的に消滅する**（merged 済み PR を「open」と主張する memory 5 件、実質完了プラン 11 件の残置、6/21 で止まった台帳が実例）。さらに悪い派生形として「**相互参照が整合したまま両方 stale**」がある: 移行 SSOT と DU-G 計画書は互いに「G2 進行中」で一致していたが、実態は G1-G4 全 merge 済みだった。文書同士の突き合わせでは検出できず、git/コードとの突き合わせが必須。
5. **並行チャット × 合流ラグ**: 14 worktree 体制では docs 修正がブランチに滞留し（本ブランチの未 PR 3 コミットが実例）、各チャットは古いスナップショット上で docs を編集する。known-issue 029（二重実装）と同型の問題が docs でも起こる。
6. **状態語彙の非標準化**: Status に SHIPPED / PARTIAL / ACTIVE(policy) / Mitigated / Workaround 等の自由語彙が混在し、hook や grep で「完了なのに残置」を機械検出できない。
7. **ハーネス由来の無音失敗**: (a) `.session-name` 未宣言や Orca 作成 worktree で hook が無音スキップし tracker/INDEX が更新されない（今セッションも起動時に未宣言警告あり）。(b) settings.json の Stop hook が main への絶対パス固定のため、worktree 側で hook を直しても古い方が走る。(c) セッション冒頭の gitStatus はスナップショットで、古い branch 状態を「現在」と誤認させる。
8. **監査自体の信頼性問題**: サブエージェントの監査報告に捏造が混ざる。今回の監査でも 2 体が「一次報告 = 捏造混じり／二次報告 = 精査済み」の二段階になり、一次報告には「SectionId は除去済み（実際は 7 種現存）」「MCP 34 ツール（実測 32）」「s9 プランは COMPLETED 表記（実物は In-Progress）」「worktree-policy は ACTIVE 表記（実物は Draft）」等、**実在しない引用つきの偽 findings が計 10 件近く**含まれた（全件メインの実測 grep で裁定・棄却済み）。docs 修正の根拠が汚染されると「修正という名の新たな矛盾」を生むため、file:line の実測 spot check を挟まない docs 修正は危険（memory の subagent-premature-completion / tool-result-fabrication 知見と同根）。

---

## 判断待ちリスト（実装セッション冒頭でユーザーに確認）

| ID   | 論点                                          | 推奨                                                                                                                                                     |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | 監査 agents 3 本の処遇                        | ipc-validator は retire（repo 内 symlink 削除）、migration-validator / sync-auditor は現行アーキ基準に書き換え（実体は agents-lib 側・📦）               |
| D-2  | worktree-policy の置き場                      | plans/ 残置 + Status「ACTIVE (adopted policy)」正規化（低コスト）。vision/ 直下改組は代替案                                                              |
| D-3  | 要判断プラン 3 本 + github-issues 残 2 点     | mobile-first = ポインタ更新後 archive／autonomous-routine = 登録実施 or BLOCKED 化／filechanged = DEFERRED 化／Project UI 残 2 点 = 手動実施 or Issue 化 |
| D-4  | archive/SUMMARY.md（約 30 ファイル欠落）      | 「2026-05-23 以前の索引」への役割再定義 + HISTORY-archive 参照修正が低コスト                                                                             |
| D-5  | known-issue 012 の残課題（client pagination） | Issue 化して Fixed 確定                                                                                                                                  |
| D-6  | settings.json の hook 絶対パス                | 意図的（main を SSOT として実行）なら注記のみ、でなければ `${CLAUDE_PROJECT_DIR}` 統一                                                                   |
| D-7  | settings brief ショートカット語彙（m2）       | IA 語彙へ更新（現行実装準拠注記の代替案あり）                                                                                                            |
| D-8  | dev-schedule 台帳・docs worktree              | 台帳は休止注記、docs worktree は用済みなら prune                                                                                                         |
| D-9  | Desktop 対象 OS（Linux 含む？）               | SSOT 準拠で CLAUDE.md に Linux 追記（縮小したなら SSOT 側修正）                                                                                          |
| D-10 | 移行 SSOT の置き場                            | `.claude/` 直下維持 + §9 に「移行 SSOT のみ例外」を 1 行明文化（移動はリンク書き換えコスト大）                                                           |

---

## Acceptance Criteria (機械検証可能)

- [ ] `grep -rn 'ink-\*\|notion-' .claude/CLAUDE.md .claude/2026-05-04*.md .claude/docs .claude/skills/parallel-orchestrator .claude/agents` → 歴史注記行（「旧称」「retired」を含む行）以外 0 件
- [ ] `grep -rln 'Status: *\(COMPLETED\|SHIPPED\)' .claude/docs/vision/plans/` → 0 件
- [ ] `grep -rn 'session-manager\|git-orchestrator' .claude/CLAUDE.md .claude/automation` → 0 件
- [ ] `grep -rn '§11\|§10\.[0-9]\|§6\.3\|§6\.4\|§7\.2 抜粋' .claude/docs/requirements .claude/docs/vision/coding-principles.md .claude/agents` → 0 件
- [ ] CLAUDE.md 内の全相対リンク実在チェック → exit 0。ワンライナー: `grep -o '](\./[^)]*)' .claude/CLAUDE.md | sed 's/](\.\///;s/)//' | while read f; do [ -e ".claude/$f" ] || { echo "MISSING: $f"; exit 1; }; done`
- [ ] ※手動: known-issues/INDEX.md の Status 集計 = 個別ファイル frontmatter の集計（1 周照合。docs-lint 実装後に自動化）
- [ ] PR diff が `.claude/**` のみ（コード変更 0）
- [ ] #154 / #155 の DoD 全項目チェック → 両 Issue close

---

## Files（主要変更対象の要約）

| File                                                           | Operation              | Notes                                                    |
| -------------------------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| .claude/CLAUDE.md                                              | edit                   | A-05/07/09/10/12/15・M-07・K-01・SSOT 例外明文化（D-10） |
| .claude/2026-05-04-cross-platform-migration.md                 | edit                   | A-01/06/07/08                                            |
| .claude/docs/vision/{core,coding-principles,db-conventions}.md | edit                   | A-02/03/04/11/13/14                                      |
| .claude/docs/vision/plans/*（11 本）                           | move→archive           | Phase 2・Status 正規化                                   |
| .claude/docs/vision/plans/*（3 本）                            | 改組                   | D-2 の決定に従う                                         |
| .claude/archive/SUMMARY.md                                     | edit                   | D-4                                                      |
| .claude/docs/known-issues/INDEX.md ほか                        | edit                   | K-01〜K-08                                               |
| .claude/docs/requirements/*（4 本 + README）                   | edit                   | R-01〜R-12                                               |
| .claude/docs/design/*（README/_TEMPLATE/settings）             | edit                   | R-13〜R-15（merge 後再検証）                             |
| .claude/agents/*（3 本）                                       | symlink 削除 or 付替え | D-1。書き換えの実体は agents-lib 側（📦 別コミット）     |
| .claude/skills/parallel-orchestrator/SKILL.md                  | edit                   | M-04                                                     |
| .claude/comm/README.md                                         | edit                   | M-09 + filechanged プランの archive リンク               |
| .claude/memory/chat-*.md（5 本）                               | edit                   | Phase 6・🛑 認可後                                       |
| .claude/automation/dev-schedule.md                             | edit                   | D-8                                                      |
| .claude/settings.json                                          | edit(条件付)           | D-6                                                      |
| ~/dev/Claude/skill-lib/...（2 スキル）                         | edit                   | 📦 repo 外・別コミット                                   |
| rules/（sweep チェックリスト等）                               | add                    | Phase 7                                                  |

---

## Risks / Known Issues 参照

- 029（並行チャット二重実装）: 本計画と docs worktree（docs/structure-notes）・他チャットの docs 編集が衝突しうる。Phase 0 の merge と、実装開始時の `git log origin/main` 確認で回避
- 026（formatter が見出し削除）: docs 大量編集時に PostToolUse formatter の既知挙動に注意
- 028（cwd 漂流）: 複数 worktree 併走中の Bash は絶対パス徹底
- 監査 findings の line 番号は監査時点のもの。merge 後にずれるため、実装時は行番号でなく内容で特定すること

## References

- 監査元: 本セッション（2026-07-07）のサブエージェント 5 体 + メイン実測裁定
- Issue: #154（W-parity 決着・本ブランチに対応コミット済み）/ #155（Issue スコープ・同）/ #146（Terminal コード除去・本計画対象外）
- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`
- 前例: fcbc1fb8「docs: resolve audit drift (#115)」・60307b25「docs: audit fixes (#156)」

## Worklog

- 2026-07-07: 計画書作成。監査サブエージェント 5 体（延べ 7 報告）・findings 約 60 件を統合。一次報告の偽 findings 約 10 件は plans 全 19 本の Status 一括実測・SectionId/MCP ツール数/CalendarTags のコード実測で裁定・棄却済み。実装は次セッション。
