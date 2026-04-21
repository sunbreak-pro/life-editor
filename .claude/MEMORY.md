# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Notes 表示整合性の統合修正 Part B（マルチインスタンス DB 同期）（着手日: 2026-04-21）

**対象**: `src-tauri/src/db_watcher.rs`（新規） / `frontend/src/context/SyncContext.tsx`
**計画書**: `.claude/2026-04-20-mobile-editor-schema-parity.md`

- 前回: Part A（Mobile/Desktop エディタ統合 + レスポンシブ対応）完了
- 現在: Part B 未着手
- 次: Rust 側で `life-editor.db-wal` を `notify` 監視 → `db-changed` emit / SyncContext で `db-changed` listen + ポーリング 30s → 7s

## 直近の完了

- Notes Mobile/Desktop エディタ統合 Part A（Phase A）✅（2026-04-21）— 当初案（Mobile 専用 schema-only 拡張）では Callout 等の NodeView 欠落で構造が崩れたため、Desktop の `MemoEditor` を Mobile でも直接使用する方針に切替。`useIsTouchDevice` フック（`(hover: none) and (pointer: coarse)`）を新設、`MemoEditor` の `BlockContextMenu` を `!isTouch` で条件マウント、ルート div を responsive padding（`max-w-full px-2 md:max-w-[760px] md:pl-10 md:pr-0`）に変更、両エディタに `enableContentCheck: true` + `onContentError` を追加。`MobileNoteView` / `MobileMemoView` を `LazyMemoEditor` 直接使用に差替え。旧 `MobileRichEditor.tsx` と `frontend/src/extensions/mobile/`（schema-only 8 ファイル）を削除。`useIsTouchDevice.test.ts` 新規追加（4 cases）。tsc 0 / Vitest 28 files 231 pass（+4）/ ESLint 変更行クリーン。
- Cloud Sync ブロッカー 3 件解消（Known Issues 004 / 005 / 008）✅（2026-04-20） — 004 は `sync_commands.rs` に empty-timestamp 防御ガード、005 は V62 migration で 10 versioned テーブルの NULL updated*at backfill + tasks INSERT トリガー追加 + fresh DB でも V62 が走るよう runner 修正、008 は 3 箇所の `set_tags_for*\*`(routine/group/schedule_item) に親`updated_at + version`bump を追加 +`shouldCreateRoutineItem`のタグ必須フィルタを削除して fail-safe 化。根本原因: relation テーブルの delta sync が親 updated_at に依存していたが親を bump していなかったため、タグ付け替えが sync に乗らず Desktop の routine_tag_assignments が空に →`ensureRoutineItemsForDateRange` が未来の schedule_items を削除。cargo test 10 pass / Vitest 227 pass / tsc 0。Known Issues INDEX 更新、CLAUDE.md の DB version を v60 → v62 に更新。
- iOS 4G 同期準備：Xcode 署名状態検証 ✅（2026-04-20） — codesign で既存 `.ipa` / `.xcarchive` を検証し、Bundle ID `com.lifeEditor.app.newlife` / Team `542QHWHN37` / Provisioning Profile（期限 2026/04/25）が完全一致することを確認。`project.yml` には Known Issue 007 対策の `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE` が既に設定済みのため再生成しても安全。

## 予定

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること、Touch デバイスで BubbleToolbar / Suggestion menu が動作すること、BlockContextMenu が非表示であること

### Cloud Sync データ復旧作業（タグ情報 iOS → Desktop）

**対象**: iOS / Desktop の Settings → Full Re-sync 実行
**背景**: 008 修正コードは着地したが、Desktop の `routine_tag_assignments` は空のまま。iOS の正データを Cloud 経由で取り戻す必要あり
**手順**: iOS で Full Re-sync → Desktop アプリ再起動（V62 migration 適用）→ Desktop で Full Re-sync → `sqlite3 ... "SELECT COUNT(*) FROM routine_tag_assignments;"` で復旧確認

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用 + タグ復旧完了
**手順**: Release build を Xcode 実機 Run → USB を外す → Wi-Fi OFF / 4G のみで Notes / Routine / Task の双方向 sync 確認

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証
**参照**: `.claude/archive/2026-04-18-mobile-schedule-work-redesign.md` §Verification
**観点**: DayCell の chip 均等 grid / bottom sheet drag / FAB 位置アニメ / Dayflow now line / Work session pill + halo

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し（TaskTree 以外での効果は別途検証必要）
