---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Section: work
Owner-chat: design-work-v2
Branch: claude/design-work-v2
---

# Design Brief: Work（ポモドーロタイマー）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

- **目的 / 主ユースケース**: 集中作業サイクルを WORK / BREAK / LONG_BREAK の 3 フェーズで管理するポモドーロタイマー。タスクに紐付けて `timer_sessions` に記録し、Analytics / サイドバー / TaskTree に残り時間を同期表示する（`.claude/docs/requirements/tier-2-supporting.md:119-121`, `:133`）。主ユースケース: タスクを選んで 25 分集中 → 5 分休憩 → 4 セット目の後に長休憩。
- **表示するデータ**:
  - タイマー状態: フェーズ（3 種）/ 残り時間 MM:SS / 進捗 0–100% / 稼働中フラグ（`web/src/work/WorkScreen.tsx:103-107`）
  - セッション進捗: `completedSessions` / `targetSessions`（`web/src/work/WorkScreen.tsx:80-83`。例: 2 / 4）
  - 紐付けタスク + 候補リスト: 葉 task ノード・削除済み除外（`web/src/work/WorkScreen.tsx:52-69`。件数感 10〜30 件）
  - 設定値: WORK / BREAK / LONG_BREAK 分数・セット数（`sessionsBeforeLongBreak`）・目標セッション数・休憩自動開始（`web/src/work/WorkScreen.tsx:153-159`）
  - プリセット一覧: 名前 + 4 つの設定値（`shared/src/components/PomodoroSettings.tsx:18-25`。件数感 2〜5 件）
  - 環境音 5 種: rain / wind / ocean / birds / fire、各 on/off + ボリューム 0–100（`shared/src/constants/sounds.ts:31-37`。要件文書 `tier-2-supporting.md:37` は旧スタックの 6 種表記だが、現行は thunder を除外した 5 種が確定スコープ）
- **主要操作**（要件: `tier-2-supporting.md:126-133`）:
  - タイマー: 開始 / 一時停止 / リセット / スキップ（`web/src/work/WorkScreen.tsx:96-98,116-119`）
  - **一時停止中のみ ±5 分調整**（`tier-2-supporting.md:129`, AC4 `:145` — 現行 Web UI 未実装。デザインで復活させる）
  - タスク選択 / クリア（`shared/src/components/PomodoroTaskSelector.tsx:47-82`）
  - 設定変更 + プリセット CRUD（保存 / 適用 / 削除。`shared/src/components/PomodoroSettings.tsx:126-173`）
  - 環境音のトグル + ボリューム調整（`shared/src/components/AudioMixer.tsx:53-89`）
  - WORK 完了時: 完了音 + 通知 + `SessionCompletionModal`（AC2 `tier-2-supporting.md:143` — モーダル意匠は未デザイン）
