---
Status: IN PROGRESS
Created: 2026-07-30
Branch: main # docs のみ。commit する場合は一時 worktree 経由（main 直 push 禁止）
Owner-chat: main
---

# Plan: Open Issue 一斉消化 fan-out ラウンド 2（2026-07-30）

> **意図的に緩い計画書**。方向性・担当 worktree・着手順（依存）だけを固定し、手順・DoD は各 Issue body を正本とする（転記しない — 数値の非複製原則）。
> コード調査で前提が変わったら Issue コメント側を更新し、本書は方向レベルのまま保つ。
> 前ラウンド = [`2026-07-28-open-issue-fanout.md`](./2026-07-28-open-issue-fanout.md)（配った Issue は全消化・#474 で archive 化予定）

---

## Context

- **動機**: 2026-07-30 時点で **open PR ゼロ・worktree 4 本すべて `origin/main`（`a4fd6f89`）と同一コミットで待機中**。open Issue 15 件のうち実行可能な 12 件を 4 レーンへ一括分配して消化する
- **制約**: 実ブラウザ検証は merge 後に chat-main の検証セッションが playwright MCP で実施する。各 worktree は build / 型検証 / vitest まで（CLAUDE.md §7.4）。**前ラウンド用の検証計画は 2026-07-29 に全項目消化して COMPLETED・archive 済み**（[`archive/2026-07-28-post-merge-playwright-verification.md`](../../../archive/2026-07-28-post-merge-playwright-verification.md) — 唯一の fail = V4 の `[[` クリック遷移が本ラウンドの #475）。**本ラウンド用の検証計画は chat-main が別途新規作成する**（同書を再オープンしない）
- **Non-goals**: #372（DDL 要・DEFERRED のまま）の実装 / Epic #290・#321 の完了宣言（チェックボックス追随のみ）/ リファクタリング新計画の起案（本ラウンドの merge 完了後に chat-main が実測ベースで作成する — 下の「後続」参照）

---

## 依存グラフ（着手順の根拠）

```
#465 (MainScreen hooks 切り出し) ──┬─→ #473 (コマンドパレット mobile 導線)
   ※最優先ゲート・単独レーン       └─→ #472 (Undo/Redo mobile 導線)

#466 (Step 5-b 繰り返しフィルタ) ──→ #468 (Step 6 カレンダー台帳フィルタ)   ※同じグリッドのフィルタ層

#475 (bug: [[リンク]] クリック遷移) ── 依存なし（RichTextEditor / itemLinkNode 局所）
   ※ MainScreen を触る必要が出たら #465 の着地を待つ（Issue の注意書き）
```

- **#465 が全体のボトルネック**。ここが merge されるまで横断 2 件（#472 / #473）は着手できないため、refactor-core レーンを最初に走らせる
- #475 は `sev:important` のバグだが依存がないので、mobile-refine レーンの先頭に置いて最短で潰す

---

## Worktree 分担

| worktree（実パス）                            | 担当（1 行）                                  | 対応 Issue（着手順）                          | 触ってよいパス（目安）                                                                                                    |
| --------------------------------------------- | --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `orca/workspaces/life-editor/refactor-core`   | MainScreen 構造確定（他レーンの前提）         | **#465**（単独・最優先）                      | `web/src/MainScreen.tsx` `web/src/hooks/**` `web/src/shell/**`（`web/src/schedule/CalendarTab.tsx` は対象外）             |
| `orca/workspaces/life-editor/mobile-refine`   | materials のバグ潰し → mobile フル編集        | **#475 → #470 → #471**                        | `web/src/notes/**` `web/src/tasks/**` `shared/src/components/materials/**` `shared/src/components/mobile/**`              |
| `orca/workspaces/life-editor/schedule-refine` | Epic #290 の残 Step 全部（5-b → 6 → 5-c → 7） | **#466 → #468 → #467 → #469**                 | `web/src/schedule/**` `shared/src/components/schedule/**` `shared/src/utils/routine*`                                     |
| `orca/workspaces/life-editor/tags-docs`       | 軽量 2 件 → #465 着地後に横断 mobile 導線     | **#368 → #474 →（#465 merge 後）#472 → #473** | `web/src/wikitag/**` `.claude/docs/**` `.claude/archive/**` `shared/src/components/AppShell.tsx` `web/src/MainScreen.tsx` |

