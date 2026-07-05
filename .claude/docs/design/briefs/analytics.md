---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Section: analytics
Owner-chat: design-analytics-v2
Branch: claude/design-analytics-v2
---

# Design Brief: Analytics（分析ダッシュボード）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> §4 のプロンプト本文は自己完結（リポジトリパス・内部参照なし）。

## 1. 画面要件ダイジェスト

- **目的 / 主ユースケース**: タスク・作業時間（ポモドーロ）・スケジュールの記録を横断して振り返る**閲覧専用ダッシュボード**。Tier 3・凍結継続で、将来は Claude 駆動分析（`reflect_on_day` / `analyze_patterns`）の出力を表示する面として再利用する想定（`.claude/docs/requirements/tier-3-experimental.md:39-62`）
- **表示するデータ**: mount 時に一括 fetch する 8 系統 — タイマーセッション / タスクツリー / 今日のスケジュール / ルーチン / ノート / タグ数 / タグ割当数 / ポモドーロ日次目標（`web/src/analytics/AnalyticsScreen.tsx:85-94`）。スケジュールタブのみ選択範囲ごとに別 fetch（同 `:131-155`）。N=1 個人データの規模感: タスク 100〜200 件・セッション 1 日 2〜8 件・ルーチン 10 件前後・予定 30 日で 60 件前後
- **主要操作**: 閲覧のみ。タブ切替（4 種）/ 期間切替（day / week / month、`shared/src/components/Analytics/PeriodSelector.tsx:15`）/ スケジュール集計範囲の変更。作成・編集・削除は一切ない純 Consumption 画面
- **Desktop / Mobile の責務分割**: Desktop = 4 タブ全機能。Mobile = Consumption 専用の単一スクロール（今日のダッシュボード + 主要カード縦積み）。**落とすもの: タブ UI・ヒートマップ・デイリータイムライン・停滞チャート・時間帯分布・期間セレクタ・タスク別/プロジェクト別の長いチャート**（詳細 §4.2）

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/analytics/AnalyticsScreen.tsx:70-308`（fetch + `AnalyticsLabels` 注入。shared 側は純プレゼンテーション）
- **shared 部品**: `shared/src/components/Analytics/`（ルート `AnalyticsView.tsx` + タブ 4 + チャート/カード部品 約 15）
  - ルート: 左にタイトル・右上にタブピル 4 種（overview / tasks / work / schedule、`AnalyticsView.tsx:27-34, 99-121`）。コンテンツは max-w-3xl（768px）中央寄せの 1 カラム縦積み
  - 概要タブ: stat カード 6 枚グリッド（2→3 列、`OverviewTab.tsx:140-183`）+ 今日のダッシュボード 3 ミニカード（`TodayDashboard.tsx:52-78`）+ 週間サマリー + ストリーク 2 カード（`StreakDisplay.tsx:38-61`）
  - タスクタブ: 完了トレンド 30 日 + 停滞チャート + プロジェクト別作業時間（`TasksTab.tsx:34-42`）
  - 作業タブ: stat カード 3 枚 + PeriodSelector + 作業時間棒グラフ + ヒートマップ（24h×7 曜日、`WorkTimeHeatmap.tsx:70-121`）+ ポモドーロ達成率 + 作業/休憩バランス + デイリータイムライン + タスク別作業時間（`TimeTab.tsx:79-150`）
  - スケジュールタブ: stat カード 5 枚 + イベント完了トレンド + 時間帯分布 + ルーチン達成率（`ScheduleTab.tsx:128-174`）
- **特徴的 UI**: recharts のチャート群（棒 / ドーナツ / 横棒等 10 ファイル）。**カテゴリ 10 色 `--color-chart-cat-1..10` はテーマ固定**（`shared/src/styles/tokens.css:114-123`、使用例 `ProjectWorkTimeChart.tsx:29-40`）。ヒートマップは CSS grid 自作で緑 4 段の rgba 直書き（`WorkTimeHeatmap.tsx:36-44`）
- **状態の現状**:
  - empty: 作業タブ = noSessions テキスト 1 行（`TimeTab.tsx:69-77`）/ スケジュールタブ = noEvents テキスト 1 行（`ScheduleTab.tsx:110-118`）
  - loading: スケジュールタブの範囲別 fetch 中のみパルス矩形 3 枚（`ScheduleTab.tsx:95-108`）。**初回 mount fetch には loading 表現がなく、データ到着まで 0 値が並ぶ**
  - error: なし（fetch 失敗は空データへ縮退、`web/src/analytics/AnalyticsScreen.tsx:119-121`）
- **現状の課題**（= プロンプトで良くしたい方向）:
  1. empty がテキスト 1 行だけで、次の行動（タイマーを回す / 予定を入れる）に誘導しない
  2. 初回ロードに skeleton がなく 0 値がフラッシュする
  3. 日付範囲プリセット（7d / 30d / 今月 / 3ヶ月 / 全期間）はロジックだけ存在し UI 未接続 — スケジュール集計は実質 30 日固定（`AnalyticsFilterContext.tsx:28-63, 98-100` に `applyPreset` があるが呼ぶ UI がない）
  4. stat カードのアイコン色に `text-purple-500` / `text-orange-500` / `text-yellow-500` などトークン外の Tailwind 既定色が混在し、色に意味体系がない（`OverviewTab.tsx:159-181`）
  5. カード面の扱いが不統一 — 作業時間チャートはカード化（`WorkTimeChart.tsx:68`）だが、ヒートマップ・ストリーク等は見出し + 地に直置き
  6. ヒートマップの緑 4 段に凡例がなく濃淡の意味が読めない。色もカテゴリ 10 色と別系統の rgba 直書き
  7. コンテンツ幅 768px 固定の 1 カラムのため、1440px では左右が余りすぎて情報密度が低い

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: 4 タブ構成とタブ内の情報順序（stat カード → チャート群）/ 期間切替ピルの意匠 / チャートのカテゴリ 10 色符号化 / ストリークの炎・トロフィーのモチーフ
- **変える意匠**: 全チャートを「ChartCard」（タイトル + 凡例 + 本体のカード面）で統一 / empty・loading を設計された状態にする（誘導文・skeleton）/ アイコン色を accent・mint・semantic の意味体系に整理 / 期間プリセットをヘッダーの UI に昇格 / Desktop はチャート 2 カラムグリッドで密度を上げる / header タブを現状のタブピル（accent 塗り）から shell brief 定義の標準（2px accent 下線式）へ統一
- **使う既存部品**: Card / Button（ピル）/ Sidebar シェル / Mobile の BottomSheet（もし期間選択を Mobile に残すなら。既定は落とす）
- **新規に必要な部品候補**（列挙のみ・実装しない）: ChartCard（見出し + 凡例スロット付きカード）/ EmptyState（アイコン + 説明 + 誘導文）/ DateRangePresetSelector / AnalyticsStatCard の意匠更新版

## 4. ClaudeDesign プロンプト

> 冒頭の共通前提ブロックは `_COMMON-CONTEXT.md`（**v2 / 2026-07-05**）の水平線以降の全文コピー（改変・要約なし）。

### 4.1 Desktop 用

```text
## Life Editor — デザイン共通前提（全画面共通・v2 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承

