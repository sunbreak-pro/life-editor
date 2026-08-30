---
Status: COMPLETED
Created: 2026-08-29
Branch: main # docs のみ。commit は一時 worktree 経由（main 直 push 禁止）
Owner-chat: main
Previous: 2026-08-03-open-issue-fanout-r3.md
---

# Plan: Open Issue 一斉消化 fan-out ラウンド 4（2026-08-29）

> **意図的に緩い計画書**。担当レーン・波（Wave）・縄張り・貼り付けコマンドだけを固定し、各 Issue の手順と DoD は Issue body を正本とする（転記しない — 数値の非複製原則）。
> ゴール = **凍結 2 件（#898 / #677）を除く全 open Issue に PR が紐づく**こと。merge と Issue close は常にユーザーの手番（POLICY P-001）。

---

## Context

- **動機**: 2026-08-29 時点で open PR 0 本・open Issue 28 件。内訳 = レーン配布可能 21 / chat-main 手番 3（#1202 #1135 #1137）/ Epic 2（#1121 #716）/ 凍結 2（#898 #677）。配布品質監査（2026-08-29）で認証・配布系の重要 Issue（#1197〜#1200）が新規に積まれ、チュートリアル（Epic #1121）の残件・Materials テンプレート刷新・Connect 後継（#1171 / #1172）も出揃った。全部を並列レーンで一気に消化する
- **偏りの是正**: `shared-fix` ラベルに 9 件が集中し、web-public / refactor-core / briefing-refine 等は手待ち。認証・配布系 3 件（#1197 #1198 #1199）を **web-public** へ、横断リファクタ #1184 を **refactor-core** へ振り直す（タイトル prefix 変更 = chat-main の采配権限 D-20260731-main-2）
- **制約**: merge は常にユーザー（P-001・自動 merge 不可 = D-20260806-main-1）/ 実ブラウザ検証は merge 後に chat-main（§7.4）/ 完成までコスト $0 / `/goal` `/loop` `/schedule` は Claude が実行せずユーザーが貼る（`rules/heavy-workflows.md`）
- **Non-goals**: 凍結 Issue（#898 #677）への着手 / Epic 本体の実装（子 Issue 消化後の close 判定のみ）/ このセッションでの実装着手（本計画書の作成まで — 実装は各レーンの別セッション）

---

## 検討した代替案（必須）

| 案                                                                                             | 採否 | 却下理由                                                                                               | 復活条件                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| local worktree レーンへ `/goal` 一斉配布 + chat-main `/loop` 巡回 + `/schedule` 朝ダイジェスト | ✓    | —                                                                                                      | —                                                                                                         |
| ultracode で 1 セッション一括実装                                                              | ✗    | 24 件は 1 コンテキストに載らず、1 worktree 集中はレーン規約（one writer per artifact）と衝突する       | レーン内の密結合クラスタ（例: materials テンプレ 3 部作）に限り、そのレーンが自セッションで採用するのは可 |
| `/schedule` のクラウドエージェントにレーン実装まで任せる                                       | ✗    | 環境未検証（ローカル worktree・session-branch 規約が前提）。無人実装は commit 止まり規約の再設計が要る | 試験 1 本で「issue → green CI → PR」が通ったら小粒 Issue から拡大                                         |
| chat-main が `/loop` で全件を順に自前実装                                                      | ✗    | 並列性ゼロで数日かかる。fan-out 基盤（レーン・ラベル routing）が既にある                               | レーンが全滅している場合の縮退運転としてのみ                                                              |

---

## Worktree 分担（Wave 1 — 19 件）

DoD は各 Issue body が正本。表には番号と 1 行だけ置く。**着順はレーン内で上から**（依存があるものは明記）。

