---
Status: IN PROGRESS
Created: 2026-07-10
Branch: claude/layout-unification-plan
Owner-chat: main
Parent: 2026-07-05-design-implementation-fanout.md
---

# Plan: レイアウト統一 fan-out（タブ帯・コンテンツ幅・gutter の全画面標準化）+ shared-fix ルート新設

---

## Context

- **動機**: 2026-07-10 の playwright smoke test で cosmetic findings 2 件（Analytics Today カードの窮屈さ / Schedule セグメントの連結表示）を検出。あわせてユーザーから「header タブとメインコンテンツの幅・左右余白がセクションで二分している。全画面で統一すること」の指示。レイアウト監査（Explore・8 箇所 spot check 済）で機械的原因を特定した
- **監査サマリ**: ①タブ部品 `HeaderTabs` 自体は 3 セクションで共通利用済み — ズレは各セクションの wrapper（左オフセット・縦リズム）起因 ②`web/src/MainScreen.tsx:258-261` の fluid 二値スイッチ + `shared/src/components/AppShell.tsx:143` の `max-w-3xl px-6` 固定枠が、各画面の独自 `max-w-[720/800/1000px]` と二重ラップを生む ③幅・gutter のトークンと共通ページ枠部品が存在しない（spacing トークンは定義済み・未使用） ④`SegmentedControl` は gap・セグメント横 padding ともゼロ。詳細 file:line は #180〜#183 に転記済（数値の非複製原則 — 実測値は Issue が正）
- **あわせて決定（2026-07-10 ユーザー 3 決定)**: worktree 横断の共有修正タスクの常設ルート = **GitHub Issues label `shared-fix`** ／ smoke findings 2 件は該当 refine worktree へ ／ 実装は共通部品先行 → 各セクション adoption
- **制約**: コスト $0 / shell 部品の単一書込者原則 / `frontend/` FROZEN / トークン既存値の変更は 🛑
- **Non-goals**: セクション中身の再デザイン（各 refine 計画の領分）/ IA 変更（サイドバー・mobile タブ構成）/ dark テーマ検証（別途）

---

## 標準定義（Layout Standard v1）

> 実装の細部（部品名・トークン名）は #180 の実装判断に委任。ここでは「何を揃えるか」だけを固定する。

1. **gutter**: 全セクションの横 padding = 16px / md 24px（`px-4 md:px-6` 相当）。タブ帯もコンテンツも同じ左端から始まる
2. **コンテンツ幅**: 2 段階 — reading 768px（settings / trash / notes / daily）・data 1000px（analytics）。work は 720px 独自値を reading 768px に統一。fluid（connect / schedule / materials→tasks）は全幅のまま gutter のみ標準化
3. **タブ帯**: `HeaderTabs` の行は常に全幅 + 標準 gutter（センタリングの外側）。全セクションで左オフセット同一
4. **幅の所有者は 1 箇所**: 標準ページ枠部品（新設）がコンテンツ幅と gutter を一元管理。`AppShell` の一律 `max-w-3xl` 適用は廃止（二重ラップ解消）
5. **SegmentedControl**: セグメント横 padding を追加し、`w-auto`（intrinsic 幅）でもセグメントが分離して見える

---

## Scope (Touchable Paths)

本計画 PR（docs のみ・コード変更 0）:

```
.claude/docs/vision/plans/2026-07-10-layout-unification-fanout.md
.claude/CLAUDE.md                 ← §9 に shared-fix ルート 1 行
.claude/comm/README.md            ← shared-fix ルート protocol 節
.claude/comm/outbox/chat-main.md  ← @all 告知
.claude/memory/chat-main.md       ← tracker（chat-main 単一書込者）
```

layout-standard オーダー（#180・コード）:

```
shared/src/components/**          ← shell 部品含む（所有権承継）
shared/src/styles/tokens.css      ← トークン追加のみ（既存値変更は 🛑）
web/src/MainScreen.tsx
web/src/schedule/ScheduleScreen.tsx  ← タブ行 gutter のトークン化 1 行のみ（2026-07-10 追記:
                                       root font-size 18px 環境で rem 由来 px-6=27px と
                                       px 固定トークン 24px が 3px ズレる実測により DoD 直結）
```

adoption（#181・各 refine worktree）: 自セクション配下のみ（Issue のチェックリスト参照）。スコープ外の変更が必要になったら計画書を更新してから手を付ける。

---

## shared-fix ルート（常設 — protocol の正本 = [`comm/README.md`](../../../comm/README.md)）

- **登録**: `gh issue create -R sunbreak-pro/life-editor --label shared-fix`（+ `type:*`）。タイトル prefix で宛先指定: `[<worktree-slug>]`（特定 worktree 宛）/ `[all]`（全 worktree）
- **発見**: 各 worktree チャットはセッション開始時と作業の区切りに `gh issue list -R sunbreak-pro/life-editor --label shared-fix --state open` で自分宛を確認する
- **完了**: 担当分を終えたら Issue にコメント + チェックリスト更新。全消化で close
- **outbox との使い分け**: 特定チャットへの連絡・引き継ぎ = outbox ／ 複数 worktree に波及するプロダクト修正タスク = shared-fix Issue

---

## Steps

