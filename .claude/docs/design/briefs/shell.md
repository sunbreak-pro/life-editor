---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Section: shell
Owner-chat: design-shell
Branch: claude/design-shell
---

# Design Brief: App Shell（全画面共通の外枠 + header タブ標準）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。
>
> **この brief は他の全 brief の基準**になる。2026-07-05 決定の目標 IA（サイドバー 6+2 / Mobile 固定 4 タブ）を初めて視覚化し、**header タブの標準意匠（形状・アクティブ表現・件数バッジ）を定義**する。各画面 brief はここで定めたタブ・シェルの意匠を参照する。

## 1. 画面要件ダイジェスト

（`.claude/docs/requirements/` の該当と `IA.md`・現行実装から。引用は `file:line` 付き）

- **目的 / 主ユースケース**: 全画面が共有する「外枠」。Desktop は左サイドバー + メインコンテンツ、Mobile は下部タブバー + メインコンテンツ。1 つのシェルが `useMediaQuery("(min-width: 768px)")` で幅により構造ごと分岐する（`shared/src/components/AppShell.tsx:69`）。セクション遷移は React Router ではなくホストの `useState` スイッチ（`web/src/MainScreen.tsx:126`、CLAUDE.md §3.2）。シェルは純表示（DataService に触れない）で、セクション一覧・ラベル・コールバックを props で受け取る（`AppShell.tsx:19-41`）
- **ナビ構成（目標 IA・2026-07-05 ユーザー承認。`IA.md` が正本）**:
  - サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（lucide: Clock / Library / Network / Timer / BarChart3。`IA.md:19-25`）
  - サイドバー最下部ユーティリティ枠（本流から視覚分離）: Settings / Trash（lucide: Settings / Trash2。`IA.md:26-27`）
  - 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面（`IA.md:19-27`）
  - フッター: コマンドパレット起動（⌘K）/ ユーザー表示（email）/ サインアウト（`IA.md:29`、`SidebarNav.tsx:104-135`）
  - 展開 240px / 折畳 64px（アイコンのみ）は現行踏襲（`IA.md:30`、`AppShell.tsx:70-73` で `SIDEBAR_COLLAPSED_KEY` にローカル保持）
  - Mobile: 下部固定 4 タブ = Schedule / Materials / Work / Analytics + "More"（More はボトムシートで Connect / Settings / Trash。`IA.md:42`）
