---
name: dev-digest
description: 朝の采配ダイジェスト生成。open PR・未回答の判断キュー・各レーンの手番・貼り付け用 boot 行を 1 枚に集約し、.claude/comm/digest/ に出力して朝刊（Daily「開発」セクション）へミラーする。Triggers include "采配", "ダイジェスト", "digest", "今日の判断", "今日どれやる", "朝刊の開発欄".
---

# Dev Digest — 朝の采配ダイジェスト

chat-main（または検証専用セッション）で起動する読み取り中心のスキル。**コード変更・git 書き込み・Issue への書き込みはしない**。書いてよいのは digest ファイルと朝刊ミラーだけ。

## 手順

1. 収集（並列で）
   - `gh pr list --state open --json number,title,isDraft,mergeable,updatedAt`
   - `.claude/comm/decisions/chat-*.md` の未回答エントリ（ANSWERS.md に無い ID）
   - `.claude/memory/INDEX.md` の「進行中」から、手番が「ユーザー」「chat-main」の行
   - `.claude/comm/outbox/` の前回 digest 以降の新着（前回 digest ファイルの日付と mtime 比較）
   - playwright 検証計画（`plans/2026-07-28-post-merge-playwright-verification.md`）の未消化 V 項目数
2. 判断の選択肢化
   - ユーザー手番の判断を「1 行の問い + A/B + 推奨 1 行 + 放置時の挙動」へ圧縮
   - **今日の要判断は最大 5 件**（認知負荷キャップ）。溢れた分は「明日以降 N 件」とだけ表示
3. 出力: `.claude/comm/digest/YYYY-MM-DD.md`
   - 3 行サマリ（今日いちばん効く 1 手を先頭に）
   - 要判断（≤5・ID 付き。回答は ANSWERS.md に 1 行、または朝刊に返信）
   - merge 判断表（推奨順・conflict 有無・リスク 1 行）
   - レーン別「次の一手」1 行 + 貼り付け用 boot 行
   - 実機目視の残（件数のみ。詳細は検証計画へリンク）
4. 朝刊ミラー（可能なら）
   - ToolSearch で `mcp__life-editor__` ツールの有無を確認 → `get_memo`（今日）→ 結合 → `upsert_memo` で「## 開発」セクションを追記（上書き禁止）
   - MCP 未接続・失敗時はサイレントにファイルのみで完了（エラーにしない）
5. 完了報告は 1 行（digest パス + 要判断件数）

## ルール

- 要判断の要約は「リンク先を開かなくても答えられる粒度」を必須とする
- 判断の推奨には必ず理由を 1 行つける（推奨だけ書かない）
- digest 自身が長文化したら負け。1 画面で読める量を上限とする
