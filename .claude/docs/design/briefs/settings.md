---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）。v2 改訂で §4 共通ブロックを _COMMON-CONTEXT v2（Lumen accent）へ再同期済み
Created: 2026-07-05
Section: settings
Owner-chat: design-settings-v2
Branch: claude/design-settings-v2
---

# Design Brief: Settings（設定）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる。

## 1. 画面要件ダイジェスト

- **目的 / 主ユースケース**: アプリ全体の外観（テーマ・フォントサイズ）・言語・キーボードショートカットを 1 画面で調整する低頻度アクセスの設定画面。N=1 の個人ツールなので発見性より「迷わず確実に変えられる」ことを優先する。
  - Theme: ダーク / ライト 2 モード + フォントサイズ 12–25px の 10 段階スライダー（`.claude/docs/requirements/tier-2-supporting.md:338`、段階→px の対応は `shared/src/constants/fontSize.ts:8-19`）。要件には System 自動追従（`tier-2-supporting.md:355`）もあるが、現行 web 実装の Theme 型は light / dark の 2 値（`shared/src/context/ThemeContextValue.ts:3`）なので本デザインも 2 択とする
  - i18n: en / ja の 2 言語を Settings から即時切替（`tier-2-supporting.md:373`、AC1 = 全 UI 即時反映 `:389`）
  - Shortcuts: キー再割当（リバインド）+ 重複検出（`tier-2-supporting.md:417`）。**Desktop 専用機能**（`:406`、Mobile はやらない `:420`）