### ブランドパレット — Lumen（Cobalt Ink + Mint 系譜）

ほぼモノクロのコバルトグレー neutrals + Lumen blue の主アクセント + ライトミントの差し色。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                         | Light                 | Dark                  |
| -------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                     | `#fafafa`             | `#16161a`             |
| bg-secondary                                 | `#f1f1f3`             | `#1e1e23`             |
| bg-subsidebar（サイドバー地）                | `#f5f5f6`             | `#1e1e23`             |
| surface-sunken（沈んだ面）                   | `#ececef`             | `#101013`             |
| text-primary                                 | `#1a1a1f`             | `#f2f2f5`             |
| text-secondary                               | `#5c5c66`             | `#a0a0ad`             |
| text-tertiary                                | `#767680`             | `#74747e`             |
| border                                       | `#e3e3e7`             | `#2e2e35`             |
| border-strong                                | `#cfcfd6`             | `#44444d`             |
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                 | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                 | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）             | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                          | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）             | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                            | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                      | `#0f7b6c`             | `#4dab9a`             |
| danger                                       | `#d92d20`             | `#ef4444`             |
| info                                         | `#2563eb`             | `#60a5fa`             |
| warning                                      | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ: task = Lumen blue 系（bg `#dbeafe` fg `#1e40af`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
- グラフ カテゴリ 10 色: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`
- スケジュールブロック地: routine `#ebf0fe` / event `#f3e8ff`（border `#8b5cf6`）/ その他 `#f1f2f4`

