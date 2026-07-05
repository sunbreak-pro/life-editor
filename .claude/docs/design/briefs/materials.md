---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-07-05
Revised: 2026-07-05（v2 — IA + Lumen accent）
Section: materials
Owner-chat: design-materials-v2
Branch: claude/design-materials-v2
---

# Design Brief: Materials セクション（header タブ: Tasks Kanban / Notes / Daily / Tags）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> **IA（2026-07-05 決定）**: Tasks / Notes / Daily / Tags は独立セクションではなく、サイドバー本流の **Materials 1 セクション**の中の **header タブ 4 つ**。§4 の各プロンプトはタブ切替を前提に、サイドバー Materials アクティブ + コンテンツ最上部の 4 タブ行を含めて指示する。§4 の各プロンプトは Desktop / Mobile のペア構造を維持する。
>
> **Version: 2（2026-07-05）** — v1（PR #137）からの改訂 3 点: ①§4 全プロンプトの共通前提を `_COMMON-CONTEXT.md` の **v2**（Lumen blue accent + 目標シェル構成）へ全文差し替え ②旧 accent 系 hex を一掃 ③4 サブ画面を「独立セクション」から「Materials の header タブ」へ再フレーム（§1 / §3 / §4）。共通前提ブロックは規約どおり要約せず全文を各プロンプト冒頭に埋め込む。header タブそのものの意匠（形・アクティブ表現）は shell brief（D7）が定義し、本 brief はそれを参照してタブの中身に集中する。

## 1. 画面要件ダイジェスト

**Materials セクション共通**: Tasks / Notes / Daily / Tags は独立セクションではなく、サイドバー本流 **Materials 1 セクション**の header タブ 4 つ。4 タブは同じ「Materials（素材・記録）」として、新規作成導線・リスト密度・見出し・空状態・ローディングの意匠を統一する（§3 統一方針）。Mobile はいずれも Consumption（閲覧）+ Quick capture（最短記録）に責務を絞る。

### 1.1 Tasks (Kanban)

- **目的 / 主ユースケース**: 階層 TaskTree を SSOT とするタスク運用のカンバン表現。フォルダ / ステータス / タグの 3 ビューで列を組み替え、カード移動でステータス変更・フォルダ移動を行う（`tier-1-core.md:23`、実装 `web/src/tasks/KanbanView.tsx:36-64`）
- **表示するデータ**: TaskNode（task / folder、数十〜200 ノード想定）。3 段階ステータス `NOT_STARTED / IN_PROGRESS / DONE`（`tier-1-core.md:29`）、フォルダ色（`tier-1-core.md:52`）、WikiTag チップ（カード最大 3 + "+N"、`shared/src/components/Kanban/KanbanCard.tsx:59-60`）
- **主要操作**: カード DnD（ステータス列間 = ステータス変更 / フォルダ列間 = フォルダ移動、`KanbanView.tsx:46-52`）、カードクリック → 中央詳細モーダル（`KanbanView.tsx:322-357`）、「+ タスクを追加」ダイアログ（`KanbanView.tsx:358-374`）、カラム色編集（`KanbanView.tsx:188-203`）
- **Desktop / Mobile の責務分割**: Desktop = 全機能（DnD・3 ビュー・色編集）。Mobile = **閲覧 + ステータス変更 + 最短追加のみ**。落とすもの: カード DnD / カラム横並び（ステータスチップフィルタ + 縦 1 カラムに置換）/ カラム色編集 / タグ別ビュー

### 1.2 Notes

- **目的 / 主ユースケース**: ツリー階層の長文ナレッジベース（Life Editor 版 Obsidian / Notion ページ）。TipTap リッチテキスト + 相互リンク + ピン留め + パスワード保護（`tier-1-core.md:159`）
- **表示するデータ**: NoteNode（folder / note、数十件想定）。ピン（`tier-1-core.md:181`）、パスワード保護（`tier-1-core.md:182`）、タグ・リンク（`web/src/notes/NotesView.tsx:618-625`）、ゴミ箱（`NotesView.tsx:526-562`）
- **主要操作**: 作成（ノート / フォルダ）、ツリー DnD（並び替え / フォルダへ格納 / ルートへ、`NotesView.tsx:352-361`）、選択 → 詳細編集、ピン / リネーム / 削除、パスワード verify（ぼかし + 解除ボタン、`NotesView.tsx:627-669`）、全文検索（要件 `tier-1-core.md:183`。現 Web 実装は未搭載 → デザインで先行）
- **Desktop / Mobile の責務分割**: Desktop = MasterDetail 2 ペイン（一覧 1 : 詳細 1.4、`shared/src/components/MasterDetail.tsx:59-78`）で全機能。Mobile = 一覧 + ほぼ全画面ボトムシートでの**閲覧 + 最短ノート追加**（`MasterDetail.tsx:81-104` の 92svh シート）。落とすもの: DnD 並び替え / フォルダ作成・リネーム / パスワード設定（解除 = 閲覧のためだけ残す）/ タグ・リンク編集（表示のみ）/ ゴミ箱

