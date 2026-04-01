# Project Review Checklist

コード変更時に該当する項目を確認する。

## IPC / Electron

- IPC追加・変更時は3点同期を確認: `electron/preload.ts` (ALLOWED_CHANNELS) / `electron/ipc/*Handlers.ts` / `frontend/src/services/ElectronDataService.ts`
- IPC経由データはJSON互換のみ（Date→文字列、undefined→null）

## DataService 層

- 新しいデータ操作は `DataService.ts` インターフェースに定義 → `ElectronDataService.ts` に実装
- コンポーネントから直接 `window.electronAPI` を呼ばない（DataService経由）

## Provider / Context

- Provider順序: Theme → UndoRedo → TaskTree → Calendar → Memo → Note → Schedule → Timer → Audio
- 新Provider追加時は `renderWithProviders.tsx` にも追加
- Context値の型は `ReturnType<typeof useHook>` パターン

## SQLite / Migration

- テーブル/カラム追加は `IF NOT EXISTS` 使用
- `PRAGMA user_version` を正しくインクリメント
- カラム名: DB=`snake_case` / JS=`camelCase`

## フロントエンド

- i18n: 新UIテキストは `en.json` / `ja.json` 両方に追加
- ID生成: `"type-timestamp"` 形式のString型
- `createMockDataService` に新メソッドのモック追加

## セキュリティ

- APIキーはフロントエンドに直接記載しない
- `public/sounds/*` はコミット禁止
