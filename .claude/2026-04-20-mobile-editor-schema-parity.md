# Plan: Notes 表示整合性の統合修正 — Mobile/Desktop エディタ統合 + マルチインスタンス DB 同期

**Status:** IN PROGRESS (Part A 完了)
**Created:** 2026-04-20
**Updated:** 2026-04-21 — Part A を schema-only 方式から「Desktop/Mobile エディタ統合 + レスポンシブ」方式に切替（Callout 等の NodeView が schema-only では構造崩れするため）
**Project:** /Users/newlife/dev/apps/life-editor
**Related:**

- `.claude/CLAUDE.md` §6.2 (Provider 順序), §6.3 (Pattern A), §3.1 (Cloud Sync)
- `.claude/docs/known-issues/006-desktop-data-dir-bundle-id-migration.md`
- `frontend/src/components/Tasks/TaskDetail/MemoEditor.tsx`
- `frontend/src/components/Mobile/shared/MobileRichEditor.tsx`
- `frontend/src/context/SyncContext.tsx`
- `src-tauri/src/lib.rs`

---

## Context

Notes / Memo / WikiTag 等の本文表示に **2 系統の不整合バグ** が同時発生している。どちらも「同じデータが場所によって違って見える」現象だが、根本メカニズムは独立している。

### Part A — Mobile ↔ Desktop の TipTap schema mismatch

Materials の Note を Desktop と iOS で開いたとき、本文テキストの表示/非表示が非対称に壊れる:

1. **Desktop 作成のノート → iOS 詳細画面で本文消失**
   - iOS 一覧プレビューでは本文が出る（`extractPlainText` が JSON を手動 walk しているため）
   - iOS 詳細の `MobileRichEditor` は StarterKit + Placeholder しか持たない → ProseMirror が未知ノードで `Node.fromJSON()` 失敗 → TipTap がドキュメント全体を空にリセット
2. **Mobile 由来のノート / 空コンテンツのノート → Desktop 詳細で本文が出ない**
   - `content=""` のままのノートや、Mobile 側 StarterKit 拡張（`underline` 等）依存のノートが存在
   - `enableContentCheck` / `onContentError` が未設定 → 失敗時にサイレントクリア

**根本原因**:

- `MemoEditor.tsx:207-371` は **30 近いカスタム拡張**（Callout / ToggleList / WikiTag / NoteLink / PdfAttachment / FileUploadPlaceholder / DatabaseBlock / BlockBackground / Table 一式 / TaskList / ResizableImage / Highlight / Color / TextStyle / CustomHeading(fontSize) など）を登録
- `MobileRichEditor.tsx:65-94` は **StarterKit + Placeholder のみ**
- `note_repository.rs:34` は content を無変換で通すため、両者の JSON がそのまま往復する
- `enableContentCheck` は `frontend/src` 全体で 0 件 — スキーマ不整合が黙殺される

### Part B — マルチインスタンス間の React state ↔ DB 非同期

同一マシン上で dev 版（`cargo tauri dev`）とパッケージ版を同時に開くと、WikiTag 一覧は一致するのに個別ノートや Daily Memo の本文が片側だけ反映されない（どちらが空かはケースバイケース）。

**観測事実**:

```
$ lsof ~/Library/Application\ Support/life-editor/life-editor.db
life-edit 31939 ...life-editor.db   ← Tauri app A
node      50568 ...life-editor.db   ← MCP server A
life-edit 50752 ...life-editor.db   ← Tauri app B
node      53206 ...life-editor.db   ← MCP server B
```

DB は同一 inode を共有（`src-tauri/src/lib.rs:41-43` で `dirs::data_dir().join("life-editor")` をハードコード）。Known Issue 006 の bundle-id 分裂は発生していない。

**根本原因**:

各 Tauri インスタンスが **独立した React state キャッシュ** を持っており、他プロセスの DB 書き込みを検出する仕組みが無い。

- `useMemos` (`useMemos.ts:26-39`) / `useNotes` (`useNotes.ts:51-64`) は `useEffect(() => refetch(), [syncVersion])` のみで refetch
- `syncVersion` は `SyncContext.tsx:88-91` で **Cloud Sync の `result.pulled > 0` 時だけ** インクリメント
- Cloud Sync は `SYNC_INTERVAL_MS = 30_000`（30 秒ポーリング）
- 結果: 同一マシン上の他インスタンスによる書き込みは **クラウドを経由して戻ってくるまで最大 60 秒以上** 反映されない。その間に逆方向の書き込みが起きると last-write-wins で一方の編集が消失する

