---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/05_要件定義書_Materials.md
Previous: .claude/docs/vision/plans/08_UIUX設計書_Work.md
---

# Plan: Materials 画面 UIUX 設計 (Prototype Mobile)

> 段階 B — Notes / Daily の一覧 + RichEditor (簡易) の視覚仕様。共通トークンは **07 §1 を継承**。`[[title]]` リンク・Backlink パネルの視覚仕様を新規定義。

---

## Context

- **動機**: 要件定義 05 で定めた Notes/Daily/Editor を、card/row 切替で快適に読め、長押しメニュー・BottomSheet・Editor スライドインで滑らかに操作できる UX に
- **制約**: 07 §1 共通トークン継承 / 1 ファイル TSX / 外部 RichText ライブラリ禁止 / `[[title]]` ハイライトは正規表現ベースの素朴実装
- **Non-goals**: TipTap / contentEditable / Markdown レンダリング / Drag&Drop 並び替え / カードアニメーション (stagger)

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/09_UIUX設計書_Materials.md
prototype/src/screens/MaterialsScreen.tsx
```

---

## 1. 全体レイアウト

```
┌────────────────────────────────────┐ max-w-md / h-screen
│ Top Bar (h-12, mantle bg)          │
│  [☰] Notes / Daily   [🔍][⊞][↕][⚙] │
├────────────────────────────────────┤
│                                    │
│   <main> (flex-1, overflow-auto)   │
│   ListView (card or row)           │
│                                    │
│                              [+]   │ <- FAB
├────────────────────────────────────┤
│ BottomTabBar (h-14, mantle bg)     │ <- 07 §11
└────────────────────────────────────┘
       ↑ EditorView がここから右スライドインで覆う
