# 031: skill-lib / agents-lib への symlink 10 本が Windows で解決できず、参照先が常に不在になる

**Status**: Fixed
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-08-09
**Resolved**: 2026-08-10（repo 内 vendor 化 — 下記 Fix）

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

## Fix

**恒久対処（2026-08-10・Mac セッションで実施）**: 選択肢 1「repo 内 vendor 化」を採用し、**10 本すべてを実ファイルとしてリポジトリに取り込んだ**（mode `120000` → `100644`）。以後 life-editor repo が唯一の正本で、`skill-lib` / `agents-lib` の `projects/life-editor/` は削除する（ユーザー確定 2026-08-10 = D-20260810-main-1）。

選択肢 2（可搬ポインタ化）は不成立。参照先の共有ライブラリ自体が git 管理外で、相対パスにしても Windows には実体が届かないため。また hooks の fallback chain（`$HOME/dev/Claude/hooks-lib` → 無ければ `.claude/scripts/hooks-lib/`）もスキルには使えない — **Claude Code はスキルをディレクトリ一覧で発見する**ので、間に振り分けスクリプトを挟む余地が無い。実体を repo 内に置く以外の手が無い。

同時に `add-component` / `add-feature` / `add-ipc-channel` / `db-migration` / `test-writing` の 5 本を `Skill.md` → `SKILL.md` へ正規化した。macOS / NTFS は大文字小文字を区別しないため今まで動いていたが、case-sensitive な FS（Linux / CI コンテナ）では読めない潜在バグだった。

**以後の運用ルール**: `.claude/skills/` と `.claude/agents/` に **repo 外を指す symlink を新規追加しない**。スキル / エージェントは repo 内に直接作る。

## References

- 関連ファイル: `.claude/skills/`（8 本）・`.claude/agents/`（2 本）— 現在はいずれも実ファイル
- 関連 plan: `.claude/docs/vision/plans/2026-08-10-harness-loop-consolidation.md`（L7 / L8 / L11）
- 分析: `.claude/docs/reports/2026-08-09-harness-loop-redesign.md` §3.1 D8
- 類例: `025`（worktree ごとに参照実体がずれる）

## Lessons Learned

- **マシン固有の絶対パスをリポジトリへコミットしない**。symlink は「壊れていても実行時エラーにならない」ため、死んでいることに気付くまでが長い
- 死活は目視でなく `git ls-files -s <dir> | grep 120000` で全数確認する（Windows ではファイルに見えるので `ls` では判別できない）
- 解決不能な参照を見つけても、**別 OS で生きている可能性があるなら消さない**。参照側に「どの環境で生きるか」を書くほうが安全
- **ディレクトリ一覧で発見される仕組み（スキル / エージェント）には fallback chain が効かない**。hooks のように「無ければ予備を呼ぶ」振り分けを挟めないので、可搬性は実体の配置でしか担保できない
- **大文字小文字だけ違うファイル名は case-insensitive な FS では死角**（`Skill.md` が 5 本混在していた）。`git ls-files | grep -i` で拾う
- 検索キーワード: skill-lib / agents-lib / 120000 / dead symlink / Mac 絶対パス / 死んだポインタ / SKILL.md 大文字小文字
