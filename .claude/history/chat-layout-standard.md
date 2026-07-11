# HISTORY (chat-layout-standard)

### 2026-07-11 - Layout Standard v2 共通部品（draft PR #196）

#### 概要

親計画 2026-07-11-layout-standard-v2.md の標準定義 §1〜§5 を v2 共通部品として実装（Step 3）。全 7 セクションに共通セクションヘッダー・幅切替 2 段タブ・rightSidebar トグル常設を配線し、パネルがヘッダー区切り線の下で開閉する AppShell 構造に変更した。

#### 変更点

- **SectionHeader 新設**: 左 = タイトル or タブ帯（HeaderTabs divider={false}）/ 右端 = 幅タブ → パネルトグル / 直下に全幅区切り線。v1 gutter トークンで左端整列
- **PageWidthToggle + usePageWidthPrefs 新設**: wide「広い」/ narrow「狭い」（lucide UnfoldHorizontal / FoldHorizontal・radiogroup）。localStorage 1 キーの scope→mode マップでセクション単位永続化（materials はサブタブ単位暫定 — outbox で materials-refine へ調整打診）
- **AppShell**: `header` スロット新設。wide を「サイドバー | (ヘッダー行 → main+RightSidebar 行)」の縦積みへ構造変更（§4）。narrow は不変（mobile non-goal）
- **sections.ts**: `rightSidebar` フラグ + SECTION_HAS_RIGHT_SIDEBAR 廃止（トグル全セクション常設・analytics/trash は共有 empty state がプレースホルダー）→ `defaultPageWidth` + SECTION_DEFAULT_PAGE_WIDTH に置換（§5 初期値表の runtime SSOT）
- **PageContainer**: `full` variant 追加（document 面の wide = gutter 付き全幅・スクロール維持）
- **MainScreen**: 標準ヘッダー配線・旧 sectionToolbar/materialsTabSwitcher の wide 分を撤去（mobile 行は維持）・幅タブ → PageContainer マッピング（narrow=reading / wide=fluid or full）
- **i18n**: layout.width / widthWide / widthNarrow を en/ja 両 catalog に追加
- **検証**: shared tsc -b + 781 tests PASS / web build PASS / playwright 7 セクション smoke PASS（console 0・パネル開閉前後でコントロール座標完全一致・push 実測 1530↔1210・永続化リロード実測）。所見 2 件（settings 内部 max-w cap・settings/trash タイトル二重）は adoption 領分として outbox 連絡済み

### 2026-07-11 - Layout Standard v1 共通部品（Issue #180）

#### 概要

全画面のタブ帯・コンテンツ幅・gutter を統一する共通部品を実装（計画書 2026-07-10-layout-unification-fanout.md Step 4）。幅と余白の所有者を新設 PageContainer に一元化し、AppShell の一律 max-w-3xl 枠と fluid 二値スイッチを廃止した。

#### 変更点

- **tokens.css**: `--container-lumen-reading`(768px) / `--container-lumen-data`(1000px) / `--spacing-lumen-gutter`(16px) / `--spacing-lumen-gutter-wide`(24px) 追加（既存値変更なし）
- **PageContainer 新設**: reading/data/fluid の 3 variant + header slot（センタリング外側・全幅・標準 gutter）。tests/pageContainer.test.tsx 4 ケース
- **AppShell**: `fluidContent` prop 廃止・main を overflow-hidden 化（スクロール所有を PageContainer へ移譲）
- **MainScreen**: fluidSection スイッチ → pageWidth variant + 全セクション PageContainer 経由（Materials タブ行が fluid/非 fluid で同一左オフセットに）
- **AnalyticsView**: fluid 化 + gutter トークン化 + max-w-lumen-data（768px clamp 解消 = #182 根本対処）
- **SegmentedControl**: gap-0.5 + px-3（Day/Week/Month 連結解消 = #183 根本対処）。tests 2 ケース追記
- **ScheduleScreen**: タブ行 gutter をトークン化（root font-size 18px 環境で rem/px 単位系差 3px ズレの実測により Scope 追記の上で対応）
- **検証**: shared 755 tests PASS / web build PASS / 生成 CSS emit 確認 / 独立 headless chromium smoke（7 セクション巡回 console 0・タブ帯 x=294 全一致・data 列 1000px・セグメント gap 2.3px・narrow 4 等分割・settings 最下部スクロール到達）/ role-qa 監査 PASS
