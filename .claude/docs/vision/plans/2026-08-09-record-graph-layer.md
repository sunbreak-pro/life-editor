---
Status: IN PROGRESS # 2026-08-09 基盤配置（台帳 + records.mjs + INDEX + rules/records.md）。残 = 後続レーン委譲分（§後続）
Created: 2026-08-09
Branch: claude/context-design-documentation-j95vnp
Owner-chat: main # remote（claude.ai）セッションで起案。merge 後の管掌は chat-main
Parent: .claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md
---

# Plan: 記録グラフ層 — 決定台帳・単一エントリポイント・索引の機械生成

> **これは何か**: `.claude/` の記録システム（memory / history / comm / decisions / plans / Issue）に「索引 + 決定台帳 + frontmatter メタデータ」の**追加層**を被せ、(1) 検索コスト (2) 設計判断の Why の記録穴 (3) 記録基準の散乱、の 3 課題を解く計画書 + 配置記録。
> **位置づけ**: loop-harness（Parent）の Phase 0（判断の非同期化）と Phase 1（夜間安全レーン）の間の **Phase 0.5（記録基盤）**。`records.mjs check` が Phase 1 の docs 整合 sweep の機械的道具になる。コンテキストコスト削減ハーネス（`2026-08-04-context-cost-reduction-harness.md`）とは同方向 — 本計画の INDEX は「航法層」の入口を担う。
> **採用の経緯** = [`D-20260809-main-1`](../../../decisions/D-20260809-main-1.md)（旧「ADR は作らない」を SUPERSEDE — ユーザー確定 2026-08-09）。

---

## Context

- **動機**（2026-08-09 の全数調査で実測）:
  1. **検索コスト**: `.claude/` は約 300 md・うち 74% が archive + docs。1 トピックの grep が 100 ファイル超に散り、入口の索引（memory/INDEX 等）は hooks の外部依存（`$HOME/dev/Claude/hooks-lib/`）が remote 環境で no-op のため生成されない
  2. **Why の記録穴**: 判断キューは回答後にエントリを削除するため思考過程が消える。理由は memory の長大 bullet（3 件枠で押し出し・ブランチ跨ぎで衝突 — D-20260801-main-1 の実測）か GitHub Issue コメント（repo 単体で到達不能）に埋まる
  3. **基準の散乱**: 1 つの出来事の書き込み先が設計上最大 9〜11 箇所。どこに書くかの判定表が無い
- **制約**: $0（プレーン md + node/bash・依存ゼロ）/ 単一書込者原則と衝突しない / CLAUDE.md は肥大させない（追記は導線 2 行のみ）/ 既存の memory・history・outbox・キューの**形式は凍結**（追加層方式 — ユーザー確定 2026-08-09）
- **Non-goals**: 既存ファイルの全面移行 / 旧 ADR の復活（台帳は supersede 連鎖で陳腐化を表現する点が本質的に異なる）/ known-issues INDEX の生成化（唯一の手書き優良索引 — 壊さないため後続判断）

---

## 配置したもの（本 PR）

