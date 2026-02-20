# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Notionライクなタスク管理 + 環境音ミキサー + プレイリスト + ポモドーロタイマーを組み合わせた没入型個人タスク管理デスクトップアプリ（Sonic Flow）。Electron + SQLite でスタンドアロン動作（バックエンドサーバー不要）。

---

## 開発コマンド

```bash
npm run dev                          # Electron + Vite 同時起動（開発時はこれ）
npm run build                        # Frontend + Electron ビルド
cd frontend && npm run test          # Vitest（単発実行）
cd frontend && npx vitest run src/path/to/File.test.tsx  # 単一テスト実行
```

---

## アーキテクチャ

### 全体構成

Renderer (React 19 + Vite) → Preload (contextBridge) → Main Process (Electron 35) → Repository層 (better-sqlite3 → `userData/sonic-flow.db`)

### DataService 抽象化（重要）

フロントエンドは `getDataService()` 経由でデータアクセス。直接IPCを呼ばない。
実装: `frontend/src/services/` — `DataService.ts`（インターフェース）/ `ElectronDataService.ts`（IPC実装）

### データ永続化

- **SQLite**: better-sqlite3、WALモード。スキーマは `electron/database/migrations.ts` が正
- **localStorage**: UI状態のみ（キー一覧は `frontend/src/constants/storageKeys.ts`）

### 重要パターン

- **ルーティング**: React Router なし。`App.tsx` の `activeSection` で画面切替
- **TaskNode**: フラット配列 + `parentId` で階層表現。`type: 'folder' | 'task'`。フォルダは最大5階層
- **ソフトデリート**: `isDeleted` フラグ → TrashView から復元可能（Tasks/Notes/Memos/Routines/CustomSounds）
- **DnD**: `@dnd-kit` 使用。`moveNode`（並び替え）と `moveNodeInto`（階層移動）は別操作
- **リッチテキスト**: TipTap (`@tiptap/react`)。`React.lazy` で遅延ロード
- **i18n**: `react-i18next`。対応: en/ja。ロケール: `frontend/src/i18n/locales/`
- **ID**: String型。`"task-xxx"` / `"folder-xxx"` 形式

---

## コーディング規約

| 種別            | 規則                  | 例                       |
| --------------- | --------------------- | ------------------------ |
| コンポーネント  | PascalCase            | `TaskList.tsx`           |
| フック          | camelCase + use接頭辞 | `useTasks.ts`            |
| 変数・関数      | camelCase             | `taskList`, `fetchTasks` |
| 定数            | SCREAMING_SNAKE_CASE  | `API_BASE_URL`           |
| Context Value型 | PascalCase            | `AudioContextValue.ts`   |

- Frontend: ESLint設定に従う
- コメントは必要最小限

---

## コミット規約

```
<type>: <subject>
```

type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

---

## 作業時の注意点

- **README.md更新必須**: コード変更の作業完了時は必ず以下を実施:
  1. 開発ジャーナルセクションに日付付きエントリを追加（降順、最新が先頭）
  2. 機能追加・削除時は「主な機能」セクションも更新
  3. アーキテクチャ変更時は「技術スタック」「セットアップ」セクションも更新
- **音源ファイル**: リポジトリにコミット禁止（`public/sounds/` は `.gitignore` 対象）
- **IPC追加時**: 以下の3箇所を必ず更新:
  1. `electron/preload.ts` の `ALLOWED_CHANNELS`
  2. `electron/ipc/` に対応ハンドラ追加
  3. `frontend/src/services/ElectronDataService.ts` にメソッド追加

---

## ドキュメント体系

| ディレクトリ                           | 用途                                |
| -------------------------------------- | ----------------------------------- |
| `.claude/feature_plans/`               | 実装プラン（PLANNED / IN_PROGRESS） |
| `.claude/archive/`                     | 完了済みプラン                      |
| `.claude/docs/Application_Overview.md` | 仕様書                              |
| `.claude/docs/adr/`                    | アーキテクチャ決定記録              |
| `TODO.md`                              | ロードマップ                        |
| `CHANGELOG.md`                         | 完了タスク履歴                      |

ライフサイクル: `feature_plans/` → `archive/`

**プラン完了時の手順**:

1. プランファイル内の Status を `COMPLETED` に更新
2. `feature_plans/` から `archive/` へファイルを移動
3. `CHANGELOG.md` に完了内容を追記