- **#472 / #473 を tags-docs が引き取る**のは 2026-07-30 のユーザー決定。#368（名前の絞り込みのみに縮小 = ANSWERS `D-20260728-main-3`）と #474（docs 棚卸し）はどちらも軽く、**#465 の merge を待つ時間にちょうど収まる**という読み
- **ブランチ運用は CLAUDE.md §7.4**: Issue ごとに `claude/<slug>-<issue>-<短slug>` を `origin/main` から切り直し、`.claude/comm/.session-branch` を都度更新。着手前に (1) `git pull --ff-only` → (2) `git fetch origin && git merge origin/main --no-edit`
- **worktree に既に切られているブランチ**（2026-07-30 時点・全部 `a4fd6f89`）: refactor-core = `claude/refactor-08-mainscreen-hooks` / schedule-refine = `claude/schedule-466-repeat-filter` / tags-docs = `claude/tags-368-name-filter` はそのまま使える。**mobile-refine のみ `claude/materials-470-mobile-task-detail` が切られているが、着手順を #475 先行に変えたので新ブランチへ切り直す**
- **Epic 追随**: #290 は schedule-refine が Step ごとにチェック（全 Step 完了時の COMPLETED 化は chat-main へ outbox 依頼）。#321 Phase 2 は担当レーンが該当行にチェック

---

## 方向性メモ（1〜2 行の向きだけ。詳細・DoD = Issue body）

### refactor-core

- **#465**: `web/src/briefing/hooks/`（#462）・`web/src/notes/hooks/`（#463）と**同じ型**で切る。挙動変更ゼロ。`shared/src/**` の diff はゼロが原則。完了時に計画書 `2026-07-28-refactor-dataservice-split.md` を COMPLETED 化して archive 移動（Step 10 の実ブラウザ確認は chat-main）

### mobile-refine

- **#475**: **推測を鵜呑みにせず、`handleClickOn` の 5 ガードのどこで落ちているかを実測してから直す**。Issue に書いた `onNavigate` の直接キャプチャ疑いは仮説であって結論ではない。再発検知テストの追加まで含めて 1 本
- **#470**: 詳細パネル + リッチテキストを狭幅で開けるように。**DnD / カンバンのカラム操作はモバイルに持ち込まない**。IME の gotcha は `rules/frontend.md` を先に読む
- **#471**: Notes を閲覧専用からフル編集へ。**#430 の遅延フェッチ（`[[` を打つまで候補を取らない）を壊さないことが条件**

### schedule-refine

- **#466**: 絞り込みの粒度（「この繰り返しだけ表示」か「繰り返し由来を隠す」か）を**実装前に 1 案へ絞り**、却下案の根拠を Issue コメントへ。永続化の要否も判断して記録
- **#468**: #466 の着地後。同時適用時（台帳フィルタ × 繰り返しフィルタ）の挙動を決めて記録するのが本丸
- **#467**: mobile の Schedule を List + FAB に。**繰り返し一覧は閲覧のみ**（編集は Desktop 専用）。Epic #290 Step 5-c と #321 の schedule 項目を 1 本で扱う統合起票
- **#469**: 編集パネルの日付ピッカー + 終日トグル。小粒は `docs/known-issues/INDEX.md` を **grep で再実測してから**拾う（古い記述が残っている）

### tags-docs

- **#368**: ANSWERS `D-20260728-main-3` で**「名前の絞り込みのみ」に縮小と確定済み**。ソート機能は入れない。共有部品 `SidebarListControls` を再利用
- **#474**: 判定の正は `gh issue list --state all` / `gh pr list --state all` の **state**。**`git diff` でのマージ判定は禁止**（squash merge は未マージに見える — CLAUDE.md §7.4）。迷ったものは動かさず Issue にコメントして chat-main へ
- **#472 / #473**: **#465 の merge を確認してから着手**（`gh pr list` の state で確認・`git diff` で判定しない）。導線の置き場所は実装者判断だが、根拠を Issue コメントに残す。Desktop の既存挙動は無変更が条件