| 層 | 実体 | 役割 |
| --- | --- | --- |
| 決定台帳 | `.claude/decisions/`（README / _TEMPLATE / D-*.md） | 1 決定 1 ファイル・frontmatter（id / status / topics / refs / supersedes / superseded-by / implemented-by / promoted-to）。キュー回答後の昇格先。**初期移行 = ANSWERS.md 全 17 件 + 取り下げ 1 件**（キュー原文が残る 6 件は全文、消化済み 12 件は ANSWERS + 反映先から再構成・出自注記つき） |
| 索引生成 | `.claude/scripts/records.mjs`（`index` / `check`） | `.claude/INDEX.md` + `decisions/INDEX.md` を決定論生成（タイムスタンプ無し・ID バイト順・LF・同一なら書かない）。`check` = frontmatter スキーマ + supersede 双方向 + ANSWERS 突合 + 索引鮮度を CI 検証。**リンク実在チェックは持たない**（docs-lint (a) の担当 — 検査の非複製） |
| 入口 | `.claude/INDEX.md`（git 追跡・生成物） | 進行中 plans・判断の現在地・型別正本の導線。無人セッションの読む順 = CLAUDE.md → INDEX.md → decisions/INDEX §Open + ANSWERS → memory/chat-<self> → 自分宛 Issue（grep ゼロ） |
| 判定規約 | `.claude/rules/records.md`（path-scoped: `.claude/**`） | 記録型ごとの正本一枚表・「どこに書くか」1 分判定・グラフ意味論（ノード / エッジ型 / 鮮度）・索引の再生成と衝突解消規則 |
| hooks 自立 | ラッパ 4 本を fallback chain 化 + vendor 2 本（`scripts/hooks-lib/`） | 外部 hooks-lib → repo 内 vendor → no-op。remote / 新規クローンでも派生 INDEX 再生成とトークン平文検知が動く（セキュリティ hook は chain 断絶時に stderr 警告） |
| 規約反映 | CLAUDE.md §0 / §9・docs-workflow スキル・comm/README・decisions/README・rules/decision-queue | 昇格ライフサイクル（回答 → 台帳化 → キュー削除 → index 再生成を同一コミット）を各正本に配線 |

### 設計判断（決定録）

1. **キュー形式は凍結し、削除先を台帳化に差し替える**（追加層方式）。キューの A/B 定型・放置時・単一書込者は実証済みの資産で、変えるのは「消える」ことだけ
2. **1 決定 1 ファイル** — 新規作成しか起きないため、tracker 衝突（D-20260801-main-1 の実測 = 1 レーン 5 ブランチで 4 本衝突）と同型の問題が構造的に発生しない
3. **陳腐化は上書きでなく supersede 連鎖で表現** — 旧 ADR 廃止理由「時点判断で陳腐化」への構造的回答。INDEX が連鎖の末端だけを Active 表に出すので、古い裁定が現行に見える事故が起きない
4. **`.claude/INDEX.md` にレーンの手番（memory 進行中の転記）を載せない** — 載せると tracker コミット（merge 後・D-20260801-main-1 = A）のたびに索引が stale になり `records.mjs check` が CI を赤にする。索引の再生成条件を「plans / decisions を変えた PR」に限定するための切り分け。レーン手番は派生 INDEX（hook 生成）が担う
5. **リンク検査を records.mjs に持たせない** — docs-lint (a) が既にゲート（#528）。検査の二重実装は数値の非複製原則の機械版違反
6. **却下案**: 索引の `.gitattributes merge=union` 化（ソート順が壊れ決定論が崩れる — 再生成上書きの方が単純）/ 全記録への frontmatter 遡及付与（凍結原則に反する・稼働 12 / 56 レーンのスタブ群に付けても意味がない）

---

## Scope (Touchable Paths)

```
.claude/decisions/**
.claude/scripts/records.mjs
.claude/scripts/hooks-lib/**
.claude/hooks/*.sh
.claude/rules/records.md
.claude/rules/decision-queue.md
.claude/INDEX.md
.claude/CLAUDE.md            # §0 / §9 の導線 2 行のみ
.claude/comm/README.md
.claude/comm/decisions/README.md
.claude/comm/decisions/ANSWERS.md   # D-20260809-main-1 の転記 1 行のみ
.claude/comm/decisions/chat-main.md # 昇格済みエントリの除去のみ
.claude/skills/docs-workflow/SKILL.md
.claude/docs/vision/plans/2026-08-09-record-graph-layer.md
scripts/docs-lint.sh         # (e) records.mjs check の組み込みのみ
```

---

## Steps

| # | Step | Gate | Acceptance |
| --- | --- | --- | --- |
| 1 | 台帳 + スクリプト + rules + 導線の配置（上表） | 🤖 自律 | 下記 Acceptance Criteria 全通過 |
| 2 | draft PR 作成 | 🤖 自律 | PR 本文に検証結果を記載 |
| 3 | レビュー & merge | 🛑 人手 | P-001（merge は常にユーザー） |
| 4 | 昇格ライフサイクルの試運転 | 👀 目視 | 次にキューへ回答が付いたとき、担当レーンが README の 3 手順で昇格できる |

