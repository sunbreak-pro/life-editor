---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Section: schedule
Owner-chat: design-schedule-v2
Branch: claude/design-schedule-v2
---

# Design Brief: Schedule（スケジュール）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

（`.claude/docs/requirements/tier-1-core.md` の「Feature: Schedule (Routine + ScheduleItems + CalendarTags)」`tier-1-core.md:78` と現行実装から）

- **目的 / 主ユースケース**: 1 日の運用（Day）と反復パターン（Routine）を束ねる「1 日の運用中枢」（`tier-1-core.md:89`）。ルーチンを 1 回定義すると日々の予定（ScheduleItem）が自動展開され（1 週間先まで backfill、`shared/src/hooks/useScheduleItemsRoutineSync.ts:157`）、単発の予定と同じカレンダーに並ぶ。朝に今日の流れを確認し、日中に完了チェックを付け、週末に翌週を計画する、という使い方が主軸。
- **表示するデータ**:
  - `ScheduleItem`（`shared/src/types/schedule.ts:1`）: `date` / `startTime` / `endTime` / `isAllDay` / `completed` / `memo` / `routineId`（`tier-1-core.md:95`）。週あたり 15〜40 件で Routine 由来が過半。例:「朝のストレッチ 7:00–7:15」「歯科検診 14:00–15:00」
  - `RoutineNode`: `frequencyType = "daily" | "weekdays" | "interval" | "group"`（`shared/src/types/routine.ts:4`）+ `frequencyDays`（曜日）/ `frequencyInterval`（N 日ごと）/ `frequencyStartDate`（起点日）（`tier-1-core.md:94`）。5〜15 件。例:「ジム 月水金 19:00–20:30」
  - `RoutineGroup`: 名前 + 色 + 独自の頻度定義。`frequencyType="group"` のルーチンは所属グループの頻度の OR で発火（`shared/src/utils/routineFrequency.ts:18` は group を呼び出し側解決に委譲）