- **表示するデータ**（現実的なサンプル値）: セクション名（日本語表示: 予定 / 資料 / つながり / 集中 / 分析 / 設定 / ゴミ箱）、ブランド名「Life Editor」、ユーザー email「fstprog@gmail.com」、Materials header タブ（タスク / ノート / デイリー / タグ）、コマンドパレットのコマンド行（「予定へ移動」「資料へ移動」等）、Toast 文言（「タスクを保存しました」「保存に失敗しました」）
- **主要操作**: セクション切替（サイドバー行 / ボトムタブ / ⌘K の 3 経路）/ サイドバー折畳トグル / header タブ切替 / コマンドパレット開閉（⌘K・`MainScreen.tsx:220-225` の GlobalShortcuts）/ サインアウト / Mobile の More シート開閉（`BottomTabBar.tsx:83-97`）
- **Desktop / Mobile の責務分割**（Mobile = Consumption + Quick capture。**何を落とすか**）:
  - Desktop = 本流 5 + ユーティリティ 2 の全 7 セクションが常時サイドバーに並ぶ。header タブは水平タブとして全幅表示
  - Mobile = 下部固定 4 タブ（Schedule / Materials / Work / Analytics）に絞る。**Connect / Settings / Trash は下部タブから落とし、More のボトムシートに畳む**。header タブは Mobile ではセグメントコントロール等の小型表現で継承（`IA.md:43`）。サイドバー折畳という概念自体が無い（下部タブは常時アイコン + ラベル）

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/MainScreen.tsx`（セクション state・ナビ一覧・ラベルを組み立てて `AppShell` に注入。`:158-182`）。現状は目標 IA と異なり **10 フラットセクション**（tasks / daily / notes / schedule / connect / work / analytics / tags / settings / trash。`MainScreen.tsx:85-108`）— Materials への header タブ統合も本流/ユーティリティの視覚分離も未実装
- **shared 部品**（すべて `lumen-*` トークン・不透明背景・i18n は props 注入）:
  - `shared/src/components/AppShell.tsx` — レスポンシブ単一シェル。`isWide` で分岐（`:75-98` wide / `:100-119` narrow）。wide は `flex h-screen`、サイドバー + `main`（`fluidContent` で中央寄せ max-w-3xl か全幅かを切替。`:89-95`）。narrow は `main` + `BottomTabBar`、safe-area padding（`:100-104`）
  - `shared/src/components/SidebarNav.tsx` — `aside` 幅 `w-60`(240px)/`w-16`(64px)、`bg-lumen-bg-subsidebar` + `border-r`（`:60-66`）。ヘッダ `h-12`（ブランド名 + 折畳トグル PanelLeftClose/Open。`:68-85`）/ セクションリスト（`:87-102`）/ フッター（⌘K NavItem + email + LogOut。`:104-135`）
  - `shared/src/components/NavItem.tsx` — サイドバー行。アクティブは `bg-lumen-hover` + `font-medium` + アイコン `text-lumen-accent`（`:43-46, 50-53`）。collapsed はアイコンのみ + `title` ツールチップ + `aria-label`（`:37, 55`）
  - `shared/src/components/BottomTabBar.tsx` — 先頭 `maxVisible=4`（`:47`）を固定タブ、残りを "More" に overflow（`:48-49`）。アクティブは `text-lumen-accent`（`:52-59`）、`pb-[env(safe-area-inset-bottom)]`（`:65`）。More は `BottomSheet` で一覧（`:99-139`）
  - `shared/src/components/BottomSheet.tsx` — 下から出るドロワー。`rounded-t-2xl`、上部に drag-handle（`h-1 w-10 bg-lumen-border-strong`。`:58`）、`bg-lumen-bg-secondary` + 黒 30% スクリム（`:41, 52-56`）、Escape / 背後クリックで閉じる
  - `shared/src/components/CommandPalette.tsx` — ⌘K。`fixed inset-0 z-50` + 黒 30% スクリム + `pt-[15vh]` 上寄せ（`:96`）、`max-w-lg` + `bg-lumen-bg-secondary`（`:100`）。虫めがね + 入力（`:105-115`）、↑↓ 移動 / Enter 実行 / Esc 閉じ（`:74-92`）、行アクティブは `bg-lumen-hover`
  - `shared/src/components/Toast.tsx` — 右下固定（`bottom-4 right-4 z-50`。`:60`）、不透明カード + `border-l-4` の variant 色（success = `lumen-success` / error = `lumen-danger` / info = `lumen-accent`。`:76-80, 92`）、4 秒で自動消滅（`:47-55`）
  - `web/src/components/OfflineBanner.tsx` — オフライン時のみ全幅バナー（online 時は `null`。`:30`）。`border-b border-lumen-danger` + `bg-lumen-bg-secondary` + WifiOff + 日本語文言、`role="status"` `aria-live="polite"`（`:32-43`）
- **特徴的 UI**: 「1 コンポーネントで wide/narrow を構造分岐」「サイドバー折畳をローカル永続化」「下部タブの 4+More オーバーフロー」「⌘K・Toast・OfflineBanner の 3 種オーバーレイがセクションの外側に常駐」（`MainScreen.tsx:200-417` で ToastProvider / CommandPalette がセクションスイッチの外にマウント）
- **状態の現状**: サイドバー = 展開 / 折畳の 2 状態（永続）。下部タブ = 通常 / More シート open。⌘K = 閉 / 開（+ 検索 0 件）。Toast = 空 / 1〜複数枚。OfflineBanner = online（非表示）/ offline（表示）
- **現状の課題**（デザイン観点で改善したい点。これがプロンプトの「良くしたい方向」）:
  1. サイドバーが 10 個フラットで、本流とユーティリティ（設定・ゴミ箱）の区別が無い。**目標 IA の「本流 5 + ユーティリティ枠 2」視覚分離が未実装**
  2. **header タブという概念自体が無い**。Tasks / Notes / Daily / Tags が独立の nav 行に散っており、Materials への統合と上部タブが要る（この brief で標準を定義）
  3. Trash が本流セクションと同列で、危険操作（完全削除）への入口が目立ちすぎる。ユーティリティ枠へ沈めたい
  4. Mobile 下部タブが `maxVisible=4` の自動 overflow で、固定 4 タブの中身が並び順依存。IA 決定（Schedule / Materials / Work / Analytics）に明示的に合わせたい
  5. サイドバーのアクティブ表現が「薄いグレー背景 + アイコンだけ accent」で選択の主張が弱い。左端アクセントバー等の標準が無い
  6. ブランドヘッダが「Life Editor」テキストのみで視覚的アンカーが弱い
  7. ⌘K / Toast / OfflineBanner の重なり順（z-index）と Mobile での safe-area・下部タブとの取り合いが未整理

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: 展開 240px / 折畳 64px の 2 段サイドバー / `useMediaQuery` 768px での wide↔narrow 構造分岐 / フッターの ⌘K・email・サインアウト / 下部タブ 4+More のオーバーフロー + BottomSheet / Toast 右下・4 秒自動消滅・`border-l-4` variant / CommandPalette 上寄せ + 黒 30% スクリム / OfflineBanner を最上端・danger 枠
- **変える意匠**:
  - サイドバーを **本流 5 → 区切り線 → ユーティリティ 2** の 2 グループに分ける（ユーティリティ枠は `text-tertiary` 寄りの控えめなトーン + 上部に区切り線）
  - **header タブ標準を新設**（下記）
  - Trash を本流と視覚的に分離し、危険度を落として沈める
  - Mobile 下部タブを IA 固定 4（Schedule / Materials / Work / Analytics）に明示。5 個目以降は More
  - サイドバー行のアクティブ表現を標準化: **左端 3px の accent バー + `accent-subtle` 背景 + アイコン/ラベル accent**（現状の「薄グレー背景のみ」を強める）
- **header タブ標準（この brief が定義。他の全 brief が参照する基準）**:
  - **形状**: メインコンテンツ最上部の水平タブ列。左寄せ、タブ間 8px、下端に `border` の薄い区切り線を全幅で引き、その上にタブが乗る（Notion / ブラウザのタブ下線式）
  - **アクティブ表現**: アクティブタブ = **`accent` 色の 2px 下線（タブ幅ぴったり）+ ラベル `text-primary` + `font-medium`**。非アクティブ = ラベル `text-secondary` + 下線なし、ホバーで `text-primary` + `hover` 背景。色だけに頼らず「太さ + 下線 + 濃度」の 3 点でアクティブを示す（不変式 5）
  - **件数バッジ**: **意味のあるタブにだけ付ける**（全タブには付けない）。バッジ = ラベル右の小型ピル（`accent-subtle` 背景 + `accent` 文字、等幅数字、角丸 6px）。例: Materials の Tasks（未完タスク数「12」）、Trash 各カテゴリ（件数）。0 件・数値に意味が無いタブ（Overview / Graph 等）は付けない
  - **Mobile での継承**: header タブは Mobile ではタブ列の代わりに**セグメントコントロール**（`bg-secondary` の角丸トラックに、アクティブセグメントだけ `bg-primary` + 影の押し出し表現）。タブが 4 つ（Materials）でも横スクロールせず等分割で収める
- **使う既存部品**: AppShell / SidebarNav / NavItem / BottomTabBar / BottomSheet / CommandPalette / Toast / OfflineBanner はすべて既存。ゼロから発明せず、この部品語彙で目標 IA に組み替える
- **新規に必要な部品候補**（部品層 `shared/src/components/` への追加候補として列挙するだけ。実装しない）:
  - `HeaderTabs`（上記標準の水平タブ列。Desktop）+ `SegmentedControl`（同じ意味の Mobile 表現）
  - `SidebarGroup`（本流 / ユーティリティ枠を仕切るグループ + 区切り線）
  - `Badge`（タブ件数ピル。既存に無ければ）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に共通前提ブロックを**全文**置いてから、画面固有の指示を続ける。
> プロンプトは日本語で書く（コンポーネント名・色値は英語 / hex のまま）。
> この画面は「中身の各セクション画面」ではなく **外枠と header タブの標準**が主役。中身はダミー（プレースホルダ）で良い。

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

## この画面: App Shell（Desktop 1440×900）

アプリの「外枠」そのものをデザインする。中身（各セクションの本文）はダミーで良い。**主役はサイドバー・header タブ・横断オーバーレイの標準意匠**。

### レイアウト構造

- 左サイドバー（幅 240px、`bg-subsidebar`、右端に `border` の縦線）+ 残り全幅のメインエリア（`bg-primary`）の 2 分割。高さは画面いっぱい
- サイドバーは上から 3 ブロック:
  1. **ブランドヘッダ**（高さ 48px、下端に `border`）: 左に小さな四角いアプリマーク（角丸 8px、`accent` 地に白の「L」1 文字）+ 「Life Editor」（`text-primary` / `font-semibold` / sm）。右端に折畳トグルのアイコンボタン（PanelLeftClose、`text-secondary`）
  2. **本流セクション（5 行）**: Schedule / Materials / Connect / Work / Analytics。各行 = lucide アイコン（Clock / Library / Network / Timer / BarChart3）+ 日本語ラベル（予定 / 資料 / つながり / 集中 / 分析）。行高 36px、角丸 6px、左右 10px パディング
     - **アクティブ行の標準**（この 1 枚では「資料（Materials）」をアクティブに）: 左端に 3px の `accent` 縦バー + 行地 `accent-subtle` + アイコンとラベル `accent` + `font-medium`
     - 非アクティブ行: ラベル `text-secondary` / アイコン `text-secondary`、ホバーで `hover` 背景 + `text-primary`
  3. **ユーティリティ枠（下寄せ・本流から分離）**: 上に全幅の `border` 区切り線を引き、その下に Settings / Trash（設定 / ゴミ箱。lucide: Settings / Trash2）。本流よりワントーン控えめ（アイコン・ラベルとも既定 `text-tertiary`、ホバーで `text-secondary`）。**ゴミ箱は危険操作の入口だが、ここでは色を強調せず沈める**
- **フッター**（サイドバー最下部、上に `border`）: 「⌘K でコマンドパレット」を示す行（Command アイコン + 「コマンド…」+ 右端に `⌘K` の小さなキーキャップ風表記）/ その下にユーザー行（email「fstprog@gmail.com」を省略表示 + サインアウトの LogOut アイコンボタン）
- **メインエリア**（この 1 枚では Materials セクションを表示中というダミー）:
  - 最上部に **header タブ標準**を置く。この brief の核心なので丁寧に描く:
    - タブ列: 「タスク | ノート | デイリー | タグ」の 4 タブ。左寄せ、タブ間 8px、タブ列の下端に全幅の薄い `border` 区切り線
    - **アクティブタブ =「タスク」**: ラベル `text-primary` + `font-medium`、直下に 2px の `accent` 下線（タブ幅ぴったり、区切り線に重ねる）
    - 非アクティブ（ノート / デイリー / タグ）: ラベル `text-secondary`、下線なし、ホバーで `text-primary` + `hover` 背景
    - **件数バッジの例**: 「タスク」ラベルの右に小さなピル（`accent-subtle` 地 + `accent` 文字 + 等幅数字「12」、角丸 6px）。他の 3 タブにはバッジを付けない（= 意味のあるタブにだけ付けるルールの実例）
  - タブの下の本文はダミーで良い（Kanban 風のカード列をうっすら 2〜3 列プレースホルダで置く程度）。**本文の作り込みは不要**
- 右下に **Toast** を 1 枚（success: `border-l-4` が `success` 色、CheckCircle アイコン + 「タスクを保存しました」）
- 画面の最上端に薄く注記: この 1 枚は「通常状態・サイドバー展開・Materials/タスクタブ」の基本形

### 状態バリエーション（Desktop・複数フレーム）

1. **通常（基本形）**: 上記そのまま（サイドバー展開・Materials の「タスク」タブ・Toast 1 枚）。light / dark 両方
2. **サイドバー折畳**: サイドバー幅 64px、アイコンのみ（ラベル非表示）。ブランドはアプリマークだけ、折畳トグルは PanelLeftOpen。アクティブ行は 3px の `accent` 縦バー + `accent` アイコンで示す（背景の `accent-subtle` は残す）。ホバー時にラベルのツールチップが右に出る様子も 1 つ
3. **コマンドパレット open**: 画面全体に黒 30% スクリム、上から 15% の位置に幅 512px の不透明カード（`bg-secondary` + `border` + 影 lg）。上端に虫めがね + 入力欄（プレースホルダ「コマンドを検索…」、入力例「よてい」）、その下にコマンド行リスト（「予定へ移動 / 移動」「資料へ移動」「つながりへ移動」…各行 lucide アイコン + タイトル + 右端にカテゴリ「移動」）。先頭行がキーボードハイライト（`hover` 背景）
4. **オフライン**: 画面最上端（サイドバーとメインの両方に跨る全幅）に OfflineBanner — `bg-secondary` 地 + 下端 `danger` ボーダー + WifiOff アイコン + `danger` 文字「オフラインです。オンライン時にご利用ください」。バナーの分だけ下のシェルが押し下がる
5. **（任意）header タブの標準見本**: Materials（タスク/ノート/デイリー/タグ・タスクにバッジ）だけでなく、Schedule（カレンダー/ルーティン・バッジなし）と Analytics（概要/タスク/集中/予定・バッジなし）のタブ列を並べた「タブ標準カタログ」1 枚。他 brief がコピーする基準として

### その他

- light / dark 両テーマ必須。dark はサイドバー地 `#1e1e23`・メイン地 `#16161a` で、両者の段差がわずかに分かること。`accent` の縦バー・下線・バッジが dark でも沈まないこと
- ⌘K / Toast / OfflineBanner の重なり: OfflineBanner は最上端に常駐（他に重ならない）、Toast は右下、コマンドパレットはスクリム込みで最前面
- キーボード操作のヒントを控えめに（フッターの「⌘K」キーキャップ表記が主。過度な操作ヒントは不要）
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