- **表示するデータ**: 設定値 3 つ（theme = light|dark / fontSize = 1–10 段 / language = en|ja）+ ショートカット定義 10 件・3 カテゴリ（global 3 / navigation 5 / edit 2 — `shared/src/constants/defaultShortcuts.ts:9-83`）。件数は少なく全件即時ロード。要件の「29 件 / 6 カテゴリ」（`tier-2-supporting.md:410`）は旧 frontend 時代の数で、web-lean 現行は 10 件
- **主要操作**: テーマ切替 / フォントサイズスライダー / 言語切替 / ショートカットのキーキャプチャ再割当・個別リセット・全リセット。**すべて即時適用で保存ボタンは無い**
- **Desktop / Mobile の責務分割**: Appearance と Language は両対応（閲覧 + 軽量操作で Quick capture 責務に収まる）。**Shortcuts ブロックは Mobile では非表示にする（閲覧のみ表示も採らない）** — ハードウェアキーボード非前提で再割当も参照も実益がなく、ShortcutConfig は Mobile 省略 Provider（CLAUDE.md §2、`tier-2-supporting.md:420`）。現行実装も Provider 不在時はブロックごと消える null ガード構造（`web/src/settings/SettingsScreen.tsx:82`）で、この方針と整合する

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/settings/SettingsScreen.tsx:53`（単一縦カラム `space-y-10`。ホストが hooks と t() を持ち、値と訳文を純粋部品に注入する構造 `:15-22`）。セクション切替は `web/src/MainScreen.tsx:362`、ShortcutConfigProvider はシェル直下 `:209`
- **shared 部品**: `shared/src/components/SettingsAppearance.tsx` / `SettingsLanguage.tsx` / `SettingsShortcuts.tsx`
- **特徴的 UI**:
  - テーマ切替 = テキストのみの小型ボタン 2 個（`SettingsAppearance.tsx:53-79`）
  - フォントサイズ = ネイティブ `input[type=range]` 10 段 + 現在 px の数値表示（`SettingsAppearance.tsx:87-100`）
  - 言語 = ボーダー付きボタン 2 個（`SettingsLanguage.tsx:40-57`）
  - ショートカット = flat な行リスト + kbd チップ（`SettingsShortcuts.tsx:145,196-198`）、キーキャプチャはインライン展開（`:163-193`）、コンフリクトは danger 文言で確定拒否（`:117-121`）、全リセットは見出し右の ghost ボタン（`:131-143`）
- **状態の現状**: loading / empty の意匠なし（設定値は即時ロード、Provider 不在時は Shortcuts ブロックが黙って消えるのみ）。エラー系はコンフリクト警告のみ実装済み
- **現状の課題**（デザインで良くしたい方向）:
  1. ページタイトル（h1）が無く、h3 見出しの素積みで画面の骨格が弱い
  2. ブロック間の区切りが余白（space-y-10）だけで、視線のまとまり・カード感が無い
  3. テーマ切替が文字ボタンのみで、選択結果のプレビューが無い
  4. フォントサイズがネイティブスライダーそのままで、10 段の目盛り・実寸プレビューが無い
  5. ショートカットが flat リストで、定義に存在するカテゴリ（global / navigation / edit）が表示に反映されていない
  6. キーキャプチャがインライン展開で行の高さが跳ね、レイアウトシフトする
  7. loading / empty 状態の意匠が未定義

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: 単一縦カラム（中央寄せ max-width 768px）/ 保存ボタン無しの即時適用モデル / キーキャプチャ方式の再割当 / コンフリクトの非破壊警告（確定させず警告して待つ）。旧 frontend の portal ベース 25 サブセクションは非移植（`SettingsScreen.tsx:20-21` の確定判断を踏襲）
- **変える意匠**: ページヘッダの新設 / 3 ブロックのカード化 / テーマ選択のミニプレビュー化 / スライダーの目盛り + ライブプレビュー文 / ショートカットのカテゴリグループ化 / キャプチャ UI の高さ固定化（シフト解消）/ loading・empty 意匠の定義
- **使う既存部品**: Card（各設定ブロックの容れ物）/ Button（secondary = 変更、ghost = リセット系）/ kbd 風チップ / Sidebar・BottomSheet はシェル側。Toast は使わない（即時反映が視覚フィードバックそのもの）
- **新規に必要な部品候補**（列挙のみ・実装しない）:
  - `ThemePreviewCard` — ミニチュア画面プレビュー付きの選択カード（ラジオ相当）
  - `SteppedSlider` — 目盛り付き離散スライダー（10 段。フォントサイズ以外にも転用可）
  - `ShortcutKeyCapture` — 高さ固定のキー待受チップ（コンフリクト警告内蔵）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降を全文コピー済み（改変・要約なし）。
> 画面固有部は色をロール名（accent / bg-primary 等）で指定し、hex の重複記載を避けている（正本は共通ブロックの表）。

### 4.1 Desktop 用

```text
## Life Editor — デザイン共通前提（全画面共通・v3 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- 各画面の header タブ行の右端に **rightSidebar（詳細パネル）の開閉トグルアイコン**（lucide: PanelRight。open 中は accent 文字 + accent-subtle 地の活性表示、closed 時はニュートラル）を置く。rightSidebar = 右端の幅 320px（min 240px・左端リサイズハンドル）・押し込み式パネル（overlay ではなくメイン領域が縮む。背景はサイドバーと同じ subsidebar 色 + 左 border、上部 48px に「詳細」ヘッダー + 閉じる X）。中身はセクション文脈の詳細・補助 UI（例: 選択中タスクの詳細 = タイトル / ステータス / 内容）。**Desktop 全画面に付ける**（タブなし単画面では画面最上部の右端に同アイコン）
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承。**画面上部・セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 の border 付きボタン）**を置き、タップで左から幅 320px の drawer（黒 30% スクリム）が開いて Desktop の rightSidebar と同一内容を表示する。ナビ用の More ボトムシートとは役割分離（More = ナビ / ハンバーガー = 詳細パネル）

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

## この画面: 設定（Settings）（Desktop 1440×900）

左サイドバーは展開状態で、最下部のユーティリティ枠（本流 5 セクションから区切り線で視覚分離され、Trash と並置される枠）の中の「Settings」がアクティブ。Settings 自体は header タブを持たないタブなし単画面。メインコンテンツは中央寄せ max-width 768px の単一縦カラム。設定は 3 ブロックで、各ブロックを不透明カード（bg-primary 地に border + 角丸 12px + 影 sm）として縦に積む。保存ボタンは置かない（すべて即時反映のモデル）。

### ページヘッダ

- h1「設定」+ 説明 1 行「外観・言語・キーボード操作をここで調整します。変更はすぐに反映されます。」（text-secondary）

### ブロック 1: 外観

- カード見出し「外観」
- 「テーマ」行: ミニチュア画面プレビュー付きの選択カードを 2 枚横並び（ラジオ相当）。
  - 「ライト」カード = bg-primary（light 値）の小さな画面モック（サイドバー + テキスト行 + accent 色のボタンが描かれたミニチュア）
  - 「ダーク」カード = bg-primary（dark 値）の同じ構図のミニチュア
  - 選択中カードは accent 色の枠 2px + 右上にチェックアイコン。非選択は border 色の枠 1px。サンプルでは「ライト」を選択中にする（dark テーマ版フレームでは「ダーク」を選択中にする）