- **主要操作**: 空きスロットクリックで 60 分イベント即作成（`web/src/schedule/ScheduleCalendarView.tsx:194`）/ ドラッグ移動・下端リサイズ（30 分スナップ、`shared/src/components/schedule/WeekTimeGrid.tsx:71` `:76`）/ 完了トグル / タイトル・時刻編集 / Routine の CRUD と頻度編集（`web/src/schedule/ScheduleView.tsx:27`）/ Routine 由来イベントは削除でなく Dismiss（この日だけスキップ。`web/src/schedule/ScheduleItemsView.tsx:24-31`）。ドラッグでの時刻変更は Tasks の `scheduledAt` と双方向同期（`tier-1-core.md:120`）
- **Desktop / Mobile の責務分割**（Mobile = Consumption + Quick capture）:
  - Desktop = 全機能。週タイムグリッドが主役
  - Mobile = **今日のアジェンダ閲覧 + 最短手数の予定追加のみ**。落とすもの: 週グリッド / Routine の作成・編集 / ドラッグ移動・リサイズ / Calendars（フォルダ別カレンダー）管理
  - 補足: Calendar Tag は要件上「Mobile 省略 Provider」だった（`tier-1-core.md:106` / AC9 `tier-1-core.md:119`）が、現行実装では DU-F で全プラットフォームから撤去済み（`web/src/MainScreen.tsx:325`）。本デザインではタグ UI を扱わない

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/schedule/` の 5 ファイル。`web/src/MainScreen.tsx:333-337` で「RoutineScheduleSync（headless 生成器）→ ScheduleCalendarView（週グリッド + アジェンダ）→ ScheduleView（Routine 管理）→ ScheduleItemsView（本日のリスト）→ CalendarView（calendars CRUD）」を 1 スクロール列に縦積み
- **shared 部品**: `shared/src/components/schedule/WeekTimeGrid.tsx`（純表示の週/日タイムグリッド。時間ガター 3.25rem・48px/時・0–24 時・30 分スナップ・終日レーン・重なりは等幅カラム分割）、`shared/src/components/BottomSheet.tsx:47`（不透明パネル + `bg-black/40` バックドロップ）、`shared/src/components/AppShell.tsx:66`（narrow はボトムタブ 4 + More）
- **特徴的 UI**: 週タイムグリッド。空きスロットの透明ボタンでクリック作成（`WeekTimeGrid.tsx:65`）、イベント本体ドラッグで移動（縦 = 時刻 / 横 = 日移動）、下端ハンドルでリサイズ。≥768px で「グリッド + 右 18rem エディタペーン」（`ScheduleCalendarView.tsx:372`）、<768px は 1 日アジェンダ + BottomSheet エディタ（`ScheduleCalendarView.tsx:123` `:438`）
- **状態の現状**: ScheduleCalendarView は loading / error 表示なし（データ到着まで空グリッド）。empty は narrow アジェンダのみカードあり。他 3 ビューはプレーンテキストの Loading / エラー文言のみ
- **現状の課題**（= プロンプトの「良くしたい方向」）:
  1. 4 ビュー縦積みで情報設計が未整理 — カレンダー・Routine 管理・本日リスト・calendars CRUD が区切りなく 1 列に並ぶ（`MainScreen.tsx:333-337`）。目標 IA では header タブ（Calendar / Routines）に整理する
  2. **週グリッド上で Routine 由来と単発イベントの見分けが全くつかない** — `WeekTimeGridItem` が `routineId` を持たず、routine 藍 / event 紫の専用トークン（`shared/src/styles/tokens.css:74-83`）が未使用。全ブロックが同一の accent 縁 + 灰色地
  3. 現在時刻インジケータ（now line）が無く、現在時刻への自動スクロールも無い
  4. カレンダーに loading / error 状態が無い
  5. narrow（Mobile 相当）のアジェンダに予定作成の導線がゼロ — Quick capture 責務を満たしていない
  6. エディタが完了 / タイトル / 開始・終了の最小 3 項目のみ。Routine 由来イベントの由来表示・「この日だけスキップ（Dismiss)」・単発の削除・メモが無く、Routine 由来のタイトル / 時刻編集は次回生成時に巻き戻される
  7. 週グリッドが中央寄せ `max-w-3xl` 列に閉じ込められ（`AppShell.tsx:93`、schedule は fluid 対象外）、1440px の横幅を活かせない

## 3. デザイン方針（このセッションの提案）

- **セクション構成（目標 IA）**: Schedule はサイドバー本流セクション。画面上部に **header タブ「Calendar」/「Routines」** の 2 タブを持つ（2026-07-05 IA 決定）。現状の「週グリッド + Routine 管理 + 本日リスト + calendars CRUD の 1 スクロール縦積み」を、この 2 タブに整理する。
  - **Calendar タブ**（既定）: 週タイムグリッド + 選択イベント編集の右パネル。従来の「週グリッド + 右エディタペーン」をこのタブに収める
  - **Routines タブ**: ルーチンの一覧 + 編集フォーム。従来 Sheet ドロワーへ畳んでいたルーチン管理を、header タブの独立画面（MasterDetail の 2 枚組意匠）に昇格させる
  - **カレンダー台帳（現 CalendarView = フォルダ別カレンダーの CRUD）の置き場（提案）**: **第 3 タブには昇格させない**。フォルダ別カレンダーは利用頻度が低く常設タブにするほどでないため、Calendar タブのツールバー右端の歯車 / overflow メニューから開く**軽量モーダル**に畳む。header タブは Calendar / Routines の 2 つに保ち、ナビをすっきりさせる
- **残す意匠 / 変える意匠**:
  - 残す: クリック作成 → 即編集の操作モデル（30 分スナップ / 60 分デフォルト）、ドラッグ移動 + 下端リサイズ、Today ボタン + 週送りシェブロン、右ペーンエディタ、日曜始まり、終日レーン、完了 = 取り消し線 + 減光、フラット寄りの密度感
  - 変える: (a) スケジュールを**全幅レイアウト**に昇格 (b) **routine = 藍 / 単発 event = 紫の色符号 + 繰り返しアイコン**で由来を可視化（色だけに頼らない） (c) now line + 今日列の薄い地色 (d) エディタに由来表示 /「この日はスキップ」/ 削除 / メモを追加 (e) **Routine 管理を縦積みから header タブ「Routines」へ昇格**（現状の 1 スクロール縦積みを解体） (f) 空・ローディング・エラー状態の設計 (g) Mobile に FAB + 最小入力シートの Quick capture
- **使う既存部品**: Button / Card / BottomSheet（Mobile エディタ・Quick capture）/ Sheet / Menu（イベント操作・calendars モーダル）/ Toast(操作フィードバック) / Sidebar / CommandPalette / MasterDetail（Routines タブの一覧 + 編集）/ header タブの標準意匠（形状・アクティブ表現は shell brief が定義するものを参照）
- **新規に必要な部品候補**（部品層への追加候補として列挙のみ。実装しない）: ScheduleEventBlock（routine / event / 完了の色符号 + バッジ内蔵ブロック）、NowIndicator(現在時刻ライン)、RoutineFrequencyChip（「毎日」「月・水・金」「3 日ごと」「グループ: 平日夜」表示チップ）、ScheduleQuickAddSheet（タイトル + 時刻だけの最小作成シート）、FloatingActionButton、SegmentedControl（Mobile での header タブ継承表現）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降を全文コピーしてから、画面固有の指示を続ける。
> プロンプトは日本語（コンポーネント名・色値は英語 / hex のまま）。表示データは現実的な日本語サンプル値。

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

## この画面: スケジュール（Desktop 1440×900）

1 日と 1 週間の運用中枢。反復予定「ルーチン」を一度定義すると、毎日の予定として週カレンダーに自動展開され、単発の予定と同じグリッドに並ぶ。ユーザーは朝にこの画面で今日の流れを確認し、日中に完了チェックを付け、週末に翌週を整える。この画面は例外的に**全幅レイアウト**（中央寄せ max-width にしない）。

### レイアウト構造

- 左サイドバー（展開 240px）: 本流セクション「Schedule」（Clock アイコン）がアクティブ
- **header タブ（画面上部の水平タブ）**: 「Calendar」/「Routines」の 2 タブ。既定は「Calendar」。タブは控えめな下線 or 塗りでアクティブを示し、セクション見出しの直下に置く（この画面のフレームは Calendar タブ表示が基本。1 枚だけ Routines タブに切り替えた状態も描く）
- ツールバー（header タブの下・1 行）: 左から「今日」ボタン / ◀ ▶ の週送りアイコンボタン / 週範囲ラベル「7/5 – 7/11」。右端に「+ 予定を追加」のプライマリボタン（accent 地 + on-accent 文字）、その左に歯車アイコンボタン（フォルダ別カレンダーの管理モーダルを開く導線。モーダル自体は今回描かない）
- 主役（Calendar タブの中身） = **週タイムグリッド**（ツールバー直下、画面幅いっぱい）:
  - 左端に時間軸の列(幅 52px 程度)。「07:00」〜「23:00」あたりが見えていて、上下にスクロールできる気配を出す
  - 上端に曜日ヘッダー行「日 7/5 … 土 7/11」。**今日（木 7/9）の列はヘッダーを accent 文字 + 太字にし、列全体に極薄の地色**を敷いて一目で分かるように
  - 曜日ヘッダーの下に「終日」レーン（1 行）。終日予定はここに横長チップで置く
  - 1 時間ごとに水平罫線。イベントは 30 分単位のグリッドに載る
  - **現在時刻ライン**: 今日の列を横切る accent 色の細い水平線 + 左端に小さな「14:30」ラベル
  - **イベントブロックの 2 系統を必ず視覚的に区別する**（この画面の最重要要件）:
    - ルーチン由来 = 藍系（地 `#ebf0fe`・文字 `#3b5bdb`・左端 3px の藍バンド）+ タイトル左に小さな繰り返しアイコン（lucide Repeat）
    - 単発の予定 = 紫系（地 `#f3e8ff`・文字 `#6d28d9`・border `#8b5cf6`）。アイコンなし
    - 完了済み = タイトルに取り消し線 + 全体を減光（色だけに頼らず線と彩度の両方で示す）
  - ブロック内はタイトル（太め）+ 開始時刻の 2 行。角丸 6px。重なった予定は等幅 2 カラムに並べる
  - 空きスロットのホバーに「+」のゴースト表示（クリックで 60 分の予定が作られ右パネルが開く、という操作が伝わるように 1 箇所ホバー状態を描く）
