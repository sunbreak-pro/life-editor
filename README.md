# Life Editor

> AI と会話しながら生活を設計・記録・運用するパーソナル OS。
> カレンダー中心の AI 連携ワークスペース。

タスク・スケジュール・メモ・知識を一つのワークスペースに集約し、Claude Code が MCP Server 経由で全データを自然言語で操作する。データ層は Supabase（Postgres + Auth + Realtime）。単一の React コードベース（`shared/` + `web/`）を Web / Electron（Desktop）/ Capacitor（Mobile）の 3 形態で配布する。

## 技術スタック

- **UI（共通層）**: React 19 (TypeScript) + Vite + Tailwind CSS v4 + @dnd-kit + TipTap + react-i18next + Recharts — `shared/`（部品・サービス）+ `web/`（renderer）
- **Desktop / Mobile 包装**: Electron（`desktop/`）/ Capacitor（`mobile/`）
- **データ層**: Supabase（Postgres + Auth + Realtime）
- **MCP Server**: Node.js + @modelcontextprotocol/sdk（`mcp-server/`）

## セットアップ

### 前提条件

- Node.js 18+
- npm

### 起動

```bash
cd shared && npm install && npm run build   # 共有層（型 + dist 出力）
cd ../web && npm install && npm run dev     # Web renderer（Vite）
```

`web/.env.local` に Supabase の接続情報が必要（詳細は移行 SSOT を参照）。その他の開発コマンドは [.claude/CLAUDE.md](.claude/CLAUDE.md) §7.1 が正本。

## ドキュメント

- [統合定義書（ビジョン・アーキテクチャ・規約・機能マップ）](.claude/CLAUDE.md) — **SSOT**
- [機能要件（Tier 1-3）](.claude/docs/requirements/)
- [実装プラン](.claude/docs/vision/plans/) / [完了アーカイブ](.claude/archive/)
- [障害知見](.claude/docs/known-issues/)

> 旧 Tauri スタック（`frontend/` + `src-tauri/`）は 2026-07-11 に削除済み（#197）。参照が必要な場合は git tag `pre-tauri-removal` から復元できる。
