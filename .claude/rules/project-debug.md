# Project Debug Guide

## IPC デバッグ

### チャンネル未許可エラー

`Error: IPC channel not allowed: <channel>` → `electron/preload.ts` の `ALLOWED_CHANNELS` を確認。チャンネル名規則: `db:domain:action`

### ハンドラ未登録

1. `electron/ipc/registerAll.ts` で登録確認
2. `*Handlers.ts` の try-catch とエラーメッセージ確認
3. Repository層のメソッド名・引数の不一致チェック

### シリアライゼーション

- IPC経由はJSON互換データのみ。`Date` → 文字列化、`undefined` → 消失（`null` を使う）

## SQLite デバッグ

- カラム名: DB=`snake_case` / JS=`camelCase`。Repository の `rowToModel` 変換関数を確認
- マイグレーション: `PRAGMA user_version` で現バージョン確認 → `migrations.ts` で処理を読む
- WALモード: 同時アクセス時のロック注意

### 診断コマンド

```bash
sqlite3 ~/Library/Application\ Support/sonic-flow/life-editor.db ".tables"
sqlite3 ~/Library/Application\ Support/sonic-flow/life-editor.db "PRAGMA user_version"
```

## Audio デバッグ

- `AudioContext` state: `suspended` → ユーザー操作後に `resume()` 必要
- フェード: `useAudioEngine` の `gainNode` 操作
- カスタムサウンド: `useCustomSounds` → IPC → ファイルシステム、メタデータは `db:customSound:*`

## Context/Provider デバッグ

- Provider順序 (外→内): ErrorBoundary → Theme → TaskTree → Calendar → Memo → Note → Timer → Audio
- 内側Providerは外側Contextに依存可（逆は不可）。Timer は TaskTree に依存
- `Cannot read properties of null` → コンポーネントが対応Providerの外で使用されている
