---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Section: connect
Owner-chat: design-connect
Branch: claude/design-brief-connect
---

# Design Brief: Connect（ノードグラフ + バックリンク）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

（`.claude/docs/requirements/` の該当 Feature と現行実装から。引用は `file:line` 付き）

- **目的 / 主ユースケース**: ノート・デイリー・タグを 1 枚の力学グラフ（Canvas 2D + d3-force）に描き、アイテム間の「つながり」を眺める・辿る・編集する画面。WikiTags のタグ体系と item↔item リンク（有向グラフ）が土台（`.claude/docs/requirements/tier-2-supporting.md:172`、接続の定義は同 `:181`）。グラフは unified item-link 読み取り 4 本（notes / dailies / tags / assignments）+ connections から構築される（`web/src/connect/ConnectScreen.tsx:73-78`、`shared/src/components/Connect/graph/buildGraphModel.ts:36-51`）
- **表示するデータ**（エンティティ・件数感・現実的なサンプル値）:
  - ノード 4 種（`shared/src/components/Connect/graph/graph-types.ts:8`）: project（= フォルダ。例「Life Editor 開発」「引っ越し 2026」）/ note（例「Supabase 移行の設計メモ」「新居の初期費用見積もり」）/ daily（日付ラベル。例「2026-07-05」）/ tag（例「#開発」「#読書」）
  - エッジ 4 種（`buildGraphModel.ts:46-50`）: hierarchy（フォルダ→ノート）/ manual（item↔item リンク = 本命の Obsidian 風接続）/ tag（アイテム→タグ）/ temporal（連続するデイリーの鎖）
  - 件数感: N=1 個人ツール。ノート数十 + デイリー ~30 + タグ ~10 で **40〜80 ノード / 60〜120 エッジ**が現実レンジ
- **主要操作**（作成 / 編集 / 削除 / 並替 / フィルタ等）:
  - ノード選択（クリック）/ 開く（ダブルクリックで note・daily に遷移。`ConnectGraphView.tsx:163-172`）/ Esc で選択解除・Cmd/Ctrl+F で検索・R で再加熱（`ConnectGraphView.tsx:176-204`）
  - 検索・種別フィルタ・タグフィルタ・ローカルグラフ深度（0/1/2-hop）・orphan 表示・ラベル表示（`GraphControlPanel.tsx:119-267`）
  - force 4 パラメータ調整: repel -600〜-30（既定 -280）/ link distance 10〜120px（既定 50）/ center 0〜0.3（既定 0.05）/ collide 0〜2（既定 1）（`GraphControlPanel.tsx:269-301`、既定値は `graph/useGraphSimulation.ts:29-34`）
  - リンク作成（選択カードの入力 + datalist 候補 → Plus。`SelectedNodeCard.tsx:181-216`）/ リンク削除（つながり行の X。`SelectedNodeCard.tsx:256-265`）。失敗は danger トースト（`ConnectScreen.tsx:149`）