### 1.3 Daily

- **目的 / 主ユースケース**: 日付（YYYY-MM-DD）に 1 エントリ対応する「その日の思考ログ」。日付主軸・階層なし・1 日 1 エントリが Note との差別化（`tier-1-core.md:221`）
- **表示するデータ**: Daily エントリ（TipTap コンテンツが要件。`tier-1-core.md:226`。現 Web 実装はプレーン textarea = S3 で TipTap 化予定、`web/src/daily/DailyView.tsx:5-13` → **本 brief は TipTap 前提の目標状態をデザインする**）。ピン / パスワード / 過去日リスト（`DailyView.tsx:162-185`）
- **主要操作**: 日付選択（date input + Today / Yesterday、`DailyView.tsx:82-110`）、blur 保存の upsert（`DailyView.tsx:112-119`）、ピン / 削除 / 復元（`DailyView.tsx:121-143`、`187-210`）、タグ・リンク付与（`DailyView.tsx:145-160`）
- **Desktop / Mobile の責務分割**: Desktop = 日付ナビ + 大きめエディタ + 過去一覧 + ゴミ箱。Mobile = **今日をすぐ書く（クイック追記）+ 過去を読む**。落とすもの: ピン・削除・ゴミ箱の管理 / タグ・リンク編集（表示のみ）/ 日付の自由ジャンプ（直近日付ストリップで代替）

### 1.4 Tags (WikiTags 管理)

- **目的 / 主ユースケース**: Notes / Dailies / Schedule Items を横断する単一タグ体系のマスタ管理。タグ CRUD + 色管理 + グループ管理（`tier-2-supporting.md:172`、`177-183`）
- **表示するデータ**: WikiTag（十数個想定、色付き）、タググループ + メンバー割当（`web/src/wikitag/WikiTagsManagementView.tsx:10-28`）
- **主要操作**: タグ作成 / リネーム / 削除（`WikiTagsManagementView.tsx:71-134`）、色変更（要件 `tier-2-supporting.md:194`。現実装は色編集 UI 未搭載 → デザインで先行）、グループ作成 / リネーム / 削除 / メンバー追加・除外（`WikiTagsManagementView.tsx:136-285`）
- **Desktop / Mobile の責務分割**: Desktop = 2 カラム（タグ / グループ）フル管理。Mobile = **閲覧 + 最短タグ追加**。落とすもの: リネーム / 削除 / 色変更 / グループ編集 / マージ
- **注記（要件ドリフト）**: `tier-2-supporting.md:168` は「Platform: Desktop only（Mobile では WikiTagProvider 省略）」だが、これは旧 Tauri 期の記述。現行 CLAUDE.md §2 では WikiTag は Mobile でも有効（省略 5 Provider に含まれない）。本 brief は CLAUDE.md に従い Mobile ペアを作る

## 2. 現状 UI インベントリ

### 2.1 Tasks (Kanban)

- **host 画面**: `web/src/tasks/KanbanView.tsx`（+ `useKanbanDnd.ts` / `KanbanColumnDroppable.tsx` / `KanbanCardDraggable.tsx` — @dnd-kit は web 側のみ）
- **shared 部品**: `shared/src/components/Kanban/`（`KanbanBoard.tsx` / `KanbanColumn.tsx` / `KanbanCard.tsx` / `buildColumns.ts`）、`TaskDetailModal.tsx` / `TaskDetailPanel.tsx` / `TaskAddDialog.tsx` / `ColorPicker.tsx`
- **特徴的 UI**: 全幅横スクロールのカラムストリップ（`KanbanBoard.tsx:8-11`、収まるとき中央寄せ `KanbanBoard.tsx:160-170`）。カラム = 幅 316px・max-h 560px・rounded-2xl・上端 4px アクセントバンド + 件数バッジ（`KanbanColumn.tsx:100-157`）。カード = 左端 4px ステータスバンド + アイコン付きステータスチップ + フォルダピル + タグチップ（`KanbanCard.tsx:2-11`、バンド色トークン `tokens.css:101-103`）。フォルダビューはカラムパネルにフォルダ色 10% / ヘッダー 18% のウォッシュ（`KanbanColumn.tsx:72-95`）。詳細モーダルはスケールイン animation（`tokens.css:295-334`）
- **状態の現状**: empty = カラム単位の中央プレースホルダあり（`KanbanColumn.tsx:174-197`）/ loading = テキストのみ（`KanbanView.tsx:225-227`）/ error = 移動拒否 alert 文言（`KanbanView.tsx:313-320`）
- **現状の課題**:
  1. loading がプレーンテキスト（スケルトン無し）
  2. ボード全体の空状態（タスク 0 件）が未デザイン
  3. 移動拒否エラーが素の赤枠テキストで意匠が浮いている
  4. Mobile の Kanban 体験が未定義（DnD 前提のまま）
  5. 追加ダイアログ・詳細モーダルの意匠がボードの完成度に対して簡素