---

## 共通ゲート（全 worktree）

DDL ゼロ / `lumen-*` トークンのみ（色ハードコード禁止）/ DataService 境界維持（コンポーネントから直接バックエンド呼び出し禁止）/ i18n は en・ja 両 catalog / `cd shared && npm run test`・`cd shared && npm run build`・`cd web && npm run build` すべて exit 0 / 実ブラウザ検証は merge 後の chat-main セッション（worktree ではやらない）/ 起票が必要な発見は自分の outbox に依頼を append（起票は chat-main 一元化）/ A/B に割れる判断は `.claude/comm/decisions/chat-<self>.md` に書いて次の作業へ進む（待ちで止まらない — `rules/decision-queue.md`）

---

## 貼り付けプロンプト（各 worktree チャットの冒頭にそのまま貼る）

> 各 worktree で `claude` を起動し、以下を最初のメッセージとして貼る。ブランチ切替の 2 ステップ（`git checkout -b` + `.session-branch` 更新）を**プロンプト側に埋め込んである**ので省略しないこと。

### refactor-core

```text
あなたは worktree refactor-core（chat-refactor-core）です。担当は Issue #465 の 1 件のみで、これは他レーンの前提になるので最優先で着地させます。

まず着手前の同期を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. ブランチは既に claude/refactor-08-mainscreen-hooks が切られています。origin/main と同一コミットであることを確認し、.claude/comm/.session-branch がこのブランチ名になっているか確認（違えば書き換え）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #465 [refactor-core] MainScreen の hooks 切り出し（DataService 分割計画 Phase B 最終ステップ）

方向:
- 挙動変更ゼロの構造改善のみ。機能追加・UI 変更・文言変更・DDL・依存追加は禁止
- 先行例 web/src/briefing/hooks/（PR #462）と web/src/notes/hooks/（PR #463）と同じ型で切る
- web/src/schedule/CalendarTab.tsx は対象外（schedule-refine レーンが Epic #290 で触る）
- shared/src/** の diff はゼロが原則。DataService インターフェースは無改変
- 完了時に計画書 .claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md の Step 9 にチェック → Status を COMPLETED にして .claude/archive/ へ移動（Step 10 の実ブラウザ確認は chat-main 担当なので手を出さない）

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run test・cd shared && npm run build・cd web && npm run build がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #465）。PR merge はこうだいさんのゲートなので、提出したら待つ。A/B に割れる判断が出たら .claude/comm/decisions/chat-refactor-core.md に書いて次へ進む。起票が必要な発見は .claude/comm/outbox/chat-refactor-core.md に起票依頼を append（自分で Issue を立てない）。

このレーンの着地が #472 / #473 の解禁条件なので、merge されたら outbox に「#465 merge 済み」を 1 行 append してください。
```

### mobile-refine