- **Desktop / Mobile の責務分割**（Mobile = Consumption + Quick capture。**何を落とすかを明記**）:
  - Desktop = 全機能。グラフはビューポート全幅（fluid セクション。`web/src/MainScreen.tsx:190`）
  - Mobile = **閲覧特化**。力学グラフの自由操作（pan/zoom 主体の探索・force 調整・リンク編集）は落とし、**検索 → ノード詳細 → バックリンク一覧**の縦導線を主役にする。簡易ローカルグラフ（選択ノード中心 1-hop の静的表示）は任意の添え物
  - 旧 WikiTag 要件では Desktop only（`tier-2-supporting.md:168`）だったが、現行 web は unified モデルで Connect セクション自体は Mobile シェル（768px 分岐 — `shared/src/components/AppShell.tsx:65`）にも露出するため、Mobile 用の閲覧 UI を新規に設計する

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/connect/ConnectScreen.tsx`（WikiTagsUnifiedProvider をマウントし、データ + ラベルを注入。`:41-47`）
- **shared 部品**: `shared/src/components/Connect/` — `ConnectGraphView.tsx`（構成ルート）/ `GraphCanvas.tsx`（Canvas 2D + d3-force）/ `GraphTopBar.tsx` / `GraphControlPanel.tsx` / `SelectedNodeCard.tsx` / `BacklinkView.tsx` + `primitives/`（IconButton / Section / Slider / Toggle）
- **特徴的 UI**（グリッド / グラフ / キャンバス / DnD / エディタ等）: フルスクリーンの Canvas グラフの上に HUD が浮かぶ構造 —
  - 左上: ステータスピル（タイトル・「12/74n · 90e」風のノード/エッジ数 mono 表示・アクティブフィルタ数・ズーム%。`GraphTopBar.tsx:33-56`）
  - 右上: アイコンボタン 3 個（再加熱 / ビューリセット / パネル開閉。`GraphTopBar.tsx:58-73`）
  - 右側: フロート設定パネル w-72（検索 / Node Types / Tags / Local Graph / Display / Forces の 6 セクション。`GraphControlPanel.tsx:100-103`）
  - 左下: 選択ノードカード w-80（種別アイコン・ラベル・生 ID・リンク/タグ数・深度切替・リンク追加・つながり一覧。`SelectedNodeCard.tsx:121`）
  - 右端: バックリンク常設サイドバー w-64（`BacklinkView.tsx:40`）
  - ノード色はテーマの CSS 変数から解決: project = text-primary / note = accent / daily = 藍 `#5b6cdb`（routine dot トークン実値）/ tag = text-secondary。note.color / tag.color があれば優先（`graph/graph-theme.ts:59-79`）
- **状態の現状**: empty（`labels.graphEmpty` センター表示。`ConnectGraphView.tsx:253-257`）/ フィルタ 0 件（noMatch + クリアボタン。`:237-251`）はある。**loading は未実装**（EMPTY_STATIC から開始するため初回フェッチ中に empty 文言が一瞬出る。`ConnectScreen.tsx:57-85`）。error はリンク編集失敗の danger トーストのみ
- **現状の課題**（デザイン観点で改善したい点。これがプロンプトの「良くしたい方向」になる）:
  1. loading 状態が無く、データ到着前に「グラフが空です」が誤表示される
  2. ノード色の凡例が画面のどこにも無く、**色だけで種別を伝えている**（PRINCIPLES §3.6 の「色だけで状態を伝えない」に反する）
  3. （現物確認で解決済み）バックリンクは実装上すでに選択ノードがある時だけ表示される（`ConnectGraphView.tsx:77` の `backlinks.length > 0 && selectedNode` 条件）。未選択時はパネルを出さずキャンバスを広く使えている。デザインでもこの「選択時のみ表示」を踏襲する（常設サイドバーには戻さない）
  4. HUD（TopBar / 右パネル / 左下カード）が Canvas 上で衝突しがちで、階層感（影・角丸・余白）の統一が弱い
  5. 文字が 10〜13px + mono 多用で「開発者ツール」寄りの密度。閲覧の心地よさが不足
  6. リンク作成が生 ID も受ける datalist 入力頼みで、発見性が低い（玄人向け UI）
  7. Mobile レイアウトが未設計（Desktop HUD がそのまま縮むだけでは touch で成立しない）

## 3. デザイン方針（このセッションの提案）

- **残す意匠 / 変える意匠**:
  - 残す: フルスクリーン Canvas + 浮遊 HUD という基本構造 / ノード 4 種の色符号（project = text / note = accent / daily = 藍 / tag = text-secondary）/ 左上ステータスピル + 右上アイコン群という配置 / バックリンクの「← 誰からリンクされているか」リスト
  - 変える: loading（skeleton またはグラフ枠 + スピナー）を新設 / **種別凡例チップ（色 + アイコン + ラベル）を常設**して色依存を解消 / HUD の elevation・角丸・余白を部品語彙（Card / shadow 3 段）に統一 / リンク追加はコマンドパレット風の候補リスト表示に
