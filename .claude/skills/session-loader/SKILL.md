---
name: session-loader
description: life-editor セッション開始時にプロジェクト固有のコンテキストを読み込む。Use at the start of a new session, after /clear, or when you need to reload project context. Triggers include session start, context load, project understanding, warm up, セッション開始, コンテキスト読み込み.
---

「session-loaderを起動します」と表示する。

# Session Loader — life-editor

life-editor セッション開始時に、標準的な `.claude/` 構造 + life-editor 固有のコンテキストを読み込む。
（かつて `~/.claude/skills/session-loader/`（グローバル版）へ委譲していたが、グローバル版は退役・archive 済みのため本スキルを self-contained 化した。）

## Step 1-5: 標準セッション開始手順

1. タスク状態把握:
   - per-chat モード: `.claude/memory/INDEX.md` (全チャット集約ビュー) を Read。SSOT は各 `.claude/memory/chat-*.md`
   - INDEX.md は task-tracker 実行時に再生成される git 非追跡の派生ビュー。鮮度に懸念がある場合は `.claude/memory/chat-*.md` を個別に Read
   - legacy モード (`.claude/memory/` 不在時): 従来通り `.claude/MEMORY.md` を Read
2. `.claude/CLAUDE.md` でプロジェクト概要（auto-load 済み前提で確認のみ）
3. Active な課題確認（2026-07-04〜の運用）:
   - プロダクトバグの正は **GitHub Issues**: `gh issue list -R sunbreak-pro/life-editor --label type:bug`
   - 過去知見は `gh issue list -R sunbreak-pro/life-editor --state closed --search <keyword>` と `.claude/docs/known-issues/` の grep（Fixed 凍結アーカイブ + 環境系台帳）の両輪
4. 進行中タスクの関連ファイル読込
5. 要約表示

## Step 6: life-editor 固有ファイルの追加読込

### Vision ドキュメント（必要に応じて）

進行中タスクの性質に応じて:

- **アーキテクチャ / 設計判断に関わるタスク** → Read `.claude/docs/vision/coding-principles.md`
- **AI / MCP 系タスク** → CLAUDE.md §5（AI Integration）と MCP Server コードを参照（独立した `ai-integration.md` は現存しない）
- **DB / Sync 系タスク** → Read `.claude/docs/vision/db-conventions.md`
- **Core Identity / Value Prop に関わる議論** → Read `.claude/docs/vision/core.md`

### Code Explanation（該当機能のタスク時のみ）

Read `.claude/docs/code-explanation/` の該当インデックス（存在する場合）。

この時点では個別の code-explanation ドキュメントは読まない（必要になったら参照）。

## Step 7: life-editor 特有の要約追記

グローバル版の Step 5 要約に加えて以下を表示:

```
**life-editor 固有コンテキスト**:
- 現在の機能 Tier: {進行中タスクが触れる機能の Tier 1/2/3}
- 関連 Provider: {該当する Provider があれば}
- 関連 MCP ツール: {該当する MCP ツールがあれば}
```

## 注意事項

- CLAUDE.md は auto-load 済み前提。Step 1-5 は確認と差分読込に留め、重複読み込みを避ける
- life-editor は `docs/adr/` を持たない（設計原則は `docs/vision/coding-principles.md` に集約）
- `docs/life-editor-v2/` や旧構造のファイルは参照しない（Phase A で CLAUDE.md に統合済み）