```text
あなたは worktree mobile-refine（chat-mobile-refine）です。担当は 3 件で、着手順は #475 → #470 → #471 です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. 着手順を #475 先行に変えたので、切られている claude/materials-470-mobile-task-detail は使わず新しく切ります:
   git checkout -b claude/materials-475-item-link-click origin/main
   echo claude/materials-475-item-link-click > .claude/comm/.session-branch
（以降 Issue を移るたびに「origin/main から切り直し + .session-branch 更新」の 2 ステップを必ずセットで行う）

担当 Issue（body が正本・DoD はそちらを読むこと）:
1. #475 [materials] bug: ノート本文の [[リンク]] をクリックしても遷移しない（sev:important）
2. #470 [materials] mobile tasks の詳細編集（Epic #321 Phase 2）
3. #471 [materials] mobile notes のフル編集（Epic #321 Phase 2）

方向:
- #475: Issue に書いてある「onNavigate をプロップ直渡ししている」は仮説です。鵜呑みにせず、handleClickOn の 5 つのガード（direct / node.type.name / targetId / role / onNavigate）のどれで false になっているかを実測で特定してから直してください。読み取り専用エディタ（editable={false} の BottomSheet 側）でも遷移が効くこと、未解決リンクは従来どおり不活性のままであることが条件。クリック遷移を覆うテストが今ゼロなので追加まで含めて 1 本にします
- #470: DnD・カンバンのカラム操作はモバイルに持ち込まない（Desktop 専用のまま）。リッチテキストの IME gotcha は .claude/rules/frontend.md を先に読むこと。Desktop の Kanban 挙動は無変更
- #471: #430 で「[[ を打つまで候補をフェッチしない」遅延化が入っています。本文編集だけで全件フェッチが走らないことを壊さないのが条件
- #470 / #471 は mobile-scope.md の該当行（#6 / #7）を実態に追随させ、Epic #321 Phase 2 の該当行にチェック
- web/src/MainScreen.tsx を触る必要が出たら、#465（refactor-core レーン）の merge を待ってください（gh pr list の state で確認・git diff で判定しない）

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run test・cd shared && npm run build・cd web && npm run build がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: 1 Issue = 1 ブランチ = 1 PR。task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #<番号>）→ 次の Issue へ。PR merge はこうだいさんのゲートなので待たずに次へ進んでよい（ただし同じファイルを触る場合は衝突を避けて順番待ち）。A/B に割れる判断は .claude/comm/decisions/chat-mobile-refine.md に書いて次へ。起票が必要な発見は .claude/comm/outbox/chat-mobile-refine.md に append（自分で Issue を立てない）。
```

### schedule-refine

```text
あなたは worktree schedule-refine（chat-schedule-refine）です。担当は Epic #290 の残り 4 件で、着手順は #466 → #468 → #467 → #469 です。

まず着手前の同期を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. ブランチは既に claude/schedule-466-repeat-filter が切られています。origin/main と同一コミットであることと .claude/comm/.session-branch の中身が一致していることを確認
（以降 Issue を移るたびに「git checkout -b claude/schedule-<issue>-<短slug> origin/main」+ 「.session-branch 更新」の 2 ステップをセットで）

担当 Issue（body が正本・DoD はそちらを読むこと）:
1. #466 [schedule] Step 5-b: Calendar グリッドの繰り返しフィルタ
2. #468 [schedule] Step 6: カレンダー台帳をグリッドのタグフィルタとして配線（#466 の着地後）
3. #467 [schedule] Step 5-c: Mobile を List+FAB に絞る + 繰り返し一覧の閲覧導線
4. #469 [schedule] Step 7: 編集パネルの日付ピッカー・終日トグル + 小粒回収

方向:
- #466: 絞り込みの粒度（「この繰り返しだけ表示」か「繰り返し由来を隠す」か）を実装前に 1 案へ絞り、採用案と却下案の根拠を Issue コメントに残す。絞り込み状態の永続化要否も判断して記録
- #468: #466 と同じグリッドのフィルタ層を触るので必ず #466 の着地後。台帳フィルタと繰り返しフィルタを同時適用したときの挙動を決めて記録するのが本丸
- #467: mobile の Schedule を List + FAB に絞る（週グリッドは Desktop 専用のまま）。繰り返し一覧は閲覧のみで、編集操作は出さない or 無効。Desktop の表示・操作は無変更
- #469: 小粒は .claude/docs/known-issues/INDEX.md を grep して再実測してから拾う（古い記述が残っている可能性あり）。回収したものと見送ったものを理由付きで Issue に記録
- 前レーンの重要な実測が per-chat memory（.claude/memory/chat-schedule-refine.md）に残っています。特に「カレンダーのナビゲーションは occurrence を生成しない」「nextRoutineOccurrence は routineScheduleSync.ts にある」「Todo の導線は 4 本ある」は今回も効くので着手前に読むこと
- 各 Issue の close 時に Epic #290 の該当 Step にチェック。全 Step 完了なら Epic #290 と計画書 2026-07-14-schedule-redesign.md の COMPLETED 化 + archive 移動を chat-main へ outbox で依頼（自分で動かさない）

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run test・cd shared && npm run build・cd web && npm run build がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: 1 Issue = 1 ブランチ = 1 PR。task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #<番号>）→ 次へ。A/B に割れる判断は .claude/comm/decisions/chat-schedule-refine.md に書いて次へ進む。起票が必要な発見は .claude/comm/outbox/chat-schedule-refine.md に append（自分で Issue を立てない）。
```

