# Plan: Code Review Fix — feature/life-editor-v2

**Status:** COMPLETED
**Created:** 2026-03-16
**Project:** /Users/newlife/dev/apps/notion-timer
**Branch:** feature/life-editor-v2

---

## Context

`feature/life-editor-v2` ブランチの包括的コードレビューで 4 Blocking / 10 Important / 10 Suggestion の問題を検出。HTTP/WebSocket サーバー（モバイルアクセス用）のセキュリティ、IPC↔REST 間の同期整合性、フロントエンドの堅牢性を中心に修正する。

**Why:** セキュリティ脆弱性（パストラバーサル、CORS）が未修正のまま公開されるリスク、モバイル同期の不整合、パフォーマンス劣化がユーザー体験を損なう。
**非目標:** 新機能追加、大規模アーキテクチャ変更、テストカバレッジ拡充。

---

## Phase 1: Security Critical (Blocking)

### Step 1-1: Path Traversal 修正 [B-1]

- [ ] `electron/server/index.ts` L92-95 に `path.resolve()` + `startsWith()` チェック追加
  - `path.resolve(path.join(staticDir, urlPath))` で正規化
  - `resolvedStaticDir + path.sep` プレフィックスチェック
  - 失敗時 403 Forbidden を返す

### Step 1-2: CORS Origin 固定化 [B-2]

- [ ] `electron/server/middleware/cors.ts` L4-6 を `Access-Control-Allow-Origin: *` に固定
  - Origin エコーを廃止（`*` はブラウザが credentials 付きリクエストをブロックするため安全）
  - `Access-Control-Allow-Credentials` は設定しない

---

## Phase 2: Sync & Performance (Blocking + Important)

### Step 2-1: useRealtimeSync 循環参照修正 [B-3]

- [ ] `frontend/src/hooks/useRealtimeSync.ts` — ref ベースで循環依存を排除
  - `connectRef` を導入し、`scheduleReconnect` が `connectRef.current?.()` を呼ぶ
  - `connect` の deps に `scheduleReconnect` を含め、`scheduleReconnect` の deps は `[]` にする
  - `connectRef.current = connect;` を useCallback の外で同期的に設定

### Step 2-2: MobileApp エンティティフィルタ付きリフレッシュ [B-4]

- [ ] `frontend/src/MobileApp.tsx` — `TAB_ENTITY_MAP` を定義し関連イベントのみ refreshKey 更新

  ```
  memos → ["memo", "timeMemo"]
  notes → ["note", "noteConnection", "wikiTag", "wikiTagGroup", "wikiTagConnection"]
  tasks → ["task"]
  schedule → ["scheduleItem", "routine", "routineTag", "calendar"]
  ```

  - `handleChange` で `activeTab` に対応するエンティティかチェック
  - `onChangeRef` パターンが useRealtimeSync 内で使われているため deps 安全

### Step 2-3: paperBoardHandlers に broadcastChange 追加 [I-1]

- [ ] `electron/ipc/paperBoardHandlers.ts` — 9操作すべてに broadcast 追加
  - `import { broadcastChange } from "../server/broadcast";`
  - createBoard/updateBoard/deleteBoard → `broadcastChange("paperBoard", ...)`
  - createNode/updateNode/bulkUpdatePositions/deleteNode → `broadcastChange("paperNode", ...)`
  - createEdge/deleteEdge → `broadcastChange("paperEdge", ...)`

### Step 2-4: timeMemo/calendar IPC ハンドラに broadcastChange 追加 [I-2]

- [ ] `electron/ipc/timeMemoHandlers.ts` — upsert/delete に broadcast 追加
- [ ] `electron/ipc/calendarHandlers.ts` — create/update/delete に broadcast 追加

### Step 2-5: WebSocket changeBus リスナーリーク修正 [I-7]

- [ ] `electron/server/ws.ts` — `setupWebSocket` が cleanup 関数を返すよう変更
  - `return () => { changeBus.off("change", onChange); wss.close(); };`
- [ ] `electron/server/index.ts` — `stopServer` 内で cleanup を呼び出し

---

## Phase 3: Robustness (Important)

### Step 3-1: GET /api/notes/:id を直接クエリに修正 [I-3]

- [ ] `electron/server/routes/notes.ts` L23-29 — `repo.fetchAll().find()` → `repo.fetchById(id)` に変更
  - noteRepository に `fetchById` prepared statement が既にあるか確認し、なければ追加

### Step 3-2: グローバルエラーハンドラ追加 [I-4]

- [ ] `electron/server/index.ts` — `createApiApp` 内に `app.onError()` を追加
  - `log.error` でログ出力 + `{ error: "Internal Server Error" }` 形式で 500 を返す

### Step 3-3: REST ルートの入力バリデーション追加 [I-5]

- [ ] 以下ファイルの POST/PATCH ルートに `typeof` ベースの基本チェック追加:
  - `electron/server/routes/calendars.ts`
  - `electron/server/routes/playlists.ts`
  - `electron/server/routes/timer.ts`
  - `electron/server/routes/wikiTagGroups.ts`
  - `electron/server/routes/routineTags.ts`

### Step 3-4: Number() NaN チェック追加 [I-6]

- [ ] `electron/server/routes/routineTags.ts` L25, L33 — NaN チェック + 400 返却
- [ ] `electron/server/routes/timer.ts` L36, L68, L76 — 同上

### Step 3-5: usePaperBoard エラーハンドリング追加 [I-8]

