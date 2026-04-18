# Project Review Checklist

コード変更時に該当する項目を確認する。

## IPC / Tauri

- IPC追加・変更時は3点同期を確認: `src-tauri/src/commands/` (`#[tauri::command]`) / `src-tauri/src/lib.rs` (`generate_handler![]`) / `frontend/src/services/TauriDataService.ts`
- Tauri IPC は `serde` でシリアライズ。Rust 引数名とフロントエンド `invoke()` 引数名を一致させる

## DataService 層

- 新しいデータ操作は `DataService.ts` インターフェースに定義 → `TauriDataService.ts` に実装
- コンポーネントから直接 `invoke()` を呼ばない（DataService 経由）

## Provider / Context

- Provider順序: CLAUDE.md のデスクトップ構成 / モバイル構成を参照
- ScheduleItemsProvider は RoutineProvider の内側に配置（sync/backfill 依存）
- 新Provider追加時は `renderWithProviders.tsx` にも追加
- **Pattern A 準拠**: 新Context作成時は3ファイル構成（ADR-0002 参照）。小規模/局所 Context は例外あり
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