- 右サイドパネル（固定幅 288px、罫線で区切った不透明パネル）: **選択中イベントの編集**
  - 上から: 完了チェックボックス「完了にする」/ タイトル入力 / 開始・終了の時刻入力（横並び）/ メモ欄
  - **由来表示**: ルーチン由来なら藍のチップで「↻ ルーチン『ジム』から生成 — 月・水・金」と頻度を表示し、その下に「この日はスキップ」ボタン（削除ではなくこの日だけ消す）。単発なら danger 色の「削除」テキストボタン
  - 何も選択していない時はこのパネルに**ルーチン一覧のサマリー**を出す: 「マイルーチン」見出し + 各行「↻ 朝のストレッチ / 毎日 7:00」「↻ ジム / 月・水・金 19:00」「↻ 観葉植物の水やり / 3 日ごと 8:30」「↻ 週次レビュー / 日曜 20:00」「↻ 英単語の暗記 / グループ: すきま学習 12:30」のように、頻度チップ 4 パターン（毎日 / 曜日 / N 日ごと / グループ）が全部見える 5〜6 行 + 「Routines タブを開く」リンク（header タブの Routines へ切り替わる導線）

### 表示データ（現実的な日本語サンプル。週 = 2026 年 7/5(日)〜7/11(土)、今日 = 7/9(木) 14:30）

