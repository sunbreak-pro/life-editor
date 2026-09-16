# _COMMON-CONTEXT — 全 ClaudeDesign プロンプト共通の前提ブロック

> **使い方**: 下の水平線以降を、各 brief の §4 プロンプト（Desktop 用 / Mobile 用の両方）の**冒頭にそのまま全文コピー**する。
> ClaudeDesign はリポジトリを読めないため、この前提が唯一の共有知識になる。**改変・要約・省略禁止**（統一性が崩れる）。
> palette 表の正本は `shared/src/styles/tokens.css`、ナビ構成の正本は `../IA.md` + `shared/src/sections.ts`。値を変えるときは正本 → 本ファイル → 各 brief の順で同期する。
>
> **Version: 4.1（2026-09-14）** — v4 からの変更 2 点。①**エンティティ別チップの用途を予定まわりに限定**し、アイテム種別のバッジは「中立地 + 色付きアイコン」だと明記した（実装 = `shared/src/components/items/ItemRoleBadge.tsx` は `bg-lumen-bg-secondary` + `border-lumen-border` の完全円チップで、色はアイコンのみ。v4 のままだと 2 行が衝突し、実際に 2026-09-13 の Connect 生成で種類見出しが種別ごとの色地で描かれた）②**タグの色スウォッチ 12 色**を追記した（正本 = `shared/src/components/colorPresets.ts` の `ITEM_COLOR_PRESETS`。未記載だったためグラフ カテゴリ色が流用された）。
>
> **Version: 4（2026-09-12）** — v3 からの変更 3 点。①**パレットを朝刊・夕刊（Asakan/Yukan）版に差し替え**（2026-07-18 #269。light = 生成りの紙 + 燈色 `#ad4409` / dark = 藍の夜空 + 薄藍 `#85aaff`。v3 の Cobalt Ink + Lumen blue は退役済みで、**v3 を埋め込んだ brief のデザインはアクセント色から作り直しが必要**）②**ナビ構成を現行 registry に同期**（朝刊の追加・Connect は Tag hub でタブなし・Materials は ノート / デイリー の 2 タブ・Trash は Settings 配下へ移設）③**narrow の 44px タップ下限**を不変式に追加（#1512 / #1561）。
> **Version: 3（2026-07-05）** — v2 からの変更: ③シェル構成に rightSidebar（詳細パネル）+ Mobile ハンバーガー → 左 drawer を追加。v1 → v2: ①accent 系 hex を PR #135 に同期 ②シェル構成を目標 IA に差し替え。

---

## Life Editor — デザイン共通前提（全画面共通・v4.1 / 2026-09-14）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。主な利用者は作者本人で、ほかに 10〜20 人へ配布する個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）。ただし 1 タップで終わる更新（完了トグル・★ の付与）は Mobile にも置く

### アプリシェル（画面の外枠。各画面はこの内側にデザインする）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。地色は本文よりやや沈んだ subsidebar 色）+ メインコンテンツ + 右の詳細パネル
- サイドバー本流 6 セクション（この順）: **朝刊 / 予定 / 素材 / つながり / 集中 / 分析**。アイコンは lucide の Sunrise, Clock, Library, Tags, Timer, BarChart3
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: **設定**（1 行だけ。ゴミ箱は設定画面の中のカテゴリ行へ移設済み）+ フッター（Claude 起動行 / コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: **素材 = ノート / デイリー**、**分析 = 概要 / Todo / 集中 / 予定**、**朝刊 = 朝刊 / 夕刊**。**予定 / つながり / 集中 / 設定はタブなしの単画面**（ツールバーを持つ画面はある）
- 各画面の header 行の右端に **詳細パネルの開閉トグル**（lucide: PanelRight。open 中は accent 文字 + accent-subtle 地の活性表示、closed 時はニュートラル）を置く。詳細パネル = 右端の**既定 320px**（左端のハンドルで 240〜560px にリサイズ可）・押し込み式（overlay ではなくメイン領域が縮む。地色はサイドバーと同じ subsidebar 色 + 左 border、上部に「詳細」ヘッダー + 閉じる X）。**Desktop 全画面に付ける**
- Mobile: 下部タブバー = **朝刊 / 予定 / 素材 / 集中 + その他**（「その他」はボトムシートで 分析 / つながり / 設定 + クイック操作。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承。**画面上部・セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 の border 付きボタン）**を置き、タップで左から幅 320px の drawer（黒 30% スクリム）が開いて Desktop の詳細パネルと同一内容を出す。ナビ用の「その他」シートとは役割分離（その他 = ナビ / ハンバーガー = 詳細パネル）

### ブランドパレット — 朝刊・夕刊（Asakan / Yukan）

