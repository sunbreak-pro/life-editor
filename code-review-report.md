# Life Editor コードレビューレポート

**調査日:** 2026-02-22
**対象:** Electron メインプロセス / IPC / データベース / フロントエンド全体

---

## 概要

Life Editor のコードベース全体を調査し、設計上の問題点・コード重複・セキュリティ脆弱性を洗い出しました。全体的なセキュリティ基盤（contextIsolation, sandbox, CSP, パラメタライズドクエリ）は良好ですが、いくつかの重要な問題が見つかりました。

---

## 1. セキュリティ脆弱性

### 1-1. パストラバーサル（HIGH）

**ファイル:** `electron/database/customSoundRepository.ts`

`loadBlob`, `saveBlob`, `permanentDelete` で `id` パラメータをそのまま `path.join(CUSTOM_SOUNDS_DIR, id)` に使用しており、`../../etc/passwd` のような値で任意ファイルの読み書き・削除が可能です。

**対策:** ID をホワイトリスト検証（`/^[a-zA-Z0-9_-]+$/`）する関数を追加。

### 1-2. インポートデータの検証不足（HIGH）

**ファイル:** `electron/ipc/dataIOHandlers.ts`

`data:import` ハンドラで JSON をパースした後の検証が最小限（配列チェックと tasks の id/type/created_at のみ）。サイズ制限なし、フィールド型・値域の検証なし。巨大データによる DoS リスクあり。

**対策:** 配列サイズ上限（例: 10,000件）、フィールド型・値域の検証を追加。

### 1-3. SQL 文字列補間（MEDIUM）

**ファイル:** `electron/database/migrations.ts`

`hasColumn()` 関数で `db.pragma(\`table_info(${table})\`)` とテーブル名を直接補間。`backupTableIfExists()` でも同様。現状はスタートアップ時のみの呼び出しだが、パターンが広がるリスクあり。

**対策:** テーブル名のホワイトリスト検証を追加。

### 1-4. エラー情報の漏洩（MEDIUM）

**ファイル:** `electron/ipc/handlerUtil.ts`

`loggedHandler` がエラーをサニタイズせずレンダラに返すため、DB テーブル名・カラム名・ファイルパス等が露出する。

**対策:** エラーメッセージを種別ごとに汎用メッセージに変換。

### 1-5. カスタムサウンド入力検証なし（MEDIUM）

**ファイル:** `electron/ipc/customSoundHandlers.ts`

`db:customSound:save` で ID 検証・サイズ制限・MIME タイプ検証がない。任意バイナリの保存が可能。

---

## 2. データベース設計の問題

### 2-1. tasks.parent_id に外部キー制約なし（HIGH）

**ファイル:** `electron/database/migrations.ts` (V1)

`parent_id TEXT` のみで FK 制約がないため、親タスク削除時に子タスクが孤立する。

**対策:** `FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE` を追加するマイグレーション。

### 2-2. マイグレーションのトランザクション不足（HIGH）

V1〜V5, V7〜V8, V10〜V16, V18 が `db.transaction()` で囲まれていない。途中クラッシュでスキーマが不整合になる可能性。

**対策:** 全マイグレーションを `db.transaction()` で囲む。

### 2-3. schedule_items が削除済み routine_templates を参照（CRITICAL）

V17 で `schedule_items.template_id` に `routine_templates` への FK を設定 → V20 で `routine_templates` を DROP。FK 参照先が消失。

### 2-4. memos の UNIQUE 制約とソフトデリートの競合（HIGH）

`date TEXT NOT NULL UNIQUE` + ソフトデリートのため、削除済みメモと同じ日付で新規作成ができない。`ON CONFLICT(date) DO UPDATE` で上書きされるが、意図しない挙動の可能性。

### 2-5. インデックス不足（MEDIUM）

以下のカラムにインデックスがない:

- `tasks.status`（フィルタリングで頻用）
- `tasks.scheduled_at`（カレンダー表示で頻用）
- `tasks.due_date`（V5 追加だがインデックスなし）
- `(is_deleted, order)` の複合インデックス

### 2-6. タイマーセッションが無制限取得（MEDIUM）

`timerRepository.ts` の `fetchSessions` に `LIMIT` なし。長期使用で全セッション返却によるパフォーマンス低下。

### 2-7. customSound が JSON ファイルで管理（MEDIUM）

他の全エンティティが SQLite を使う中、customSound のみ JSON ファイル + ファイルシステムで管理。トランザクション保護なし、一貫性の欠如。

---

## 3. フロントエンド設計の問題

### 3-1. Context Provider の過剰ネスト（HIGH）

`main.tsx` で 8 層のプロバイダネスト:

```
ThemeProvider → UndoRedoProvider → TaskTreeProvider → CalendarProvider
→ MemoProvider → NoteProvider → ScheduleProvider → TimerProvider → AudioProvider
```

どのコンテキストが変更されても、下位全体が再レンダリングの影響を受ける。

**対策:** 3 階層（設定系 / コアデータ / 機能別）に再構成。

### 3-2. 楽観的更新のロールバック欠如（CRITICAL）