| worktree           | 担当（1 行）                                                             | 対応 Issue                                    | 触ってよいパス（目安）                                                                                            |
| ------------------ | ------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `schedule-refine`  | カレンダーのタグフィルタ化 + ドロワー微修正                              | #1173 → #1207                                 | `web/src/schedule/**` `shared/src/components/schedule/**`                                                         |
| `materials-refine` | テンプレート刷新 3 部作 → Related パネル → 小粒 2 件                     | #1179 → #1180 → #1181 → #1172 → #1189 → #1183 | `web/src/notes/**` `web/src/daily/**` `shared/src/components/materials/**`                                        |
| `settings-refine`  | Settings タブ構成リファクタ → サイズ設定 → アカウント削除                | #1174 → #1182 → #1200                         | `web/src/settings/**` `shared/src/components/settings/**`（#1174 の Schedule 初期ビューは設定の読み出し配線まで） |
| `connect-refine`   | Tag hub 新セクション                                                     | #1171                                         | `web/src/connect/**`（新設）`shared/src/sections.ts` `web/src/MainScreen.tsx`（登録行のみ）                       |
| `shared-fix`       | MCP 週開始（着手済みブランチあり）→ チュートリアルバグ → Briefing ツアー | #1138 → #1192 → #1193 → #1201                 | `mcp-server/**` `shared/src/components/tour/**` 各画面の anchor 行                                                |
| `web-public`       | 配布前の認証・保全 3 点                                                  | #1197 → #1198 → #1199                         | `web/src/auth/**`（AuthScreen）規約ページ新設 `web/src/MainScreen.tsx`（ErrorBoundary の root 巻きのみ）          |

### 縄張り（重要）

- **`web/src/MainScreen.tsx` は 2 レーンが触る**（connect #1171 のセクション登録 / web-public #1199 の root 巻き）。**#1199 を先に出す**（差分が小さい）。後から出す側が rebase して手動解消
- `shared/src/components/Backlinks/**` と `shared/src/utils/itemLinks.ts` は #1171 / #1172 の両方が**読むだけ**。変更が要る場合は実装せず outbox → chat-main 采配（P-008）
- `shared/src/components/tour/**` は Wave 1 中 **shared-fix 専有**。#1174 の Settings リファクタで tour anchor が動く場合、settings レーンは anchor の追随 1 行までにする
- 警告・確認パネルの共通化は #1184（Wave 2）の領分。**Wave 1 の各レーンは既存パネルの流儀のまま実装**し、先回りで統一しない（P-008）

## Wave 2（2 件 — 発火はユーザーの merge 後）

