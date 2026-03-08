# 024: Settings 統合 — Tips移動 + Claudeタブ昇格 + Sidebar変更

**Status**: COMPLETED
**Branch**: feature/life-editor-v2
**Created**: 2026-03-08

## 概要

Settings を統合拠点として整理:

1. Tips セクションを独立画面から Settings 内タブに統合
2. Claude を Advanced サブ項目からトップレベルタブに昇格
3. MCP ツール一覧・CLAUDE.md 編集・Skills 管理の UI を Claude タブに追加
4. サイドバーの Tips アイコン削除、Settings をラベル付き表示に変更

## 詳細設計

→ `.claude/plans/humming-noodling-pine.md` を参照

## 修正ファイル数

- 既存ファイル変更: 12
- 新規ファイル: 3

## 検証

1. `npm run dev` で全機能の動作確認
2. TypeScript コンパイルエラーなし
3. 各 Claude サブセクション (Setup, MCP Tools, CLAUDE.md, Skills) の動作確認
