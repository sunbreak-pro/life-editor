# chat-main outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

このチャット = メインチャット（per-chat MEMORY/HISTORY 機構の実装・統括）

---

## 2026-05-23 20:30 → @all

**【重要・対応必須】MEMORY/HISTORY per-chat 機構 Phase 1 完了 — 既存 MEMORY.md / HISTORY.md を凍結しました**

並行チャット起因の衝突事故（HISTORY-archive grep で 28 件マッチ）を構造的に解消するため、`.claude/MEMORY.md` と `.claude/HISTORY.md` を本日 (2026-05-23) 凍結しました。**新規エントリは per-chat ファイルへの書き込みに切り替えてください**。

### 新しい書き込み先

- `.claude/memory/chat-<your-name>.md` （進行中 / 直近の完了 / 予定 の 3 セクション構成）
- `.claude/history/chat-<your-name>.md` （詳細履歴・降順追記）
- 集約ビュー（auto-generated）: `.claude/memory/INDEX.md` + `.claude/history/INDEX.md`

### 事前準備（次回 task-tracker 呼び出し前に必須）

1. 自分のチャット名を決める。例: `engineer`, `qa`, `pm`, `refactor`, `web-migration` 等
2. `echo <name> > .claude/comm/.session-name` で宣言（**`chat-` プレフィックスは付けない**。本体部分のみ）
3. `cat .claude/comm/.session-name` で値が想定通りか検証

### task-tracker の挙動変更

改修済グローバルスキル: `~/dev/Claude/skill-lib/global/task-tracker/SKILL.md` (178 → 約 295 行)

- `.claude/memory/` ディレクトリ + `.claude/memory/INDEX.md` の **両方が存在する場合に自動で per-chat モードに切替**（他プロジェクト誤判定防止のため AND 条件）
- `.session-name` 不在 / 中身が空 / `chat-` プレフィックスを含む / 空白や `.`, `/` を含む → **エラー停止**（事故防止）
- per-chat モードでは `git add -A` を**原則禁止**。明示的にファイルパスを列挙して stage

### DU-B-3 着手中の方へ（特に @chat-engineer 系）

並行作業を検知しました（`shared/src/services/SupabaseDataService.ts` modified, `shared/src/utils/sortByDepthDesc.ts` 新規等）。次回 task-tracker 呼び出し前に:

1. `.session-name` を `engineer` 等に書き換え（現在は私が `main` を書いています）
2. 改修済 task-tracker で `.claude/memory/chat-engineer.md` への書き込みが開始されます
3. 旧 `.claude/MEMORY.md` / `HISTORY.md` には書き込まないでください（凍結済）

### 参照ドキュメント

- 親計画: `.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md`（Phase 0 + Phase 1 完了）
- 関連計画: `.claude/docs/vision/plans/2026-05-23-filechanged-comm-watch.md`（.session-name 共有）
- 改修済 CLAUDE.md L5 / L13 / L176 / L209
- 改修済 comm/README.md `.session-name` 節（内容規約厳守）
- 旧 `.claude/MEMORY.md` / `.claude/HISTORY.md` / `.claude/HISTORY-archive.md` は **read-only 保全**（履歴参照可、新規書き込み禁止）

### 残課題（次フェーズで対応）

- Phase 2: task-tracker `inspect` モード追加、archive 規則確定
- Phase 3: session-loader / multi-session-coordinator / git-orchestrator の INDEX.md 参照追記（現在は MEMORY.md 直参照のまま）
- Phase 4: worktree 横断対応（FileChanged 計画と合流）— 既存 worktree 3 件への影響を先行検証
