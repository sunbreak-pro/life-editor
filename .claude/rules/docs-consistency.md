---
paths:
  - ".claude/docs/**"
  - ".claude/archive/**"
  - ".claude/CLAUDE.md"
---

# Docs Consistency — 矛盾を作らないための運用ルール

> 出典: `docs/vision/plans/2026-07-07-docs-consistency-cleanup.md`（2026-07-07 監査で矛盾約 60 件を確認・Phase 7 で本ルール化）。docs を更新する全セッションが対象（path-scoped: 上記パスを扱う時のみ自動ロード）。

## 1. 数値の非複製原則

個数・列挙（テーブル数 / ツール数 / Provider 一覧 / 機能数など）は**単一の正本（コード or SSOT）だけに書き、他文書は参照にする**。

- 「一覧はコードが正」と書くなら数字を併記しない（数字だけ古くなる自己矛盾の典型パターン）
- 同じ事実が SSOT → CLAUDE.md → vision → requirements → briefs → skills の最大 6 層に転記されると、決定 1 つに対し更新箇所が N 箇所になり必ず漏れる

## 2. 改名・退役 sweep チェックリスト

トークン改名・機能退役・パス変更などの「横断イベント」が起きたら、同一 PR で以下を **grep で全数 sweep** する:

```bash
# 1. プロジェクト固有の docs / skills / agents（2026-08-10 vendor 化で全て repo 内 — known-issues 031）
grep -rn '<旧名>' .claude/

# 2. グローバル資産（claude-dotfiles repo・別リポジトリなので PR diff に出ない死角）
#    ~/.claude/{skills,agents,rules} は claude-dotfiles への symlink。life-editor 固有語
#    （lumen-* / SectionId / life-editor）が実際に混ざっているため、ここも必ず当てる
grep -rn '<旧名>' <claude-dotfiles>/claude/
```

- **実例**: ink→lumen 改名（#135）は `rules/frontend.md` だけ直して SSOT・tier-2・skill-lib へ波及せず、notion→ink→lumen の **3 世代が併存**した（当時スキル実体は repo 外にあり PR diff に出なかった）
- **死角は減ったが消えていない**: 2026-08-10 の vendor 化でプロジェクト固有分は repo 内に入ったものの、グローバル資産（claude-dotfiles）には今も `lumen-*` や SectionId 一覧が直書きされている。「1 回の grep で全数」と思い込まないこと
- 歴史的記述として残す場合は「旧称」「当時の仮称」「retired」等の注記を同じ行に付ける（docs-lint #173 の除外条件）

## 3. plans/ Status の enum

`docs/vision/plans/` の Status は次の enum のみ（自由語彙禁止・grep 可能にする）:

`Draft` / `IN PROGRESS` / `BLOCKED` / `COMPLETED` / `SUPERSEDED` / `DEFERRED` / `REFERENCE` / `ACTIVE (adopted policy)`

- `COMPLETED` / `SUPERSEDED` になったファイルは `archive/` へ移動する（plans/ に残置しない）
- 禁止例: In-progress / EXECUTED / READY FOR PR / SKELETON / FROZEN / SHIPPED / CLOSED
- **enum を当てるのは plans/ 由来の文書だけ**（2026-08-01 ユーザー確定 D-20260801-main-2）: `archive/` には計画書以外（要件定義書・棚卸しメモ）も同居しており、そちらの `**Status**: SPECIFICATION（凍結）` / `ARCHIVED` は**文書種別を表す語**なので enum 化しない。Status 行が無い非計画書に足す必要もない。enum は「計画がどこまで進んだか」の語彙で、要件定義書に `COMPLETED` を当てても意味が通らない
- **全数チェックには `grep -n "^Status:"` では足りない**（#474 実測・2 本を見落とした）: `**Status**:` 形式と blockquote 前置（`> Status:`）を拾うため、各ファイル先頭 14 行に `^>?\s*Status:` と `^>?\s*-?\s*\*\*Status[^*]*\*\*:` の両方を当てる

## 4. 完了イベント時の docs 追随（DoD）

PR merge / Issue close をしたら、同時に次を更新する（テンプレのチェック行にも記載あり）:

- 対応する plan の Status（COMPLETED 化 + archive 移動）
- 自チャットの per-chat memory（merge 済み PR を「open」と主張し続けない）
- SSOT のチェックボックス・Status 行（「相互参照が整合したまま両方 stale」は文書同士の突き合わせでは検出不能 — **git / コードと突き合わせる**）

## 5. サブエージェント監査の実測必須則

サブエージェントの監査報告に含まれる file:line・件数・Status 引用は、**採用前に必ずメインが実測（grep / Read）で spot check** する。

- 実例: 2026-07-07 監査では一次報告に「実在しない引用つきの偽 findings」が約 10 件混入した（SectionId 除去済み・MCP 34 ツール等 — 全件実測で棄却）
- 根拠が汚染された docs 修正は「修正という名の新たな矛盾」を生む。関連 memory: `subagent-premature-completion` / `tool-result-fabrication-triage`