- [ ] `frontend/src/hooks/usePaperBoard.ts` L31-57 に `.catch()` ハンドラ追加
  - `error` state 追加、失敗時に `loading: false` + エラーメッセージ設定
  - return に `error` を追加

### Step 3-6: RestDataService Paper メソッドの型修正 [I-9]

- [ ] `frontend/src/services/RestDataService.ts` L722-755 — `Record<string, unknown>` を DataService interface の具体型に合わせる

### Step 3-7: usePaperBoard.deleteBoard の setState 入れ子修正 [I-10]

- [ ] `frontend/src/hooks/usePaperBoard.ts` — `setActiveBoardId` を `setBoards` updater の外に移動
  - `boardsRef` パターンで最新の boards を参照

---

## Phase 4: Polish (Suggestion — 主要3件)

### Step 4-1: serveStatic のストリーム対応 [S-1]

- [ ] `electron/server/index.ts` L100, L109 — `readFileSync` → `createReadStream().pipe(res)` に変更

### Step 4-2: TaskTreeHeader suggestions のフィルタ順序修正 [S-4]

- [ ] `frontend/src/components/Tasks/TaskTree/TaskTreeHeader.tsx` L37-63
  - 現在: sort → slice(10) → filter（検索が上位10件のみ対象）
  - 修正: filter → sort → slice(10)

### Step 4-3: PaperSidebar 削除確認ダイアログ追加 [S-6]

- [ ] `frontend/src/components/Ideas/Connect/Paper/PaperSidebar.tsx` L156-163 — `window.confirm()` 追加
- [ ] `frontend/src/i18n/locales/en.json` / `ja.json` — 確認メッセージの翻訳キー追加

---

## Files

| File                                                           | Operation | Phase | Notes                                    |
| -------------------------------------------------------------- | --------- | ----- | ---------------------------------------- |
| `electron/server/index.ts`                                     | Modify    | 1,3,4 | Path traversal, error handler, streaming |
| `electron/server/middleware/cors.ts`                           | Modify    | 1     | CORS origin 固定化                       |
| `frontend/src/hooks/useRealtimeSync.ts`                        | Modify    | 2     | Circular ref fix                         |
| `frontend/src/MobileApp.tsx`                                   | Modify    | 2     | Entity-filtered refresh                  |
| `electron/ipc/paperBoardHandlers.ts`                           | Modify    | 2     | broadcastChange 追加 (9操作)             |
| `electron/ipc/timeMemoHandlers.ts`                             | Modify    | 2     | broadcastChange 追加                     |
| `electron/ipc/calendarHandlers.ts`                             | Modify    | 2     | broadcastChange 追加                     |
| `electron/server/ws.ts`                                        | Modify    | 2     | Cleanup 関数追加                         |
| `electron/server/routes/notes.ts`                              | Modify    | 3     | fetchById 使用                           |
| `electron/database/noteRepository.ts`                          | Modify    | 3     | fetchById メソッド追加（必要な場合）     |
| `electron/server/routes/calendars.ts`                          | Modify    | 3     | 入力バリデーション                       |
| `electron/server/routes/playlists.ts`                          | Modify    | 3     | 入力バリデーション                       |
| `electron/server/routes/timer.ts`                              | Modify    | 3     | NaN チェック + バリデーション            |
| `electron/server/routes/wikiTagGroups.ts`                      | Modify    | 3     | 入力バリデーション                       |
| `electron/server/routes/routineTags.ts`                        | Modify    | 3     | NaN チェック + バリデーション            |
| `frontend/src/hooks/usePaperBoard.ts`                          | Modify    | 3     | エラーハンドリング + setState 修正       |
| `frontend/src/services/RestDataService.ts`                     | Modify    | 3     | Paper メソッド型修正                     |
| `frontend/src/components/Tasks/TaskTree/TaskTreeHeader.tsx`    | Modify    | 4     | フィルタ順序修正                         |
| `frontend/src/components/Ideas/Connect/Paper/PaperSidebar.tsx` | Modify    | 4     | 削除確認ダイアログ                       |
| `frontend/src/i18n/locales/en.json`                            | Modify    | 4     | 翻訳キー追加                             |
| `frontend/src/i18n/locales/ja.json`                            | Modify    | 4     | 翻訳キー追加                             |

---

## Verification

### Phase 1

- [ ] `curl http://localhost:13456/../../etc/passwd` → 403 Forbidden
- [ ] モバイルブラウザからの API アクセスが正常動作

### Phase 2

- [ ] WebSocket 切断 → exponential backoff で再接続確認
- [ ] メモタブ表示中にタスク変更 → MobileApp 再マウントなし
- [ ] デスクトップで PaperBoard/TimeMemo/Calendar 変更 → モバイル同期確認
- [ ] サーバー再起動 → `changeBus.listenerCount("change")` が増加しない

### Phase 3

- [ ] `/api/notes/:id` → 単一レコード DB クエリ
- [ ] 不正 JSON / 欠損フィールド → 400 Bad Request
- [ ] `/api/timer/presets/abc` → 400 Invalid ID
- [ ] PaperBoard ネットワークエラー → loading 解除 + エラー表示

### Phase 4

- [ ] タスク検索で11件目以降のマッチも表示される
- [ ] ボード削除時に確認ダイアログ表示

### 全体

- [ ] `npm run dev` → デスクトップ/モバイル両方の基本操作が正常動作