- **使う既存部品**（Button / Card / Sheet / BottomSheet / Menu / Toast / Sidebar / Kanban / MasterDetail / CommandPalette 等）: Card（HUD パネル類）/ Toast（リンク編集失敗）/ BottomSheet（Mobile のノード詳細）/ CommandPalette の意匠（リンク先候補・Mobile 検索結果）/ Sidebar・下部タブはアプリシェル側
- **新規に必要な部品候補**（部品層 `shared/src/components/` への追加候補として列挙するだけ。実装しない）:
  - `GraphLegend`（種別凡例チップ列。色 + lucide アイコン + ラベル）
  - `NodeDetailSheet`（Mobile 用: ノードメタ + つながり + バックリンクを 1 枚にした BottomSheet）
  - `GraphSkeleton`（loading 用のプレースホルダ描画）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降を**全文コピー**してから、画面固有の指示を続ける。
> プロンプトは日本語で書く（コンポーネント名・色値は英語 / hex のまま）。
> 表示データは現実的な日本語サンプル値で具体的に指定する。

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

## この画面: Connect — ノードグラフ + バックリンク（Desktop 1440×900）

ノート・デイリー・タグのつながりを 1 枚の力学グラフ（点と線のネットワーク図）として眺め、選んだノードの詳細とバックリンク（そのノートに向かって張られたリンクの逆一覧）を確認・編集する画面。Obsidian のグラフビューに相当する。

### レイアウト構造

- 左サイドバー（展開 240px、"Connect" がアクティブ）以外の**全面をグラフキャンバスが占める**（中央寄せ max-width は適用しない全幅画面）。キャンバス地は bg-primary
- キャンバスの上に UI が「浮かぶ」HUD 構造。各フロートパネルは**完全不透明の bg-primary + border + 控えめな影（elevation md）+ 角丸 8〜12px** で統一する:
  - 左上: ステータスピル — 画面名「Connect」、ノード/エッジ数（例「74/74n · 96e」の等幅数字）、ズーム率「100%」、フィルタが効いている時だけ「フィルタ 2 件 ×」クリアチップ
  - 左上・ステータスピルの直下: **種別凡例チップ列**（新設） — 色ドット + アイコン + ラベルの 4 チップ「● プロジェクト / ● ノート / ● デイリー / ● タグ」。色だけに頼らずアイコンとラベルで種別が分かるようにする
  - 右上: アイコンボタン 3 個（再配置＝シミュレーション再加熱 RotateCcw / 全体表示にリセット Maximize2 / 設定パネル開閉 Settings2）
  - 右側: 設定パネル（幅 288px、上下いっぱいのフロート、内部スクロール）。セクション: 検索（虫めがね付き入力）/ ノード種別（4 行トグル。各行にアイコン + ラベル + 「12/74」の件数）/ タグ（#タグ名 のチップを折返し並べ、選択中はアクセント枠）/ ローカルグラフ（選択ノードから 0 / 1-hop / 2-hop の深さ切替）/ 表示（「未接続ノードを表示」「ラベルを表示」の 2 トグル）/ 力学調整（反発力・リンク距離・中心引力・衝突半径の 4 スライダー、既定値 -280 / 50px / 0.05 / 1.0）
  - 左下: 選択ノードカード（幅 320px） — 種別アイコン + タイトル（例「Supabase 移行の設計メモ」）+ 小さな ID 表記、「リンク 4 · タグ 2」のメタ行、ローカル深度の 3 ボタン（オフ / 1-hop / 2-hop）、リンク追加入力（プレースホルダ「リンク先を検索…」+ 追加ボタン。入力すると下に候補リストが浮かぶコマンドパレット風）、つながり一覧（アイコン + 名前の行。ホバーで行末に削除 × が現れる。最大高でスクロール）
  - 右端: バックリンクパネル（幅 256px、縦一列） — **ノード選択時のみ表示**。ヘッダ「バックリンク」+ 選択ノード名、その下に「← ノート名」の行リスト。未選択時はこのパネル自体を出さない（キャンバスを広く使う）
- グラフ本体: ノードは塗り circle + 下にラベル（12px、text-secondary）。エッジは細線。選択ノードは accent のリング + 接続エッジをハイライト、非隣接ノードは減光。ホバーでリングとラベル強調

### ノードとエッジの色（共通パレットの役割参照。テーマに追随）