- ルーチン由来（藍 + Repeat アイコン）: 「朝のストレッチ」毎日 7:00–7:15 全曜日 / 「日本語学習の復習」毎日 8:00–8:30 / 「ジム」月・水・金 19:00–20:30 / 「観葉植物の水やり」3 日ごと（7/5・7/8・7/11）8:30–8:45 / 「週次レビュー」日曜 20:00–21:00 / 「英単語の暗記」グループ『すきま学習』所属で火・木に発火（7/7・7/9）12:30–12:45 / 「英会話オンラインレッスン」火・木 20:00–20:50（7/7・7/9）
- 単発（紫）: 「歯科検診」7/7(火) 14:00–15:00 / 「友人と夕食 @渋谷」7/10(金) 19:30–21:30（ジムと重なるので金曜 19:00 台は 2 カラム並び）/ 「確定申告の書類を集める」7/11(土) 10:00–12:00 / 「区役所で住民票を取る」7/9(木) 10:30–11:00 / 「プロジェクトの進捗整理」7/9(木) 15:00–16:00 / 「夕食の買い出し」7/9(木) 17:30–18:00
- 終日レーン: 「粗大ごみ回収日」7/9(木)
- 完了済み: 7/5(日)〜7/8(水) の予定と、今日 7/9(木) の 14:30 より前の予定（朝のストレッチ・日本語学習の復習・英単語の暗記・区役所で住民票を取る）はすべて完了済み（取り消し線 + 減光）。終日の「粗大ごみ回収日」は完了状態を持たせず通常表示
- 右パネル: 金曜の「ジム」を選択中の状態で描く（由来チップ「↻ ルーチン『ジム』から生成 — 月・水・金」+「この日はスキップ」ボタンが見える）