### 形・余白・文字

- フォント: システムフォントスタック（-apple-system / Segoe UI 等）。ベース 16px。サイズ段階は xs / sm / base / lg / xl の 5 段
- 角丸: 6 / 8 / 12 / 16 px + 完全円。余白: 4px 基調のスケール（4 / 8 / 12 / 16 / 20 / 24）
- 影: elevation 3 段（sm / md / lg）。控えめに。フラット寄りの Notion ライクな密度感

### 守るべきルール（不変式）

1. **上記パレットの色のみ使用**。新しい hex を発明しない（必要なら「トークン追加の提案」として明記する）
2. **主要コンテナ（カード / メニュー / ダイアログ / パネル / ポップオーバー）の背景は完全不透明**。backdrop-blur 不使用。モーダル背後の黒 30% バックドロップだけ許容
3. **light / dark 両テーマを必ず作る**。dark は pure black ではなく `#16161a`。light は pure white ではなく `#fafafa`
4. 本文テキストのコントラストは **WCAG AA（4.5:1）以上**
5. **状態を色だけで伝えない**（ラベル・形・バンドを併用）
6. **テキストは日本語の現実的なサンプルで組む**（英語より 1.2〜1.5 倍の幅を想定。UI は日英切替があるため極端な幅依存レイアウトを避ける）
7. 既存部品の意匠を踏襲する: Button / Card / Sheet（ドロワー）/ BottomSheet / Menu / Toast / Sidebar / CommandPalette / Kanban カード（左端ステータスバンド 4px）/ MasterDetail（一覧+詳細の 2 枚組）は既に存在する。ゼロから発明せず、この部品語彙で組む

### 成果物フレーム（全画面共通）

- **Desktop: 1440×900**（light / dark の 2 枚。左サイドバー展開状態込み）
- **Mobile: 390×844**（light / dark の 2 枚。下部タブバー込み・safe-area 考慮）
- 各画面につき: **通常状態（データあり）+ 空状態 + ローディング**、該当があればエラー状態も

---

## この画面: 分析ダッシュボード（Desktop 1440×900）

閲覧専用の分析ダッシュボード。タスク・作業時間（ポモドーロ）・スケジュールの記録を横断して振り返る画面で、作成・編集・削除の操作は一切ない。「読む体験」に全振りし、数字が自分の生活の手応えとして気持ちよく入ってくるデザインにしたい。

### 画面骨格

- 左サイドバー展開（240px）。本流 5 セクション（Schedule / Materials / Connect / Work / Analytics）のうち「Analytics（分析）」（BarChart3 アイコン）がアクティブ。最下部にユーティリティ枠（Settings / Trash）
- メインのヘッダー行: 左にページタイトル「分析」、右に期間プリセットセレクタ（新設のコントロール。コンパクトなピル群 or ドロップダウン）: 「7日 / 30日 / 今月 / 3ヶ月 / 全期間」で「30日」選択中。集計対象期間を切り替える
- ヘッダー直下に header タブ 4 種（全画面共通の下線式タブ標準）: 「概要」「タスク」「作業」「スケジュール」。左寄せの水平タブ列・タブ間 8px・下端に border の薄い区切り線を全幅で引く。アクティブタブ = accent 色の 2px 下線（タブ幅ぴったり）+ ラベル text-primary + font-medium。非アクティブ = ラベル text-secondary・下線なし、ホバーで text-primary + hover 背景
- コンテンツ幅: 現状は中央寄せ 768px の 1 カラム縦積みで 1440px だと左右が余りすぎる。**中央寄せ最大 960〜1040px に広げ、チャートカードは 2 カラムグリッド**で情報密度を上げる提案が欲しい（stat カード列は全幅、チャートは 2 列で高さを揃える）
- **すべてのチャート・集計を「ChartCard」= タイトル + （必要なら）凡例 + 本体のカード面（bg-secondary・border・角丸 12px・完全不透明）に統一**する。現状はカードに乗った物と地に直置きの物が混在しているので、必ず全部カードに乗せる
- stat カードのアイコン色は意味体系で統一する: 作業・時間系 = accent、達成・完了系 = ミント（accent-secondary）、注意・停滞系 = warning。装飾のためのバラバラな色は使わない