## この画面: App Shell（Mobile 390×844）

Mobile の「外枠」をデザインする。サイドバーは無い。**下部固定タブバー + header タブのセグメントコントロール + More のボトムシート**が主役。中身はダミーで良い。

### レイアウト構造

- 縦 3 段: 上端（オフライン時のみバナー）/ 中央のメインエリア（`bg-primary`・縦スクロール）/ 最下部の固定タブバー
- **下部タブバー**（画面下に固定、`bg-primary` + 上端 `border`、`env(safe-area-inset-bottom)` の余白を下に確保）:
  - 固定 4 タブ = 予定 / 資料 / 集中 / 分析（lucide: Clock / Library / Timer / BarChart3）+ **More**（MoreHorizontal アイコン + 「その他」）。計 5 枠を等分割
  - 各タブ = アイコン（上）+ 極小ラベル（下、xs）の縦積み
  - **アクティブタブ**（この 1 枚では「資料」）: アイコンとラベルが `accent`。非アクティブは `text-secondary`
- **メインエリア**（この 1 枚では Materials を表示中というダミー）:
  - 最上部に **header タブのセグメントコントロール**（Mobile での header タブ標準）: `bg-secondary` の角丸トラック（角丸 8px、全幅、内側 2px パディング）に「タスク / ノート / デイリー / タグ」の 4 セグメントを等分割。**アクティブ（タスク）だけ `bg-primary` + 影 sm で押し出し + `text-primary` + `font-medium`**、他は `text-secondary`。件数は Mobile では省く（幅が狭いため。タブ名のみ）
  - その下の本文はダミー（タスクのリスト行を 3〜4 行うっすらプレースホルダ）。**作り込み不要**