- ノード: プロジェクト（フォルダ）= text-primary / ノート = accent / デイリー = 藍（light `#5b6cdb` / dark `#818cf8`。既存の routine 系ドットトークンの実値で、テーマに追随する）/ タグ = text-secondary
- エッジ: 階層（フォルダ→ノート）= border / 手動リンク（本命の item↔item）= accent / タグ紐付け = text-secondary / デイリー連鎖 = デイリーと同じ藍
- ノート・タグに個別色が設定されている場合はそれを優先（サンプルでは 2〜3 個だけカテゴリ 10 色から使ってよい）

### 表示データ（日本語の現実的サンプル。40〜80 ノード規模の「使い込まれた」見え方）

- プロジェクト（フォルダ）: 「Life Editor 開発」「引っ越し 2026」「読書」「健康管理」
- ノート: 「Supabase 移行の設計メモ」「Connect 画面のデザイン検討」「新居の初期費用見積もり」「内見チェックリスト」「SICP 第 2 章の要点」「習慣トラッカーの反省」「週次レビューの型」など 20〜30 個
- デイリー: 「2026-06-28」〜「2026-07-05」あたりの日付ノードが鎖状につながる
- タグ: 「#開発」「#設計」「#引っ越し」「#読書」「#振り返り」「#健康」など 8〜12 個
- 選択ノードカードの例: 「Supabase 移行の設計メモ」（リンク 4 · タグ 2）。つながり: 「Connect 画面のデザイン検討」「週次レビューの型」「2026-07-04」「#設計」。バックリンク: 「← 週次レビューの型」「← 2026-07-02」

### 状態バリエーション

- 通常: 上記データでノード選択中（凡例・設定パネル・選択カード・バックリンクパネルがすべて見える 1 枚も含める）
- 空: ノードが 1 つも無い。中央に Network アイコン + 「まだつながりがありません」+ 補足 1 行（「ノートにタグやリンクを付けると、ここに広がっていきます」）
- ローディング: 中央にスピナー + 「グラフを準備しています…」。HUD はステータスピルだけ薄く表示（現状はローディングが無く空表示が一瞬出る問題があるため、明確に区別する）
- フィルタ 0 件: グラフは描かれず、中央に Filter アイコン + 「条件に合うノードがありません」+ 「フィルタをクリア」ボタン
- エラー（軽量）: 画面右下に danger のトースト「リンクを作成できませんでした」が出ている状態を 1 枚

### その他

- light / dark 両テーマ必須。dark ではキャンバス地 `#16161a` の上でノード色・エッジ色が沈まないこと（特に text-primary ノードと border エッジのコントラスト）
- キーボード操作の存在を示す小さなヒント（例: 設定パネル下部に「Esc 選択解除 · ⌘F 検索 · R 再配置」の 1 行、text-tertiary）
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

## この画面: Connect — つながり閲覧（Mobile 390×844）

ノート・デイリー・タグのつながりを「検索して、選んで、バックリンクを辿る」ための**閲覧特化**画面。Desktop 版はフルスクリーンの力学グラフ + 設定パネル + リンク編集を持つが、Mobile では以下を**すべて落とす**:

- 力学グラフの自由操作（ピンチズーム・パンで探索する大きなキャンバス）
- 力学調整スライダー・未接続ノード/ラベル表示トグル等の設定パネル一式
- リンクの作成・削除（編集系はすべて Desktop の責務）
- キーボードショートカット

代わりに **検索 → ノード詳細 → バックリンク一覧** の縦導線を主役にする。

### レイアウト構造（縦 1 カラム。下部タブバー込み・safe-area 考慮）