- 「フォントサイズ」行: ラベル左、右端に現在値「16px（4/10）」を tabular-nums で表示。
  - 10 段の目盛り付きスライダー（離散ステップ。つまみは accent 色、トラックの走行済み側も accent、未走行側は border-strong）。目盛りは 10 個の小さな点
  - 両端ラベル「小 12px」（左）「大 25px」（右、text-secondary）
  - スライダーの下にライブプレビュー文を 1 行:「今日の Todo: 買い物リストを作って、夕食の下ごしらえをする」— 現在のフォントサイズ（16px）で表示し、サイズ変更の効果が見えることを示す

### ブロック 2: 言語

- カード見出し「言語」（Globe アイコン添え）+ 説明「表示言語を切り替えます。変更は画面全体に即時反映されます。」（text-secondary）
- 選択カード 2 枚横並び:「English」「日本語」。「日本語」を選択中（accent 枠 + チェックアイコン）。非選択は border 枠 + text-secondary

### ブロック 3: キーボードショートカット

- カード見出し「キーボードショートカット」+ 見出し右端に ghost ボタン「すべてリセット」（RotateCcw アイコン付き）
- カテゴリ見出し（text-secondary の小さめラベル）でグループ化した行リスト。行は区切り線（border 色）で仕切る:
  - 「全般」: コマンドパレットを開く ⌘ K ／ 設定を開く ⌘ , ／ 新しいタスクを作成 T
  - 「移動」: スケジュールへ移動 ⌘ 1 ／ マテリアルへ移動 ⌘ 2 ／ コネクトへ移動 ⌘ 3 ／ ワークへ移動 ⌘ 4 ／ アナリティクスへ移動 ⌘ 5
  - 「編集」: 元に戻す ⌘ Z ／ やり直す ⇧ ⌘ Z
- 行の構成: 左 = アクション名（text-primary）。右 = キーを kbd 風チップ（bg-secondary 地 + border + 等幅数字）+ secondary 小ボタン「変更」
- 「新しいタスクを作成」の行はカスタマイズ済みの例: kbd チップの隣にミント色チップ「変更済み」（chip-mint bg/fg）+ ghost 小ボタン「リセット」を追加表示
- 状態バリエーション（同一フレーム内 or 別フレームで提示）:
  1. キャプチャ中: 「マテリアルへ移動」の行で、kbd チップの位置が accent 枠のチップ「キーを入力…」に置き替わり、下に小さく「Esc でキャンセル」（text-tertiary）。行の高さは通常時と同じに保つ（レイアウトシフトさせない）
  2. コンフリクト警告: キャプチャ中の行の下に danger 色の警告テキスト + 警告アイコン「⌘ 1 は「スケジュールへ移動」に割り当て済みです」。キーは確定されず待受が続く（色だけに頼らず、アイコンと文言で伝える）

### 状態バリエーション（画面全体）

- 通常: 上記のデータ入り状態
- ローディング: 3 カードの中身をスケルトン（見出しバー + 行プレースホルダの角丸矩形、bg-secondary）に置き換えた 1 フレーム
- 空状態: 外観・言語は設定値が常に存在するため空状態なし。ショートカットのみ、読み込み失敗時のプレースホルダ「ショートカット設定を読み込めませんでした」+ ghost ボタン「再読み込み」を行リスト位置に表示する 1 バリエーション

light / dark の両テーマで各 1440×900。dark は色の反転だけでなく、カードの border と影でブロックの層が保たれるように。
```

### 4.2 Mobile 用

```text
## Life Editor — デザイン共通前提（全画面共通・v3 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- 各画面の header タブ行の右端に **rightSidebar（詳細パネル）の開閉トグルアイコン**（lucide: PanelRight。open 中は accent 文字 + accent-subtle 地の活性表示、closed 時はニュートラル）を置く。rightSidebar = 右端の幅 320px（min 240px・左端リサイズハンドル）・押し込み式パネル（overlay ではなくメイン領域が縮む。背景はサイドバーと同じ subsidebar 色 + 左 border、上部 48px に「詳細」ヘッダー + 閉じる X）。中身はセクション文脈の詳細・補助 UI（例: 選択中タスクの詳細 = タイトル / ステータス / 内容）。**Desktop 全画面に付ける**（タブなし単画面では画面最上部の右端に同アイコン）
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承。**画面上部・セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 の border 付きボタン）**を置き、タップで左から幅 320px の drawer（黒 30% スクリム）が開いて Desktop の rightSidebar と同一内容を表示する。ナビ用の More ボトムシートとは役割分離（More = ナビ / ハンバーガー = 詳細パネル）

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