### 2.2 Notes

- **host 画面**: `web/src/notes/NotesView.tsx`（+ `RichTextEditor.tsx` / `NotePasswordDialog.tsx` / `useNoteTreeDnd.ts`）
- **shared 部品**: `MasterDetail.tsx`（wide 2 ペイン / narrow BottomSheet、`MasterDetail.tsx:29-45`）、`BottomSheet.tsx`
- **特徴的 UI**: 階層ツリー（インデントガイド `TreeNodeIndent`、フォルダアイコン⇄シェブロンの hover 入替 `NotesView.tsx:169-205`、hover で grip + 削除が出現 `NotesView.tsx:151-162`・`234-248`）。ピン / ロックのインラインアイコン（`NotesView.tsx:219-231`）。TipTap エディタ + タグピッカー + リンクパネル（`NotesView.tsx:618-625`）。パスワードノートは本文ぼかし + 中央解除ボタン（`NotesView.tsx:627-669`）
- **状態の現状**: empty = 「No notes yet」テキスト（`NotesView.tsx:476-479`）/ loading = テキストのみ（`NotesView.tsx:432-434`）/ error = 赤枠 alert（`NotesView.tsx:458-474`）
- **現状の課題**:
  1. 作成 / リネームが `window.prompt`（`NotesView.tsx:388-404`）で UI として未成立
  2. 検索 UI が無い（要件の全文検索 `db_notes_search` が UI に露出していない）
  3. ゴミ箱が素の `<details>`（`NotesView.tsx:526-562`）
  4. 一覧に本文抜粋・更新日などの手掛かりが無く、行が名前だけで痩せている
  5. 文言が英語ハードコード（i18n 前）
  6. 空状態・ローディングが素のテキスト

### 2.3 Daily

- **host 画面**: `web/src/daily/DailyView.tsx`（S2 の機能検証 UI。TipTap は S3 送り `DailyView.tsx:5-13`）
- **shared 部品**: `TagPicker` / `LinkPanel`（web/src/wikitag）
- **特徴的 UI**: date input + Today / Yesterday ボタン（`DailyView.tsx:82-110`）、blur 保存 textarea（`DailyView.tsx:112-119`）、日付だけの過去リスト（★ = ピン、🔒 = ロックの文字装飾。`DailyView.tsx:162-185`）
- **状態の現状**: empty 専用デザイン無し / loading 無し / Trash セクションあり（`DailyView.tsx:187-210`）
- **現状の課題**:
  1. 4 画面中もっとも素朴。「日次ジャーナル」としての情緒（日付の主役感・書き心地）が無い
  2. プレーン textarea（要件は TipTap リッチテキスト）
  3. 過去リストが日付文字列のみで中身の手掛かりゼロ
  4. ピンが「★」・ロックが「🔒」の文字装飾で意匠未統一
  5. 空状態・ローディング未デザイン

### 2.4 Tags

- **host 画面**: `web/src/wikitag/WikiTagsManagementView.tsx`（+ `TagPill.tsx`）
- **shared 部品**: なし（`WikiTagsUnifiedContext` を直接消費）
- **特徴的 UI**: md 以上で 2 カラム grid（`WikiTagsManagementView.tsx:357-358`）。タグ行 = TagPill + hover のリネーム / 削除（`71-134`）。グループカード = 見出し + メンバーチップ（× で除外）+ 検索式の追加ピッカー（`136-285`）
- **状態の現状**: empty = テキストあり（`364-367`・`387-390`）/ loading = テキストのみ（`353-355`）
- **現状の課題**:
  1. タグの色変更 UI が無い（要件 AC3 のカラーピッカーが未露出。Kanban 側には `ColorPicker` 部品が既にある）
  2. タグの使用件数など「効いているタグか」の手掛かりが無い
  3. マージ・タグ接続（要件にある）が UI に無い — 本 brief では件数表示まで扱い、接続グラフは Connect クラスタに譲る
  4. 全体にフラットで「管理画面」の域を出ない。クラスタ共通の見出し・行意匠に揃えたい

## 3. デザイン方針（このセッションの提案）

### Materials header タブ 4 つの統一方針（Tasks / Notes / Daily / Tags — プロンプトにも同趣旨を埋め込む）

- **header タブ標準は shell brief（D7）に委譲**: タブ行の形状・アクティブ表現・件数バッジ有無は shell brief が定義する。本 brief はそれを参照し、Materials 内 4 タブの**中身**の統一に集中する（二重定義を避ける）
- **新規作成導線**: 4 タブとも主アクションを **header タブ行の右端の同じ位置**に置く（Tasks =「+ タスクを追加」/ Notes =「+ ノート」/ Tags =「+ タグ」/ Daily は当日エディタ直行の「今日へ」）。ボタンは accent 塗り・on-accent 文字で統一
- **リスト密度**: 一覧の行は高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent 枠 + hover 地。行内アイコン 14px / text-secondary
- **セクション見出し**: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- **空状態**: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ + 主アクション（accent 塗りボタン）の縦積み
- **ローディング**: 実レイアウトと同形のスケルトン（bg-secondary の角丸バー）。スピナー単独にしない
- **残す意匠**: Kanban のカード / カラム語彙（4px バンド・チップ・ウォッシュ）は完成度が高いので Materials の基準にする。Notes のツリー行（hover で grip / 削除出現、アイコン入替）も維持
- **変える意匠**: `window.prompt` / `<details>` ゴミ箱 / ★・🔒 の文字装飾 / 素のテキスト loading・empty を全廃し、上記共通パターンへ置換