- 「Quick capture」の存在を示す控えめな要素として、メインエリア右下（タブバーの上）に FAB 風の丸い + ボタン（`accent` 地 + 白 +、影 md）を 1 つ置いてよい（Mobile の素早い記録導線の示唆）

### 状態バリエーション（Mobile・複数フレーム）

1. **通常（基本形）**: 上記そのまま（下部タブ「資料」アクティブ・header セグメント「タスク」アクティブ）。light / dark 両方
2. **More のボトムシート open**: 画面下から不透明シート（`bg-secondary`、上端角丸 16px、上に drag-handle の丸バー `border-strong`、背後は黒 30% スクリム）。見出し「その他」+ 縦リスト 3 行: つながり（Network）/ 設定（Settings）/ ゴミ箱（Trash2）。**ゴミ箱は控えめトーン**（`text-secondary`、危険色で煽らない）。シート下端は safe-area 余白
3. **オフライン**: 画面最上端に全幅バナー（`bg-secondary` + 下端 `danger` ボーダー + WifiOff + `danger` 文字「オフラインです。オンライン時にご利用ください」）。下部タブバーは通常どおり
4. **（任意）ローディング**: メインエリア本文の位置にスケルトン行（3〜4 本のグレーの角丸バー）。タブバー・セグメントは通常表示

