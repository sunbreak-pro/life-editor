# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ Memo → Daily 大規模 rename refactor + Mobile parity Phase B（中断: 2026-04-22）

**対象**: `types/memo.ts → daily.ts` 他 30+ ファイル(rename + 関連 context/hook 更新)、`frontend/src/components/Mobile/*` 複数
**計画書**: なし(旧 vision/mobile-porting.md 系)
**stash**: `stash@{0}: WIP: Memo->Daily refactor + Mobile parity + known-issues 009/010 (paused for iOS routine-dup verify on 2026-04-22)`

- 前回: types/memo.ts を daily.ts へ rename、context/hooks 一部を Memo\* → Daily\* へ改名、Mobile View 系のレスポンシブ改修着手
- 現在: refactor 未完了。`DataService.ts` / `useCalendar.ts` / `useRoleConversion.ts` / `analyticsAggregation.ts` が旧 `../types/memo` を参照したまま、`useDaily.ts` が DataService に存在しない `toggleDailyPin` / `setDailyPassword` / `verifyDailyPassword` 等を呼んでおり tsc -b で 20+ エラー
- 次: stash pop → 壊れた import を一斉修正(DataService に新メソッド群を追加 or rename)、あわせて Mobile parity Phase B のビュー改修を完了させる

## 直近の完了

- Routine schedule_items 重複の根本修正 + Cloud sync initial-pull 500 件 cap 暫定対応(Known Issues 011 / 012)✅（2026-04-22）— 4 層欠陥(DB UNIQUE 制約欠落 / sync 衝突解決が id 単独 / Frontend Map キー単独 / Rust `create()` ガード欠如)を `V63` migration + `schedule_item_repository::create()` の (routine_id, date) ガード + `sync_engine::upsert_versioned` の schedule_items 特別扱い + `cloud/src/routes/sync.ts::push` の pre-dedup + 複合キー `${routineId}:${date}` + backfill existingSet で根治。Cloud D1 の既存 1,181 行を dry-run preview 付きで DELETE、partial UNIQUE index を SQLite/D1 両端に張り恒久化。iOS 再インストール過程で (a) Xcode PATH 問題(`/usr/local/bin` へ cargo/rustc/rustup を symlink で解消) (b) dead code `IdeasView.tsx` 削除 (c) `MobileNoteView.tsx` の未使用 useEffect 除去 (d) Cloud Worker `/sync/changes` LIMIT=500 が 4/14-4/22 の routine を切り落とす Known Issue 012 を LIMIT=5000 へ bump + 暫定対応で解消。本命 fix(client pagination)は別セッション。`cargo check` 0 / frontend build 11.15s / vitest 231 pass / cloud tsc 0
- Notes Mobile/Desktop エディタ統合 Part A（Phase A）✅（2026-04-21）— Desktop `MemoEditor` を Mobile でも直接使用、`useIsTouchDevice` フック新設、ルート div レスポンシブ化、旧 `MobileRichEditor` と `extensions/mobile/` 削除、`useIsTouchDevice.test.ts` 4 件追加
- Cloud Sync ブロッカー 3 件解消（Known Issues 004 / 005 / 008）✅（2026-04-20）— V62 migration + `tasks_updated_at_insert` トリガー + `set_tags_for_*` 3 箇所に親 bump + `shouldCreateRoutineItem` タグ必須フィルタ撤去

## 予定

### Known Issue 012 本命修正 — sync pagination 実装

**対象**: `cloud/src/routes/sync.ts` / `src-tauri/src/sync/sync_engine.rs` / `src-tauri/src/sync/sync_client.rs` / `src-tauri/src/sync/types.rs`
**背景**: `/sync/changes` が `hasMore: true` を返しても Rust client が無視して一度で完了扱い。現在は LIMIT=5000 の bump で暫定凌ぎだが、テーブルあたり 5000 行を超えるとまた同じ truncate が再発する構造的バグ。
**手順**: Worker 側に `nextSince` cursor を含めて返すよう改修 → client で `while has_more { fetch_changes(since=nextSince) ... }` ループを実装 → `last_synced_at` は全ページ完了後に確定更新
**参照**: `.claude/docs/known-issues/012-sync-changes-limit-500-truncates-large-initial-pull.md`

### Realtime Sync Phase 1 実装 — foreground 可変 polling + 変更イベント駆動 push

**対象**: `frontend/src/context/SyncContext.tsx` / DataService mutation 呼出層
**背景**: 現状 30 秒間隔 polling で往復 60 秒ラグ。「DB 共有の実感」が薄い
**手順**: Visibility API 観測 → フォアグラウンド 3-5s / 非アクティブ 60s、主要 mutation 後に debounced `triggerSync()`
**参照**: `.claude/docs/vision/realtime-sync.md` Phase 1

### Mobile Settings に Full Re-sync ボタン追加

**対象**: `frontend/src/components/Mobile/MobileSettingsView.tsx::MobileSyncSection` (line 159-183)
**背景**: Desktop `SyncSettings.tsx` には `fullDownload` ボタンがあるが Mobile 側は `triggerSync` + `disconnect` の 2 ボタンのみ。初回 pull が truncate した時に「Disconnect → Reconnect」の 3 手順が必要で UX が悪い

### Desktop パッケージ版の更新

**対象**: `/Applications/Life Editor.app`
**背景**: 現在の /Applications 配下は session 前の Rust バイナリ(V63 migration / create() guard / sync_engine 特別扱いを含まない)。V63 は DB に既適用済なので実害は限定的だが、新規 Routine 作成時の (routine_id, date) UNIQUE 違反を graceful に握りつぶす guard が無い
**手順**: `cargo tauri build` → `target/release/bundle/macos/Life Editor.app` を `/Applications/` 既存と置換

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### Cloud Sync データ復旧作業（タグ情報 iOS → Desktop）

**対象**: iOS / Desktop の `routine_tag_assignments` 復旧
**背景**: 008 修正コードは着地したが、Desktop の `routine_tag_assignments` は空のまま。iOS の正データを Cloud 経由で取り戻す必要あり。2026-04-22 の iOS 再接続 + Sync Now で一部は復旧している可能性、要確認

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用 + タグ復旧完了

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **Memo→Daily refactor**: 途中で中断した大規模 rename(stash@{0} 保持)。復旧に型整合作業が相当量必要
- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-22 時点)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録:

- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / memos / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Memo→Daily refactor の未完了 stash**: 現在 stash@{0} に 30+ ファイルの大規模 rename が眠っており、時間経過で復元困難化する。優先的に再開推奨
- **Desktop パッケージ版と HEAD 実装の乖離**: V63 migration は DB に適用済だが、`/Applications/Life Editor.app` の Rust バイナリは旧版。Routine 作成時のエラーパスに脆弱性が残存(稀だが発火可能)
