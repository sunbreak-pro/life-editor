# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Tipsパネル再設計 + Terminalセクション化 + LeftSidebar コンパクト化 ✅（2026-04-19） — Tips を LeftSidebar 下部のトグルボタン + 中央エリア下部の半透明オーバーレイ（1 カラム縦スクロール）に刷新し、サブカテゴリタブで 6 セクション × 4 タブ × 6〜10 件の Tips を切替表示。Terminal は dock/resize/minimize を全削除して SectionId に `terminal` 追加 → TitleBar の Undo/Redo 左隣の Terminal アイコンから全画面セクションに切替（Cmd/Ctrl+J）し、TerminalSection を Layout に永続マウントしてセッション維持。LeftSidebar はフォント 16px 固定 + py-1.5 + space-y-0.5 でコンパクト化。Tips コンテンツは実装調査エージェント 3 並列で全面検証 → 未実装機能（タグフィルタ / 完了非表示 / プリセット / 環境音 6 種ミキサー / Cmd+F / CSV 出力 等）を削除し、わかりやすい言葉（右サイドバー / 鉛筆アイコン / ▶ ボタン 等）に統一。Analytics 専用 Tips も追加。en/ja 完全一致 (382 keys 各)、tsc / eslint（本セッション範囲）クリーン、Vitest 227 pass。計画書: 外部 `~/.claude/plans/leftsidebar-font-size-2px-rosy-beaver.md`。
- Connect Canvas UX 改善（WikiTag 軽量化 + Connect モード + Link エッジ + 矩形選択）✅（2026-04-19）
- Obsidian Phase 1 フォローアップ（記法分離 `@`化 + アイコン表示 + Daily Memo→Notes 遷移 + sync fix）✅（2026-04-19）

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