- **Desktop / Mobile の責務分割**: Desktop = 全機能（タイマー + タスク紐付け + 環境音ミキサー + 設定/プリセット）。**Mobile = タイマー主役の全画面 + タスク選択のみ**。Mobile で落とすもの: ①環境音ミキサー（AudioProvider が Mobile 省略 Provider のため非搭載 — `web/src/work/WorkScreen.tsx:133-137` の null ガード）②設定・プリセット CRUD（Desktop 専用）。History / Music / FREE モードは**意図的に廃止済みで復活させない**（`web/src/work/WorkScreen.tsx:25-28`）。

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/work/WorkScreen.tsx:101`（`grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]` — 左 = タイマー縦積み / 右 = 設定パネル 320px。lg 未満は 1 カラム縦積み）
- **shared 部品**:
  - `shared/src/components/PomodoroTimer.tsx` — フェーズチップ + SVG 円形進捗リング（r=86 / 線幅 10、`:41-42`）+ font-mono 4xl の MM:SS（`:110-120`）+ transport 3 ボタン（`:123-161`）
  - `shared/src/components/PomodoroTaskSelector.tsx` — native `<select>` 候補ピッカー / 選択済みはチップ + クリア（`:47-82`）
  - `shared/src/components/PomodoroSettings.tsx` — NumberField ×5 の 2 列グリッド（`:75-114`）+ 自動開始 checkbox（`:116-124`）+ プリセット行リスト & 保存フォーム（`:126-173`）
  - `shared/src/components/AudioMixer.tsx` — アイコントグル + range スライダー + 数値の行 ×5（`:53-89`）
- **特徴的 UI**: stroke-dashoffset を 1 秒 linear で更新する円形進捗リング（`PomodoroTimer.tsx:103-108`）。フェーズ→色は WORK = accent / BREAK・LONG_BREAK = success の 2 値のみ（`PomodoroTimer.tsx:46-50`）
- **状態の現状**: empty はタスクセレクタの「なし」placeholder のみ（`PomodoroTaskSelector.tsx:73-75`）。候補 fetch 失敗は空配列 fallback で無表示（`WorkScreen.tsx:63-65`）。loading / error の意匠なし。プリセット 0 件は空リストのまま
- **現状の課題**（デザイン観点）:
  1. BREAK と LONG_BREAK が同色で、フェーズ 3 種の視覚区別が弱い（`PomodoroTimer.tsx:46-50`）
  2. セッション進捗がテキストのみ。要件のドットインジケーター（`tier-2-supporting.md:128`）が新 UI に未実装
  3. 一時停止中の ±5 分調整（AC4 `tier-2-supporting.md:145`）が新 UI に未実装
  4. 右パネルの設定フォームが常時剥き出しで視覚的重量が大きく、タイマーの没入感を削ぐ（稼働中に触る要素ではない）
  5. タスクセレクタが native select で素っ気なく、候補が多いと探しにくい
  6. WORK 完了時の `SessionCompletionModal`（AC2）の意匠が未定義
  7. 空 / ローディング / エラー状態の意匠が未設計

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: 円形進捗リング + 中央 MM:SS の等幅大数字 / フェーズチップ / 左メイン + 右 320px の 2 カラム / Card ベースの区画 / 環境音行の「アイコントグル + スライダー + 数値」構造
- **変える意匠**:
  - フェーズ 3 色符号化: WORK = accent（Lumen blue）/ BREAK = accent-secondary（ミント）/ LONG_BREAK = 琥珀 `#f59e0b`（グラフ カテゴリ色。Analytics の長休憩符号 `--color-chart-phase-long-break` と同一で画面間一貫）
  - セッションドットインジケーター（セット内位置）+ 数値の併記
  - 一時停止中のみの ±5 分ボタン復活
  - 右パネルを「タイマー設定」「プリセット」の 2 ブロックに階層化し、稼働中は減光して主役（タイマー）を立てる
  - タスクセレクタのリッチ化と、WORK 完了モーダルの意匠定義
- **使う既存部品**: Card / Button / IconButton / Input / BottomSheet（Mobile タスク選択）/ Toast / Menu
- **新規に必要な部品候補**（列挙のみ・実装しない）: SessionDots（セット内進捗ドット）/ PhaseBadge（フェーズ色チップ）/ SessionCompletionModal（完了モーダル意匠）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降を**全文コピー**してから、画面固有の指示を続ける。

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
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                   | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                   | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）               | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                            | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）               | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                              | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                        | `#0f7b6c`             | `#4dab9a`             |
| danger                                         | `#d92d20`             | `#ef4444`             |
| info                                           | `#2563eb`             | `#60a5fa`             |
| warning                                        | `#b45309`             | `#fbbf24`             |

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

## この画面: Work — ポモドーロタイマー（Desktop 1440×900）

集中作業を WORK（作業）/ BREAK（短い休憩）/ LONG_BREAK（長い休憩）の 3 フェーズで回すポモドーロタイマー画面。タイマーが主役で、タスク紐付けと環境音ミキサーが脇を固め、右側に設定・プリセットのパネルが付く。過去セッションの履歴一覧・音楽ライブラリ・自由計測（カウントアップ）モードは意図的に廃止済みなので、そのためのタブや領域は一切作らない。

### レイアウト

- メインコンテンツは 2 カラム: 左（可変幅）= タイマー本体の縦積み、右（固定 320px）= 設定・プリセットパネル
- 左カラムの縦積み（上から）:
  1. タイマーカード — 上部にフェーズチップ、中央に円形進捗リング（直径 200px 前後・線幅 10px 前後）、リング中央に MM:SS の大きな等幅数字とセッション進捗、下部に操作ボタン列
  2. タスク紐付けカード — このセッションをどのタスクに記録するかを選ぶ小さなカード
  3. 環境音ミキサーカード — 5 種の環境音（雨・風・波・鳥・焚き火。lucide の CloudRain / Wind / Waves / Bird / Flame）の行リスト