### 使う既存部品

Button / Card / Menu / Toast / Sidebar / BottomTabBar / **Kanban（Board / Column / Card）** / **MasterDetail** / BottomSheet / Modal（TaskDetailModal 系）/ ColorPicker / TagPill / Input / IconButton / CommandPalette（検索の受け皿候補）

### 新規に必要な部品候補（部品層への追加候補として列挙のみ。実装しない）

- `MaterialsTabBar`（Materials の header タブ 4 つ + 右端の新規作成ボタン枠。形状は shell brief 準拠）
- `EmptyState`（アイコン + メッセージ + CTA の共通空状態）
- `SkeletonList` / `SkeletonCard`（共通ローディング）
- `StatusFilterChips`（Mobile Kanban のステータスチップフィルタ）
- `QuickAddSheet`（Mobile 共通の 1 行入力ミニシート）
- `DateStrip`（Mobile Daily の横スクロール日付チップ）
- `ListItemWithExcerpt`（タイトル + 抜粋 1 行の 2 行リスト行 — Notes / Daily 共用）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md`（v2）の水平線以降を全文コピー済み（要約・改変なし）。
> プロンプトは日本語（コンポーネント名・色値は英語 / hex のまま）。本文にリポジトリパスは書かない。
> Materials は 1 セクション・header タブ 4 つ（Tasks / Notes / Daily / Tags）。各プロンプトはサイドバー Materials アクティブ + コンテンツ最上部の 4 タブ行を含めて指示する。header タブそのものの意匠は shell brief 準拠。

### 4.1 Tasks — Kanban ボード

#### 4.1.1 Desktop 用

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

## この画面: Materials —「Tasks」タブ（Kanban ボード。Desktop 1440×900・light / dark 両方）

サイドバーは本流 5 セクションのうち **Materials** がアクティブ（Library アイコン）。コンテンツ最上部に Materials の header タブ行「Tasks / Notes / Daily / Tags」があり、現在は **Tasks** タブがアクティブ。この画面はその Tasks タブの中身（タスクをカンバンで運用）をデザインする。header タブ行の下は中央寄せ max-width を使わず全幅を使う（カラム群が収まるときは中央寄せ、あふれたら横スクロール）。header タブ自体の形状・アクティブ表現は共通シェルの標準に従う（水平タブ・アクティブは下線または塗りで表現）。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ タスクを追加」（accent 塗り・Plus アイコン）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. header タブ行（Materials 共通）: 左に「Tasks / Notes / Daily / Tags」の水平タブ（Tasks アクティブ）。右端に「+ タスクを追加」ボタン（accent 塗り・Plus アイコン付き）
2. ツールバー（タブ直下 1 行）: 左に 3 択セグメンテッドコントロール「フォルダ / ステータス / タグ」— 角丸 12px の枠（bg-secondary 地）に入った 3 ボタン。各ボタンに lucide アイコン（Folder / CircleDot / Tag）+ ラベル。選択中は bg-primary + 小さな影で浮く
3. ボード: 横並びのカラム列。カラムは幅 316px・角丸 16px・1px border + md 相当の影・最大高さ 560px。カラム間 16px
4. カラムヘッダー（地は bg-secondary）: 上端いっぱいに高さ 4px のアクセント色バンド。中身は色ドット（フォルダ列 = 角丸四角 / タグ列 = 丸）またはステータスアイコン（ステータス列: Circle / CircleDashed / CheckCircle2）+ カラム名（15px bold・1 行省略）+ 右端に件数バッジ（丸ピル・bg-primary 地にアクセント色の数字）
5. カラム本体: 縦スクロールのカードスタック（内側余白 10px・カード間 10px）
6. フォルダ表示のとき: カラムパネル背景にフォルダ色を 10% 混ぜた薄いウォッシュ、ヘッダーは 18%。カード自体は不透明な bg-primary のまま浮かせる

### カードの意匠

- 角丸 8px・1px border・小さな影。hover でわずかに浮き上がり（2px）+ 影が強まる
- 左端に幅 4px のステータスバンド（未着手 #38bdf8 / 進行中 #eab308 / 完了 #10b981）
- 1 行目: タイトル（14px semibold。完了タスクは取り消し線 + text-secondary）+ 右端にステータスチップ（丸ピル・アイコン + ラベル。未着手 = task チップ色 / 進行中 = 琥珀の progress チップ色 / 完了 = 緑の completed チップ色）
- 2 行目（メタ行）: フォルダピル（小さな色四角 + フォルダ名 11px。ステータス / タグ表示のときのみ）+ タグチップ（タグ色の点 + 名前の薄塗りピル。最大 3 個、あふれは「+N」ピル）

### 表示データ（フォルダ表示・通常状態）

- カラム「仕事」（色 #2563eb）: 「確定申告の書類を集める」（未着手・タグ #経理）／「週次レビューを書く」（進行中・タグ #振り返り）／「請求書を送付する」（完了）
- カラム「生活」（色 #22c55e）: 「粗大ゴミの回収を予約する」（未着手・タグ #家事）／「食洗機の修理業者に連絡する」（進行中・タグ #家事 #急ぎ）
- カラム「開発 — Life Editor」（色 #8b5cf6）: 「Kanban 画面のダークテーマを調整する」（進行中・タグ #デザイン #UI）／「同期エラーの再現手順をまとめる」（未着手）／「配色トークンを整理する」（完了・タグ #デザイン）
- カラム「読書」（色 #ec4899）: カード 0 枚 — 中央に「このフォルダにタスクはありません」のプレースホルダ

### 状態バリエーション（各テーマで揃える）

- 通常: 上記 4 カラム（空カラム 1 本を含む）
- 全体空状態: タスクが 1 件も無い。中央に CheckSquare アイコン + 「タスクがまだありません」+ 「+ タスクを追加」ボタン
- ローディング: カラム 3 本ぶんのスケルトン（ヘッダーバー + カード形の角丸ブロック 2〜3 枚ずつ）
- エラー: カード移動が拒否された直後の変形 — 右下に Toast（不透明パネル・左端に danger 色のアクセントバー + アイコン + 「移動できません: 自分の配下のフォルダへは移動できません」）を重ねた 1 枚

### 補足

- 参考（余力があれば別フレーム）: カードクリックで開く詳細は中央モーダル — パンくず「仕事 > タスク」+ タイトル + ステータスチップ + リッチテキスト本文。背後は黒 30% バックドロップ
```