### タブ 1「概要」（メインフレーム）

- stat カード 6 枚（3 列 × 2 行）。各カード = アイコン + 大きい数値 + ラベル + サブテキスト
  - 「タスク」128 — サブ「86 完了 (67%)」
  - 「今日の予定」7 — サブ「4 完了」
  - 「ノート」42 — サブ「+5 今週」
  - 「作業時間」214時間30分 — サブ「今日 3時間25分」
  - 「ルーチン」9 — サブ「達成率 78%」
  - 「タグ」31 — サブ「120 割当」
- 「今日」カード: 作業時間 3時間25分 / 完了タスク 5 / ポモドーロ 6 の 3 分割ミニ統計
- 「今週のサマリー」カード: 作業時間 18時間40分・セッション 32・完了タスク 23
- 「作業ストリーク」カード: 現在 12 日連続（炎アイコン）/ 最長 34 日（トロフィーアイコン）

### タブ 2「タスク」

- 「タスク完了トレンド」: 直近 30 日の日別完了数の棒グラフ（0〜7 件、週末が低い波形）
- 「停滞タスク」: 最終更新からの経過期間バケット別の横棒。「1週間未満 41 / 1〜2週間 18 / 2〜4週間 9 / 1〜3ヶ月 6 / 3ヶ月以上 3」。緑→黄→赤系の 5 段グラデーションだが、**色だけに頼らずバケットラベルと件数を必ず併記**
- 「プロジェクト別作業時間」: ドーナツチャート + 凡例リスト（カテゴリ 10 色を順に使用、凡例に色チップ + 名前 + 時間を併記）。サンプル: 「Life Editor 開発 48時間 / 簿記3級の勉強 22時間30分 / ブログ執筆 9時間 / 部屋の片付け 6時間 / 読書メモ 4時間30分」

### タブ 3「作業」

- stat カード 3 枚: 「合計作業時間 214時間30分」「セッション数 512」「1日平均 2時間10分」
- 「作業時間」棒グラフ + 期間切替ピル「日 / 週 / 月」（「日」選択中）。直近 14 日、1 日 0〜6.5 時間の棒。棒色は accent
- 「作業ヒートマップ」: 横 24 時間 × 縦 月〜日 のグリッド。平日の 8〜10 時と 21〜23 時が濃い。**濃淡 4 段の凡例（「少ない → 多い」のスケール表示）を必ず添える**。ホバーで「84 分」のようなツールチップ
- 「ポモドーロ達成率」: 日別の実績セッション数 vs 目標 8 回/日
- 「作業と休憩のバランス」: 作業 82% / 休憩 15% / 長い休憩 3%
- 「今日のタイムライン」: 1 日の帯（8:00〜24:00）に作業 / 休憩ブロックを配置（例: 08:30〜09:25 作業 → 5 分休憩 → 09:30〜10:25 作業、夜 21:00〜23:00 に 2 セッション）
- 「タスク別作業時間」: 横棒 上位 8 件。サンプルタスク名: 「確定申告の書類を集める 12時間30分」「引っ越し見積もりを比較する 8時間15分」「週次レビューを書く 6時間40分」「簿記3級の過去問を解く 5時間20分」「ブログの下書きを仕上げる 4時間10分」
- カードが 7 枚と多いタブなので、2 カラムグリッドでの整理の見せ場にする

### タブ 4「スケジュール」

- stat カード 5 枚: 「予定 64」「完了 51」「完了率 80%」「アクティブなルーチン 9」「ルーチン達成率 78%」
- 「イベント完了トレンド」: 直近 30 日の日別完了数の棒グラフ
- 「時間帯分布」: 予定の開始時刻の分布（7〜9 時と 19〜22 時にピークの棒グラフ）
- 「ルーチン別達成率」: 横棒 + % ラベル。「皿洗い 96% / 朝のストレッチ 92% / 日記を書く 85% / 英単語 20 分 71% / 筋トレ 60%」

### 状態バリエーション

