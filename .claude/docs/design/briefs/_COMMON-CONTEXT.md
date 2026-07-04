# _COMMON-CONTEXT — 全 ClaudeDesign プロンプト共通の前提ブロック

> **使い方**: 下の水平線以降を、各 brief の §4 プロンプト（Desktop 用 / Mobile 用の両方）の**冒頭にそのまま全文コピー**する。
> ClaudeDesign はリポジトリを読めないため、この前提が唯一の共有知識になる。**改変・要約・省略禁止**（統一性が崩れる）。
> palette 表の正本は `shared/src/styles/tokens.css`。値を変えるときは tokens.css → 本ファイル → 各 brief の順で同期する。

---

## Life Editor — デザイン共通前提（全画面共通）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- Mobile: 下部タブバー（先頭 4 タブ + "More" タブでボトムシート展開。safe-area inset 対応）
- セクション構成: Tasks / Daily / Notes / Schedule / Connect / Work / Analytics / Tags / Settings / Trash（アイコンは lucide 系統: CheckSquare, CalendarDays, FileText, Clock, Network, Timer, BarChart3, Tag, Settings, Trash2）

### ブランドパレット — Cobalt Ink + Mint

ほぼモノクロのコバルトグレー neutrals + 電撃コバルトの主アクセント + ライトミントの差し色。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                           | Light                 | Dark                  |
| ---------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                       | `#fafafa`             | `#16161a`             |
| bg-secondary                                   | `#f1f1f3`             | `#1e1e23`             |
| bg-subsidebar（サイドバー地）                  | `#f5f5f6`             | `#1e1e23`             |
| surface-sunken（沈んだ面）                     | `#ececef`             | `#101013`             |
| text-primary                                   | `#1a1a1f`             | `#f2f2f5`             |
| text-secondary                                 | `#5c5c66`             | `#a0a0ad`             |
| text-tertiary                                  | `#767680`             | `#74747e`             |
| border                                         | `#e3e3e7`             | `#2e2e35`             |
| border-strong                                  | `#cfcfd6`             | `#44444d`             |
| accent（電撃コバルト。主ボタン・選択・リンク） | `#1f4fff`             | `#5b82ff`             |
| accent-hover                                   | `#1a42d9`             | `#7596ff`             |
| on-accent（accent 上の文字）                   | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）               | `#e1e6fb`             | `#21273f`             |
| hover（行ホバー等）                            | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）               | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                              | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                        | `#0f7b6c`             | `#4dab9a`             |
| danger                                         | `#d92d20`             | `#ef4444`             |
| info                                           | `#2563eb`             | `#60a5fa`             |
| warning                                        | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ: task = コバルト系（bg `#e3e7ff` fg `#2330b0`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
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