## Acceptance Criteria (機械検証可能)

- [x] `node .claude/scripts/records.mjs check` exit 0（スキーマ・supersede 双方向・ANSWERS 突合・索引鮮度）
- [x] `records.mjs index` を 2 回連続実行して 2 回目が無変更（決定論）
- [x] `LC_ALL=C bash scripts/docs-lint.sh` exit 0（リンク・enum・旧トークン + 新設 (e)）
- [x] `HOME=/nonexistent bash .claude/hooks/regen-index.sh` で vendor 版が走り `memory/INDEX.md` / `history/INDEX.md` が生成される（remote 環境の no-op 解消）
- [x] vendor `pre-commit-mcp-check.sh` がトークン平文パターンを検知する（合成データで陽性・現 `.mcp.json` で陰性）
- [x] 任意の answered 決定に `.claude/INDEX.md` から 2 hop（INDEX → decisions/INDEX → D ファイル）で到達できる

---

## 後続（Issue 起票候補 — 起票は chat-main・`issue-dispatch` 経由）

1. **各レーンの回答済みキュー残の昇格**: schedule-refine の D-20260801-sched-1 は台帳化済みだがキュー側の削除は担当レーンの手番（単一書込者のため本 PR では触らない）
2. **memory スタブの退役 sweep**: 500B 未満・参照ゼロの休眠レーン memory（調査時点 19 本）を P-002 の grep 全数実測で整理
3. **archive/ 索引の再建判断**: SUMMARY.md は 2026-05-23 以前のみ索引（約 30 本が索引外）。`records.mjs` に archive スキャンを足して生成化するか → decision キューへ
4. **CLAUDE.md インライン決定注記の台帳バックフィル**: 結論行は残し `(D-…)` 参照を付ける（layering Phase 3 の移送と同時が効率的）
5. **残り hooks 2 本（session-start-check / pre-commit-index-guard）の vendor 実装**（chain 化は本 PR で済み・informational のため急がない）
6. **dev-digest スキルの収集元更新**: 「要判断」の収集を chat-*.md 直接 grep から `decisions/INDEX.md` §Open に変更
7. **tracker 非同梱規約の機械化**: 「tracker を実装ブランチに載せない」（D-20260801-main-1）の pre-commit 検知（layering §4 の ⬜ 未実体）

---

## Risks / Known Issues 参照

- 外部 hooks-lib 側の `pre-commit-index-guard.sh` が `INDEX.md` を広いパターンで対象にしていると、新設の追跡 INDEX 2 本を commit から自動除外してしまう可能性がある（本環境から実体を読めず未検証）。**症状 = ローカルマシンで INDEX の変更が commit に入らない**。発生したら guard の対象を `memory/INDEX.md` / `history/INDEX.md` に限定する修正を hooks-lib 側（別リポジトリ）で行う
- vendor 版 regen-index の出力書式は外部版と完全一致しない（最小再実装）。どちらも git 非追跡の派生ビューなので実害なし・冒頭に vendor 注記あり

## References

- 親計画: `2026-07-28-loop-engineering-harness.md`（Phase 0.5 として挿入）/ 同方向: `2026-08-04-context-cost-reduction-harness.md`
- モデルにした既存索引: `docs/known-issues/INDEX.md`（Status 表 + Category 逆引き + 統合履歴）
- related skills: `docs-workflow`（運用の正本）

## Worklog

- 2026-08-09: remote セッションで全数調査（Explore 3 体）→ 設計（Plan 1 体）→ ユーザー確定 3 点（スコープ / 追加層 / ADR SUPERSEDE）→ 基盤配置。調査はセッション開始時の stale クローン（2026-07-28 断面）に対して行い、実装前に origin/main（2026-08-07 断面）で全事実を再検証した — 壊れリンク 14 本は #528 系で解決済みと判明し、リンク修復と links 検査を計画から削除（検査の非複製）。ANSWERS は 4 → 16 件に増えており移行対象を全件に拡大