#### 4.1.2 Mobile 用

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

## この画面: Materials —「Tasks」タブ（Kanban。Mobile 390×844・light / dark 両方・下部タブバー込み・safe-area 考慮）

下部固定タブバーは **Materials**（2 番目）がアクティブ。コンテンツ最上部にセグメントコントロール「Tasks | Notes | Daily | Tags」があり、現在は **Tasks**。Mobile の責務 = 閲覧 + ステータス変更 + 最短のタスク追加。Desktop から落とすもの: カードのドラッグ&ドロップ / カラムの横並び（ステータスチップフィルタ + 縦 1 カラムに置換）/ カラム色編集 / タグ別・フォルダ別ビュー。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ タスクを追加」（accent 塗り・Plus アイコン）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. ヘッダー: 画面名「Materials」+ その下にセグメントコントロール「Tasks | Notes | Daily | Tags」（Tasks 選択）。右端に「+」アイコンボタン（accent 色）
2. ステータスフィルタ: 「未着手 4 / 進行中 3 / 完了 2」の 3 チップを水平 1 行（件数付き）。選択中チップは accent-subtle 地 + accent 文字、未選択は border のみ。これが Desktop のカラムの代替
3. カードリスト: 縦 1 カラム。カード意匠は Desktop と同一 — 左端 4px ステータスバンド（未着手 #38bdf8 / 進行中 #eab308 / 完了 #10b981）+ タイトル + ステータスチップ（アイコン + ラベル）+ フォルダピル + タグチップ最大 2
4. カードタップ → ボトムシート（高さ 60% 目安・不透明パネル・黒 30% バックドロップ・上端に取っ手）: タイトル / フォルダピル / タグチップ / 本文の冒頭数行（読み取り）+ 下部に「未着手・進行中・完了」の 3 択ステータス切替（大きめのセグメント。1 タップで変更して閉じられる）
5. 「+」タップ → 最短追加のミニシート: タイトル 1 行入力 + 「追加」ボタンのみ（フォルダ選択などは持たない）

### 表示データ（「進行中」フィルタ選択状態）

- 「週次レビューを書く」（進行中・仕事・タグ #振り返り）
- 「食洗機の修理業者に連絡する」（進行中・生活・タグ #家事 #急ぎ）
- 「Kanban 画面のダークテーマを調整する」（進行中・開発 — Life Editor・タグ #デザイン）

### 状態バリエーション

