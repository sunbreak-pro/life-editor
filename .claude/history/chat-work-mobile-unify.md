# HISTORY (chat-work-mobile-unify)

### 2026-06-06 - Phase 1 Work Mobile 基準デザイン統一（実装完了・PR 待ち）

#### 概要

Work セクションを WorkView variant アーキテクチャに統一（Mobile を正・Desktop を寄せる）。実装 Step 1-7 完了、検証全緑 + role-qa 独立 PASS。Step 8（PR/merge）は人手ゲート待ちで未コミット。

#### 変更点

- **共有抽出**: `Work/view/` に TimerComponents / folderPath / WorkTaskSelector / SessionCompletionSheet を verbatim 抽出
- **統一 View**: `Work/WorkView.tsx` 新設（`variant: mobile|desktop`）。timer 列共有、task area とクロムのみ variant 分岐
- **配線**: MobileApp → `WorkView variant=mobile`、App → `WorkView variant=desktop`、`MobileWorkView`/`WorkScreen` 削除、barrel 更新
- **掃除**: `WorkSidebarInfo` の Now Playing(audio依存) 削除、`WorkHistoryContent`/`WorkMusicContent` + 孤児 `Mobile/work/*`(4) 削除
- **i18n**: 意図的に未変更（ユーザー判断「1px厳守」。fallback 依存解消は別 PR）
- **検証**: `npm run build` exit 0 / 変更9ファイル lint クリーン（既存ベースライン97問題は対象外）/ vitest 534緑 / role-qa PASS（Mobile デグレ0 を機械 diff で確証・二重モーダル回避確認）
