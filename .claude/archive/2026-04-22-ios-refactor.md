# Plan: iOS Refactor — Sync 反映復旧 + Mobile\*View Provider 統一 + 重複排除

> Status: DRAFT (2026-04-22)
> Project: life-editor
> Companion plan: [`2026-04-22-memos-to-daily-rename.md`](./2026-04-22-memos-to-daily-rename.md)（独立 PR / 並行実施可）
> Related vision: [`vision/mobile-data-parity.md`](../mobile-data-parity.md) / [`vision/mobile-porting.md`](../mobile-porting.md) / [`vision/ios-everywhere-sync.md`](../ios-everywhere-sync.md)

---

## 0. Context

### なぜ今やるか

- Phase B mobile-data-parity は 2026-04-22 に実装が **全てロールバック**されて paused 状態（commit `43eedf8`）
- ロールバック理由: iOS 実機で Desktop 側の変更が同期されない不具合が **コード修正後も再ビルド後も解消せず**、Provider 統一を land させる土台が壊れていた
- その間に投入された Rust 側 sync 修正（`helpers.rs` / `note_repository.rs` / `schedule_item_repository.rs`）も巻き添えで消えたまま
- 結果、`MobileCalendarView` / `MobileMemoView` は現在も `getDataService()` 直叩きで Provider 経由になっていない → Single Source of Truth 違反が継続
- iOS 固有の pitfall（XcodeGen drift / PATH / GUI ⌘R）は既に対応済みで `known-issues/` と memory に記録

### 目的

- **Phase 1**: iOS sync 反映不具合の root cause を特定し、既知の 3 関数への versioning 修正を安全に land させる
- **Phase 2**: Phase B の Provider 統一を再適用（MobileCalendarView / MobileMemoView）
- **Phase 3**: MobileNoteView と NotesView の重複ロジックを shared hook / shared component に抽出
- **Non-Goals**: Desktop 機能変更 / Memos→Daily rename（別プラン） / iOS ビルド CI 自動化 / Analytics や Paper Boards

### 前提（調査済み事実）

- Optional hook 6 個は全て実装済み（`useAudioContextOptional` / `useScreenLockContextOptional` / `useFileExplorerContextOptional` / `useCalendarTagsContextOptional` / `useWikiTagsOptional` / `useShortcutConfigOptional`）
- `frontend/src/components/shared/` および `Schedule/shared/` に required hook 呼びの漏れは現状なし
- `main.tsx` の Provider ネスト順は Desktop / Mobile で正しく分岐
- Mobile components は `frontend/src/components/Mobile/` 配下に集約（`mobile/` 別 dir なし）
- 現行 DB は V63（`migrations.rs:1937`）

---

## 1. Phase 1: iOS Sync 反映不具合の Root Cause 特定

### 1.1 仮説リスト（調査優先順）

| #   | 仮説                                                                              | 検証手段                                                                   |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| H1  | `last_synced_at` が秒単位精度でミリ秒更新を取りこぼす                             | D1 ログで同一秒内の更新を grep、`sync_engine` の境界条件テスト             |
| H2  | `collect_local_changes` の payload 組み立てで特定 ID がスキップされている         | Cloud Worker log に「どの ID を push したか」を一時的に verbose 出力し比較 |
| H3  | `upsert_versioned` の version 比較ブランチで stale data が wins している          | `version` / `updated_at` の組み合わせを手元で再現 → トレース               |
| H4  | D1 に古い重複行（Known Issue #011 の残骸等）が残って pull 時の整合性を壊す        | `cloud/` に SELECT スクリプトで点検、(routine_id, date) 系の重複掃除       |
| H5  | iOS 側 Tauri IPC で `serde` がカラムの NULL を落とす（Known Issue #005 系の再発） | iOS 実機 console log と `tsc --noEmit` + Rust 側 struct 一致確認           |

### 1.2 具体手順

- [ ] Cloud Worker (`cloud/src/routes/sync.ts`) に **一時的な** verbose log を追加（push/pull 対象 ID を全件列挙）→ iOS 実機で再現試行
- [ ] Desktop → Cloud 側の `/sync/full` 直後に D1 を直接 SELECT で検査（ローカルテーブルと diff）
- [ ] iOS → Cloud 側も同様に検査（push に乗っていない / pull で取得できていない ID を特定）
- [ ] `sync_engine` の `upsert_versioned` にデバッグ log を入れ、`version` と `updated_at` の決定木を記録
- [ ] 原因を `docs/known-issues/NNN-ios-sync-reflection-miss.md` に Active で起票
- [ ] verbose log を revert（本 PR に含めない）

### 1.3 完了条件

- Root cause が Known Issue として起票される
- 修正パッチが `src-tauri/src/sync/` または `cloud/src/routes/sync.ts` にローカル検証済みで存在（Phase 2 で他の修正と同時に land）

---

## 2. Phase 2: Rust 側 Sync 修正の再適用