### 状態バリエーション（フレーム一覧）

1. 通常 light（Calendar タブ・上記データ。右パネルは金曜の「ジム」を選択中）
2. 通常 dark（1 と同内容）
3. 未選択 light: Calendar タブで何も選択していない状態。右パネルにルーチン一覧のサマリー（頻度チップ 4 パターン）が出ている
4. Routines タブ light: header タブを「Routines」に切り替えた状態。MasterDetail の 2 枚組で、左にルーチン一覧、右に選択中 1 件の編集フォーム — タイトル / 開始・終了時刻 / 頻度セレクタ（毎日・曜日・N 日ごと・グループの 4 択）/ 曜日チップ（日〜土のトグル。「ジム」編集中なら月・水・金が選択状態）/ 所属グループのバッジ
5. 空状態 light: Calendar タブでその週に予定が 1 件もない。グリッドの骨格は保ち、中央に控えめな案内「この週の予定はありません。空いた時間をクリックして作成できます」+「+ 予定を追加」ボタン
6. ローディング light: Calendar タブのグリッド骨格 + イベントブロック位置に角丸スケルトン数個
7. エラー light: グリッド位置に「予定を読み込めませんでした」の案内カード + 「再試行」ボタン

計 7 フレーム（通常のみ light / dark の両方、3〜7 は light のみ）
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

## この画面: スケジュール（Mobile 390×844）

Mobile のスケジュールは「閲覧 + 素早い記録」に責務を絞る。**出すのは (1) 今日のアジェンダ (2) 最短手数の予定追加、の 2 つだけ**。

### Desktop から落とすもの（出さない。明確に不在にする）

- 週タイムグリッド・月カレンダー（グリッドは移植しない。1 日のアジェンダのみ）
- header タブ（Calendar / Routines のセグメント切替）— Routines を落とすため Mobile では Calendar 相当の「今日のアジェンダ」単画面にする（セグメントを出さない）
- ルーチンの作成・編集・一覧管理（閲覧の手掛かりとして由来バッジだけ残す）
- ドラッグでの移動・リサイズ（タップ操作のみ）
- カレンダー（フォルダ別ビュー）の管理

### レイアウト

- 下部タブバー: **Schedule / Materials / Work / Analytics の 4 タブ + More**。Schedule（Clock アイコン）がアクティブ。safe-area 分の余白を下に確保
- ヘッダー（1 行）: 「今日」の見出し + 日付「7/9 (木)」/ 右に ◀ ▶ の日送りボタン。今日以外の日を見ている時だけ「今日へ戻る」テキストボタンが出る
- 本体 = **今日のアジェンダ**（時系列リスト、縦スクロール）:
  - 終日予定を最上部に横長チップで（例「粗大ごみ回収日」）
  - 以降は時刻順の行。各行: 左に時刻列（「19:00–20:30」を等幅数字で 2 行）/ 中央にタイトル + 由来バッジ / 右端に完了チェック（タップ領域 44px 以上）
  - **由来の区別**: ルーチン由来は藍のドット + 小さな繰り返しアイコン（lucide Repeat）、単発は紫のドット。完了済みは取り消し線 + 減光
  - **現在時刻の位置に区切りライン**（accent 色の細線 + 「14:30」）。過ぎた予定はその上、これからの予定は下に自然に分かれる
- **Quick capture**: 右下（タブバーの上）に accent 色の丸い FAB「+」。タップで**最小入力のボトムシート**が上がる:
  - 不透明パネル + 上端グラブハンドル。背後は黒 30% バックドロップ
  - 中身は「タイトル入力（プレースホルダ『予定を入力…』）」「開始 / 終了の時刻入力（横並び、初期値は現在時刻に近い 15:00 / 16:00）」「追加ボタン（accent、幅いっぱい）」の 3 要素だけ。ここにルーチン設定やタグ等の高度な項目は置かない