### tags-docs

```text
あなたは worktree tags-docs（chat-tags-docs）です。担当は 4 件で、着手順は #368 → #474 →（#465 の merge を確認してから）#472 → #473 です。

まず着手前の同期を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. ブランチは既に claude/tags-368-name-filter が切られています。origin/main と同一コミットであることと .claude/comm/.session-branch の中身が一致していることを確認
（以降 Issue を移るたびに「git checkout -b claude/<slug>-<issue>-<短slug> origin/main」+ 「.session-branch 更新」の 2 ステップをセットで）

担当 Issue（body が正本・DoD はそちらを読むこと）:
1. #368 [tags] WikiTags 一覧のソート・フィルタ検討
2. #474 [docs] plans/ の Status 棚卸しと archive 移動
3. #472 [all] Undo/Redo のモバイル導線（#465 merge 後）
4. #473 [all] コマンドパレットのモバイルタッチ導線（#465 merge 後）

方向:
- #368: スコープはユーザー回答で「名前の絞り込みのみ」に縮小確定しています（.claude/comm/decisions/ANSWERS.md の D-20260728-main-3）。ソート機能は入れない。共有部品 SidebarListControls（shared/src/components/materials/・props 注入型）を再利用する
- #474: 判定の正は gh issue list --state all / gh pr list --state all の state です。git diff / git log / git cherry でのマージ判定は禁止（squash merge は未マージに見える — CLAUDE.md §7.4）。文書同士の突き合わせでは stale を検出できないので、必ず git・コード・Issue state と突き合わせる。Status の値は enum のみ（Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)）。判定に迷ったものは動かさず Issue にコメントして chat-main へ回す。対象外は 3 本 = 2026-07-28-refactor-dataservice-split.md（#465 の担当が閉じる）/ 2026-05-04-cross-platform-migration.md（移行 SSOT・生きている）/ 2026-07-30-open-issue-fanout-r2.md（本ラウンドの計画書）。なお Issue body が対象外に挙げている 2026-07-28-post-merge-playwright-verification.md は 2026-07-29 に archive 済みで plans/ にもう無いので、探して見つからなくても異常ではない
- #472 / #473: どちらも shared/src/components/AppShell.tsx と web/src/MainScreen.tsx を触る可能性が高いので、#465（refactor-core レーンの MainScreen hooks 切り出し）の merge を gh pr list の state で確認してから着手する。#465 がまだなら #368 / #474 を先に終わらせて待つ。導線の置き場所は実装者判断だが、決めた根拠を Issue コメントに残す。Desktop の既存挙動（ヘッダーボタン / Cmd+K）は無変更が条件。履歴はグローバル 1 本のまま（Epic #304 の設計を分岐させない）。mobile-scope.md の #16 / #17 行を実態に追随させ、Epic #321 Phase 2 の該当行にチェック

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run test・cd shared && npm run build・cd web && npm run build がすべて exit 0（#474 は docs only なので diff が .claude/** に限られることを確認）/ 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: 1 Issue = 1 ブランチ = 1 PR。task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #<番号>）→ 次へ。A/B に割れる判断は .claude/comm/decisions/chat-tags-docs.md に書いて次へ進む。起票が必要な発見は .claude/comm/outbox/chat-tags-docs.md に append（自分で Issue を立てない）。
```

---

## chat-main の担当（このラウンド中）