```

---

## 2. Top Bar (List モード)

```
height: 48px (h-12)
background: C.mantle
border-bottom: 1px solid C.surface1
```

| 要素            | 幅     | 説明                                                            |
| --------------- | ------ | --------------------------------------------------------------- |
| Menu icon       | 44×44  | 左、Sidebar はこの prototype では未実装 (icon のみ、押下 no-op) |
| Kind セグメント | flex-1 | `Notes / Daily` の 2 ボタン、選択側は mauve underline           |
| Search icon     | 44×44  | 押下で検索入力欄 (top 直下に slideDown)                         |
| Layout icon     | 44×44  | `LayoutGrid` (card) / `ListIcon` (row) を相互切替               |
| Sort icon       | 44×44  | `ArrowUpDown` 押下で SortSheet                                  |
| Filter icon     | 44×44  | `Filter` 押下で FilterSheet。フィルタ適用中は `text-mauve`      |

---

## 3. ListView - Card Layout

### 3.1 Notes Card

```
┌─────────────────────────────┐
│ life-editor 設計メモ  📌    │ <- title (text-base font-medium) + pin icon
│ Tauri + Rust + React 19...  │ <- excerpt (text-sm subtext0, 2 行 line-clamp)
│ #dev #arch       2時間前    │ <- tag chip + timeAgo
└─────────────────────────────┘
```

- 幅: 100% - 32px (padding-x 4 = 16px 両端)
- 高さ: 自動 (excerpt 2 行)、最小 96px
- 背景: `C.surface0`、border-l 3px solid tag color (1 件目のタグ色 / なし=overlay0)
- rounded-2xl、padding 16px
- 行間 gap-3
- Pin icon: 右上、`C.peach`、size=14
- 押下: `bg-surface1`、200ms

### 3.2 Daily Card

```
┌─────────────────────────────┐
│ 5月23日(金) 🟢              │ <- 日付 + mood dot
│ 今日の振り返り...           │ <- excerpt
│ 🍅 4セッション   3時間前    │ <- pomodoroSessions + timeAgo
└─────────────────────────────┘
```

- title (text-base font-medium) は日付 + weekday `5月23日(金)`
- mood dot: 右側に MOOD_COLOR の `w-3 h-3 rounded-full` (1 件)
- 下段: `🍅 N セッション` (TimerIcon + count, text-xs)

### 3.3 Pin セクション区切り

```
─── 📌 ピン留め (2) ───
[Card]
[Card]
─── すべて (10) ───
[Card]
...
```

section header: `text-xs uppercase tracking-wide text-subtext0`、上下 padding-y 8px

---

## 4. ListView - Row Layout

### 4.1 Notes Row

```
┌─────────────────────────────────────┐
│ life-editor 設計メモ          2h前  │ <- title + timeAgo
│ Tauri + Rust + React 19...  #dev   │ <- excerpt 1 行 + 1 タグ
└─────────────────────────────────────┘
```

- 高さ 64px、border-bottom hairline `border-surface1`
- 左 padding 16、右 padding 16
- 押下: `bg-surface0`

### 4.2 Daily Row

```
┌─────────────────────────────────────┐
│ 🟢 5月23日(金)                3h前  │
│ 今日の振り返り... 🍅 4              │
└─────────────────────────────────────┘
```

- mood dot 左に固定 (w-3 h-3)

---

## 5. LongPress 動作

- 600ms 押下 → ItemMenuSheet 起動
- 同時に `active:scale-[0.99]` で押下フィードバック
- LongPress 中 (200ms 経過後) `bg-surface1` で視覚予兆
- Cancel: 指離す / 移動量 >10px

---

## 6. BottomSheet 群

### 6.1 共通 BottomSheet コンテナ

- 高さ: 内容に応じる (40-80%)
- 背景: `C.mantle`、上端 `rounded-t-2xl`
- handle: 上端中央 `w-10 h-1 rounded-full bg-overlay0 mt-2`
- アニメ: `translateY(100%→0)` 300ms ease-out
- バックドロップ: `bg-crust opacity-50` → タップで閉

### 6.2 SortSheet

```
┌─────────────────────────────┐
│       ───                    │
│ 並び替え                     │
│ ──────────                   │
│ ● 更新日時 (新しい順) ✓     │
│ ○ 作成日時 (新しい順)        │
│ ○ タイトル (五十音順)        │
└─────────────────────────────┘
```

- 高さ 40%
- 行高 48px、tap で `setSortKey` + 自動閉

### 6.3 FilterSheet

```
┌─────────────────────────────┐
│       ───                    │
│ フィルタ        [すべてクリア]│
│ ──────────                   │
│ タグ                         │
│  □ #dev (12)                │
│  □ #arch (5)                │
│  ☑ #book (6)                │
│  ...                        │
│ [適用]                       │
└─────────────────────────────┘
```

- 高さ 60%
- 1 タップで toggle、適用ボタンで反映 (即時反映でも可、本プロトタイプは即時)
- `[すべてクリア]` ボタン右上

### 6.4 ItemMenuSheet (LongPress)

```
┌─────────────────────────────┐
│       ───                    │
│ life-editor 設計メモ         │ <- target title
│ ──────────                   │
│ 📌 ピン留め                  │
│ 📋 複製                       │
│ 🗑️ 削除                       │ <- red text
└─────────────────────────────┘
```

- 高さ 40%
- 各行 56px

### 6.5 EditorMenuSheet (Editor More)

```
┌─────────────────────────────┐
│       ───                    │
│ ──────────                   │
│ 📌 ピン留めを解除            │ <- 状態に応じてラベル変化
│ 📋 複製                       │
│ 🔗 共有 (モック)             │
│ 🗑️ 削除                       │
└─────────────────────────────┘
```

### 6.6 MoodSheet (Daily)

```
┌─────────────────────────────┐
│       ───                    │
│ 気分                         │
│ ──────────                   │
│ 🟢 良い           ✓          │
│ 🔵 普通                       │
│ 🟡 微妙                       │
│ 🟠 つかれた                   │
│ 🔴 だめ                       │
└─────────────────────────────┘
```

- 高さ 50%
- 大きめの dot (w-6 h-6 + ラベル text-base)

### 6.7 TagSheet (WikiTag 付与)

```
┌─────────────────────────────┐
│       ───                    │
│ タグを追加                    │
│ ──────────                   │
│ [🔍 タグを検索______________X] │ <- 検索 + 新規作成
│                              │
│ 既存タグ                      │
│ ☑ #dev                      │
│ ☑ #arch                     │
│ □ #book                     │
│ ...                          │
│ [+ "newtag" を作成]          │ <- 検索クエリが既存に無い時のみ
└─────────────────────────────┘
```

- 高さ 70%
- 検索入力中、既存タグの部分一致を絞り込み
- IME 安全: `isComposing` 中は absent から追加ボタンを出さない

---

## 7. EditorView (右からスライドイン)

### 7.1 構造

```
┌────────────────────────────────────┐ 全画面 / max-w-md
│ [←]    [▼ 保存中]      [⚙ More]   │ <- ヘッダー (h-12)
├────────────────────────────────────┤
│ タイトル                            │
│ [_______________________________]  │
│                                    │
│ #dev × #arch × [+]                 │ <- WikiTag chip + 追加
│                                    │
│ 🟢 (Daily のみ mood)                │
│                                    │
│ ┌────────────────────────────────┐│
│ │ 本文                            ││ <- textarea (flex-1)
│ │                                 ││
│ │ [[life-editor 設計]] と関連...   ││ <- ハイライト
│ │                                 ││
│ │ ...                            ││
│ └────────────────────────────────┘│
│ ─────────────────────              │
│ ▼ このノートを参照しているもの (3)  │ <- Backlink パネル (折りたたみ)
│  • [Task] life-editor 仕様レビュー  │
│  • [Note] Tauri 学習メモ           │
│  • [Note] 設計判断録                │
└────────────────────────────────────┘
```

### 7.2 スライドインアニメ ([M-EDITOR-1])

- ListView はマウント維持 (z-index 0)
- EditorView は overlay として `translateX(100%→0)`、300ms ease-out
- 戻る (`onBack`) は `translateX(0→100%)` 300ms ease-in
- 並行で keyboard hiding と競合しないよう `will-change: transform`

### 7.3 SaveStatus インジケーター

| status  | 色     | アイコン                   | テキスト  |
| ------- | ------ | -------------------------- | --------- |
| editing | yellow | (なし)                     | 編集中    |
| saving  | sky    | spinner (ChevronDown 回転) | 保存中... |
| saved   | green  | Check                      | 保存済み  |

- 中央 chip、`text-xs`、padding-x 8、padding-y 4、rounded-full

### 7.4 Title 入力

- `<input>` placeholder「タイトル」
- `text-xl font-semibold`、`bg-transparent` (ただしコンテナは不透明 `C.base`)
- focus 時 border-bottom 2px mauve

### 7.5 WikiTag chip 行

- 横並び、横スクロール (overflow-x-auto)
- 各 chip: `h-6 rounded-full bg-[tagColor]/20 text-[tagColor]` (薄色背景は不透明な専用定数。プロトタイプでは `bg-surface0 border` で代用してもよい)
- 各 chip 右に X (短押し = detach)
- 末尾に `+ ` 円形ボタン (TagSheet 起動)

### 7.6 Body textarea

- `<textarea>` 高さ flex-1、`bg-transparent` (コンテナは `C.base`)
- フォント: `font-mono text-sm leading-relaxed`
- placeholder: 「ここに書く...」

### 7.7 `[[title]]` ハイライト ([M-LINK 追加])

textarea は素なので overlay 表示で疑似ハイライト:

- textarea の内容を `<pre>` レイヤに reflect (positon: absolute、textarea と同寸法、color: transparent な textarea で覆う)
- `<pre>` 側で `[[title]]` を `<span class="text-sky underline cursor-pointer">` でラップ
- 解決可: `text-sky`、解決不可: `text-red`
- タップ判定: textarea の `onClick` で caret 位置を取得、その位置に `[[..]]` トークンがあれば prevent default + 遷移

実装の簡易化: 本プロトタイプでは「リンクハイライトのみ」(タップ遷移なし) でも acceptance OK。タップ遷移は段階 C で必要なら追加。

### 7.8 `[[` 入力候補ポップアップ

- textarea 内で `[[` が入力された瞬間、現在 caret 直下に absolute で表示
- 候補リスト: `Notes / Daily / ScheduleItem` の title 部分一致、最大 10 件
- 各行: kind アイコン + title (1 行) + WikiTag chip 1 件
- 矢印キー: 上下で選択、Enter で確定 → `[[<title>]]` 挿入 + ポップアップ閉
- Escape: 閉じる
- IME: `isComposing` 中は表示しない (Enter キーが変換確定と競合)

### 7.9 Backlink パネル ([M-BACKLINK 追加])

- 折りたたみ default 閉
- header: `▼ このノートを参照しているもの (N)` (N=0 なら表示しない)
- 各行 56px:
  - 左: kind icon (`[Task]`/`[Event]`/`[Note]`/`[Daily]` バッジ)
  - 中: from タイトル + マッチ snippet (`...と関連する [[このノート]] を参照`)
  - 押下: 該当画面へ遷移 (Note→Editor 開き直し、ScheduleItem→/schedule 遷移 + ハイライト)

---

## 8. FAB (List モード時のみ)

07 §10 と同寸。Materials 固有:

- 押下動作: `kind === 'notes'` なら新規 Note → Editor、`kind === 'daily'` なら当日 Daily 取得 or 新規 → Editor
- Editor 表示中は **非表示** (`view === 'list'` で表示制御)

---

## 9. 状態 4 種マトリクス (Materials 固有)

| 要素                   | default            | active                  | pinned/selected    | disabled     |
| ---------------------- | ------------------ | ----------------------- | ------------------ | ------------ |
| Notes Card             | bg=surface0        | bg=surface1             | border-mauve 2px   | —            |
| Daily Card             | bg=surface0        | bg=surface1             | (pinned と同様)    | —            |
| Row                    | bg=base            | bg=surface0             | border-l-mauve 3px | —            |
| Layout icon            | text=overlay0      | text=mauve (現 layout)  | —                  | —            |
| Filter icon            | text=overlay0      | text=mauve (フィルタ中) | —                  | —            |
| WikiTag chip in editor | bg=surface0 border | scale-95                | —                  | —            |
| `[[link]]` (解決可)    | text=sky underline | scale-95                | —                  | —            |
| `[[link]]` (解決不可)  | text=red underline | —                       | —                  | (タップ無効) |
| Save status            | (status 別色)      | —                       | —                  | —            |

---

## 10. アンチパターン (Materials 固有追加)

07 §13 に加え:

- **LongPress と Scroll 競合**: タップ開始後、Y 方向移動 >10px で LongPress 判定キャンセル
- **`[[` 連打で候補ポップアップが重複起動**: 候補ポップアップは singleton `popoverOpen` state で管理
- **textarea の `onChange` 全文同期で巨大ノート遅延**: 本プロトタイプは規模小なので問題なし。本番で 10KB 超は debounce + virtual textarea
- **Editor スライドイン中に LongPress 受信で ItemMenuSheet 起動**: `view === 'list'` ガードで防御
- **Daily の `date` 変更で ID 衝突**: date は read-only (FR-10 で UI 上は表示のみ、変更不可)

---

## 11. 実装移植ヒント (CRUD 計画書 11 への引き継ぎ)

- BottomSheet は共通コンポーネント `BottomSheet({ open, onClose, height, children })` として 1 ファイル内 helper にまとめる
- `[[title]]` 解決は `resolveLink(title, allEntities)` 関数で分離、Backlink 走査と共通化
- 簡易 highlight overlay は実装難度高い → 段階 C で「ハイライトなし、リンクは別行に列挙」の fallback パターンも検討
- TagSheet は Schedule 03 / Work 04 の WikiTag 付与でも再利用 (共通化候補)

---

## Acceptance Criteria

- [ ] §1-7 各画面パーツの寸法・色・状態が表で明記されている
- [ ] §9 状態マトリクスが空欄なし
- [ ] §10 アンチパターンが Materials 固有問題 (LongPress / IME / `[[` 重複) を含む
- [ ] [M-EDITOR-1] [M-LIST-PIN-1] [M-DAILY-1] [M-LONGPRESS-1] [M-IME-1] が反映
- [ ] [M-LINK 追加] [M-BACKLINK 追加] の視覚仕様が具体的
- [ ] 07 §1 共通トークンを再定義していない

---

## References

- 要件定義 (Parent): `05_要件定義書_Materials.md`
- 前 UIUX (共通トークン): `07_UIUX設計書_Schedule.md`
- 凍結原本: `prototype/_artifacts/materials demo.tsx`
- 本書を参照する後続: `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。BottomSheet 7 種類 / EditorView スライドイン / `[[title]]` overlay highlight 案 / Backlink パネル UI 設計