### 方針

**Part A（旧方針・棄却）**: Mobile 専用の schema-only カスタムノード作成

> 一度 `frontend/src/extensions/mobile/` を作成して schema-only 版を登録したが、NodeView が無いため Callout / ToggleList 等が「ただの div」になり構造が崩れることが判明。Mobile/Desktop の二重管理も将来的な drift を招くため棄却。

**Part A（新方針）**: Desktop の `MemoEditor` を Mobile でも直接使用 + レスポンシブ対応

1. Desktop/Mobile で **単一のエディタコンポーネント `MemoEditor` を共有**
   - NodeView 込みの完全な Desktop 版を Mobile でも使う（Callout / Toggle / WikiTag / NoteLink / DatabaseBlock 等が同一レンダリング）
   - Mobile 用 provider tree に WikiTagProvider が既にあるため `useWikiTagSync` も動作する
2. Touch 環境検出フック `useIsTouchDevice`（`(hover: none) and (pointer: coarse)`）
3. Hover 前提 UI（`BlockContextMenu`）は touch 環境ではマウントしない
4. レスポンシブ padding: `px-2` ベース + `md:max-w-[760px] md:pl-10`
5. 両エディタに `enableContentCheck: true` + `onContentError` を追加（schema エラーの可視化は維持）
6. Suggestion メニュー（WikiTag/NoteLink の `@#` 補完）は Mobile でも有効（user 指定）

**Part B（マルチインスタンス同期）**: OS レイヤの DB 変更通知 + Cloud Sync 短縮の併用

1. **(対策 A)** Rust 側で SQLite DB ファイル（`life-editor.db` / `life-editor.db-wal`）を `notify` crate で監視。変更検出時に **全 Tauri ウィンドウに `db-changed` イベントを emit**
2. **(対策 C)** Cloud Sync のポーリング間隔を短縮（30s → 5-10s）。背景タブ / オフライン時はスキップする現行ロジックは維持
3. Frontend 側で `db-changed` / `sync-complete` の両方を listen し、`syncVersion` インクリメントをトリガー → 既存の hook がすべて自動 refetch
4. 書き込み直後の自己ループ防止（自プロセスの書き込み完了から N 秒は自分の emit を無視 or 最終イベント時刻で重複除外）

**Non-Goals**:

- Mobile で Desktop と同じ編集機能を提供（ToggleList を iOS で開閉等）
- Desktop / Mobile 間の content フォーマット移行（マイグレーション）
- 画像 / PDF 添付の iOS 側実装
- 真の CRDT / OT 型リアルタイム編集（同時編集中の文字単位 merge）— ここでは「他プロセスの書き込みを短時間で検知」までがスコープ
- 複数マシン間でのリアルタイム同期（これは Cloud Sync の役割であり、short polling でカバー）

---

## Steps

### Part A — Mobile/Desktop エディタ統合（完了）

#### A.1. Touch 環境検出フック（完了）

- [x] `frontend/src/hooks/useIsTouchDevice.ts` を新規作成
  - `window.matchMedia("(hover: none) and (pointer: coarse)")` で判定
  - MediaQueryList の change イベントで動的に再評価

#### A.2. MemoEditor の統合改修（完了）

- [x] `useIsTouchDevice()` を導入
- [x] `BlockContextMenu` を `!isTouch` で条件レンダリング（hover 前提 UI のため）
- [x] ルート div のクラスを responsive に: `max-w-full px-2 md:max-w-[760px] md:pl-10 md:pr-0`
- [x] `enableContentCheck: true` + `onContentError` で schema エラーを console.warn

#### A.3. Mobile ビューから MemoEditor を直接使用（完了）

- [x] `MobileNoteView.tsx` から `MobileRichEditor` を `MemoEditor`（LazyMemoEditor）に差替え。entityType="note"
- [x] `MobileMemoView.tsx` から `MobileRichEditor` を `MemoEditor`（LazyMemoEditor）に差替え。entityType="memo" + syncEntityId

#### A.4. 旧 Mobile 専用アセットの削除（完了）

- [x] `frontend/src/extensions/mobile/` ディレクトリを削除（MobileCallout / MobileToggleList / MobileWikiTag / MobileNoteLink / MobileDatabaseBlock / MobilePdfAttachment / MobileResizableImage + index.ts）
- [x] `frontend/src/components/Mobile/shared/MobileRichEditor.tsx` を削除

