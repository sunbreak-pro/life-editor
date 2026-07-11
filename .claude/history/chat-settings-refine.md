# HISTORY (chat-settings-refine)

### 2026-07-11 - #181 settings 行: SettingsScreen 二重センタリング解消（draft PR #193）

#### 概要

Layout Standard v1（#180）adoption の settings 分。SettingsScreen root の `mx-auto max-w-[768px]` を撤去し、幅・センタリング・gutter の所有を MainScreen 側の `PageContainer width="reading"` に一本化した。

#### 変更点

- **web/src/settings/SettingsScreen.tsx**: root div の `mx-auto max-w-[768px]` を除去（`--container-lumen-reading` = 768px と同値のため見た目の幅は不変）+ 冒頭コメントを PageContainer 所有の記述へ更新
- **検証**: shared build + test 768/768 pass（初回 5 件 fail は並行 worktree ビルド負荷起因のタイムアウト・再実行でクリーン）/ web build pass / role-qa 独立レビュー PASS（Blocker / Important 0）
- **PR**: draft PR #193。merge 後に #181 の settings 行チェックが残タスク
- **隣接所見（role-qa・本 PR 対象外）**: `web/src/work/WorkScreen.tsx:338` に同種の未 adoption（work-refine のレーンで PR #192 対応中）
