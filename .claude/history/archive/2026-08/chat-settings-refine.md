# HISTORY ARCHIVE (chat-settings-refine)

### 2026-08-15 - テーマ切替カードの light / dark が区別できない不具合修正（Issue #887 / PR #905）

#### 概要

Settings のテーマ切替カード 3 枚（ライト / ダーク / システム）が同じ見た目で、選択中のモードを色から読み取れなかった。原因は色の値ではなく `lumen-*` 別名の**解決タイミング**。Tailwind は `@theme` の別名（`--color-lumen-bg: var(--color-bg-primary)`）を `:root` に出力するが、CSS カスタムプロパティの `var()` は**宣言された要素**で置換されるため、別名は root のテーマ色で確定し子孫はその確定値を継承する。カードの `data-theme` サブツリーは下敷きの `--color-*` を切り替えていたが、実際に塗りに使う `lumen-*` 側は解決済みだった（`data-theme` スコープ自体は正しく、ミニチュア設計も正しかった）。

#### 変更点

- **shared/src/styles/tokens.css**: 裸の `[data-theme]` 属性セレクタで `lumen-*` 別名を再宣言するブロックを追加（light / dark の両方に当たるので、各宣言はその要素でスコープに入っている `--color-*` を見て解決される）。レイヤー外に置いたので Tailwind が `@layer theme` の `:root` に出す同名定義にも勝つ。列挙はネストしたテーマで塗る 6 トークンのみ・全て `var()` 経由で色値のコピーはゼロ
- **shared/src/components/ThemePreviewCard.tsx**: ラベル左に lucide の昼/夜グリフ（`Sun` / `Moon` / `SunMoon`）を 14px で追加し、色以外の手がかりを一本持たせた（絵文字は不可 = Issue 明記）。ラベルは `min-w-0` で 3 列モバイルグリッドでも折り返せるように
- **ビルド後 CSS で実証**: `[data-theme]{--color-lumen-bg:var(--color-bg-primary);…}` が `@layer` の外に出力され、`.bg-lumen-bg{background-color:var(--color-lumen-bg)}` が使用箇所で引く形になっていることを `web/dist` の生成物で確認
- **テスト**: `shared/tests/tokensNestedTheme.test.ts` 新規（別名ブロックを落とすと無言で元の症状に戻るため tokens.css の宣言を固定。色値コピーの混入も検出）・`shared/tests/themePreviewCard.test.tsx` に 3 枚のグリフ差分とミニチュアの固定テーマ検査を追加
- **docs**: `.claude/rules/frontend.md` のデザイン規約に落とし穴を 1 行追加（`lumen-*` はネストした `data-theme` に追随しない／部分テーマで使うトークンは別名ブロックに足す）
- **検証**: shared lint 0 errors / `tsc -b` OK / 2152 tests pass、web lint 0 errors / build OK / 394 tests pass、`scripts/docs-lint.sh` OK。実ブラウザ確認は §7.4 に従い merge 後 chat-main 側
- **worktree**: 本レーンの worktree が `workspaces/life-editor/workspaces/life-editor/settings-refine` と二重ネストしている（過去の相対パス作成の名残）。リポジトリ**外**なので Orca の除外条件には当たらず実害はパス長のみと判断し、作り直さず作業した

### 2026-07-11 - Settings フォント種別が本文に効かない不具合修正（Issue #228 / PR #233）

#### 概要

Settings → Appearance → Font で Serif/Monospace を選んでも本文の書体が変わらない不具合を修正。ThemeContext は選択フォントを `document.documentElement.style.fontFamily`（`<html>`）に書き、継承で本文に届ける設計だが、`web/src/index.css` が `body { font-family: var(--font-sans) }` を body に直接当てていて継承値を毎回上書きしていたのが原因。CSS 1 ファイルのみで修正（ThemeContext は無変更）。

#### 変更点

- **web/src/index.css**: `font-family: var(--font-sans)` を body から外し、新設 `html { font-family: var(--font-sans) }` へ移設。body は継承のみ（margin/bg/color/min-height 維持）。system は inline を `""` で消去し `html` ルールへフォールバック
- **カスケード実測（独立 QA・ビルド済み CSS）**: 未レイヤーの html ルールは Tailwind v4 `@layer base` preflight に勝つ（二重に堅牢で preflight の `--default-font-family` も `var(--font-sans)` 解決）。`<html>` inline style は最優先。form 要素は preflight `font:inherit` で継承鎖に乗る。`code`/`pre` は preflight monospace 明示で Serif 選択時も等幅維持 → 本文だけ書体が変わる（#228 意図どおり）
- **検証**: `cd web && npm run build` exit 0 / `cd shared && npm run test` 845 pass（`themeContext.test.tsx` の font-family アサーション含む・ThemeContext 無変更で緑）。role-qa 独立レビュー PASS（Blocker 0・scope 越境なし）
- **PR**: #233（Closes #228）commit f9ccb3e3。実ブラウザ `getComputedStyle(document.body).fontFamily` の最終実測は §7.4 に従い merge 後に chat-main の playwright で
- **#181 [all] layout-standard**: settings 行は既に main で対応済み（commit 7c4c3723 / PR #193・MainScreen PageContainer が幅所有・`web/src/settings` にローカル max-w なし）を確認 → Issue の settings チェックボックスを ✅ 化＋根拠コメント投稿。close は chat-main に委譲（全行消化待ち）

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