- 右パネル（320px）: 「タイマー設定」ブロック（作業・休憩・長い休憩の分数、セットあたりセッション数、1 日の目標セッション数、休憩の自動開始トグル）と「プリセット」ブロック（保存済みプリセットのリスト + 現在の設定を名前を付けて保存するフォーム）

### フェーズの視覚区別（この画面の最重要ポイント）

- WORK = accent（Lumen blue）/ BREAK = accent-secondary（ミント）/ LONG_BREAK = 琥珀 `#f59e0b`（グラフ カテゴリ 10 色の 3 番目。分析画面が長休憩をこの琥珀で符号化しており、画面間で色の意味を揃える）
- 進捗リング・フェーズチップ・主ボタンの色相をフェーズに追従させ、一目で「作業中か・休憩中か・長い休憩か」が分かるようにする。ただし色だけに頼らず、フェーズチップには必ずラベル（作業 / 休憩 / 長い休憩）を書く
- セッション進捗は 2 段構え: セット内位置のドットインジケーター（例: 4 個中 2 個塗り ●●○○）+ 「今日 2 / 4 セッション」の数値表記

### 操作要素

- 稼働中: 一時停止（Pause）を主ボタンに、リセット（RotateCcw）・スキップ（SkipForward）を補助ボタンで
- 停止・一時停止中: 開始（Play）が accent 塗りの主ボタン。**一時停止中のみ** −5 分 / ＋5 分 の残り時間調整ボタンを表示する（稼働中は出さない）
- タスク紐付けカード: 未選択時は「タスクを選択…」プレースホルダのセレクタ、選択済みはタスク名チップ + クリア（X）ボタン
- 環境音の行: アイコントグル（ON = accent 塗り・OFF = 枠線のみ）+ サウンド名 + 0–100 のボリュームスライダー + 数値。OFF の行はスライダーを無効化して減光
- 右パネルのプリセット行: プリセット名 + 設定値のミニ表記（例: 25·5·15·×4）+「適用」テキストボタン + 削除アイコン（Trash2）。タイマー稼働中は設定ブロック全体を減光してタイマーの邪魔をしない

### 表示データ（このサンプル値で組む）

- フェーズ: WORK 稼働中、残り 17:42 / 25:00（リングは約 3 割消化）
- セッション: 今日 2 / 4 セッション完了（ドット ●●○○）
- 紐付け中のタスク: 「確定申告の書類を集める」
- タスク候補（セレクタ内）: 「週次レビューを書く」「引っ越し見積もりの比較」「ブログ記事『積読の崩し方』の推敲」「英語の音読 15 分」
- プリセット: 「標準 25/5」（25 / 5 / 15 / ×4）・「深い集中 50/10」（50 / 10 / 30 / ×2）・「朝の助走 15/3」（15 / 3 / 10 / ×4）
- 環境音: 雨 ON・60 / 焚き火 ON・35 / 風 OFF・50 / 波 OFF・50 / 鳥 OFF・50

### 状態バリエーション

1. 通常（WORK 稼働中・上記サンプル値）
2. 一時停止中（主ボタンが「再開」になり、−5 分 / ＋5 分ボタンが現れる）
3. BREAK 稼働中（ミント基調に切り替わった全景。残り 03:12 / 5:00）
4. WORK 完了モーダル（「セッション 2 が完了しました」の見出し + 「休憩を開始」主ボタン / 「もう 1 セッション」/ 「閉じる」。背後は黒 30% バックドロップ、モーダル本体は完全不透明）
5. 空状態（タスク未選択・タスク候補 0 件で「紐付けられるタスクがありません」・プリセット 0 件で「プリセットはまだありません」）
6. ローディング（タスク候補の読み込み中スケルトン。タイマー本体はローカル状態なので即時表示のまま）

通常 / 空 / ローディングは light・dark の両テーマで作る。一時停止・BREAK・完了モーダルのバリエーションは light のみでもよい。
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
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                   | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                   | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）               | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                            | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）               | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                              | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                        | `#0f7b6c`             | `#4dab9a`             |
| danger                                         | `#d92d20`             | `#ef4444`             |
| info                                           | `#2563eb`             | `#60a5fa`             |
| warning                                        | `#b45309`             | `#fbbf24`             |

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

