# MEMORY.md - タスクトラッカー

## 進行中

### ⏸️ iOS Safe Area 対応（着手日: 2026-04-17）

**対象**: `frontend/src/components/Layout/MobileLayout.tsx`
**計画書**: `.claude/feature_plans/2026-04-17-ios-safe-area.md`

- 前回: —
- 現在: Step 1-3 実装完了（header/nav/FAB に safe area padding 追加）、iOS シミュレータ確認待ち
- 次: シミュレータ確認 → FAB の mb が過剰なら除去 → 完了

### ⏸️ TitleBar ドラッグ修復 + タイトル修正（着手日: 2026-04-16）

**対象**: `frontend/src/components/Layout/TitleBar.tsx`, `frontend/src/utils/platform.ts`, `src-tauri/capabilities/default.json`

- 前回: タイトル「Life Editor」変更・トラフィックライト間隔修正・isMac検出修正・capabilities に allow-start-dragging 追加完了
- 現在: `getCurrentWindow().startDragging()` による全ヘッダー領域ドラッグ対応を実装、動作確認待ち
- 次: ユーザー動作確認 → ボタン・タブのクリック動作確認 → 完了

## 直近の完了

- Routine Calendar 改善（Preview Edit 修正・Tag color picker・削除カスケード・Group sort/頻度同期） ✅（2026-04-18）
- アプリ再定義ロードマップ v2 Phase A 完了（CLAUDE.md 13章統合 / ADR・rules・life-editor-v2・TODO archive 移動 / README 簡素化） ✅（2026-04-18）
- アプリ再定義ロードマップ策定（3 プラン作成: 戦略/定義書雛形/保留項目再評価） ✅（2026-04-18）

## 予定

- アプリ再定義ロードマップ v2 Phase B（全機能 Tier 1-3 要件定義 — `.claude/docs/requirements/` に 4 ファイル作成）
- アプリ再定義ロードマップ v2 Phase C（実装プラン群整理 + 保留 5 件 I-1/S-2/S-4/S-5/S-6 再評価）