light = 生成りの紙に燈色（ひいろ）のアクセント。dark = 藍の夜空に月明かりの薄藍。ほぼ無彩色の地に暖色 1 本という構成で、長時間読んでも疲れない密度を狙う。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                         | Light（朝刊）         | Dark（夕刊）          |
| -------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                     | `#fbf4e8`             | `#101a2c`             |
| bg-secondary                                 | `#f5ebda`             | `#18243c`             |
| bg-subsidebar（サイドバー・詳細パネル地）    | `#f8efe1`             | `#18243c`             |
| surface-sunken（沈んだ面・検索欄・コード）   | `#efe3cd`             | `#0a1220`             |
| text-primary                                 | `#2b2015`             | `#edf1f9`             |
| text-secondary                               | `#6b5a45`             | `#a4b2ca`             |
| text-tertiary（件数・日時・補助）            | `#857054`             | `#75839d`             |
| border                                       | `#eadec6`             | `#263650`             |
| border-strong                                | `#d6c3a2`             | `#3c4e70`             |
| accent（主ボタン・選択・リンク）             | `#ad4409`             | `#85aaff`             |
| accent-hover                                 | `#8f3807`             | `#a3c0ff`             |
| on-accent（accent 上の文字）                 | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り・選択行の地） | `#fbe3c6`             | `#1e2d4b`             |
| hover（行ホバー）                            | `#f0e5d0`             | `#22314e`             |
| accent-secondary（ミント差し色）             | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                            | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                      | `#0f7b6c`             | `#4dab9a`             |
| danger                                       | `#d92d20`             | `#ef4444`             |
| info                                         | `#2563eb`             | `#60a5fa`             |
| warning                                      | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ（**予定まわり専用** — 週 / 月グリッドのブロック・アジェンダ行・ポモドーロの Todo 選択で使う。下の「アイテム種別のバッジ」には使わない）: task = 青（bg `#dbeafe` fg `#1e40af`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
- グラフ カテゴリ 10 色: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`
- スケジュールブロック地: routine `#ebf0fe` / event `#f3e8ff`（border `#8b5cf6`）/ task `#dbeafe` / その他 `#f1f2f4`
- **アイテム種別のバッジ**（Todo / イベント / ノート / デイリーを混在リストで示す唯一の形）: 完全円のチップで、**地は bg-secondary・枠は border・文字は text-secondary の中立**。色が付くのは**アイコンだけ**で Todo = accent / イベント = info / ノート = accent-secondary / デイリー = warning。地を種別で塗り分けない（混在リストが虹色になるため）
- **タグの色スウォッチ**（ユーザーが選ぶ 12 色・2 段 6 列）: `#2563eb` `#0ea5e9` `#14b8a6` `#16a34a` `#eab308` `#f59e0b` / `#e03e3e` `#ec4899` `#8b5cf6` `#6366f1` `#0f766e` `#6b7280`。色を持たないタグは text-secondary の既定アイコンで描く。グラフ カテゴリ 10 色はチャート専用で、タグ色には使わない

### 形・余白・文字

- フォント: システムフォントスタック（-apple-system / Segoe UI 等）。ベース 16px
- 角丸: 6 / 8 / 12 / 16 px + 完全円（9999px）
- 余白: 4px 基調のスケール（4 / 8 / 12 / 16 / 20 / 24）。画面端の溝は 16px、広い画面で 24px
- 影: elevation 3 段（sm / md / lg）。控えめに。フラット寄りの Notion ライクな密度感
- 文字サイズは設定画面から全体を拡縮できる相対設計。極端に小さい固定 px を前提にしない

### 守るべきルール（不変式）

1. **上記パレットの色のみ使用**。新しい hex を発明しない（必要なら「トークン追加の提案」として明記する）
2. **主要コンテナ（カード / メニュー / ダイアログ / パネル / ポップオーバー）の背景は完全不透明**。backdrop-blur 不使用。モーダル背後の黒 30% バックドロップだけ許容
3. **light / dark 両テーマを必ず作る**。dark は pure black ではなく `#101a2c`、light は pure white ではなく `#fbf4e8`。dark はアクセントの明度を上げ、その上の文字を near-black にする
4. 本文テキストのコントラストは **WCAG AA（4.5:1）以上**
5. **状態を色だけで伝えない**（ラベル・形・バンドを併用）
6. **Mobile（768px 未満）のタップ対象は 44×44px 以上**。行・アイコンボタン・入力欄の枠だけでなく、実際に押せる面が 44px に届くこと
7. **テキストは日本語の現実的なサンプルで組む**（英語より 1.2〜1.5 倍の幅を想定。UI は日英切替があるため極端な幅依存レイアウトを避ける）
8. 既存部品の意匠を踏襲する: Button / Card / Sheet（ドロワー）/ BottomSheet / Menu / Toast / Sidebar / CommandPalette / MasterDetail（一覧 + 詳細の 2 枚組）/ 左端 4px ステータスバンドのカード / EmptyState / SkeletonList は既に存在する。ゼロから発明せず、この部品語彙で組む

### 成果物フレーム（全画面共通）

- **Desktop: 1440×900**（light / dark の 2 枚。左サイドバー展開状態込み）
- **Mobile: 390×844**（light / dark の 2 枚。下部タブバー込み・safe-area 考慮）
- 各画面につき: **通常状態（データあり）+ 空状態 + ローディング**、該当があればエラー状態も
