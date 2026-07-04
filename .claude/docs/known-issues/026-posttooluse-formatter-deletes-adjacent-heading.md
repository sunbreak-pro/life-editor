# 026: PostToolUse formatter が隣接する Markdown 見出しを削除する

**Status**: Active
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-05-24

## Symptom

`Edit` で Markdown ファイルに新規の `### 見出し` ブロックを挿入した直後、PostToolUse hook が走り次の通知が表示される:

```
PostToolUse:Edit hook additional context: PostToolUse hook modified
/Users/newlife/dev/apps/life-editor/.claude/history/chat-main.md after your
edit (likely a formatter). Your next Edit will not fail with a stale-file
error, but if its old_string targets a region the hook reformatted, Read
the file first.
```

その後ファイルを Read すると、**追加した新規見出しの直下にあった既存見出し行だけが消滅**し、本文（概要 / 変更点ブロック）はそのまま残る形になる。結果として「新規エントリの変更点リスト」の直後に「次のエントリの概要本文」が見出しなしで連結された異常状態になる。

今回の具体例（`.claude/history/chat-main.md`）:

- Edit 前: `# HISTORY` → `### 2026-05-23 - Schedule 無限ループ修正...` (5 件)
- Edit 内容: `# HISTORY` の直後に新規 `### 2026-05-24 - 並行作業基盤強化...` ブロックを挿入
- Edit 後（formatter 通過後）: 新規 `### 2026-05-24 ...` は残ったが、**`### 2026-05-23 - Schedule 無限ループ修正...` のタイトル行だけが消失**。その下の `#### 概要` 以降の本文は残った
- `grep -c "^### 2026"` が想定 6 件のところ 5 件を返してアーカイブ判定が狂うことで気づいた

## Root Cause

未特定（formatter の正体と挙動を確定できていない）。推定:

- `.claude/settings.json` または上位 settings に PostToolUse:Edit の hook で Markdown formatter（prettier-markdown / remark / markdownlint --fix 系）が登録されている可能性
- 連続する見出しレベル（`### A` → `### B`）に対して formatter が「重複と誤認して片方を削除する」ルールを持っているか、空白行正規化の副作用で見出し行を空行に置換した可能性
- 「タイトル行が消えるが本文は残る」という選択的削除なので、単純な空白正規化ではなく見出し固有のルールが疑わしい

確証を得るには PostToolUse hook の設定確認（`~/.claude/settings.json` / project settings / グローバル hook） + formatter ログの保存が必要。

## Impact

- **history の読み手側**: 時系列が壊れる。`### YYYY-MM-DD - <title>` を期待して読むと「次のエントリの概要だけが裸で出てくる」状態になり、どのエントリの本文か判別不能
- **task-tracker のローリングアーカイブ判定**: `grep -c "^### YYYY"` で件数を数えてアーカイブ判定するため、消されたタイトル行の分だけカウントが減り、本来アーカイブすべきタイミングを 1 回遅らせる
- **頻度**: 今回 1 回確認。再現条件（連続見出し / 特定ファイルパス / 編集パターン）が未確定なので潜在的に再発しうる
- **影響範囲**: `.claude/history/chat-*.md` / `.claude/memory/chat-*.md` 等の見出しが連続する Markdown 全般。並行 worktree でも同じ formatter が走るため全チャット共通でリスクあり

## Fix / Workaround

### 今回の応急処置

- 手動で `Edit` を 1 回追加実行し、消えた `### 2026-05-23 - Schedule 無限ループ修正（RoutineScheduleSync no-op 化）` のタイトル行を `### 変更点` リスト末尾と `#### 概要` の間に復元
- ローリングアーカイブ判定（6 件超過）を実施して DU-B-4 を `history/archive/2026-05/chat-main.md` へ移送
- commit `a59a3e4` に手動修復後の状態でコミット

### 検証ルーチン（恒久対応への第一歩）

`Edit` で `.claude/history/chat-*.md` または `.claude/memory/chat-*.md` に追記した直後は、必ず以下を実行する:

```bash
grep -c "^### 2026" .claude/history/chat-main.md
```

期待件数と一致しなければ Read で全文確認 → 消えた見出しを Edit で復元。

### 恒久対応の候補（未実施）

1. **formatter の正体特定**: `~/.claude/settings.json` / `.claude/settings.json` / グローバル hook 設定を grep して PostToolUse の登録を洗い出す
2. **対象除外**: 判明後、formatter の対象から `.claude/history/**` / `.claude/memory/**` を除外する設定追加
3. **task-tracker への組み込み**: history 追記後に件数バリデーション step を skill に追加（Edit 前後で `grep -c "^### "` を比較）

## References

- 関連 commit: `a59a3e4` chore(meta): add Plan Gate Convention + Stop hook + plan template
- 関連 history エントリ: `.claude/history/chat-main.md` の 2026-05-24「並行作業基盤強化」
- 影響ファイル: `.claude/history/chat-main.md`
- 関連 skill: `task-tracker`（END フローの history 追記ステップ）
- 確認コマンド: `grep -c "^### 2026" .claude/history/chat-<self>.md`

## Lessons Learned

- **PostToolUse hook 通知（"likely a formatter"）を軽視しない**: 通知が出たら必ず Read で影響範囲を確認する。「次の Edit は stale エラーにならない」だけを安心材料にしない
- **Edit 後の数値バリデーション**: Markdown の見出し追加・削除を伴う Edit は、件数を grep で測って想定と照合する習慣をつける
- **連続見出しの危険性**: `### A` の直上に `### B` を挿入するパターンは formatter の誤動作を誘発しやすい。空行を 2 行入れる / 区切り線（`---`）を挟む等で物理的に隔離する選択肢もある
- **検索キーワード**: formatter, PostToolUse, Edit, 見出し消失, heading deleted, chat-main.md, ローリングアーカイブ件数ズレ

---

→ **GitHub Issue #119 に移行**（2026-07-04）。以後の状態更新・議論は Issue 側が正（https://github.com/sunbreak-pro/life-editor/issues/119）。本ファイルは移行時点のスナップショット。