> Phase B で実装済み・ロールバック済みの 3 修正を、Phase 1 の修正と同一 PR で再 land する。

### 2.1 修正対象

| File                                                    | 関数                         | 修正内容                                                   |
| ------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `src-tauri/src/db/helpers.rs`                           | `soft_delete_by_key` (L49-)  | `version = version + 1, updated_at = ?` を UPDATE 句に追加 |
| `src-tauri/src/db/helpers.rs`                           | `restore_by_key`             | 同上                                                       |
| `src-tauri/src/db/note_repository.rs`                   | `sync_tree` (L138-)          | children 更新時に `version++` + `updated_at` bump          |
| `src-tauri/src/db/schedule_item_repository.rs`          | `fetch_by_date_range` (L75-) | `WHERE is_dismissed = 0` 条件追加（Desktop と揃える）      |
| `src-tauri/src/sync/` または `cloud/src/routes/sync.ts` | Phase 1 で特定した箇所       | Phase 1 成果物                                             |

### 2.2 検証

- [ ] `cargo test --lib` 全通過
- [ ] `cargo build --release`
- [ ] Desktop で Memo / Note soft delete → restore → Cloud sync → iOS で反映確認
- [ ] iOS から新規作成 → Desktop で反映確認
- [ ] 既存 known-issues を update（#010 的な観測メモがあれば Fixed へ）

---

## 3. Phase 3: Mobile\*View の Provider 経由化

### 3.1 対象コンポーネント

| Component                                              | 現状                                        | 修正後                                                                       |
| ------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `components/Mobile/MobileCalendarView.tsx` (771 lines) | `ds.fetchScheduleItemsByDateRange()` 直叩き | `useScheduleItemsContext()` + `useTaskTreeContext()` 使用                    |
| `components/Mobile/MobileMemoView.tsx` (173 lines)     | `ds.fetchAllMemos()` 直叩き                 | `useMemoContext()` 経由（※ Memos→Daily rename 完了後は `useDailyContext()`） |
| `components/Mobile/schedule/DayflowGrid.tsx` 等配下    | 要調査（shared 化の余地）                   | Phase 4 候補                                                                 |

### 3.2 注意点

- **Memos→Daily rename プランとの順序依存**: 本 Plan と rename Plan は独立に進めるが、`MobileMemoView` の Provider 化は **rename 完了後に実施**するのが安全（rename が先行すればそのまま `useDailyContext()` を使う形で 1 回の修正で済む）
- CLAUDE.md §6.4「DataService 依存はコールバックで注入（フック内で直接 `getDataService()` を呼ばない）」を遵守
- Mobile 専用ロジックは Mobile\*View 側に残し、Provider 経由で state のみ取る

### 3.3 検証

- [ ] `npm run build` (frontend) 通過
- [ ] `npx vitest run` 通過
- [ ] iOS 実機で: Desktop からスケジュール追加 → iOS 画面に即時反映（Provider の購読が効いているか）
- [ ] iOS 実機で: Desktop から Memo 編集 → iOS 画面に即時反映

---

## 4. Phase 4: MobileNoteView と NotesView の重複抽出

### 4.1 対象

- `components/Mobile/MobileNoteView.tsx` (513 lines) と `components/Ideas/NotesView.tsx` が
  - Note tree 描画
  - Password dialog
  - Search ロジック
  - Edit lock 処理
    を別々に実装している

### 4.2 抽出先

| 抽出先                                                  | 抽出するロジック                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `frontend/src/hooks/useNoteTreeSearch.ts`               | 検索 / フィルタリング state                                           |
| `frontend/src/components/shared/NotePasswordDialog.tsx` | 既存なら再利用、なければ抽出                                          |
| `frontend/src/components/shared/NoteEditLockToggle.tsx` | edit lock ボタン + 確認モーダル                                       |
| `frontend/src/components/Notes/NoteEditor.tsx`（仮）    | TipTap 本体 + 共通ツールバー（Desktop/Mobile が layout だけ差し替え） |

### 4.3 設計規約遵守

- CLAUDE.md §6.4「i18n テキストは props 経由（コンポーネント内で `useTranslation()` を呼ばない）」
- 「ジェネリクスでエンティティ型を外部化」「DataService 依存はコールバックで注入」
- Tailwind `notion-*` デザイントークンのみ使用

### 4.4 検証

- [ ] vitest 通過
- [ ] Desktop: Note 作成 / 編集 / 削除 / Password ロック 全操作
- [ ] iOS: 同上（layout 差分があっても機能一致）

---

## 5. 改修対象ファイル一覧

