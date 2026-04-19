# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Obsidian Phase 1 フォローアップ（記法分離 `@`化 + アイコン表示 + Daily Memo→Notes 遷移 + sync fix）✅（2026-04-19） — WikiTag トリガを `#` → `@` に変更（NoteLink `[[` と明確分離）+ `WikiTag` / `NoteLink` の NodeView を「括弧/記号なし、lucide Tag/Link アイコン + 名前のみ」に刷新 + Daily Memo 内リンクのクリックで `life-editor:navigate-to-note` CustomEvent 発火 → App.tsx が Materials タブ + Notes サブタブに自動切替して該当ノートを開く + `routine_groups.version` 列欠落による Cloud Sync UPSERT 失敗を防御的 ALTER で修正（V42 世代 DB からの上位互換）。i18n en/ja 同期、cargo test 5 件 pass、Vitest 222 pass。
- TerminalPanel 直上 Tips セクション追加 ✅（2026-04-19） — Claude 起動ボタン直上に activeSection 連動の折りたたみ式 Tips パネル（`components/shared/TipsPanel.tsx`）。Schedule / Work / Materials / Connect の 4 セクション × 各 4 Tips を lucide アイコン付きで表示、localStorage `TIPS_COLLAPSED` で開閉永続化、i18n en/ja 同期。analytics / settings では非表示、docsPath があれば「詳細を見る」リンクを条件表示。
- Mobile DayFlow 完了 UI / 長押し DnD / フォーム & Settings コンパクト化 ✅（2026-04-19） — `MobileDayflowBlock` 新規（color rail 6px タップで完了トグル、Task 3-state cycle、Routine / Event / Task 別の完了表現）+ `useMobileLongPressDrag` hook（450ms 長押し + 5 分スナップ + `DragPreview` 半透明ブロック + ライブ時刻ピル + navigator.vibrate）+ `MobileScheduleItemForm` を Date/Start/End 1 行 3 列 grid 化 + Settings を `MobileSettingsPrimitives` に分離してコンパクト化 + FontSize / Timer / Notifications / Trash の 4 セクション新規追加 + i18n en/ja 同期。計画書: 外部 `~/.claude/plans/mobile-task-event-routine-ui-ux-elegant-hinton.md`。Vitest 222/222 pass、tsc / eslint クリーン。

## 予定

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証
**参照**: `.claude/archive/2026-04-18-mobile-schedule-work-redesign.md` §Verification
**観点**: DayCell の chip 均等 grid / bottom sheet drag / FAB 位置アニメ / Dayflow now line / Work session pill + halo

### Known Issues Active 2 件の調査

- **004 sync_last_synced_at が保存されない** — delta sync が機能せず毎回フル push。`src-tauri/src/commands/sync_commands.rs:87` 調査
- **005 tasks.updated_at NULL on creation** — task 作成パスで updated_at を set していない根本バグ。`src-tauri/src/db/task_repository.rs` 周辺調査

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し（TaskTree 以外での効果は別途検証必要）
