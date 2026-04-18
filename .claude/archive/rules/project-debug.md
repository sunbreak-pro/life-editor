# Project Debug Guide

## Tauri IPC デバッグ

### コマンド未登録

1. `src-tauri/src/commands/` に `#[tauri::command]` 関数が定義されているか確認
2. `src-tauri/src/lib.rs` の `generate_handler![]` にコマンドが登録されているか確認
3. `frontend/src/services/TauriDataService.ts` の `invoke()` 呼び出しでコマンド名が一致しているか確認

### シリアライゼーション

- Tauri IPC は `serde` でシリアライズ。Rust 側の引数名はフロントエンドの `invoke()` 引数と一致が必要
- `Date` → 文字列化、`undefined` → 消失（`null` を使う）

## SQLite デバッグ

- カラム名: DB=`snake_case` / JS=`camelCase`。Repository の `rowToModel` 変換関数を確認
- マイグレーション: `PRAGMA user_version` で現バージョン確認 → `migrations.ts` で処理を読む
- WALモード: 同時アクセス時のロック注意

### 診断コマンド

```bash
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db ".tables"
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"
```

## Audio デバッグ

- `AudioContext` state: `suspended` → ユーザー操作後に `resume()` 必要
- フェード: `useAudioEngine` の `gainNode` 操作
- カスタムサウンド: `useCustomSounds` → IPC → ファイルシステム、メタデータは `db:customSound:*`

## Context/Provider デバッグ

- Provider順序: CLAUDE.md のモバイル構成 / デスクトップ構成を参照
- 内側Providerは外側Contextに依存可（逆は不可）
- 依存関係: ScheduleItemsProvider → RoutineProvider、AudioProvider → TimerProvider
- `Cannot read properties of null` → コンポーネントが対応Providerの外で使用されている
- Schedule系は3 Provider に分解済み（ADR-0003 参照）: Routine / ScheduleItems / CalendarTags
- `useScheduleContext()` はファサード（3つの新hookを内部で合成）。新コードでは `useRoutineContext()` / `useScheduleItemsContext()` / `useCalendarTagsContext()` を直接使用推奨