- 空状態（作業タブで表現）: アイコン + 見出し「まだ作業セッションがありません」+ 誘導文「Work のタイマーで最初のポモドーロを始めると、ここに分析が表示されます」。テキスト 1 行だけの寂しい空にしない
- ローディング（初回・概要タブで表現）: stat カード枠 + チャートカード枠の skeleton パルス（レイアウトが確定して見えること）
- ローディング（期間切替・スケジュールタブで表現）: stat カード 3 枚分のパルス。チャート領域は骨格を保つ
- エラー状態は不要（データ欠損は空表示に縮退する仕様）

### フレーム一覧（各 1440×900）

1. 概要タブ light / 2. 概要タブ dark / 3. タスクタブ light / 4. タスクタブ dark / 5. 作業タブ light / 6. 作業タブ dark / 7. スケジュールタブ light / 8. スケジュールタブ dark / 9. 空状態（作業タブ・light）/ 10. 初回ローディング（概要タブ・light）/ 11. 期間切替ローディング（スケジュールタブ・light）
```

### 4.2 Mobile 用

```text
## Life Editor — デザイン共通前提（全画面共通・v2 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承

### ブランドパレット — Lumen（Cobalt Ink + Mint 系譜）

ほぼモノクロのコバルトグレー neutrals + Lumen blue の主アクセント + ライトミントの差し色。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                         | Light                 | Dark                  |
| -------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                     | `#fafafa`             | `#16161a`             |
| bg-secondary                                 | `#f1f1f3`             | `#1e1e23`             |
| bg-subsidebar（サイドバー地）                | `#f5f5f6`             | `#1e1e23`             |
| surface-sunken（沈んだ面）                   | `#ececef`             | `#101013`             |
| text-primary                                 | `#1a1a1f`             | `#f2f2f5`             |
| text-secondary                               | `#5c5c66`             | `#a0a0ad`             |
| text-tertiary                                | `#767680`             | `#74747e`             |
| border                                       | `#e3e3e7`             | `#2e2e35`             |
| border-strong                                | `#cfcfd6`             | `#44444d`             |
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                 | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                 | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）             | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                          | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）             | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                            | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                      | `#0f7b6c`             | `#4dab9a`             |
| danger                                       | `#d92d20`             | `#ef4444`             |
| info                                         | `#2563eb`             | `#60a5fa`             |
| warning                                      | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ: task = Lumen blue 系（bg `#dbeafe` fg `#1e40af`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
- グラフ カテゴリ 10 色: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`
- スケジュールブロック地: routine `#ebf0fe` / event `#f3e8ff`（border `#8b5cf6`）/ その他 `#f1f2f4`

### 形・余白・文字

- フォント: システムフォントスタック（-apple-system / Segoe UI 等）。ベース 16px。サイズ段階は xs / sm / base / lg / xl の 5 段
- 角丸: 6 / 8 / 12 / 16 px + 完全円。余白: 4px 基調のスケール（4 / 8 / 12 / 16 / 20 / 24）
- 影: elevation 3 段（sm / md / lg）。控えめに。フラット寄りの Notion ライクな密度感

### 守るべきルール（不変式）

1. **上記パレットの色のみ使用**。新しい hex を発明しない（必要なら「トークン追加の提案」として明記する）
2. **主要コンテナ（カード / メニュー / ダイアログ / パネル / ポップオーバー）の背景は完全不透明**。backdrop-blur 不使用。モーダル背後の黒 30% バックドロップだけ許容
3. **light / dark 両テーマを必ず作る**。dark は pure black ではなく `#16161a`。light は pure white ではなく `#fafafa`
4. 本文テキストのコントラストは **WCAG AA（4.5:1）以上**
5. **状態を色だけで伝えない**（ラベル・形・バンドを併用）
6. **テキストは日本語の現実的なサンプルで組む**（英語より 1.2〜1.5 倍の幅を想定。UI は日英切替があるため極端な幅依存レイアウトを避ける）
7. 既存部品の意匠を踏襲する: Button / Card / Sheet（ドロワー）/ BottomSheet / Menu / Toast / Sidebar / CommandPalette / Kanban カード（左端ステータスバンド 4px）/ MasterDetail（一覧+詳細の 2 枚組）は既に存在する。ゼロから発明せず、この部品語彙で組む

### 成果物フレーム（全画面共通）

- **Desktop: 1440×900**（light / dark の 2 枚。左サイドバー展開状態込み）
- **Mobile: 390×844**（light / dark の 2 枚。下部タブバー込み・safe-area 考慮）
- 各画面につき: **通常状態（データあり）+ 空状態 + ローディング**、該当があればエラー状態も