- 行タップ → **詳細のボトムシート**: 完了チェック / タイトル / 開始・終了時刻 / ルーチン由来なら藍チップ「↻ ルーチン『英会話オンラインレッスン』から生成 — 火・木」+「この日はスキップ」ボタン、単発なら「削除」テキストボタン（danger 色）

### 表示データ（今日 = 2026/7/9(木) 14:30 時点の現実的な日本語サンプル）

- 終日: 「粗大ごみ回収日」
- 完了済み（現在時刻ラインより上）: 「朝のストレッチ」7:00–7:15（↻ 藍）/ 「日本語学習の復習」8:00–8:30（↻ 藍）/ 「区役所で住民票を取る」10:30–11:00（紫）/ 「英単語の暗記」12:30–12:45（↻ 藍）
- これから（ラインより下）: 「プロジェクトの進捗整理」15:00–16:00（紫）/ 「夕食の買い出し」17:30–18:00（紫）/ 「英会話オンラインレッスン」20:00–20:50（↻ 藍。火・木に発火するルーチン）
- 詳細シートの画面は「英会話オンラインレッスン」をタップした状態で 1 枚描く（由来チップ「↻ ルーチン『英会話オンラインレッスン』から生成 — 火・木」とスキップボタンが見える）
- Quick capture シートの画面も 1 枚描く（タイトルに「美容院の予約」と入力途中の状態）

### 状態バリエーション（フレーム一覧）

1. 通常 light（上記データのアジェンダ）
2. 通常 dark（1 と同内容）
3. 詳細シート light（「英会話オンラインレッスン」をタップした状態）
4. Quick capture シート light（「美容院の予約」を入力途中の状態）
5. 空状態 light: 「今日の予定はありません」の控えめな案内 + 「+ で予定を追加できます」と FAB への誘導。FAB は出したまま
6. ローディング light: 時刻列 + タイトルの行スケルトン 5〜6 行
7. エラー light: 「予定を読み込めませんでした」の案内 + 「再試行」ボタン

計 7 フレーム（通常のみ light / dark の両方、3〜7 は light のみ）
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロックが**全プロンプトの冒頭に全文**埋まっている（要約・改変なし・v2 / 2026-07-05）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（エラー状態も両プロンプトのフレーム一覧に含む）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（**何を出さないか**）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている
- [x] **（v2）** v1 の旧 accent 系 hex（Lumen 化前のコバルト accent 各色）が本文から一掃されている（旧 hex の機械チェックが 0 件で pass）
- [x] **（v2）** ナビ前提が `IA.md`（サイドバー本流 5 + ユーティリティ枠 / Schedule = Calendar・Routines の header タブ / Mobile 固定 4 タブ = Schedule・Materials・Work・Analytics）と一致

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/schedule/`（WeekTimeGrid の拡張 + 新規部品は §3 の候補リストを参照。生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
- **スコープ注記**: Routine 管理 UI は header タブ「Routines」（Desktop フレーム 4・MasterDetail の 2 枚組）でカバーする。calendars（フォルダ別カレンダー）の CRUD は Calendar タブのツールバー歯車から開く軽量モーダルに畳む提案（§3）。モーダル内部の詳細意匠は本 brief では意図的に対象外（必要になれば §4 の iterate で追加する）
- **palette 同期状況（v2・2026-07-05）**: 本 brief は `_COMMON-CONTEXT.md` **v2**（accent = Lumen blue `#1d4ed8` 系・`shared/src/styles/tokens.css` の PR #135 に同期済み）を §4 の共通前提ブロックに全文埋め込み済み。v1 の旧 accent 系 hex は一掃済み。今後 `_COMMON-CONTEXT.md` が更新された場合は、§4 の共通前提ブロックを再コピーすること（全文コピー・改変禁止の規則に従う）