- 通常: 上記リスト + フィルタチップ
- 空状態: 選択中フィルタに 0 件（「進行中のタスクはありません」）と、全体 0 件（CheckSquare アイコン + 「タスクがまだありません」+ 追加ボタン）の 2 種
- ローディング: カード形スケルトン 3〜4 枚
```

### 4.2 Notes — 階層ノート

#### 4.2.1 Desktop 用

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

## この画面: Materials —「Notes」タブ（階層ノート。Desktop 1440×900・light / dark 両方）

サイドバーは **Materials** がアクティブ（Library アイコン）。コンテンツ最上部の Materials header タブ「Tasks / Notes / Daily / Tags」は **Notes** がアクティブ。この画面はその Notes タブの中身（長文ナレッジベース）をデザインする。左 = 階層ツリー（一覧）、右 = 選択ノートの詳細（リッチテキストエディタ）の 2 枚組（MasterDetail）。一覧 : 詳細 = 1 : 1.4。2 枚組のため header タブ行の下はコンテンツ幅 1080px 目安で組む。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ ノート」（accent 塗り）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### 左ペイン（一覧）

1. 上部: 「+ ノート」（accent 塗り）と「+ フォルダ」（border ボタン）の 2 ボタン + 検索フィールド（虫めがねアイコン + プレースホルダ「ノートを検索…」。surface-sunken の沈んだ地・角丸 8px）
2. ツリー: フォルダ / ノートの階層リスト（行は 4 タブ共通の意匠）。階層は縦のインデントガイド線で表現
   - フォルダ行: Folder アイコン（行 hover でシェブロン ▶ / ▼ に入れ替わる）+ 名前
   - ノート行: FileText アイコン + タイトル。ピン留めは小さな Pin アイコン（accent 色）、パスワード保護は Lock アイコン（text-secondary）をタイトル右に添える
   - 行 hover 時のみ: 左端にドラッグ用グリップ（GripVertical）、右端に削除（Trash2）が現れる
   - 選択行: accent 枠線 + hover 地
3. 下部: 「ゴミ箱（2）」の折りたたみ行。開くと取り消し線タイトル + 復元（RotateCcw）/ 完全削除（Trash2）アイコンの行が並ぶ

### 右ペイン（詳細）

1. ヘッダー行: タイトル入力（フラットな 1 行・16px semibold）+ ピン留めトグル（Pin）+ 削除ボタン（アイコンボタン列）
2. メタ行: タグチップの列（タグ色の点 + 名前の薄塗りピル + 「+ タグ」）と、関連ノートへの内部リンクのリスト（小さなリンク行 2 件程度）
3. 本文: リッチテキストエディタ。見出し・箇条書き・チェックリスト・引用が混ざった長文。ツールバーは控えめ（上部に薄いアイコン列）
4. パスワード保護ノートの変形: 本文全体がぼかし（blur）になり、中央に不透明のカード — Lock アイコン + 「このノートはパスワードで保護されています」+ 「クリックで解除」— が重なる

### 表示データ

- ツリー: フォルダ「レシピ」（配下「鶏むね肉の低温調理」「常備菜の作り置きメモ」）／フォルダ「開発メモ」（配下「Supabase 移行の設計メモ」= 選択中、「同期の落とし穴まとめ」）／フォルダ「読書ノート」（折りたたみ）／ルート直下「今月の目標」（ピン留め）「パスワード管理方針」（ロック付き）
- 詳細: 「Supabase 移行の設計メモ」— 見出し「やること」+ 箇条書き 3 点（「認証フローを Session pooler に切り替える」等）+ 引用 1 つ + チェックリスト 2 項目

### 状態バリエーション（各テーマで揃える）

- 通常: 上記
- 未選択: 右ペインに「ノートを選択してください」のプレースホルダカード（bg-secondary）
- 全体空状態: 「ノートがまだありません」+ 「+ ノート」ボタン（FileText アイコン）
- ローディング: ツリー行スケルトン 5〜6 本
- ロック中ノートを開いた変形（ぼかし + 解除カード）を 1 枚
```

#### 4.2.2 Mobile 用

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

## この画面: Materials —「Notes」タブ（Mobile 390×844・light / dark 両方・下部タブバー込み・safe-area 考慮）

下部固定タブバーは **Materials**（2 番目）がアクティブ。コンテンツ最上部のセグメントコントロール「Tasks | Notes | Daily | Tags」は **Notes**。Mobile の責務 = 閲覧 + 最短のノート追加。Desktop から落とすもの: ドラッグ&ドロップ並び替え / フォルダ作成・リネーム / パスワードの設定・変更（閲覧のための解除だけ残す）/ タグ・リンクの編集（表示のみ）/ ゴミ箱。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ ノート」（accent 塗り）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. ヘッダー: 「Materials」+ セグメントコントロール「Tasks | Notes | Daily | Tags」（Notes 選択）+ 検索アイコン + 「+」アイコンボタン（最短追加）
2. 一覧: 先頭に「ピン留め」セクション（ピン付きノートを固定）。以降はフォルダ = 折りたたみ見出し行（Folder アイコン + 名前 + 件数）、ノート = 2 行リスト行（1 行目タイトル、2 行目に本文冒頭の抜粋を text-secondary で 1 行省略）。ロック付きは Lock アイコンを添え、抜粋は出さない
3. ノートタップ → ほぼ全画面（高さ 92%）のボトムシート: 上端に取っ手 + 閉じるボタン、タイトル、本文の閲覧ビュー（読みやすい行間）。タグチップとリンクは下部に表示のみ。本文タップで最小限のテキスト編集に入れる
4. ロック付きノート: シートを開く前にパスワード入力ダイアログ（不透明パネル + 黒 30% バックドロップ）
5. 「+」タップ → 最短追加ミニシート: タイトル 1 行入力 + 「作成」→ そのまま本文編集シートへ