---

## この画面: 分析ダッシュボード（Mobile 390×844）

Mobile の分析は「閲覧（Consumption）専用のミニダッシュボード」。Desktop の 4 タブ構成は持ち込まず、**今日 → 今週 → 全体**の順で 1 本の縦スクロールに絞る。移動中や寝る前に 30 秒眺めて「今日はよくやった」と確認できる画面にしたい。

### Desktop から落とすもの（明示）

- タブ切替（概要 / タスク / 作業 / スケジュール）→ 廃止。単一スクロールに統合
- 作業ヒートマップ（24 時間 × 7 曜日）と今日のタイムライン → 広幅すぎるため出さない（横スクロールでの延命もしない）
- 停滞タスク・時間帯分布・タスク別 / プロジェクト別の長いチャート → 出さない
- 期間プリセット・期間切替（日 / 週 / 月）→ 出さない。集計は直近 30 日固定

### 構成（上から順に）

- ヘッダー: タイトル「分析」のみ（コントロールなし）
- 「今日」カード（最上部・一番目立たせる）: 作業時間 3時間25分 / 完了タスク 5 / ポモドーロ 6 の 3 分割ミニ統計
- 「作業ストリーク」カード: 現在 12 日連続（炎アイコン）/ 最長 34 日（トロフィーアイコン）の 2 分割
- 「今週」カード: 作業時間 18時間40分・完了タスク 23 のサマリー + 直近 7 日の作業時間ミニ棒グラフ（月〜日の 7 本、棒色 accent、画面幅に収まるサイズ。軸ラベルは曜日のみ・値ラベルは最大値のみ）
- stat カード 2 列 × 2 行: 「タスク 128（86 完了）」「今日の予定 7（4 完了）」「ルーチン達成率 78%」「ノート 42」
- 「ルーチン達成率」カード: 上位 3 件の横棒 + % ラベル。「皿洗い 96% / 朝のストレッチ 92% / 日記を書く 85%」
- 下部タブバー: 固定 4 タブ = Schedule / Materials / Work / Analytics + 「More」（More はボトムシートで Connect / Settings / Trash を開く）。分析は固定タブの一つなので **Analytics タブ（BarChart3）がアクティブ状態**。ホームインジケータの safe-area 込み

### 状態バリエーション

- 空状態: アイコン + 見出し「まだ記録がありません」+ 誘導文「タイマーやスケジュールを使い始めると、ここに今日のサマリーが表示されます」
- ローディング: カード枠の skeleton パルス（今日カード + 今週カード + stat グリッドの骨格が見えること）

### フレーム一覧（各 390×844）

1. 通常 light / 2. 通常 dark / 3. 空状態 light / 4. ローディング light
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロック（**v2 / 2026-07-05**）が**全プロンプトの冒頭に全文**埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（エラーは「不要」の判断を明記）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（**何を出さないか**）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている
- [x] ナビ・タブ前提が `IA.md`（サイドバー = 本流 5 + ユーティリティ枠 Settings・Trash、Analytics は 4 header タブ維持、Mobile 固定 4 タブに Analytics を含む）と矛盾しない

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/Analytics/`（既存タブ・チャート部品の意匠差し替え + ChartCard / EmptyState / DateRangePresetSelector の新設候補。生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
- ✅ **\_COMMON-CONTEXT.md v2 同期済み（2026-07-05・本オーダー design-analytics-v2）**: §4 の Desktop / Mobile 両プロンプトの共通前提ブロックを v2（Lumen blue accent + 目標 IA シェル）へ全文差し替え済み。accent は light `#1d4ed8` / dark `#5b8cff` で `shared/src/styles/tokens.css` と一致し、Mobile 下部固定 4 タブ = Schedule / Materials / Work / Analytics + More（Analytics は More 経由ではなく固定タブ）を反映。v1 の旧 accent 系 hex は一掃済み。
- ✅ **整合監査 fix（2026-07-05・chat-frontend）**: header タブの意匠を独自のタブピル（accent 塗り + on-accent 文字）から shell brief 定義の標準（左寄せ水平タブ列 + 2px accent 下線式）へ統一し、期間プリセットセレクタをヘッダー右へ移動。Status を Ready へ昇格。