### Mobile で落とすもの（Consumption + Quick capture への割り切り）

- **サイドバー・折畳という概念は無し**（下部タブ + More に置換）
- 下部タブから **つながり（Connect）/ 設定（Settings）/ ゴミ箱（Trash）を外し** More のシートへ畳む（探索・設定・管理系は「素早い記録・閲覧」の主導線ではないため）
- header タブの件数バッジは省略（幅が狭い。名前のみ）
- コマンドパレット（⌘K）は Mobile では主役にしない（物理キーボード前提のため、この brief では Mobile 版を描かない）

### その他

- light / dark 両テーマ必須。dark でタブバー地 `#16161a` と本文地の段差、セグメントの押し出し（`bg-primary` の押し出し）が沈まないこと
- safe-area: タブバーは下、バナーは上のノッチ/ホームインジケータを避ける余白を確保
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] 共通前提ブロック（**v2 / 2026-07-05**）が全プロンプトの冒頭に**全文**埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（該当すればエラーも）。シェルは「空状態」= 該当なし（外枠は常にデータあり）のため、代わりに折畳 / ⌘K open / offline / loading の状態網羅で満たす
- [x] 表示データが日本語の現実的なサンプルで指定されている（セクション名・email・タブ名・Toast 文言）
- [x] Mobile の責務削減（**何を出さないか**）が明記されている（§4.2「Mobile で落とすもの」）
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている
- [x] （shell 固有 AC）`IA.md` との完全一致: サイドバー本流 5 + ユーティリティ枠 2 / header タブ 4 種の割当 / Mobile 固定 4 タブ + More（Connect / Settings / Trash）
- [x] （shell 固有 AC）header タブの標準意匠（形状・アクティブ表現・件数バッジ・Mobile 継承）を定義し、他 brief が参照できる形にした

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/AppShell.tsx` / `SidebarNav.tsx` / `NavItem.tsx` / `BottomTabBar.tsx` / `BottomSheet.tsx` + 新規候補 `HeaderTabs` / `SegmentedControl` / `SidebarGroup` / `Badge`（生成結果を見てから確定）
- **他 brief への波及**: この brief の header タブ標準（下線式 / アクティブ 2px accent 下線 / 件数バッジは意味のあるタブのみ / Mobile はセグメントコントロール）は Materials・Schedule・Analytics・Connect の各 brief が前提にする。標準を変えたらこの brief を先に直し、各 brief へ同期する
- 生成デザインへのフィードバックで §4 を更新した場合、Status と履歴を追記する
