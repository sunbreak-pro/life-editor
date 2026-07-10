# HISTORY (chat-layout-standard)

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