| worktree        | 対応 Issue                                      | 発火条件（gate）                                                                                             |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shared-fix`    | #1194（Settings からチュートリアル開始導線）    | **#1174 の PR が merge されてから**（Settings の新タブ構成の上に実装するため）                               |
| `refactor-core` | #1184（警告・確認パネルの共通コンポーネント化） | **Wave 1 の UI 系 PR が概ね merge されてから**（呼び出し元の総取り替えなので、並走すると全レーンと衝突する） |

## chat-main 手番（レーンに出さない）

- #1202（CLAUDE.md の配布記述整合 + D 台帳起こし）/ #1137（issue-prompter スキルの配布穴 — 本ラウンドは本計画書の表と Wave gate が手動の代替ガード）/ #1135（memory 進行中の stale 掃除）
- r3 計画書（`2026-08-03-open-issue-fanout-r3.md`）の COMPLETED 化 + archive 移動（対象 Issue #585〜#593 は全 close 済み・乖離レビュー 3 行付き）
- merge 後の実ブラウザ検証（playwright は chat-main 専有）と Epic close 判定: **#1121** = #1192 #1193 #1201 #1194 着地 + ユーザー実機確認後 / **#716** = 残タスクなし・ユーザーの狭幅実機目視のみ

---

## Scope (Touchable Paths)

本計画書 PR 自体の Scope（各レーンの Scope は上表と Issue body が正本）:

```
.claude/docs/vision/plans/2026-08-29-open-issue-fanout-r4.md
```

スコープ外の変更が必要になった場合は P-008 に従いキュー or 起票依頼へ積み、現計画を続行する。

---

## Steps

| #   | Step                                                                                                  | Gate    | Acceptance                     |
| --- | ----------------------------------------------------------------------------------------------------- | ------- | ------------------------------ |
| 1   | 宛先振り直し（#1197 #1198 #1199 → `[web-public]` / #1184 → `[refactor-core]` にタイトル prefix 変更） | 🤖 自律 | `gh issue view` で prefix 反映 |
| 2   | 本計画書 PR 作成                                                                                      | 🤖 自律 | docs-lint 緑・PR open          |
| 3   | Wave 1 の `/goal` 6 本を各レーンのチャットへ貼る                                                      | 🛑 人手 | 各レーンが着手報告             |
| 4   | 各レーン実装 → PR（レーン内は lead-pipeline / session-verifier 準拠）                                 | 🤖 自律 | 19 Issue すべてに PR           |
| 5   | PR merge（随時）                                                                                      | 🛑 人手 | merge ボタン                   |
| 6   | chat-main `/loop` 巡回: merge 検知 → main 取り込み → 実ブラウザ検証・赤/衝突の報告                    | 🤖+👀   | 検証結果を都度報告             |
| 7   | Wave 2 の `/goal` 2 本を gate 成立後に貼る                                                            | 🛑 人手 | #1194 #1184 に PR              |
| 8   | Epic #1121 / #716 の close 判定・実機目視                                                             | 👀+🛑   | ユーザー確認 → close           |
| 9   | 全消化で本計画 COMPLETED 化 → archive 移動                                                            | 🤖 自律 | Status 更新 + 移動 commit      |

---

## Acceptance Criteria (機械検証可能)

- [x] Wave 1 の 19 Issue すべてに、その番号を参照する PR が存在する（2026-08-30 実測: 19 件すべて close・merge 済み PR 付き）
- [x] Wave 2 の #1194 / #1184 に同上（#1194 = PR #1246 / #1184 = PR #1259・とも merged）
- [x] chat-main 手番の #1202 / #1135 / #1137 に PR（#1202 = PR #1280 / #1137 = PR #1282 / #1135 = PR #1295・とも merged）
- [ ] open Issue が Epic（#1121 #716）と凍結（#898 #677）のみになっている — **免除**（r4 スコープでは #1135 のみ open 残・Worklog 乖離レビュー (2) 参照。r4 スナップショット後起票の #1210 / #1211 と 2026-08-30 新ラウンド #1264 / #1275〜#1294 は対象外）
- [x] r3 計画書が COMPLETED + archive 済み（PR #1262）
- [x] 完了時: 本計画の Status 更新 + archive 移動 + per-chat memory 更新（Status / 移動 = 本 PR・memory 追随は巡回の次回 tracker PR に畳む）

---

## 貼り付けコマンド集（ユーザーが各チャットへ貼る — Claude は実行しない）

> `/goal` の終端は「PR を開くまで」。merge を条件に入れると人待ちで永久に達成されない。
> 各レーンは貼られたら worktree-policy の 2 段同期（`git pull --ff-only` → `git fetch origin && git merge origin/main --no-edit`）から始めること。

### Wave 1

**schedule-refine**（2 件）

```text
/goal in the life-editor worktree for schedule-refine: each issue below has its own branch off origin/main, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it — first #1173 (replace the calendar header gear with a tag multi-select filter + Group save), then #1207 (align drawer segment label heights). One issue per branch, read .claude/skills/worktree-policy/SKILL.md before touching git, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

停止: 2 本の PR が open になったら（merge は待たない）

**materials-refine**（6 件）

```text
/goal in the life-editor worktree for materials-refine: each issue below has its own branch off origin/main, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it — in this order: #1179 (note three-dot menu becomes "register as template"), #1180 (template list in rightSidebar + center-panel editing), #1181 (apply template from three-dot menu with discard-confirm), #1172 (extend LinkPanel into a Related panel), #1189 (retire Daily rightSidebar day tabs, keep search), #1183 (larger todo icon). The first three share the template UI, so keep that order. Backlinks components are read-only for you — if they need changes, write an outbox request instead of editing. One issue per branch, read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

停止: 6 本の PR が open になったら（merge は待たない）

**settings-refine**（3 件）

```text
/goal in the life-editor worktree for settings-refine: each issue below has its own branch off origin/main, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it — in this order: #1174 (Settings rightSidebar tab refactor + Schedule initial-view setting), #1182 (3-step mobile font/element size), #1200 (self-service account deletion + sign-out audit). If #1200 requires Supabase dashboard changes or new secrets, implement what is possible locally, queue the user gate in .claude/comm/decisions/chat-settings-refine.md, and still open the PR for the local part. One issue per branch, read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

