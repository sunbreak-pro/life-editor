# Project Review Checklist

コード変更時に該当する項目を確認する。

## IPC / Electron

- IPC追加・変更時は3点同期を確認: `electron/preload.ts` (ALLOWED_CHANNELS) / `electron/ipc/*Handlers.ts` / `frontend/src/services/ElectronDataService.ts`
- IPC経由データはJSON互換のみ（Date→文字列、undefined→null）

## DataService 層

- 新しいデータ操作は `DataService.ts` インターフェースに定義 → `ElectronDataService.ts` に実装
- コンポーネントから直接 `window.electronAPI` を呼ばない（DataService経由）

## Provider / Context

- Provider順序 (外→内): Theme → Toast → UndoRedo → ScreenLock → TaskTree → Calendar → Memo → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig
- ScheduleItemsProvider は RoutineProvider の内側に配置（sync/backfill 依存）
- 新Provider追加時は `renderWithProviders.tsx` にも追加
- **Pattern A 準拠**: 新Context作成時は3ファイル構成（ADR-0002 参照）
  - `context/FooContextValue.ts` — 型 + createContext
  - `context/FooContext.tsx` — Provider
  - `hooks/useFooContext.ts` — `createContextHook()` で consumer hook
- `context/index.ts` に Provider, Context, ContextValue type を export 追加

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
