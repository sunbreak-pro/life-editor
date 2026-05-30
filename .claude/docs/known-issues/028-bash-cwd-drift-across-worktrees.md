# 028: Bash の `cd` が worktree を跨いで持続し、以降の相対パス操作が別 worktree に着地する

**Status**: Workaround
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-05-26
**Resolved**: -

## Symptom

メイン worktree (`/Users/newlife/dev/apps/life-editor`) で作業中のチャットが、別 worktree (`.claude/worktrees/<other>/`) を調査するために以下のような Bash 呼び出しを実行する:

```bash
cd /Users/newlife/dev/apps/life-editor/.claude/worktrees/prototype-mobile && git status -s
```

調査終了後、cwd を戻さないまま次の Bash 呼び出しを実行すると、**cwd は依然として別 worktree のまま**である。

```bash
git status
# → On branch prototype/mobile-ui
#   Your branch is up to date with 'origin/prototype/mobile-ui'.
```

メインで作業中のつもりが、`git status` / `git diff` / `git add` / 相対パスでのファイル参照などがすべて別 worktree (= 別ブランチ) に対して走る。本事例では `ls .claude/docs/vision/plans/2026-05-25-worktree-rollout-and-cleanup.md` が **No such file or directory** を返し (新規作成したファイルが消えたように見える)、初めて漂流に気付いた。

## Root Cause

Claude Code の Bash ツール仕様:

> The working directory persists between commands, but shell state does not.

`cd` で移動した cwd は **次の Bash 呼び出しでも保持される**。複数 worktree を持つリポジトリでは、別 worktree への一時的な `cd` を戻し忘れると、以降の git 操作・相対パス操作がすべて別 worktree (= 別ブランチ) で実行される。

絶対パスを使うツール (`Read` / `Write` / `Edit` で絶対パス指定) は cwd に依存しないので影響を受けないが、Bash 内の `git` / `ls` / `grep` 等は cwd 依存。

## Impact

放置 / 再発した場合:

- **誤 commit リスク**: メインで作業中のつもりが別ブランチに commit してしまう (本事例では絶対パス Write を使っていたため難を逃れたが、相対パスや `git add .` を使っていたら別ブランチに着地していた)
- **デバッグ時間の浪費**: 「新規作成したファイルが消えた」「git diff が空」等の幻覚的症状でユーザーが混乱
- **`.claude/comm/.session-branch` との不整合**: チャットの宣言と実際の cwd の branch が乖離。SessionStart hook 検査 F が次回起動時に警告を出す
- **頻度**: 並行チャット運用で worktree が複数ある環境では、調査系の `cd` を 1 回でも使えば再発しうる。本リポジトリでは現在 3 worktree が常駐

## Fix / Workaround

### 推奨パターン (恒久対応)

**`cd` は使わず `git -C <worktree-path>` を使う**。cwd を変えずに別 worktree の git 操作ができる。

```bash
# ❌ NG: cwd が持続する
cd .claude/worktrees/prototype-mobile && git status -s

# ✅ OK: cwd は変わらない
git -C .claude/worktrees/prototype-mobile status -s
```

ls / find / grep 等で別 worktree のファイルを見たい場合も、絶対パスまたは `--git-dir` / `-C` を使う。

### 応急処置 (一時的な `cd` をどうしても使う場合)

サブシェル `( cd ... && ... )` で囲み、cwd 変更をその場限りに閉じる。

```bash
( cd .claude/worktrees/prototype-mobile && git status -s )
# 終了後 cwd は元の場所に戻る
```

または `cd ... && ... && cd -` で明示的に戻す:

```bash
cd .claude/worktrees/prototype-mobile && git status -s; cd -
```

### 検出パターン

意図しない漂流を早期検出するには、git 状態を確認する Bash 呼び出しで `pwd` も併記する:

```bash
echo "=== pwd ==="; pwd; echo "=== HEAD ==="; git rev-parse --abbrev-ref HEAD; echo "=== status ==="; git status -s
```

セッション中 `pwd` が想定外に変わっていたら漂流。

## References

- 関連 plan: `.claude/docs/vision/plans/2026-05-25-worktree-rollout-and-cleanup.md` (Worklog "cwd 漂流事故" 節)
- 関連 plan: `.claude/docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md` (Multi-chat Worktree Policy の前提)
- 関連 CLAUDE.md: `.claude/CLAUDE.md` §7.4
- Bash ツール仕様: Claude Code 公式ドキュメント「The working directory persists between commands」

## Lessons Learned

- **複数 worktree がある repo では `cd` を Bash ツールで使うこと自体がリスク**。`git -C <path>` への置き換えを優先する
- **ファイル操作は絶対パス**を徹底する (Write / Edit / Read で絶対パスを使えば cwd 漂流の被害が最小化される)
- セッション中、無名の git コマンドを使う前に **`pwd` を 1 行併記**するクセを付ける (検出パターン参照)
- 検索キーワード: `bash cwd persistence worktree`, `wrong branch after cd`, `git status shows other branch`, `worktree drift`, `cd persistent claude code`