停止: 3 本の PR が open になったら（#1200 がユーザーゲートで割れた場合はキュー行き + 可能分の PR で可）

**connect-refine**（1 件）

```text
/goal in the life-editor worktree for connect-refine: issue #1171 (new tag-hub Connect section) has a branch off origin/main, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it. The issue body is the spec SSOT. Backlinks components and shared/src/utils/itemLinks.ts are read-only for you — if they need changes, write an outbox request instead of editing. Expect web/src/MainScreen.tsx to be touched by another lane (#1199); rebase on origin/main before opening the PR. Read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on branch switch, and merge nothing yourself.
```

停止: 1 本の PR が open になったら（merge は待たない）

**shared-fix**（4 件）

```text
/goal in the life-editor worktree for shared-fix: each issue below has its own branch, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it — first finish #1138 (MCP localWeekStart to Sunday) on the existing branch claude/shared-fix-1138-mcp-week-start, then #1192 (tour step 4 blocked by its own tooltip), #1193 (tutorial cannot resume from step 3+), #1201 (explain Briefing in the onboarding tour). Do NOT start #1194 — it is Wave 2, gated on #1174 merging. One issue per branch, read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

停止: 4 本の PR が open になったら（merge は待たない）

**web-public**（3 件）

```text
/goal in the life-editor worktree for web-public: each issue below has its own branch off origin/main, a green local run of the CI verify steps (read .github/workflows/ci.yml), and an open PR referencing it — in this order: #1199 (top-level ErrorBoundary with recoverable fallback — small, ship it first because another lane will touch MainScreen after you), #1197 (email confirmation: pending-confirmation state in AuthScreen; the Supabase dashboard toggle is the user's move — queue it in .claude/comm/decisions/chat-web-public.md and do not flip it yourself), #1198 (privacy policy + terms pages linked from the auth screen). One issue per branch, read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

停止: 3 本の PR が open になったら（merge は待たない）

### Wave 2（gate 成立をユーザーが確認してから貼る）

**shared-fix — #1194**（gate: #1174 merge 済み）

```text
/goal in the life-editor worktree for shared-fix: issue #1194 (start the tutorial from Settings: overview modal, section picker, auto-navigate) has a branch off origin/main taken AFTER #1174 is merged, a green local run of the CI verify steps, and an open PR referencing it. Read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch, and merge nothing yourself.
```

停止: 1 本の PR が open になったら

**refactor-core — #1184**（gate: Wave 1 の UI 系 PR が概ね merge 済み）

```text
/goal in the life-editor worktree for refactor-core: issue #1184 (unify warning / notice / confirm panels into a shared component and migrate call sites) has a branch off origin/main, a green local run of the CI verify steps, and an open PR referencing it. Sync origin/main immediately before branching — this issue rewrites call sites across screens and stale bases will conflict everywhere. Read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch, and merge nothing yourself.
```

停止: 1 本の PR が open になったら

### chat-main の巡回（配布後にこのチャットへ貼る）

```text
/loop 30m 巡回: (1) gh pr list -R sunbreak-pro/life-editor --state open と --state merged の差分を確認し、新しい merge があれば git pull --ff-only で main を取り込んで実ブラウザ検証キューへ積む (2) 各レーンの PR に CI 赤・コンフリクトが出ていないか確認して報告 (3) .claude/comm/decisions/ の未回答キューと comm/outbox/ の起票依頼を拾って一覧提示 (4) Wave 2 の gate（#1174 merge / Wave 1 UI 系 merge）が成立したら知らせる。Wave 1 の 19 Issue すべてに PR が出そろい、実ブラウザ検証キューが空になったら停止。
```

停止条件は文中に埋め込み済み（19 PR + 検証キュー空）。

### `/schedule`（任意 — 朝の状況ダイジェストを無人化する場合）

前提: chat-main が追跡用 Issue（`[all] fan-out r4 tracking` — 告知用途なので `[all]` 可）を起票し、`#<N>` を差し込む。GitHub への書き込み（毎日 1 コメント）が発生するため、貼るかどうかはユーザー判断。