#### A.5. Phase A 検証（完了）

- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run test -- --run` → 28 files / 227 tests pass
- [ ] 手動: iOS 実機で Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が構造込みで表示
- [ ] 手動: Desktop 通常編集にリグレッションなし
- [ ] 手動: Touch デバイスで右クリックメニューが出ないこと、Bubble toolbar / Suggestion menu が動作すること

### Part B — マルチインスタンス DB 同期

#### B.1. Rust 側 DB ファイルウォッチャ（対策 A）

- [ ] `src-tauri/src/db_watcher.rs` を新規作成
  - `notify_debouncer_mini`（既に `file_watcher.rs` で使用中）で `life-editor.db-wal` と `life-editor.db-shm` を監視
  - 変更検出（debounce 200-500ms）で `AppHandle::emit_all("db-changed", payload)` 発火
  - payload: `{ source: "external" | "self", at: ISO string }`
  - 自プロセスの書き込みによる emit をサプレスする仕組み（最終書き込み時刻から N ms 以内は "self" タグで送る or 完全無視）
- [ ] `src-tauri/src/lib.rs` の `setup` 内で DB 初期化直後に `db_watcher::start(&app.handle(), &db_path)` を呼ぶ
- [ ] `src-tauri/src/lib.rs` の `mod` 宣言に `db_watcher` を追加
- [ ] macOS / Linux / Windows で `notify` の WAL ファイル監視が実際に発火することを確認（WAL checkpoint のタイミング依存）
  - 発火しない場合の代替: 一定間隔で `PRAGMA schema_version` / `PRAGMA data_version` をポーリングして変化検知

#### B.2. Frontend 側で `db-changed` を listen

- [ ] `frontend/src/context/SyncContext.tsx` に Tauri event listener を追加:
  - `listen("db-changed", handler)` で `setSyncVersion((v) => v + 1)` を発火
  - 自プロセス起因と外部起因を判別し、自プロセスは無視（二重 refetch 回避）
  - デバウンス（200-500ms）で連続イベントを束ねる
- [ ] 既存 `emitSyncComplete` との共存: Cloud Sync pull 時も DB 変更イベントが発火するため、重複処理を避ける

#### B.3. Cloud Sync ポーリング間隔の短縮（対策 C）

- [ ] `SyncContext.tsx:19` の `SYNC_INTERVAL_MS = 30_000` を **7_000（7 秒）** に変更
  - 背景タブ / オフライン時スキップのロジックは維持
  - デバウンス + abort controller で連続トリガーを抑制
- [ ] Cloudflare Workers / D1 の無料枠上限の再計算
  - 現状 30s × 1 device = 2880 req/day → 7s × 1 device = 12,343 req/day
  - 複数デバイスでも Free Plan のワーカー 100,000 req/day に収まるか確認（収まる）
- [ ] 設定 UI（`SyncSettings.tsx`）に「ポーリング間隔」項目を追加検討（デフォルト 7s、ユーザーが変更可）

#### B.4. `useSyncContext` + 各 hook の検証

- [ ] `useNotes` / `useMemos` / `useTasks` / `useWikiTags` / `useRoutines` / `useCalendars` 等、`syncVersion` を dep にしている全 hook を列挙（既に 25 ファイル確認済）
- [ ] `db-changed` 起点の refetch が全 hook に伝播することを確認
- [ ] 編集中（`isEditing` 相当のフラグがある場合）に refetch が走っても入力中の state が破壊されないことを確認
  - TipTap エディタの場合、`initialContent` 変更による再マウントが発生しないよう `key={noteId}` のまま保持
  - 入力中のノートは refetch で上書きしない／マージするロジックが必要か検討

### Part C — 検証と記録

#### C.1. 既存データでの動作確認

- [ ] iOS Mobile で Desktop 作成の既存ノート（Callout / ToggleList / WikiTag を含む）を開き、テキストが消えないこと
- [ ] Desktop で Mobile 作成のノートを開き、本文が表示されること
- [ ] 壊れたコンテンツでも onContentError に落ちてクラッシュしないこと
- [ ] dev 版 + パッケージ版同時起動 → 片方で Daily 編集 → もう片方に 10 秒以内に反映されること
- [ ] dev 版 + パッケージ版同時起動 → 同じノートを別々に編集 → Cloud Sync 経由で last-write-wins が機能すること
- [ ] dev 版 + パッケージ版同時起動 → 入力中の TipTap エディタが db-changed イベントで破壊されないこと

#### C.2. Known Issue 記録

- [ ] `.claude/docs/known-issues/009-mobile-desktop-tiptap-schema-mismatch.md` を作成
  - Root Cause: TipTap 拡張セットの非対称
  - Lessons Learned: クロスプラットフォーム TipTap は schema を共有ソースから組み立てる
- [ ] `.claude/docs/known-issues/010-multiinstance-react-state-db-drift.md` を作成
  - Root Cause: React state が他プロセスの DB 書き込みを検出しない
  - Lessons Learned: 共有 SQLite を前提にするなら OS レベルのファイル変更通知が必要

#### C.3. セッション検証 + コミット

- [ ] `cd frontend && npm run test` 全 pass
- [ ] `cd frontend && npm run typecheck`（あれば）pass
- [ ] `cargo build` pass
- [ ] 手動で iOS / Desktop dev / Desktop packaged の 3 系統を起動し受け入れテスト
- [ ] コミット分割:
  1. `feat(notes): register Desktop-shared schema in MobileRichEditor`
  2. `feat(notes): enableContentCheck with onContentError on both editors`
  3. `feat(sync): watch SQLite DB file and emit db-changed to frontend`
  4. `feat(sync): shorten Cloud Sync polling to 7s and listen to db-changed`

---

## Files

| File                                                                     | Operation         | Notes                                                                                           |
| ------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------- |
| `frontend/src/components/Mobile/shared/MobileRichEditor.tsx`             | **Delete** (done) | MemoEditor に統合                                                                               |
| `frontend/src/extensions/mobile/` (ディレクトリ一式)                     | **Delete** (done) | schema-only 方針棄却                                                                            |
| `frontend/src/hooks/useIsTouchDevice.ts`                                 | **Create** (done) | `(hover: none) and (pointer: coarse)` 判定                                                      |
| `frontend/src/components/Tasks/TaskDetail/MemoEditor.tsx`                | **Edit** (done)   | `useIsTouchDevice` + `!isTouch && BlockContextMenu` + responsive padding + `enableContentCheck` |
| `frontend/src/components/Mobile/MobileNoteView.tsx`                      | **Edit** (done)   | MobileRichEditor → LazyMemoEditor (entityType="note")                                           |
| `frontend/src/components/Mobile/MobileMemoView.tsx`                      | **Edit** (done)   | MobileRichEditor → LazyMemoEditor (entityType="memo")                                           |
| `src-tauri/src/db_watcher.rs`                                            | Create            | notify ベースの DB ファイル監視 + `db-changed` emit                                             |
| `src-tauri/src/lib.rs`                                                   | Edit              | `mod db_watcher;` 追加 + `setup` 内で `db_watcher::start` 呼び出し                              |
| `src-tauri/Cargo.toml`                                                   | Edit (if needed)  | `notify` / `notify-debouncer-mini` の dep を確認（`file_watcher` で既に有り）                   |
| `frontend/src/context/SyncContext.tsx`                                   | Edit              | `SYNC_INTERVAL_MS` 短縮 + `db-changed` listen + `setSyncVersion` 発火                           |
| `frontend/src/components/Settings/SyncSettings.tsx`                      | Edit (optional)   | ポーリング間隔設定 UI                                                                           |
| `.claude/docs/known-issues/009-mobile-desktop-tiptap-schema-mismatch.md` | Create            | Known Issue A                                                                                   |
| `.claude/docs/known-issues/010-multiinstance-react-state-db-drift.md`    | Create            | Known Issue B                                                                                   |
| `.claude/docs/known-issues/INDEX.md`                                     | Edit              | 009 / 010 を Active に追加                                                                      |
| `.claude/MEMORY.md`                                                      | Edit              | task-tracker 経由                                                                               |
| `.claude/HISTORY.md`                                                     | Edit              | task-tracker 経由                                                                               |

---

## Verification

### 自動

- [ ] `cd frontend && npm run test` 全 pass
- [ ] `cd frontend && npm run typecheck`（あれば）pass
- [ ] `cargo build` pass

### 手動 — Part A (iOS / Desktop cross)

- [ ] Desktop で Callout / ToggleList / WikiTag / NoteLink / Table / TaskList / Highlight / Image / PDF を含むノートを作成・保存
- [ ] iOS でそのノートを選択
  - [ ] 一覧プレビューに本文テキストが出る
  - [ ] 詳細画面で本文テキスト + 構造（callout 中身、toggle 中身）が可視
  - [ ] 編集せずに戻ってもデータが破壊されない（round-trip）
- [ ] iOS で基本 note を新規作成 → Desktop で開いて本文表示される
- [ ] 失敗可視化: schema error 発生時に DevTools console に `[MobileRichEditor] TipTap content schema error` が出る
- [ ] エラー発生時もアプリがクラッシュしない

### 手動 — Part B (Desktop multi-instance)

- [ ] dev 版 + パッケージ版を同時起動
- [ ] dev 版で Daily Memo を編集 → パッケージ版に **10 秒以内** に反映
- [ ] パッケージ版で WikiTag の本文を編集 → dev 版に 10 秒以内に反映
- [ ] 両側で同じノートを連続編集 → Cloud Sync 経由の last-write-wins が発動（片方の編集が遅れて上書きされる場合でも、状態は最終的に一致する）
- [ ] 入力中のエディタ（未 flush の状態）で他インスタンスの書き込みが届いても、入力中テキストが破壊されない（debounce 中の書き込みは優先される）
- [ ] ネットワーク OFF でも DB-changed イベントによる即時同期は機能する（Cloud 経由ではなくファイル watch 経由）
- [ ] 背景タブにしても DB-changed は発火する（`document.hidden` ガードは Cloud Sync ポーリングだけに適用）

### リグレッション

- [ ] Desktop 通常編集: 見出し / table / toggle / WikiTag suggestion / NoteLink suggestion / 画像 / PDF / DatabaseBlock 全て動作
- [ ] iOS 基本編集: 見出し / ボールド / リスト / 引用 / コードブロック 動作
- [ ] Cloud Sync で Desktop ↔ iOS の content round-trip が破壊されない
- [ ] Cloud Sync 無効時でもアプリは動作する（ポーリング 7s はスキップされる）
- [ ] Cloudflare Workers / D1 の daily request 数が Free Plan の上限（100,000 req/day）に収まる
- [ ] 複数インスタンス同時起動で SQLite WAL が肥大化しない（checkpoint が走る）
- [ ] MCP server が DB を開いていても db-changed イベントが発火する

---

## Open Questions / Risks

1. **Mobile のバンドルサイズ**: カスタム拡張を全部 import するとバンドル増。schema-only 切り出しでどこまで抑えられるか要計測
2. **DatabaseBlock の NodeView**: React NodeView を Mobile でどう扱うか。「埋め込みが壊れている」旨のプレースホルダ表示が現実的
3. **既存の壊れたデータ**: schema miss 修正前に iOS 保存されたノートは、Desktop 由来のカスタムノードが dropped されている可能性。forward fix のみ（本 Plan スコープ外）
4. **TipTap v3.19 の `enableContentCheck` の実挙動**: `onContentError` 呼び出し後に editor が空になるか部分保持か要検証
5. **SQLite WAL ファイル監視の信頼性**: `notify` が macOS / Linux / Windows で WAL 書き込みを確実に検知できるかは OS 依存。失敗時は `PRAGMA data_version` ポーリングに fallback
6. **入力中 refetch の扱い**: 他インスタンス書き込みで refetch が走った際、自インスタンスで編集中の TipTap エディタがどう反応するか。`key={id}` 保持で remount は防げるが、`initialContent` 変更は伝播しない（TipTap は `initialContent` を初回のみ使用するため）。編集中は一旦 refetch を deferred に（他のノートを見るタイミングまで）する手法も選択肢
7. **自己 emit サプレス**: DB ファイル watch は自プロセスの書き込みでも発火する。無限ループを防ぐため、書き込み直後 N ms は emit を抑制するか、self/external を判別できる仕組みが必要
8. **Cloud Sync 7s ポーリングのバッテリー影響**: デスクトップは問題ないが、iOS モバイルの常駐ポーリングは電池を食う。iOS 側は 30s 維持、Desktop のみ 7s にする分岐を検討
9. **MCP server プロセスが DB を開いている影響**: lsof で確認済みだが、MCP server 側からの書き込みも db-changed で拾えるか。`notify` は inode 単位で検知するので拾えるはず
