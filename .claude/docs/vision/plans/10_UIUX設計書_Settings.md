---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/06_要件定義書_Settings.md
Previous: .claude/docs/vision/plans/09_UIUX設計書_Materials.md
---

# Plan: Settings / Trash / CrossSearch 画面 UIUX 設計 (Prototype Mobile)

> 段階 B — iOS HIG 風 List Section / Trash 画面 / CrossSearch 画面の視覚仕様。共通トークンは **07 §1 を継承**。

---

## Context

- **動機**: 要件定義 06 で定めた Settings (List Section) / TrashScreen / CrossSearchScreen の視覚仕様を確定。iOS の Settings.app に寄せたシンプル・明確なリスト UI を目指す
- **制約**: 07 §1 共通トークン継承 / 1 ファイル TSX (各画面 1 ファイル、3 ファイル) / Catppuccin Mocha 固定
- **Non-goals**: iOS Native Settings の完全再現 / カラーピッカー / 詳細グラフ

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/10_UIUX設計書_Settings.md
prototype/src/screens/SettingsScreen.tsx
prototype/src/screens/TrashScreen.tsx
prototype/src/screens/CrossSearchScreen.tsx
```

---

## 1. SettingsScreen 全体レイアウト

```
┌────────────────────────────────────┐ max-w-md / h-screen
│ Top Bar (h-12, mantle bg)          │
│  設定                              │
├────────────────────────────────────┤
│ <main> (flex-1, overflow-auto)     │
│                                    │
│  ─── 表示 ───                      │ <- Section header
│  Theme           Dark      [>]     │
│  Font size                 ────●   │ <- Slider 行
│  Language        日本語    [>]     │
│  Materials の既定 Card | Row       │ <- segmented inline
│                                    │
│  ─── 通知 ───                       │
│  Pomodoro 終了              ☑     │
│  10 分前リマインダー         ☑     │
│  30 分前リマインダー         □     │
│  Daily 未記入 (20:00)        ☑     │
│  ⓘ 本番モバイルアプリで実通知化    │ <- バッジ
│                                    │
│  ─── データ ───                     │
│  🔍 横断検索                  [>]  │
│  🗑️ ゴミ箱           (3)     [>]  │ <- バッジ
│  Mock データを初期化               │ <- danger
│                                    │
│  ─── About ───                      │
│  バージョン     prototype-v0.0.1   │
│  OSS ライセンス             [>]    │
│  リポジトリ                 [Copy] │
│  このプロトタイプについて   [>]    │
│                                    │
├────────────────────────────────────┤
│ BottomTabBar (h-14, mantle bg)     │ <- 07 §11
└────────────────────────────────────┘
```

---

## 2. Top Bar (画面遷移ヘッダー)

```
height: 48px (h-12)
background: C.mantle
border-bottom: 1px solid C.surface1
```

| 状況                 | 左       | 中央     | 右       |
| -------------------- | -------- | -------- | -------- |
| SettingsScreen (top) | (なし)   | 設定     | (なし)   |
| TrashScreen          | [< 設定] | ゴミ箱   | [全削除] |
| CrossSearchScreen    | [< 戻る] | 横断検索 | (なし)   |

中央: `text-base font-medium`。両端ボタン: 44×44 タップターゲット。

---

## 3. List Section ([S-LIST-1] 不変)

### 3.1 Section Header

```
height: 32px, padding-y 8, padding-x 16
text: `text-xs uppercase tracking-wide text-subtext0`
背景: C.base (透明感のあるが不透明)
```

### 3.2 Section Body

```
背景: C.surface0
rounded-xl
margin-x 16, margin-bottom 16
内側に hairline divider (border-bottom 1px solid C.surface1) を各 row 間に
```

### 3.3 各 row 共通仕様

| 要素                | 寸法                                                      |
| ------------------- | --------------------------------------------------------- |
| 高さ                | 44px 最小、内容により 56-64px                             |
| padding-x           | 16                                                        |
| 左アイコン (任意)   | 24×24、margin-right 12                                    |
| label               | flex-1、`text-sm`                                         |
| 右コントロール      | 状況に応じる (Toggle / Slider / Picker / chevron / badge) |
| 区切り              | row 間 1px `border-surface1`、最終 row なし               |
| 押下 (タップ可能行) | `bg-surface1` 100ms                                       |

---

## 4. 各 row 種別の視覚仕様

### 4.1 Picker row (Theme / Language)

```
[label]                     [value]  [>]
Theme                       Dark      ›
```

- 右に現在値 (`text-sm text-subtext0`) + ChevronRight icon (`size=16 text-overlay0`)
- 押下: BottomSheet で選択肢一覧 (radio 風、選択中は Check icon)

### 4.2 Slider row (Font size)

```
[label]
[──●──────────] 12 - 25
Aa  Aa  Aa  Aa  Aa  Aa  Aa  Aa  Aa  Aa
```

- 高さ 80px
- 上段: label
- 下段: native `<input type="range" min="12" max="25" step="1">`
- スライダー thumb: `bg-mauve`
- 下に「サンプル文字」を 10 段階で表示 (装飾、実 fontSize を反映 — このプロトタイプではこのプレビューだけ実 size 反映、画面全体は変えない)
- 右に「本番で適用」バッジ ([S-PREVIEW-1])

### 4.3 Segmented row (Materials Layout)

```
Materials の既定表示
[ Card ✓ ] [ Row ]
```

- 2 ボタン segmented、選択側 `bg-mauve text-base`、未選択 `bg-surface1 text-subtext1`
- 押下: 即時切替 (BottomSheet なし)

### 4.4 Toggle row (Notifications)

```
[label]                     [○────]
Pomodoro 終了                ON
```

- iOS 風 toggle (08 §6.4 と同じ)
- 押下: 即時 toggle

### 4.5 Nav row (横断検索 / ゴミ箱 / About 系)

```
[icon] [label]      (badge)   [>]
🗑️ ゴミ箱            (3)        ›
```

- badge: `bg-mauve text-base rounded-full text-xs px-2` (件数表示)
- 押下: 別画面遷移 (`/trash`, `/cross-search` 等)

### 4.6 Danger row (Mock 初期化)

```
[icon, red] [label, red]
🗑️ Mock データを初期化
```

- 左 icon + label 全体 `text-red`
- 押下: ConfirmModal (08 §7.2 共通)

### 4.7 Value-only row (About バージョン等)

```
[label]            [value (mono)]
バージョン         prototype-v0.0.1
```

- value: `font-mono text-sm text-subtext0`、押下無効

### 4.8 Action row (リポジトリ Copy)

```
[label]                    [Copy]
リポジトリ                 [Copy]
```

- 右に小さなボタン (`text-xs bg-surface1 px-3 py-1 rounded`)、押下で `navigator.clipboard.writeText` + Toast「コピーしました」

### 4.9 「本番で適用」バッジ ([S-PREVIEW-1])

- row の右下 or value 横に小さく
- `text-[10px] text-subtext0 bg-surface1 px-2 py-0.5 rounded-full`
- 文言: 「本番アプリで反映」

---

## 5. BottomSheet (Picker 用)

### 5.1 Theme Picker Sheet

```
┌─────────────────────────────┐
│       ───                    │
│ テーマ                       │
│ ──────────                   │
│ ● Light                      │
│ ● Dark ✓                     │
│ ● System                     │
└─────────────────────────────┘
```

- 高さ 40%
- radio 風 (左に circle filled / 右に Check icon for selected)

### 5.2 Language Picker Sheet

同上、日本語 / English。

---

## 6. TrashScreen

### 6.1 全体

```
┌────────────────────────────────────┐ max-w-md / h-screen
│ Top Bar: [< 設定] ゴミ箱 [全削除]  │
├────────────────────────────────────┤
│ Filter Tabs (h-10, scrollable)     │
│ [全て(3)][Sch(1)][Note(2)][Daily]  │
├────────────────────────────────────┤
│ <main> (flex-1, overflow-auto)     │
│                                    │
│ ┌──────────────────────────────┐  │
│ │ life-editor 設計メモ          │  │ <- TrashItemRow
│ │ Note          3日前削除       │  │
│ │ [復元] [完全削除]              │  │
│ └──────────────────────────────┘  │
│                                    │
│ ...                                │
│                                    │
│ (空状態 = アイコン + メッセージ)    │
│                                    │
├────────────────────────────────────┤
│ BottomTabBar (Settings tab active) │
└────────────────────────────────────┘
```

### 6.2 Filter Tabs

- 横スクロール、各 chip `h-8 px-3 rounded-full`
- 非選択: `bg-surface0 text-subtext1`
- 選択: `bg-mauve text-base`
- バッジ数字を chip 内に表示 `全て (3)`

### 6.3 TrashItemRow

- カード形式、padding 16、`bg-surface0 rounded-xl`、margin-bottom 12
- 上段: title (`text-base`) + kind バッジ (右上、`text-[10px] bg-surface1 px-2 rounded-full`)
- 中段: 削除日時 (`text-xs text-subtext0` + `🕐 timeAgo(deletedAt)`)
- 下段: 2 ボタン横並び
  - 復元: `bg-mauve text-base rounded-md h-9 flex-1`
  - 完全削除: `bg-surface1 text-red border border-red rounded-md h-9 flex-1`

### 6.4 全削除

- Top Bar 右の `[全削除]` テキストボタン (`text-red text-sm`)
- 押下 → ConfirmModal (`message: "ゴミ箱内の全項目を完全に削除します"`)

### 6.5 空状態 ([S-TRASH-1])

```
┌──────────────────────┐
│                      │
│    🗑️              │ <- Trash2 icon (size=64, color=overlay0)
│                      │
│  ゴミ箱は空です      │
│                      │
│ 削除した項目は       │
│ ここに表示されます    │
│                      │
└──────────────────────┘
```

- 縦中央、上下左右余白たっぷり
- text: `subtext0` / `subtext1`

---

## 7. CrossSearchScreen

### 7.1 全体

```
┌────────────────────────────────────┐ max-w-md / h-screen
│ Top Bar: [< 戻る] 横断検索         │
├────────────────────────────────────┤
│ Search Input (h-12)                │
│ [🔍 タグ・タイトル・本文_________]  │
├────────────────────────────────────┤
│ Tag chip 列 (h-10, scrollable)     │
│ [#dev × ][#arch × ][+ 追加]        │
├────────────────────────────────────┤
│ <main> (flex-1, overflow-auto)     │
│                                    │
│ ┌──────────────────────────────┐  │
│ │ [📅] チーム会議                │  │ <- ResultRow
│ │ 2026-05-21 09:00 #dev          │  │
│ ├──────────────────────────────┤  │
│ │ [📄] life-editor 設計メモ      │  │
│ │ Tauri + Rust... 2時間前 #dev   │  │
│ ├──────────────────────────────┤  │
│ │ [📔] 5月20日(月)              │  │
│ │ 今日の振り返り 3日前 #journal  │  │
│ └──────────────────────────────┘  │
│                                    │
│ (結果なし = 「該当なし」表示)       │
└────────────────────────────────────┘
```

### 7.2 Search Input

- 高さ 48px、padding-x 16
- 左に Search icon、入力フィールド、右に X (クリア)
- 背景: `C.surface0 rounded-md`
- IME 安全: `isComposing` 中は結果再計算しない

### 7.3 Tag chip 列

- 横スクロール、各 chip `h-8 px-3 rounded-full bg-mauve/30 text-mauve` (不透明な薄色は `bg-surface0 border border-mauve` で代用可)
- × ボタン: chip 内右端
- 末尾に `+ 追加` chip (`bg-surface0 border-dashed border-subtext0`) → TagSheet 起動

### 7.4 ResultRow

- 高さ 64px、padding 12、border-bottom hairline
- 左 アイコン: kind 別 (`Calendar`=Schedule, `FileText`=Note, `BookOpen`=Daily)
- 中央: title (1 行 ellipsis) + meta (時刻 / timeAgo + WikiTag chip 1 件)
- 押下: 該当画面へ遷移
  - Schedule: `/schedule` + state で MonthView の該当日付セルへスクロール
  - Note: 直接 EditorView を開く (`/materials?open=note-xxx` でも可)
  - Daily: 同上

### 7.5 結果ソート

- `updatedAt` 降順
- header に 「N 件」表示 (`text-xs text-subtext0`、結果上部 padding-y 8)

---

## 8. アンチパターン (Settings 系固有追加)

07 §13 に加え:

- **toggle の連打で localStorage 競合書き込み**: 各 setting 関数は `await` ベースで作らず、同期的に setState + localStorage 書き込み (mock では問題なし)
- **slider 連続値変更で localStorage に毎フレーム書き込み**: throttle 100ms 必須 (06 §7 で言及)
- **Trash 復元時に同 title 衝突 (Daily)**: 復元前に既存 ID 重複チェック、衝突なら警告 toast「同日の Daily が既に存在します」+ 復元キャンセル
- **Search 入力中に IME 変換が結果再計算をトリガー**: `isComposing` チェック必須
- **「Mock 初期化」を誤タップ**: 必ず ConfirmModal、ConfirmModal の OK ボタンも 1 秒の cool down (連打誤操作防止) を入れる

---

## 9. 状態 4 種マトリクス (Settings 系固有)

| 要素                    | default                   | active             | selected                | disabled            |
| ----------------------- | ------------------------- | ------------------ | ----------------------- | ------------------- |
| Section row (tap)       | bg=surface0               | bg=surface1        | —                       | text=overlay0       |
| Toggle                  | track=surface1 thumb=text | scale-90           | track=mauve thumb=mauve | opacity-50          |
| Slider thumb            | bg=mauve                  | —                  | —                       | opacity-50          |
| Segmented btn           | bg=surface1 text=subtext1 | bg=mauve text=base | —                       | opacity-50          |
| Picker BottomSheet row  | (radio)                   | bg=surface1        | check icon visible      | —                   |
| Trash item 復元 btn     | bg=mauve text=base        | scale-98           | —                       | opacity-50 (件数 0) |
| Trash item 完全削除 btn | bg=surface1 text=red      | scale-98           | —                       | —                   |
| Search Input            | bg=surface0               | border-mauve focus | —                       | —                   |
| Filter tab chip         | bg=surface0 text=subtext1 | scale-98           | bg=mauve text=base      | —                   |
| Result row              | bg=base                   | bg=surface0        | —                       | —                   |

---

## 10. 実装移植ヒント (CRUD 計画書 11 への引き継ぎ)

- `SettingsScreen` の List Section 共通コンポーネントは `Section` / `Row` helper を 1 ファイル内に定義 (素朴な func)
- BottomSheet は Materials 09 §6.1 と同等の共通 helper を再利用 (1 ファイル内に再定義 — DRY より 1 ファイル完結優先)
- 「本番で適用」バッジは `<PreviewBadge />` helper で揃える
- Trash 画面の `listTrashItems` は各 mock store (scheduleItems / notes / presets / sessions) を順に走査して flatten、`deletedAt` 降順 sort
- CrossSearch は debounce 200ms で再計算 (大量データ想定外、本プロトタイプでは即時でも可)

---

## Acceptance Criteria

- [ ] §1-7 各画面パーツの寸法・色・状態が表で明記されている
- [ ] §9 状態マトリクスが空欄なし
- [ ] §10 アンチパターンが Settings 系固有問題を含む
- [ ] [S-LIST-1] [S-DANGER-1] [S-TRASH-1] [S-CROSS-1] [S-PREVIEW-1] が反映
- [ ] 07 §1 共通トークンを再定義していない

---

## References

- 要件定義 (Parent): `06_要件定義書_Settings.md`
- 前 UIUX (共通トークン): `07_UIUX設計書_Schedule.md`
- iOS HIG (List Section の概念参考): https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- 本書を参照する後続: `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。iOS 風 List Section / Trash 画面 / CrossSearch 画面 / 「本番で適用」バッジ / 危険行の red 統一