## この画面: 設定（Settings）（Mobile 390×844）

下部タブバー付き（Settings は先頭 4 タブに入らないため "More" タブがアクティブの文脈。More のボトムシートから開かれた後の全画面表示としてデザインする）。上部に画面タイトル「設定」のシンプルなヘッダ。本文は縦 1 カラムで、Desktop と同じカード意匠の設定ブロックを積む。safe-area（上下）を考慮する。

### Mobile の責務（Desktop から落とすもの）

- **キーボードショートカットのブロックは表示しない**。ハードウェアキーボード非前提の環境では再割当も一覧参照も実益がないため、閲覧のみ表示も採らず丸ごと省く（Mobile = 閲覧 + 素早い記録の責務に含まれない）
- 残すのは「外観」と「言語」の 2 ブロックのみ。項目が少ないことは正であり、埋め草の要素を足さない

### ブロック 1: 外観

- カード見出し「外観」
- 「テーマ」: ミニチュアプレビュー付き選択カード 2 枚を横並び（各カードは幅半分弱）。「ライト」= 明るいミニチュア画面、「ダーク」= 暗いミニチュア画面。選択中は accent 枠 2px + チェックアイコン。タップ領域はカード全体（高さ 44px 以上）
- 「フォントサイズ」: ラベルと現在値「16px（4/10）」の行 + 10 段目盛りスライダー（つまみはタッチ向けに大きめ 28px 目安、accent 色）。両端に「小 12px」「大 25px」。下にライブプレビュー文 1 行「今日の Todo: 買い物リストを作って、夕食の下ごしらえをする」を現在サイズで表示

### ブロック 2: 言語

- カード見出し「言語」（Globe アイコン）+ 説明「表示言語を切り替えます。変更は画面全体に即時反映されます。」
- 選択肢は縦積みのフルワイド行 2 本:「English」「日本語」。各行は高さ 48px 以上、右端に選択中チェックアイコン。「日本語」を選択中

### 状態バリエーション

- 通常: 上記のデータ入り状態
- ローディング: 2 カードの中身をスケルトン（角丸矩形、bg-secondary）にした 1 フレーム
- 空状態: この画面は設定値が常に存在するため該当なし（空状態フレームは作らなくてよい）

light / dark の両テーマで各 390×844。ボトムタブバーは不透明（bg-primary 地 + 上辺 border）。
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロックが全プロンプトの冒頭に全文埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（エラー相当 = ショートカットのコンフリクト警告を含む）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（何を出さないか = Shortcuts ブロック非表示）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/SettingsAppearance.tsx` / `SettingsLanguage.tsx` / `SettingsShortcuts.tsx` の改修 + §3 の新規部品候補（ThemePreviewCard / SteppedSlider / ShortcutKeyCapture）
- **✅ 対応済み（v2 / 2026-07-05）**: §4.1 / §4.2 の共通前提ブロックを `_COMMON-CONTEXT.md` の v2 へ全文差し替え、accent 系を Lumen 値（accent light `#1d4ed8` / dark `#5b8cff`、accent-hover `#1e40af` / `#7aa2ff`、accent-subtle `#dbeafe` / `#21273f`、task チップ bg `#dbeafe` / fg `#1e40af`）へ再同期した。旧 accent hex は本ファイルから一掃済み。シェル前提も目標 IA（サイドバー本流 5 + ユーティリティ枠 Settings / Trash・Mobile 固定 4 タブ + More）へ更新済み。これに伴い Status を Ready へ昇格した
- 要件との既知差分: System テーマ自動追従（requirements AC3）と 29 件ショートカットは旧 frontend 実装の記述。現行 web-lean は light/dark 2 値 + 10 件で、本デザインは現行に合わせた
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
