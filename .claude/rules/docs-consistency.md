# Docs Consistency — 矛盾を作らないための運用ルール

> 出典: `docs/vision/plans/2026-07-07-docs-consistency-cleanup.md`（2026-07-07 監査で矛盾約 60 件を確認・Phase 7 で本ルール化）。docs を更新する全セッションが対象。

## 1. 数値の非複製原則

個数・列挙（テーブル数 / ツール数 / Provider 一覧 / 機能数など）は**単一の正本（コード or SSOT）だけに書き、他文書は参照にする**。

- 「一覧はコードが正」と書くなら数字を併記しない（数字だけ古くなる自己矛盾の典型パターン）
- 同じ事実が SSOT → CLAUDE.md → vision → requirements → briefs → skills の最大 6 層に転記されると、決定 1 つに対し更新箇所が N 箇所になり必ず漏れる

## 2. 改名・退役 sweep チェックリスト

トークン改名・機能退役・パス変更などの「横断イベント」が起きたら、同一 PR で以下を **grep で全数 sweep** する:

```bash
# 1. repo 内 docs / skills / agents（symlink 込み）
grep -rn '<旧名>' .claude/

# 2. repo 外の symlink 実体（PR diff に現れない死角 — 別コミットで追随）
grep -rn '<旧名>' ~/dev/Claude/skill-lib/projects/life-editor/
grep -rn '<旧名>' ~/dev/Claude/agents-lib/projects/life-editor/
```

- **実例**: ink→lumen 改名（#135）は `rules/frontend.md` だけ直して SSOT・tier-2・skill-lib へ波及せず、notion→ink→lumen の **3 世代が併存**した
- 歴史的記述として残す場合は「旧称」「当時の仮称」「retired」等の注記を同じ行に付ける（docs-lint #173 の除外条件）

## 3. plans/ Status の enum

`docs/vision/plans/` の Status は次の enum のみ（自由語彙禁止・grep 可能にする）:

`Draft` / `IN PROGRESS` / `BLOCKED` / `COMPLETED` / `SUPERSEDED` / `DEFERRED` / `REFERENCE` / `ACTIVE (adopted policy)`

- `COMPLETED` / `SUPERSEDED` になったファイルは `archive/` へ移動する（plans/ に残置しない）
- 禁止例: In-progress / EXECUTED / READY FOR PR / SKELETON / FROZEN / SHIPPED / CLOSED

## 4. 完了イベント時の docs 追随（DoD）

PR merge / Issue close をしたら、同時に次を更新する（テンプレのチェック行にも記載あり）:

- 対応する plan の Status（COMPLETED 化 + archive 移動）
- 自チャットの per-chat memory（merge 済み PR を「open」と主張し続けない）
- SSOT のチェックボックス・Status 行（「相互参照が整合したまま両方 stale」は文書同士の突き合わせでは検出不能 — **git / コードと突き合わせる**）

## 5. サブエージェント監査の実測必須則

サブエージェントの監査報告に含まれる file:line・件数・Status 引用は、**採用前に必ずメインが実測（grep / Read）で spot check** する。

- 実例: 2026-07-07 監査では一次報告に「実在しない引用つきの偽 findings」が約 10 件混入した（SectionId 除去済み・MCP 34 ツール等 — 全件実測で棄却）
- 根拠が汚染された docs 修正は「修正という名の新たな矛盾」を生む。関連 memory: `subagent-premature-completion` / `tool-result-fabrication-triage`