```text
/schedule 毎日 07:00 JST に sunbreak-pro/life-editor を確認: (1) merge 待ちの open PR 一覧 (2) Wave 1 の 19 Issue のうち PR が無いもの (3) 直近 24 時間に merge された PR を集計し、Issue #<N> に 1 コメントで投稿する。push / merge / close / issue 編集はしない。全 19 Issue に PR が紐づいたら「完走」と書いて以後の投稿を止める。
```

---

## Risks / Known Issues 参照

- **二重着手**（#473 で実証 40 分ロス）: 1 Issue = 1 レーン固定 + `[all]` 禁止で回避。`/goal` は 1 レーン 1 本まで（後勝ちで前が消える）
- **#1137 の配布穴**（issue-prompter が依存付き Issue を配る）: 本ラウンドはスキルを使わず本計画書の表と Wave gate を手動の正とする。#1137 自体は chat-main 手番で修正
- **MainScreen.tsx の 2 レーン交差**: #1199 先行 + #1171 側 rebase で緩和（縄張り節）
- **stacked PR / 近接 merge 事故**: base が main 以外の PR は作らない。merge 済み判定は `gh pr list` の state のみ（memory: stacked-pr-base-retarget-race / push-after-merge-strands-commits）
- **tracker guard**: tracker / outbox は実装 PR に載せない（D-20260801-main-1 / D-20260802-sched-1）。merge 系で guard が誤発火したら `[tracker-ok]`
- **Supabase 側ゲート**（#1197 の dashboard トグル / #1200 の削除 API・シークレット）: レーンは queue へ積んで可能分の PR まで進める。DDL が要る場合はローカルファイル先行 → ユーザー `db push`（§7.3）

---

## References

- 前ラウンド: `2026-08-03-open-issue-fanout-r3.md`（Previous）
- 運用規約: `docs-workflow` / `issue-prompter` / `worktree-policy` / `rules/heavy-workflows.md`
- 追跡: GitHub Issues（`gh -R sunbreak-pro/life-editor`）— 本計画書は分担の全体像のみを持つ

---

## Worklog

- 2026-08-29: 計画書作成（chat-main）。open Issue 28 / open PR 0 の実測スナップショットから 6 レーン 19 件 + Wave 2 の 2 件 + chat-main 3 件に分配。#1197 #1198 #1199 → `[web-public]`・#1184 → `[refactor-core]` の宛先振り直しを同日実施
- 2026-08-30: 全消化を確認して COMPLETED 化 + archive 移動（chat-main・Step 9）。Wave 1 の 19 件と Wave 2 の #1194 / #1184 はすべて close（merge 済み PR 付き）、chat-main 手番 3 件も PR 着地。merge 後の実ブラウザ検証は各バッチで PASS（最終 = #1296 の legal §4 文面・巡回 1 回目）
- 乖離レビュー (1) スコープ逸脱: なし（本計画書 PR が触ったのは本ファイルのみ。レーン実装・宛先振り直しは各 Issue / PR 側で完結）
- 乖離レビュー (2) AC 免除: AC4「open Issue が Epic + 凍結のみ」は r4 スコープで #1135 だけが open 残。機構（RETIRED マーカー + 集計スキップ）は PR #1295 で着地済みで、close は方向 (b)（regen 時に gh で PR 実状態を引く案）の扱いをユーザーへ提示してから（P-001 = Issue close の確定は常にユーザー）。#1210 / #1211（r4 スナップショット後に起票）と #1264 / #1275〜#1294（2026-08-30 の新ラウンド）は r4 の対象外なので AC4 の判定に含めない
- 乖離レビュー (3) 途中で出た判断の行き先: レーン発の判断はすべて処理済み — D-20260829-web-1〜3 / D-20260829-connect-1 は回答済み → 台帳昇格 PR #1297、#1184 の残置換 3 グループは #1275 / #1278 / #1279 として起票済み、#1200 の 🛑 2 手は G-20260829-settings-1（手 1 = 0025 適用済みを 2026-08-30 実測・手 2 = Edge Function deploy 待ち）。Epic #1121 / #716 の close 判定は実機確認後のユーザー手番として本計画の外で追跡