### 表示データ

- ピン留め: 「今月の目標」
- フォルダ「開発メモ」（4 件）: 「Supabase 移行の設計メモ」（抜粋「認証フローを Session pooler に…」）「同期の落とし穴まとめ」（抜粋「LWW で updated_at が…」）
- フォルダ「レシピ」（2 件・折りたたみ）
- ルート直下: 「今週の献立」（抜粋「月: 鶏の照り焼き…」）

### 状態バリエーション

- 通常: 上記リスト
- 空状態: 「ノートがまだありません」+ 「+」ボタン（FileText アイコン）
- ローディング: 2 行リスト行スケルトン 5〜6 本

（Mobile は Consumption + Quick capture 責務。ノート作成は最短の 1 フィールド → すぐ本文へ。フォルダ管理・並べ替え・パスワード設定・タグ編集は Desktop 専用）
```

### 4.3 Daily — 日次ジャーナル

#### 4.3.1 Desktop 用

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

## この画面: Materials —「Daily」タブ（日次ジャーナル。Desktop 1440×900・light / dark 両方）

サイドバーは **Materials** がアクティブ（Library アイコン）。Materials header タブ「Tasks / Notes / Daily / Tags」は **Daily** がアクティブ。日付主軸の「その日の思考ログ」（1 日 1 エントリ）。header タブ行の下は左に日付ナビ + 過去エントリ一覧、右に大きめのリッチテキストエディタ。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: Daily は「その日のエントリ」を直接編集するため、新規作成ボタンの代わりに header タブ行右端へ「今日へ」ボタンを置く（他タブの新規作成ボタンと同じ位置）
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. 左ペイン（日付ナビ + 過去一覧）: 上部に「今日」「昨日」クイックボタン + 日付ピッカー（カレンダー入力）。下に過去エントリの日付リスト（日付 + 曜日 + 本文冒頭の抜粋 1 行）。ピン留めされた日は先頭に固定
2. 右ペイン（エディタ）: 最上部に大きな日付見出し（例「2026年7月5日（土）」28px bold）+ 右端にピン / 削除。その下にリッチテキストエディタ（見出し・箇条書き・チェックリスト対応）。プレースホルダ「今日は何があった？」
3. 保存はエディタ blur 時に自動（明示ボタンなし。右上に小さく「保存済み」= text-tertiary）

### 表示データ

- 日付見出し: 「2026年7月5日（土）」
- 本文: 「午前はデザインの brief をまとめた。Materials セクションの 4 タブを…」（数段落 + チェックリスト 2 項目）
- 過去一覧: 「7/4（金）予定と実績のズレを…」「7/3（木）Supabase の…」「7/1（火・ピン）今月の目標…」

### 状態バリエーション

- 通常: 上記
- 空状態（その日のエントリ未作成）: エディタ領域に「まだ書かれていません」+ プレースホルダで誘導（CalendarDays アイコン）
- 全体空: 過去エントリ 0 件のときの一覧プレースホルダ
- ローディング: 日付リスト + エディタ領域のスケルトン
```

#### 4.3.2 Mobile 用

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

## この画面: Materials —「Daily」タブ（Mobile 390×844・light / dark 両方・下部タブバー込み・safe-area 考慮）

下部固定タブバーは **Materials**（2 番目）がアクティブ。セグメントコントロール「Tasks | Notes | Daily | Tags」は **Daily**。Mobile の責務 = 今日をすぐ書く + 過去を読む。Desktop から落とすもの: ピン・削除・ゴミ箱の管理 / タグ・リンク編集（表示のみ）/ 日付の自由ジャンプ（直近日付ストリップで代替）。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: Daily は「その日のエントリ」を直接編集するため、新規作成ボタンの代わりに header タブ行右端へ「今日へ」ボタンを置く（他タブの新規作成ボタンと同じ位置）
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. ヘッダー: 「Materials」+ セグメントコントロール「Tasks | Notes | Daily | Tags」（Daily 選択）+ 今日の日付。右端にピン一覧アイコン
2. 日付ストリップ: 横スクロールの日付チップ（直近 2 週間ぶん。今日を右端に強調表示）。タップで切替
3. エディタ: 日付見出し + リッチテキスト（プレースホルダ「今日は何があった？」）。Mobile は入力にフォーカスした最短の書き心地を優先
4. 過去を読む: エディタ下に直近エントリの抜粋リスト（日付 + 抜粋 1 行）

### 状態バリエーション