- ヘッダ: 画面名「Connect」+ 検索バー（常設。プレースホルダ「ノート・デイリー・タグを検索」。虫めがねアイコン、入力中は × クリア）
- 検索バー直下: 種別フィルタチップ 4 個（横スクロール可: 「プロジェクト」「ノート」「デイリー」「タグ」。各チップに色ドット + アイコン。選択でアクセント枠）
- 本文リスト: ノード一覧（検索・フィルタ結果）。各行 = 種別アイコン（種別色）+ タイトル + 右端に「リンク 4 · ← 2」の小さなメタ（つながり数とバックリンク数）。行高はタップしやすい 44px 以上
- 行タップ → **ノード詳細のボトムシート**（画面の 7〜8 割の高さ、上端に取っ手、背景は完全不透明の bg-primary、背後は黒 30% バックドロップ）:
  - ヘッダ: 種別アイコン + タイトル（例「Supabase 移行の設計メモ」）+ 種別チップ（例「ノート」）+ 「開く」ボタン（accent。ノート/デイリー本文へ遷移）
  - 簡易ローカルグラフ（任意・静的）: 選択ノードを中心に 1-hop の隣接ノードだけを円形配置した小さな図（高さ 180px 程度、操作不可の読み取り専用。ノード色は Desktop と同じ種別色: プロジェクト = text-primary / ノート = accent / デイリー = 藍（light `#5b6cdb` / dark `#818cf8`、既存 routine 系ドットトークンの実値）/ タグ = text-secondary）
  - セクション「つながり」: リンク先の行リスト（アイコン + 名前。タップでそのノードの詳細に差し替わる）
  - セクション「バックリンク」: 「← ノート名」の行リスト（このノードに向かってリンクしている元。タップで同様に遷移）
  - 編集ボタンは置かない（閲覧のみ。Desktop で編集する）

### 表示データ（日本語の現実的サンプル）

- 検索結果リストの例: 「Supabase 移行の設計メモ」（リンク 4 · ← 2）/ 「Connect 画面のデザイン検討」（リンク 3 · ← 1）/ 「新居の初期費用見積もり」（リンク 2 · ← 1）/ 「2026-07-05」（リンク 3）/ 「#開発」（12 件）など 8〜12 行
- 詳細シートの例: 「Supabase 移行の設計メモ」。つながり: 「Connect 画面のデザイン検討」「週次レビューの型」「2026-07-04」「#設計」。バックリンク: 「← 週次レビューの型」「← 2026-07-02」

### 状態バリエーション

- 通常: 検索結果リスト表示の 1 枚 + 詳細シートが開いた 1 枚
- 空: ノードが 1 つも無い。中央に Network アイコン + 「まだつながりがありません」+ 補足 1 行（「ノートにタグやリンクを付けると、ここに集まってきます」）
- ローディング: リスト行のスケルトン（アイコン丸 + テキスト帯を 6〜8 行）
- 検索 0 件: 「『初期費用』に一致するものがありません」+ 「検索をクリア」テキストボタン

### その他

- light / dark 両テーマ必須（dark 地は #16161a）
- 種別は色 + アイコン + ラベルの併用で伝える（色だけに頼らない）
- 下部タブバーは「More」経由セクションのため、タブバー自体は既定 4 タブ表示のままでよい
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロックが**全プロンプトの冒頭に全文**埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（Desktop はフィルタ 0 件 + エラートーストも）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（**何を出さないか**）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/Connect/`（既存）+ 新規部品候補 `GraphLegend` / `NodeDetailSheet` / `GraphSkeleton`（生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
- **既知ドリフト（v1 作成時に検出 → 2026-07-05 解消済み）**: v1 時点では `_COMMON-CONTEXT.md` のパレット表の accent 系 5 値が正本 `shared/src/styles/tokens.css`（PR #135 の lumen 化で accent `#1d4ed8` / hover `#1e40af` / subtle `#dbeafe` / dark `#5b8cff` / `#7aa2ff` に更新）より古かった。その後 `_COMMON-CONTEXT.md` は v2 / 2026-07-05 で追随し、本 brief も v2 改訂（PR #157）で全プロンプトを同期済み。旧値の列挙は機械チェック（旧 accent hex の grep = 0 件）を通すため本注記から除去した（整合監査 follow-up・chat-frontend）
- **共通表の未収載色**: Connect のデイリーノード / デイリー連鎖エッジが使う routine 系ドット色（light `#5b6cdb` / dark `#818cf8` = `--color-chip-routine-dot` の実値）は `_COMMON-CONTEXT.md` のパレット表に載っていない（表にあるのは routine チップの bg/fg のみ）。本 brief では §4 プロンプト内に light/dark 実値を直接明記して自己完結させた。COMMON 追随更新の際にドット色 3 種（routine / event / task）を表へ足すことを推奨