## この画面: Work — ポモドーロタイマー（Mobile 390×844）

Desktop 版と同じポモドーロタイマーの Mobile 版。Mobile は「閲覧 + 素早い記録」に責務を絞るため、この画面は**タイマー主役の全画面 + タスク選択だけ**で構成する。

### Desktop から落とすもの（作らない）

- 環境音ミキサー（Mobile には音声機能を載せない方針のため、行リストも折り畳みも作らない）
- タイマー設定・プリセットの編集パネル（分数・セット数・プリセットの作成 / 削除は Desktop 専用。Mobile は現在の設定でそのまま回す）
- 過去セッションの履歴一覧・音楽ライブラリ・自由計測モード（そもそも廃止済み）

### レイアウト

- 下部タブバー込みの 1 カラム全画面。タイマーが視覚の中心で、余白を広く取って集中を邪魔しない
- 上部: フェーズチップ（作業 / 休憩 / 長い休憩）
- 中央: 円形進捗リング（直径 260–280px）+ 中央に MM:SS の等幅大数字。リング下にセット内進捗ドット（●●○○）と「今日 2 / 4 セッション」
- その下: タスク紐付け行（選択済み = タスク名チップ + クリア（X）。未選択 = 「タスクを選ぶ」ボタン → タップで候補リストのボトムシートを開く）
- 下部: 操作ボタン列。開始 / 一時停止を大きな主ボタン（accent 塗り・タップターゲット 44px 以上）に、リセット・スキップを左右の補助アイコンボタンに。親指が届く下寄り配置
- **一時停止中のみ** −5 分 / ＋5 分の調整ボタンを表示する

### フェーズの視覚区別

- WORK = accent（Lumen blue）/ BREAK = accent-secondary（ミント）/ LONG_BREAK = 琥珀 `#f59e0b`（グラフ カテゴリ 10 色の 3 番目。分析画面の長休憩の符号色と同じ）
- リング・フェーズチップ・主ボタンの色相をフェーズに追従させる。色だけに頼らず、チップのラベル（作業 / 休憩 / 長い休憩）で必ず明示する

### 表示データ（このサンプル値で組む）

- フェーズ: WORK 稼働中、残り 17:42 / 25:00（リングは約 3 割消化）、今日 2 / 4 セッション
- 紐付け中のタスク: 「確定申告の書類を集める」
- ボトムシートのタスク候補: 「週次レビューを書く」「引っ越し見積もりの比較」「ブログ記事『積読の崩し方』の推敲」「英語の音読 15 分」

### 状態バリエーション

1. 通常（WORK 稼働中・上記サンプル値）
2. 一時停止中（主ボタンが「再開」になり、−5 分 / ＋5 分が現れる）
3. BREAK 稼働中（ミント基調。残り 03:12 / 5:00）
4. タスク選択ボトムシート展開（候補リスト + 「選択を外す」行。シート本体は完全不透明・背後は黒 30% バックドロップ）
5. 空状態（タスク候補 0 件で「紐付けられるタスクがありません」）
6. ローディング（候補読み込み中のスケルトン。タイマー本体は即時表示のまま）

通常 / 空 / ローディングは light・dark の両テーマで作る。他のバリエーションは light のみでもよい。ホームインジケータの safe-area を考慮する。
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロックが**全プロンプトの冒頭に全文**埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（エラーはこの画面に該当面なし — 候補 fetch 失敗は空扱い）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（**何を出さないか**）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/`（SessionDots / PhaseBadge / SessionCompletionModal の新意匠は生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
- ✅ **v2 同期済み（2026-07-05）**: §4 の共通前提ブロックを `_COMMON-CONTEXT.md` v2（見出し `v2 / 2026-07-05`）へ全文差し替え。accent 系 hex を PR #135 の Lumen blue 化（`tokens.css` 正本）に同期し（light accent `#1d4ed8` / hover `#1e40af` / subtle `#dbeafe`、dark accent `#5b8cff` / hover `#7aa2ff`、task チップ bg `#dbeafe` fg `#1e40af`）、旧 accent 系 hex を全廃。シェル記述を旧フラットセクション列挙から目標 IA（サイドバー本流 5 + ユーティリティ枠 Settings / Trash・Mobile 固定 4 タブ + More）へ差し替え。Status を Ready 化