**ファイル:** `useNotes.ts`, `useMemos.ts`, `usePlaylistData.ts` 等

UI 状態を先に更新し、DataService 呼び出しが失敗してもロールバックしない:

```typescript
setNotes((prev) => [newNote, ...prev]); // UI 更新
getDataService().createNote(id, title)
  .catch((e) => logServiceError(...));  // エラーログのみ、UI 戻さない
```

ユーザーは成功したと思うが、DB にはデータがない。

### 3-3. TimerContext の巨大な value（HIGH）

32 プロパティを持つコンテキスト値。`remainingSeconds` が毎秒更新されるたびに全 32 プロパティのオブジェクトが再生成され、全消費コンポーネントが再レンダリング。

**対策:** TimerState / TimerControls / TimerSettings の 3 コンテキストに分割。

### 3-4. サイレントエラー（CRITICAL）

**ファイル:** `TimerContext.tsx`

タイマーセッション終了時の DB 保存失敗が `console.warn` のみ。ユーザーの作業記録が消失する。`usePlaylistData.ts` では `.catch(() => {})` でエラーを完全に無視するケースも。

**対策:** persistError のようなエラー状態を全エンティティに統一実装。

### 3-5. useTaskTreeAPI の肥大化（MEDIUM）

1 フックが 30 以上のメソッドを返却。3 つのサブフックを合成。消費コンポーネントが不要なメソッドまで取得し、テストも困難。

### 3-6. usePlaylistEngine の Ref 過剰使用（MEDIUM）

13 個の `useRef` と 8 個の同期用 `useEffect`。Props → Ref の手動同期は React のメンタルモデルに反する。

---

## 4. コード重複

### 4-1. リポジトリ層の CRUD ボイラープレート

12 のリポジトリで同一の create/update/fetchById パターンが繰り返し。共通の BaseRepository インターフェースやファクトリで削減可能。

### 4-2. Undo/Redo ボイラープレート

`useMemos`, `useNotes`, `usePlaylistData`, `useScheduleItems`, `useRoutines` で同一のパターン（push → undo/redo コールバック定義 → DataService 呼び出し）が約 200 行分重複。

### 4-3. ソフトデリートの不統一

Tasks/Notes/Memos/Routines は `is_deleted` + `deleted_at` を使用。Playlists/Calendars はハードデリート。CustomSounds は JSON ファイルで独自実装。

### 4-4. N+1 クエリパターン

全リポジトリの `create()` / `update()` で INSERT 後に即 SELECT で同じレコードを取得。入力データから直接返却すれば 1 クエリ削減可能。

### 4-5. ElectronDataService のパススルー

489 行のファイルがほぼ全て `window.electronAPI.invoke()` への単純委譲。キャッシュ・バッチング・楽観的更新の機会を逃している。

---

## 5. 対応優先度

### Phase 1: 即時対応（セキュリティ）

| #   | 問題                         | 深刻度   |
| --- | ---------------------------- | -------- |
| 1-1 | パストラバーサル修正         | HIGH     |
| 2-3 | schedule_items FK 参照先修正 | CRITICAL |
| 3-2 | 楽観的更新のロールバック     | CRITICAL |
| 3-4 | サイレントエラーの修正       | CRITICAL |

### Phase 2: 次スプリント（データ整合性）

| #   | 問題                                     | 深刻度 |
| --- | ---------------------------------------- | ------ |
| 1-2 | インポートデータ検証強化                 | HIGH   |
| 2-1 | tasks.parent_id FK 追加                  | HIGH   |
| 2-2 | マイグレーション全体のトランザクション化 | HIGH   |
| 2-4 | memos UNIQUE 制約の修正                  | HIGH   |
| 3-3 | TimerContext 分割                        | HIGH   |

### Phase 3: 中期（設計改善）

| #   | 問題                       | 深刻度 |
| --- | -------------------------- | ------ |
| 1-4 | エラーメッセージサニタイズ | MEDIUM |
| 2-5 | インデックス追加           | MEDIUM |
| 3-1 | Context Provider 再構成    | HIGH   |
| 4-1 | リポジトリ層の共通化       | MEDIUM |
| 4-2 | Undo/Redo 共通化           | MEDIUM |

### Phase 4: 長期（品質向上）

| #   | 問題                         | 深刻度 |
| --- | ---------------------------- | ------ |
| 2-6 | クエリのページネーション     | MEDIUM |
| 2-7 | customSound の SQLite 移行   | MEDIUM |
| 4-4 | N+1 クエリ解消               | MEDIUM |
| 4-5 | DataService キャッシュ層追加 | MEDIUM |

---

## 良い点

- **Electron セキュリティ設定が堅牢**: contextIsolation, sandbox, nodeIntegration:false 全て有効
- **CSP が適切**: dev/prod で分けた制限的ポリシー
- **SQLクエリは全てパラメタライズド**: リポジトリ層で `db.prepare()` + バインドパラメータを一貫使用
- **IPC チャネルのホワイトリスト**: preload.ts で 123 チャネルを明示的に許可
- **WAL モード + 外部キー有効化**: db.ts で設定済み
- **ソフトデリート**: 主要エンティティでデータ復元可能
