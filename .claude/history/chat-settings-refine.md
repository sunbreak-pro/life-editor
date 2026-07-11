# HISTORY (chat-settings-refine)

### 2026-07-11 - Settings: Layout Standard v2 adoption（本文内タイトル行撤去・PR #211）

#### 概要

Layout Standard v2 で shell が標準 SectionHeader を持つようになったのに合わせ、SettingsScreen 本文内の自前タイトル行を撤去してタイトルを shell に一本化した。前セッションの未 commit 分（同内容）が /clear 前に消えていたためやり直した。

#### 変更点

- **web/src/settings/SettingsScreen.tsx**: 本文内の `<h1>{t("settings.title")}</h1>` + 説明文 `<div>` を撤去（外側のカード縦積みコンテナは維持）。冒頭コメントを v2 実態へ更新（タイトルは shell 所有・本文内ヘッダーなし）
- **shared/src/i18n/locales/{en,ja}.json**: 孤立キー `settings.title` / `settings.pageDescription` を除去（shell タイトルは別キー `section.settings`。frozen な `frontend/` は独自 locale を持ちビルドグラフ外で影響なし）
- **着手前**: CLAUDE.md §7.4 の二段階 pull で origin/main 取り込み（競合ゼロ）。Issue #209 起票 → 実装
- **検証**: shared build（tsc -b）/ web build（tsc -b + vite）/ eslint pass、vitest 803/803（`SupabaseDailiesUnifiedService` の `setDailyPasswordUnified` は順序依存フレーキーで本変更と無関係・別途調査要）。role-qa 独立レビュー PASS（Blocker 0・scope 越境なし）
- **PR**: #211（Closes #209, Refs #181）commit 7d3469de。実ブラウザでのタイトル二重解消・DetailPanel 開閉・全幅カード列の目視は §7.4 に従い merge 後に chat-main で実測

### 2026-07-11 - #181 settings 行: SettingsScreen 二重センタリング解消（draft PR #193）

#### 概要

Layout Standard v1（#180）adoption の settings 分。SettingsScreen root の `mx-auto max-w-[768px]` を撤去し、幅・センタリング・gutter の所有を MainScreen 側の `PageContainer width="reading"` に一本化した。

#### 変更点

- **web/src/settings/SettingsScreen.tsx**: root div の `mx-auto max-w-[768px]` を除去（`--container-lumen-reading` = 768px と同値のため見た目の幅は不変）+ 冒頭コメントを PageContainer 所有の記述へ更新
- **検証**: shared build + test 768/768 pass（初回 5 件 fail は並行 worktree ビルド負荷起因のタイムアウト・再実行でクリーン）/ web build pass / role-qa 独立レビュー PASS（Blocker / Important 0）
- **PR**: draft PR #193。merge 後に #181 の settings 行チェックが残タスク
- **隣接所見（role-qa・本 PR 対象外）**: `web/src/work/WorkScreen.tsx:338` に同種の未 adoption（work-refine のレーンで PR #192 対応中）