- 4 レーンの PR 進捗の追跡と、**#465 merge 後に #472 / #473 の解禁を tags-docs へ通知**
- 各レーンの outbox / decisions を拾って Issue 起票・回答転記（起票は chat-main 一元化 — CLAUDE.md §9）
- **merge 後の実ブラウザ検証**: 本ラウンド用の検証計画を新規作成して実施する（前ラウンド分の [`archive/2026-07-28-post-merge-playwright-verification.md`](../../../archive/2026-07-28-post-merge-playwright-verification.md) は COMPLETED なので再オープンしない。検証セッションの約束事 = 場所は main・`gh pr list --state merged` で merge 済みの項目だけ検証・ブランチ差分での判定禁止 — は同書の「前提」節を踏襲する）
- PR merge そのものはこうだいさんの手番（🛑）

---

## Acceptance Criteria（ラウンド完了の条件）

- [ ] 12 件（#465 / #475 / #470 / #471 / #466 / #468 / #467 / #469 / #368 / #474 / #472 / #473）がすべて close または「不要と判断 + 根拠コメント」で決着
- [ ] Epic #290 の Step 5-b / 5-c / 6 / 7 にチェックが入り、全 Step 完了なら Epic 自体を close
- [ ] Epic #321 Phase 2 の #6 / #7 / #16 / #17 行にチェックが入っている
- [ ] `mobile-scope.md` の該当行が実態に追随している
- [ ] merge 後の実ブラウザ検証が chat-main で完了している
- [ ] 本計画書を COMPLETED にして `.claude/archive/` へ移動

---

## 後続（本ラウンド完了後）

**リファクタリング新計画は本ラウンドの merge 完了後に chat-main が作成する**（2026-07-30 ユーザー指定の順序）。今のうちに骨格を作らない理由は、#465 で MainScreen の構造が変わり、#466〜#469 で Schedule の構成が変わり、#470 / #471 で mobile 側の編集経路が増えるため、**着地前に立てた計画は着地後に必ず作り直しになる**こと。

作成時に材料として使うもの（実測ベースで再取得する）:

- 神ファイル候補の行数実測（`web/src/schedule/CalendarTab.tsx` は今回のラウンドで対象外にしていた分の負債が溜まっている見込み）
- 本ラウンドで各レーンが decisions / Issue コメントに残した「見送った整理」
- `shared/eslint.config.js` の per-file baseline 37 件（#421 で隔離した分の解消 — 未起票）
- `docs/known-issues/INDEX.md` の環境系以外の残り

---

## References

- CLAUDE.md §7.4（worktree / ブランチ運用）・§9（Issue dispatch / decision queue）
- 前ラウンド: [`2026-07-28-open-issue-fanout.md`](./2026-07-28-open-issue-fanout.md)
- Epic: #290（Schedule redesign）/ #321（Mobile UI/UX 追随）
- 関連計画書: [`2026-07-28-refactor-dataservice-split.md`](../../../archive/2026-07-28-refactor-dataservice-split.md)（#465 の正本・COMPLETED → archive 済み）/ [`2026-07-14-schedule-redesign.md`](./2026-07-14-schedule-redesign.md)（#466〜#469 の正本）
- 関連 memory: `push-after-merge-strands-commits` / `stacked-pr-base-retarget-race`（PR 着地事故の実測知見）

---

## Worklog

- 2026-07-30: 現状実測（open PR ゼロ / worktree 4 本すべて `a4fd6f89` / open Issue 15 件）→ 依存グラフ整理 → 4 レーン分担確定（#472 / #473 は tags-docs が引き取り = ユーザー決定）→ 貼り付けプロンプト 4 本を作成
- 2026-07-30: commit 直前の `git fetch` で `origin/main` が `7093e11e` まで進んでいたことが判明（#476 = 前ラウンドの検証計画を COMPLETED 化して archive 移動・#477 = worktree の置き場所をリポジトリ外へ変更）。本書の検証計画リンク 2 箇所と #474 プロンプトの「対象外」記述を追随修正。worktree 実パスの表記は #477 の新方針と一致していたため変更なし