- 通常: 上記（今日の日付を選択・本文あり）
- 空状態: 「今日はまだ書かれていません」+ プレースホルダ
- ローディング: エディタ + リストのスケルトン
```

### 4.4 Tags — WikiTags 管理

#### 4.4.1 Desktop 用

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

## この画面: Materials —「Tags」タブ（WikiTags 管理。Desktop 1440×900・light / dark 両方）

サイドバーは **Materials** がアクティブ（Library アイコン）。Materials header タブ「Tasks / Notes / Daily / Tags」は **Tags** がアクティブ。Notes / Dailies / Schedule を横断する単一タグ体系のマスタ管理。header タブ行の下は左にタグ一覧、右にタググループ。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ タグ」（accent 塗り）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. 左ペイン（タグ一覧）: セクション見出し「タグ（12）」+ 「+ タグ」ボタン。各行 = タグ色ドット + タグ名 + 使用件数（text-secondary）。hover でリネーム / 色変更 / 削除アイコン
2. 右ペイン（グループ）: セクション見出し「グループ（3）」+ 「+ グループ」。グループカード = 見出し + メンバータグチップ（× で除外）+ 「+ タグを追加」ピッカー
3. 色変更: タグ行の色ドットをクリックすると ColorPicker ポップオーバー（プリセット 10 色 + カスタム hex）

### 表示データ

- タグ一覧: 「#経理（4）」「#振り返り（8）」「#家事（12）」「#急ぎ（3）」「#デザイン（15）」「#UI（6）」...
- グループ: 「仕事」（#経理 #振り返り）「生活」（#家事 #急ぎ）「開発」（#デザイン #UI）

### 状態バリエーション

- 通常: 上記
- 空状態: タグ 0 件（「タグがまだありません」+ Tag アイコン + 「+ タグ」）
- ローディング: タグ行スケルトン 8 本 + グループカードスケルトン 2 枚
```

#### 4.4.2 Mobile 用

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

## この画面: Materials —「Tags」タブ（Mobile 390×844・light / dark 両方・下部タブバー込み・safe-area 考慮）

下部固定タブバーは **Materials**（2 番目）がアクティブ。セグメントコントロール「Tasks | Notes | Daily | Tags」は **Tags**。Mobile の責務 = 閲覧 + 最短タグ追加。Desktop から落とすもの: リネーム / 削除 / 色変更 / グループ編集 / マージ。

### Materials 4 タブ共通の意匠（Tasks / Notes / Daily / Tags で統一・header タブ切替で行き来する）

- 新規作成導線: header タブ行の右端に「+ タグ」（accent 塗り）。4 タブとも新規作成は header タブ行右端の同じ位置に置く
- 一覧の行: 高さ 36px 前後・角丸 8px・1px border・地は bg-secondary。選択行は accent の枠線 + hover 色の地。行内アイコンは 14px で text-secondary
- セクション見出し: 14px semibold + 丸括弧の件数（例「タグ（12）」）。件数は text-secondary
- 空状態: 領域中央に lucide アイコン（24〜28px・text-tertiary）+ 1 行メッセージ（text-secondary）+ 主アクションボタン（accent 塗り・on-accent 文字）の縦積み
- ローディング: 実レイアウトと同じ形のスケルトン（bg-secondary の角丸バー数本）。スピナー単独にしない

### レイアウト構造

1. ヘッダー: 「Materials」+ セグメントコントロール「Tasks | Notes | Daily | Tags」（Tags 選択）+ 右端「+」
2. タグ一覧: タグ色ドット + タグ名 + 使用件数の 1 行リスト（縦スクロール）
3. グループ: 折りたたみ見出しで下部にまとめる（閲覧のみ）
4. 「+」→ 最短タグ追加ミニシート（タグ名 1 行 + 追加）

### 状態バリエーション

- 通常: 上記
- 空状態: 「タグがまだありません」+ Tag アイコン
- ローディング: タグ行スケルトン 8 本
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロック（**v2**）が全プロンプトの冒頭に全文埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（該当すればエラーも）
- [x] 表示データが日本語の現実的なサンプルで指定されている
- [x] Mobile の責務削減（**何を出さないか**）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている
- [x] 4 サブ画面が Materials の header タブ 4 つとして再フレームされ、ナビ前提が `IA.md`（サイドバー本流 5 + ユーティリティ枠・Mobile 固定 4 タブ）と矛盾しない

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は shared 部品層への移植（別計画）
- 移植先候補: shared 部品層（生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
- **v2 改訂履歴（2026-07-05）**: accent 系 hex を Lumen blue（accent `#1d4ed8` / dark `#5b8cff`・hover `#1e40af` / `#7aa2ff`・subtle `#dbeafe`・task チップ `#dbeafe` / `#1e40af`）へ同期し、共通前提を `_COMMON-CONTEXT.md` v2 へ全文差し替え。シェル構成を目標 IA（サイドバー本流 5 + ユーティリティ枠 Settings / Trash・Mobile 固定 4 タブ）へ更新。4 サブ画面を Materials セクションの header タブ 4 つとして再フレーム。旧「10 フラットセクション」前提を除去。header タブ意匠は shell brief に委譲