| #   | Step                                              | Gate                  | Acceptance                            |
| --- | ------------------------------------------------- | --------------------- | ------------------------------------- |
| 1   | label `shared-fix` 新設 + #180〜#183 起票         | 🤖 自律               | ✅ 2026-07-10 done                    |
| 2   | 本計画 PR merge                                   | 🛑 人手               | PR merge（ボタン 1 つ）               |
| 3   | layout-standard worktree 起動（下記「起動手順」） | 🛑 人手               | worktree 稼働・boot 行投入            |
| 4   | 共通部品実装 → draft PR（#180）                   | 🤖 自律               | #180 DoD 全項目 + playwright smoke    |
| 5   | #180 PR merge                                     | 🛑 人手               | merge                                 |
| 6   | 各 refine worktree が rebase + adoption（#181）   | 🤖 自律（各チャット） | #181 チェックリスト全消化             |
| 7   | findings 2 件の解消確認（#182 / #183）            | 🤖 自律               | 両 Issue close                        |
| 8   | 統一後の全画面 playwright smoke + ユーザー目視    | 👀 目視               | console error/warning 0 + ユーザー OK |

---

## Acceptance Criteria (機械検証可能)

- [ ] `gh issue list -R sunbreak-pro/life-editor --label shared-fix --state open` が 0 件（#180〜#183 全消化）
- [ ] セクション画面コード（`web/src/**` / `shared/src/components/**`）から独自の `max-w-[720px]` / `max-w-[800px]` / `max-w-[1000px]` / `max-w-3xl` ハードコードが消えている（標準部品・トークン定義内は除く）
- [ ] 7 セクション巡回の playwright smoke で console error / warning 0
- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` が関連全ブランチで pass
- [ ] 完了・退役・supersede 時: 本計画 Status 更新 + archive 移動 + 対応 Issue close + per-chat memory 更新（DoD）

---

## 起動手順（ユーザー）

### Step 3: layout-standard worktree（#180）

```bash
cd /Users/newlife/dev/apps/life-editor
git worktree add .claude/worktrees/layout-standard -b claude/layout-standard
cd .claude/worktrees/layout-standard
echo claude/layout-standard > .claude/comm/.session-branch
echo layout-standard > .claude/comm/.session-name
claude
```

boot 行（新セッションの最初のメッセージ）:

```text
計画書 .claude/docs/vision/plans/2026-07-10-layout-unification-fanout.md の layout-standard オーダー（GitHub Issue #180）をゴール（draft PR）まで実行してください。
```

### Step 6: 各 refine worktree（#181・#180 merge 後）

各 refine チャットに次の 1 行を貼る:

```text
shared-fix 確認: gh issue list -R sunbreak-pro/life-editor --label shared-fix --state open を見て、自分宛（[<自分の slug>] / [all]）の作業を実行してください。まず git fetch origin main && git rebase origin/main から。
```

---

## Risks / Known Issues 参照

- **shell 部品の所有権競合**: app-integration チャットが稼働中の場合、AppShell / MainScreen の編集が衝突しうる → #180 着手前に outbox 確認を DoD 化済み
- **行番号の陳腐化**: #181 チェックリストの file:line は 2026-07-10 main（b1c2dffe）時点。rebase 後の目印として扱う
- **worktree の .env.local 欠落**（memory `worktree-supabase-treeshake`）: layout-standard worktree で dev 確認する場合は main の `web/.env.local` をコピー
- 関連 known-issue: サブエージェント監査の実測必須則（`rules/docs-consistency.md` §5）— 本計画の file:line は 8 箇所 spot check 済

---

## References

- 起票済み Issue: #180（共通部品）/ #181（adoption）/ #182（analytics finding）/ #183（schedule finding）
- タブ標準意匠: `.claude/docs/design/IA.md`・`.claude/docs/design/briefs/shell.md` §3
- トークン実体: `shared/src/styles/tokens.css`
- 親系譜: [`2026-07-05-design-implementation-fanout.md`](./2026-07-05-design-implementation-fanout.md)（refine ウェーブの親計画）

---

## Worklog

- 2026-07-10: 計画作成（chat-main）。playwright smoke test（PASS・console 0 件）→ レイアウト監査 → ユーザー 3 決定（Issues ルート / findings は refine worktree へ / 共通部品先行）。label `shared-fix` 新設 + #180〜#183 起票。smoke findings 2 件を #182（analytics-refine 宛）/ #183（schedule-refine 宛）として登録
- 2026-07-11: Step 4 実装完了（chat-layout-standard）。トークン 4 種 + PageContainer 新設 + AppShell fluidContent 廃止 + MainScreen 置換 + AnalyticsView 追随 + SegmentedControl px-3/gap-0.5。実装判断 2 件: ①analytics は PageContainer(data) で包まず fluid + 自前構造のトークン化（AnalyticsView が標準と同型の「全幅タブ帯 + センタリング列」を内製済みのため。1000px clamp 解消 = #182 根本対処）②Scope に ScheduleScreen.tsx タブ行 1 箇所を追加 — アプリ既定 root font-size 18px で rem 由来 px-6=27px と px 固定トークン 24px が 3px ズレる実測（headless smoke）により DoD 直結と判断。検証 = shared 755 tests / web build / 生成 CSS emit / 独立 headless smoke（7 セクション巡回 console 0・タブ帯 x=294 全一致・data 列 1000px・セグメント gap 2.3px・narrow 4 等分割）。既知残課題: schedule 本文・connect 内部ヘッダの rem gutter（27px）は #181 の各 refine adoption で px トークンへ（タブ帯以外なので #180 DoD 外）