| File                                                        | Operation           | Phase         | Notes                                                                      |
| ----------------------------------------------------------- | ------------------- | ------------- | -------------------------------------------------------------------------- |
| `cloud/src/routes/sync.ts`                                  | Modify              | 1             | verbose log 一時追加 → 原因修正後 revert                                   |
| `src-tauri/src/db/helpers.rs`                               | Modify              | 2             | `version++` + `updated_at` bump                                            |
| `src-tauri/src/db/note_repository.rs`                       | Modify              | 2             | `sync_tree` versioning                                                     |
| `src-tauri/src/db/schedule_item_repository.rs`              | Modify              | 2             | `is_dismissed = 0` フィルタ                                                |
| `src-tauri/src/sync/sync_engine.rs`                         | Modify (contingent) | 1-2           | Phase 1 で根拠が出たら                                                     |
| `src-tauri/tests/`                                          | Add                 | 2             | soft_delete / restore / sync_tree の versioning テスト                     |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`     | Refactor            | 3             | Provider 経由化                                                            |
| `frontend/src/components/Mobile/MobileMemoView.tsx`         | Refactor            | 3 (rename 後) | Provider 経由化（rename と衝突回避）                                       |
| `frontend/src/hooks/useNoteTreeSearch.ts`                   | Create              | 4             | 抽出                                                                       |
| `frontend/src/components/shared/NotePasswordDialog.tsx`     | Create or Move      | 4             | 抽出                                                                       |
| `frontend/src/components/Notes/NoteEditor.tsx`              | Create (仮名)       | 4             | 共通化                                                                     |
| `frontend/src/components/Mobile/MobileNoteView.tsx`         | Refactor            | 4             | 抽出された hook / component 利用                                           |
| `frontend/src/components/Ideas/NotesView.tsx`               | Refactor            | 4             | 同上                                                                       |
| `.claude/docs/known-issues/NNN-ios-sync-reflection-miss.md` | Create              | 1             | Phase 1 起票                                                               |
| `.claude/docs/known-issues/INDEX.md`                        | Modify              | 1-2           | Active 追加 → Fixed 移動                                                   |
| `.claude/CLAUDE.md`                                         | Modify              | 2-3           | § Platform 機能差分マトリクスの Mobile 側補足（Memos/Note 同期対応を明記） |
| `.claude/docs/vision/mobile-data-parity.md`                 | Modify              | 3             | Phase B Done 記載 / Phase C 以降の残課題 update                            |

---

## 6. Verification

### End-to-End シナリオ（iOS 実機 + Desktop 併用）

- [ ] **Sync 反映テスト (P1 完了条件)**
  - Desktop で Memo 新規作成 → iOS で 60s 以内に表示
  - Desktop で Memo soft-delete → iOS で削除反映
  - Desktop で Note DnD 並び替え → iOS で並び順反映
  - iOS で Memo 編集 → Desktop に反映
- [ ] **Provider 統一後の購読テスト (P3 完了条件)**
  - iOS で `MobileCalendarView` 表示中に Desktop からスケジュール追加 → 画面再描画（再 fetch なしでも Provider が優先）
  - iOS で `MobileMemoView` 表示中に Desktop から Daily 編集 → 画面再描画
- [ ] **共通化テスト (P4 完了条件)**
  - Desktop NotesView の Password ロックと Mobile 側の挙動が完全一致（成功/失敗メッセージ / IME / Lock 後の読み取り権限）

### 自動テスト

- [ ] `cargo test --lib` (Rust)
- [ ] `npx vitest run` (frontend)
- [ ] `tsc -b` / `npm run build` (solution-style tsconfig のため `tsc --noEmit` は無効)

---

## 7. Rollback 計画

- Phase 1 verbose log: 原因判明後すぐ revert（同一 PR に含めない）
- Phase 2 Rust 修正: 各関数独立に revert 可。問題が出たら関数単位で git revert
- Phase 3 Provider 経由化: コンポーネント単位で revert（DataService 直叩きに戻すだけ）
- Phase 4 shared 抽出: 共通コンポーネント側の変更はコミット単位で revert 可能な粒度で分ける

---

## 8. 依存関係 / 順序

```
Phase 1 (iOS sync 原因特定)
  ↓
Phase 2 (Rust sync 修正)
  ↓
[Memos→Daily rename Plan 完了を待つ推奨]
  ↓
Phase 3 (Mobile*View Provider 統一)
  ↓
Phase 4 (MobileNoteView / NotesView 共通化)
```

- Phase 1 ↔ 2 は同一 PR 推奨（root cause と修正をセットで land）
- Phase 3 は rename Plan が先行していれば `useDailyContext()` を直接使える（工数節約）
- Phase 4 は Phase 3 と独立（並行可）

---

## 9. Known Issue / Pitfall への配慮

- **Issue #006 (bundle ID drift)**: 本プラン範囲外だが、Phase 2 の修正で DB migration が絡む場合は `app_data_dir` 分裂をまず確認する
- **Issue #012 (sync LIMIT)**: 既に 500→5000 修正済。Phase 1 の調査で初回 pull 範囲を再確認
- **Tauri iOS ビルド**: 必ず `cargo tauri ios dev --host` or `cargo tauri ios build`（Xcode ⌘R 不可）
- **Xcode PATH**: cargo/rustc/rustup が `/usr/local/bin/` に symlink 済みであることを再確認
