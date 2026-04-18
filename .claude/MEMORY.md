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

- アプリ再定義ロードマップ v2 **Phase A+B+C 全完遂**（計画書: `archive/2026-04-18-integrated-design-roadmap.md`）— feature_plan 9 件 archive + 保留 5 件 Verdict 確定、ADR-0006/0007 + 新規 plan 4 件起票 ✅（2026-04-18）
- アプリ再定義ロードマップ v2 Phase B 完了（Tier 1-3 全 26 機能の要件定義記入、CLAUDE.md §11 相互リンク化）✅（2026-04-18）
- Routine Calendar 改善（Preview Edit 修正・Tag color picker・削除カスケード・Group sort/頻度同期） ✅（2026-04-18）
- アプリ再定義ロードマップ v2 Phase A 完了（CLAUDE.md 13章統合 / ADR・rules・life-editor-v2・TODO archive 移動 / README 簡素化） ✅（2026-04-18）

## 予定

### Phase C 起票の新規 plan 4 件（優先度順）

いずれも PLANNED、個別に着手可能:

1. **S-5**: `.claude/feature_plans/2026-04-18-service-error-handler-hook.md`（即時実装可、silent failure 解消）
2. **S-6 Option A**: `.claude/feature_plans/2026-04-18-context-hook-optional.md`（ADR-0007 に基づく実装、Mobile バンドル軽量化）
3. **I-1**: `.claude/feature_plans/2026-04-18-tasks-fetch-by-range.md`（計測 first、iOS 大規模タスク時の遅延対策）
4. **S-4**: `.claude/feature_plans/2026-04-18-folder-progress-batch-memo.md`（計測 first、TaskTree 再レンダ改善、React Compiler と比較）

### CLAUDE.md ビジョン素案レビュー（任意、いつでも可）

**対象**: `.claude/CLAUDE.md` §1-5 / §8.3-8.4（「素案 — ユーザーレビュー待ち」マーク付与済み）
**レビュー観点**: Core Identity / Target User / Value Propositions / Non-Goals / AI Integration シナリオ

### アプリ再定義ロードマップ v2 Phase C（推定 1-2 セッション、Phase B 完了後）

**起点ファイル**: `.claude/feature_plans/2026-04-18-integrated-design-roadmap.md` の「次セッション開始ガイド」§Step 3-B
**準備済みデータ**: 既存 PLANNED 11 件の git log 集計表 + 保留 5 件 (I-1/S-2/S-4/S-5/S-6) の暫定 Verdict 表
**最初のアクション**: 事前データ表をベースに 019-022（3 ヶ月放置 → Drop 推奨）から確定 → archive 移動

### CLAUDE.md ビジョン素案レビュー（任意、いつでも可）

**対象**: `.claude/CLAUDE.md` §1-5 / §8.3-8.4（「素案 — ユーザーレビュー待ち」マーク付与済み）
**レビュー観点**: Core Identity / Target User / Value Propositions / Non-Goals / AI Integration シナリオ
