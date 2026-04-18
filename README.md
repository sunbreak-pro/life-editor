# Life Editor

> AI と会話しながら生活を設計・記録・運用するパーソナル OS。
> カレンダー中心の AI 連携ワークスペース。

タスク・スケジュール・メモ・知識・家計などを一つのデスクトップアプリに集約し、アプリ内ターミナルから Claude Code が MCP Server 経由で全データを自然言語で操作する。SQLite ローカル SSOT + Cloud Sync で Desktop ↔ iOS 間を同期しつつ、オフラインでも完全動作する。

## 技術スタック

- **Frontend**: React 19 (TypeScript) + Vite + Tailwind CSS v4 + @dnd-kit + TipTap + xterm.js + react-i18next + Recharts
- **Desktop / Mobile**: Tauri 2.0 + rusqlite + portable-pty
- **MCP Server**: Node.js + @modelcontextprotocol/sdk + better-sqlite3

## セットアップ

### 前提条件

- Node.js 18+
- npm
- Rust (rustup)

### 起動

```bash
npm install                          # postinstall で frontend 依存も自動インストール
cargo tauri dev                      # Vite(5173) + Tauri 同時起動
```

## ドキュメント

- [統合定義書（ビジョン・アーキテクチャ・規約・機能マップ）](.claude/CLAUDE.md) — **SSOT**
- [機能要件（Tier 1-3）](.claude/docs/requirements/) — Phase B で作成予定
- [アクティブ ADR](.claude/docs/adr/)
- [実装プラン](.claude/feature_plans/) / [完了履歴](.claude/archive/)
- [変更履歴](.claude/HISTORY.md) / [リリース履歴](CHANGELOG.md)
