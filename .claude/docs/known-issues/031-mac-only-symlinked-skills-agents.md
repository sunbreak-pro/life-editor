# 031: skill-lib / agents-lib への symlink 10 本が Windows で解決できず、参照先が常に不在になる

**Status**: Workaround
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-08-09

## Symptom

`.claude/skills/` の 8 本と `.claude/agents/` の 2 本が **Mac の絶対パスを指す symlink**（git mode `120000`）で、Windows のクローンでは中身が読めない。Claude Code のスキル / エージェント一覧に載らないため、これらを名指しで委譲する文書（CLAUDE.md・計画テンプレ・loop-\* スキル）の指示が **Windows セッションでは黙って空振りする**。

対象（`git ls-files -s .claude/skills .claude/agents | grep 120000` で全数確認できる）:

- skills 8 本 → `/Users/newlife/dev/Claude/skill-lib/projects/life-editor/<name>`
- agents 2 本 → `/Users/newlife/dev/Claude/agents-lib/projects/life-editor/<name>.md`

Windows 上では symlink がテキストファイルとしてチェックアウトされ、中身が Mac の絶対パス 1 行になっている。

## Root Cause

スキル / エージェントの実体をリポジトリ外の共有ライブラリ（`skill-lib` / `agents-lib`）に置き、リポジトリからは symlink で参照する構成。この共有ライブラリは Mac にしか存在せず、パスも Mac 絶対パスで固定されているため、他の OS・他のマシンでは解決手段がない。

## Impact

- Windows セッションでは、委譲先が常に不在のまま作業が進む（エラーにならず、指示が無視されるだけなので気付きにくい）
- 「実体を読めないので直せない」ため、Windows 側からは削除・stub 化しか選べず、**どちらも Mac 側の生きた参照を壊す**
- 参照している文書側が「使えるつもり」で書かれ続けると、文書と実行環境の乖離が広がる

## Fix / Workaround

**現状（応急）**: 削除・stub 化を禁止し、参照側に「Mac のみ実体」の注記を付けて空振りを可視化する。

- 参照側の注記: `CLAUDE.md` §4（`db-migration`）・§7.0（整合監査 2 エージェント）
- Windows セッションでの代替: `add-feature` / `test-writing` → 既存テスト・既存実装に倣う／`issue-dispatch` → 起票依頼を自分の outbox に append（起票は chat-main）／`db-migration` → `docs/vision/db-conventions.md` + 計画テンプレの DB Migration Notes

**恒久対処（Mac セッションの手番）**: 実体を読める環境で、次のどちらかを行う。

1. **repo 内 vendor 化** — 実体をリポジトリへ取り込み、共有ライブラリ側は fallback にする（`scripts/hooks-lib/` の fallback chain で型が実証済み）
2. **可搬ポインタ化** — 絶対パスの symlink をやめ、OS 非依存の参照（相対パス or 環境変数展開）に置き換える

## References

- 関連ファイル: `.claude/skills/`（8 本）・`.claude/agents/`（2 本）
- 関連 plan: `.claude/docs/vision/plans/2026-08-10-harness-loop-consolidation.md`（L7 / L8 / L11）
- 分析: `.claude/docs/reports/2026-08-09-harness-loop-redesign.md` §3.1 D8
- 類例: `025`（worktree ごとに参照実体がずれる）

## Lessons Learned

- **マシン固有の絶対パスをリポジトリへコミットしない**。symlink は「壊れていても実行時エラーにならない」ため、死んでいることに気付くまでが長い
- 死活は目視でなく `git ls-files -s <dir> | grep 120000` で全数確認する（Windows ではファイルに見えるので `ls` では判別できない）
- 解決不能な参照を見つけても、**別 OS で生きている可能性があるなら消さない**。参照側に「どの環境で生きるか」を書くほうが安全
- 検索キーワード: skill-lib / agents-lib / 120000 / dead symlink / Mac 絶対パス / 死んだポインタ
