# HISTORY (chat-settings-refine)

### 2026-07-11 - Settings 軽量プリファレンス拡張（Issue #216）

#### 概要

Settings 機能棚卸し（Workflow で 147 候補 → 約 40 整理・ユーザーが軽量セット選択）を受け、frontend only・移行非依存の 5 設定＋共通 prefs 基盤を実装した。新 Provider を足さず既存 ThemeContext を拡張。他 worktree のセクション部品には非接触。

#### 変更点

- **shared/src/context/ThemeContext(.tsx/Value.ts)**: `themeMode`(light/dark/**system**)を SSOT 化・`theme` は matchMedia 解決の派生値に。OS 変化購読（cleanup 付き）。`fontFamily`(system/serif/mono)・`reduceMotion`(system/reduce/off)を追加し documentElement へ反映。既存 `setTheme`/`toggleTheme` は後方互換。移行は「新規は light 既定」でサプライズ回避
- **shared/src/styles/tokens.css**: reduce-motion を 3 状態対応（`:root:not([data-reduce-motion="off"])` で OS 追従を上書き可能化＋`[data-reduce-motion="reduce"]` で OS 非依存の強制減。打ち消しを kanban 限定→全体 `*` に一般化・0.001ms で transitionend 発火）
- **新規**: `hooks/useStartupSection.ts`(resolveInitialSection/persistLastSection/useStartupSectionPref) / `utils/resetPreferences.ts`(life-editor 名前空間のみ削除) / `constants/fontFamily.ts` / pure primitive `SettingsSegment`・`SettingsGeneral`・`SettingsReset`
- **web/src/MainScreen.tsx**: section state を起動時 pref から lazy init ＋ last-section 永続の 2 箇所のみ改修
- **web/src/settings/SettingsScreen.tsx**: 5 設定のカード配線・reset の confirm 所有。起動候補は MAIN_SECTIONS（trash/settings 除外）
- **i18n**: settings.* に 19 キー（en/ja 両 catalog・パリティ確認済）
- **テスト**: themeContext / useStartupSection / resetPreferences の 3 単体テスト追加
- **検証**: shared build（tsc -b）/ shared test 810 pass / web build すべて緑（メイン独立実測 2 回）。role-qa 独立レビュー PASS（Blocking 0）。指摘 2 件（SettingsSegment の矢印キー a11y・起動候補 MAIN_SECTIONS 化）は同 PR で修正・再検証済
- **分離**: 週始まり→#217（schedule-refine）・日付ロールオーバー→#218（docs-workspace）に shared-fix で切り出し（読み手が他 worktree のため）
- **表示確認**: §7.4 に従い実ブラウザ目視は PR merge 後 chat-main の playwright で

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
