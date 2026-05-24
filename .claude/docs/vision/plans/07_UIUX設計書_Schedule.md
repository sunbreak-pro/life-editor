---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/03_要件定義書_Schedule.md
---

# Plan: Schedule 画面 UIUX 設計 (Prototype Mobile)

> 段階 B — 「どう見せ、どう動かすか」を確定する書類。実装の根拠となる視覚仕様・モーション・ジェスチャ・a11y を網羅。

---

## Context

- **動機**: 要件定義 03 で定めた機能要件を、Catppuccin Mocha + Tailwind v3 で実装する際の視覚 SSOT を作る。08/09/10 はここで定義する共通パターン (色・モーション・ジェスチャ) を継承する
- **制約**: Catppuccin Mocha 固定 / arbitrary value (`bg-[#xxxxxx]`) or `style={{ background: C.xxx }}` のいずれかで指定 / 主要 UI コンテナ背景に透明度禁止 / モーションは React state + Tailwind transition のみ (framer-motion 等の導入禁止)
- **Non-goals**: Light テーマ / Theme トークン化 / Storybook / Figma 連携

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/07_UIUX設計書_Schedule.md
prototype/src/screens/ScheduleScreen.tsx  (実装は 11 CRUD で対応、本書は仕様のみ)
```

---

## 1. 共通デザイントークン (本書 + 08/09/10 で共有)

### 1.1 Catppuccin Mocha (全エンティティ共通)

```ts
const C = {
  // Base layers (背景・サーフェス)
  base: "#1e1e2e", // 画面ベース
  mantle: "#181825", // 1 段奥 (BottomTab 背景 等)
  crust: "#11111b", // 最奥 (モーダルオーバーレイ ベース)
  surface0: "#313244", // カード・行
  surface1: "#45475a", // 入力欄・border emphasis
  surface2: "#585b70", // 押下時 active
  // Text
  text: "#cdd6f4", // primary
  subtext1: "#bac2de",
  subtext0: "#a6adc8", // secondary / placeholder
  overlay0: "#6c7086", // disabled / icon mute
  overlay1: "#7f849c",
  // Accent
  mauve: "#cba6f7", // primary action / brand
  pink: "#f5c2e7",
  peach: "#fab387", // warn / birthday
  yellow: "#f9e2af", // doing status / 注意
  green: "#a6e3a1", // done status / 成功
  sky: "#89dceb", // event / 情報
  blue: "#89b4fa",
  red: "#f38ba8", // danger / 削除
};
```

### 1.2 Spacing スケール (Tailwind 既定を採用)

| Token         | px      | 用途             |
| ------------- | ------- | ---------------- |
| `gap-1`       | 4       | chip 間          |
| `gap-2`       | 8       | icon + text      |
| `gap-3`       | 12      | row 間           |
| `gap-4`       | 16      | section 間       |
| `gap-6`       | 24      | section 大区切り |
| `p-2 p-3 p-4` | 8/12/16 | 各 padding       |

### 1.3 Radius

| Token          | px  | 用途               |
| -------------- | --- | ------------------ |
| `rounded-md`   | 6   | input / chip       |
| `rounded-lg`   | 8   | card               |
| `rounded-xl`   | 12  | modal / sheet      |
| `rounded-2xl`  | 16  | FAB                |
| `rounded-full` | ∞   | avatar / chip pill |

### 1.4 タイポ

- Sans: `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif` (default)
- Mono: `'SF Mono', Menlo, Consolas, monospace` (ID 表示・コード)
- ベース: 14px (Mobile 標準)
- 行高: `leading-snug` (1.375) を主、本文のみ `leading-relaxed` (1.625)

### 1.5 共通モーション

| 用途                         | duration    | easing                                        |
| ---------------------------- | ----------- | --------------------------------------------- |
| 押下 active feedback         | 100ms       | `ease-out` (`transition active:scale-[0.98]`) |
| BottomSheet / Modal slide    | 300ms       | `ease-in-out`                                 |
| Drawer (Sidebar) slide       | 280ms       | `ease-out`                                    |
| View 切替 (List/Month/Three) | なし (即時) | —                                             |
| Skeleton fade                | 600ms       | `ease-in-out` (本プロトタイプでは未使用)      |

### 1.6 ジェスチャ規約

| ジェスチャ      | 持続   | 用途                                                     |
| --------------- | ------ | -------------------------------------------------------- |
| Tap             | <300ms | プライマリ操作                                           |
| LongPress       | ≥600ms | コンテキストメニュー                                     |
| Swipe (横)      | —      | 本プロトタイプ未採用 (ThreeDayView の日付スワイプは将来) |
| Pull-to-refresh | —      | 本プロトタイプ未採用                                     |

### 1.7 a11y

- すべてのタップターゲット: 44×44px 以上 (`min-h-[44px] min-w-[44px]`)
- アイコンのみのボタンは `aria-label` 必須
- focus visible: `focus-visible:ring-2 ring-[#cba6f7]` (mauve)
- color contrast: テキスト最小 4.5:1 (Catppuccin Mocha base + text=#cdd6f4 で OK)

---

## 2. Schedule 画面 全体レイアウト

```
┌────────────────────────────────────┐ <- max-w-md (375px) / h-screen
│ ScreenHeader (h-12, surface0 bg)   │
│  [Menu] 2026年5月  [<] [>] [Today] │
│  ─── Month | Three | List ───      │ <- segment control (h-10)
├────────────────────────────────────┤
│                                    │
│   <main> (flex-1, overflow-auto)   │
│                                    │
│   MonthView / ThreeDayView /       │
│   ListView                         │
│                                    │
│                                    │
├────────────────────────────────────┤
│                              [+]   │ <- FAB (absolute, bottom-20 right-4)
├────────────────────────────────────┤
│ BottomTabBar (h-14, mantle bg)     │
│ [Sch][Wrk][Mat][Set]               │
└────────────────────────────────────┘
```

- ルート: `<div className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden" style={{ background: C.base }}>`
- 背景: 必ず不透明 (`base`)。透明 / opacity は使わない (CLAUDE.md §6.4 透明落ち禁止)

---

## 3. ScreenHeader

```
height: 48px (h-12)
background: C.surface0
border-bottom: 1px solid C.surface1
```

### 3.1 構成 (横並び)

| 要素              | サイズ | 説明                                  |
| ----------------- | ------ | ------------------------------------- |
| Menu icon button  | 44×44  | 左、Sidebar 開閉                      |
| Title `2026年5月` | flex-1 | 中央寄せ、`text-base font-medium`     |
| Prev `<` icon     | 44×44  | 月送り                                |
| Next `>` icon     | 44×44  | 月送り                                |
| Today button      | auto   | `text-sm`、border-mauve、押下で当月へ |

### 3.2 セグメント (View 切替)

`ScreenHeader` 下に独立した行 `h-10`、3 ボタン等幅。

- 非選択: `bg-surface0 text-subtext0`
- 選択: `bg-mauve text-base`
- 押下: `active:scale-[0.98]`

---

## 4. MonthView (最重要・[MV-1] 不変)

### 4.1 グリッド構造

```
週ヘッダー (h-8): 日 月 火 水 木 金 土
─────────────────────────────────────
6 行 × 7 列 = 42 セル
各セル: padding-bottom 150% で 1:1.5 固定
```

```tsx
<div className="grid grid-cols-7 gap-px" style={{ background: C.surface1 }}>
  {/* week header */}
  {WEEK_DAYS.map((d) => (
    <div
      className="h-8 flex items-center justify-center text-xs"
      style={{ background: C.mantle, color: weekendColor(d) }}
    >
      {d}
    </div>
  ))}
  {/* 42 cells */}
  {cells.map((cell) => (
    <div
      className="relative"
      style={{ background: C.base, paddingBottom: "150%" }}
    >
      <div className="absolute inset-0 overflow-hidden p-1">
        {/* 日付 + 最大 3 アイテム + 「+N」 */}
      </div>
    </div>
  ))}
</div>
```

### 4.2 セル内レイアウト

```
┌─────────────────┐
│ 21              │ <- 日付 (右上 or 左上, text-xs, 当月=text, 月外=overlay0)
│ ┌─────────────┐ │
│ │ ●チーム会議  │ │ <- アイテム chip (h-4, text-[10px])
│ ├─────────────┤ │
│ │ ●デザイン... │ │
│ ├─────────────┤ │
│ │ ●週次MTG     │ │
│ └─────────────┘ │
│ +2              │ <- 超過集約 (text-[10px], subtext0)
└─────────────────┘
```

### 4.3 セル内アイテム chip 配色

| type / status | dot color | text color                              |
| ------------- | --------- | --------------------------------------- |
| task / todo   | overlay0  | text                                    |
| task / doing  | yellow    | text                                    |
| task / done   | green     | overlay0 (strikethrough)                |
| event         | sky       | text                                    |
| birthday      | peach     | text                                    |
| holiday       | red       | text (背景 dot なし、日付自体が red 色) |

### 4.4 月外日付セル

- 背景: `C.mantle` (当月より一段沈める)
- 日付色: `C.overlay0`
- タップ: 無効 (`pointer-events-none`)
- アイテム表示: あれば表示 (タップは無効)

### 4.5 当日セル

- 日付背景: `rounded-full bg-mauve text-base w-6 h-6 flex items-center justify-center`

### 4.6 選択中セル (DayDetailSheet 開いている状態)

- セル全体に `outline: 2px solid C.mauve` (offset -2px)

---

## 5. ThreeDayView

### 5.1 構造

```
┌─────────────────────────────────────┐
│ 日付ヘッダー (sticky top, h-12)      │
│  5/20(月)  5/21(火) 今日 5/22(水)    │
├─────────────────────────────────────┤
│ 8:00 │       │       │              │
│  ┌──┐│       │       │              │
│  │  ││ ●会議 │       │              │
│ 9:00 │ 9-10  │       │              │
│      │       │ ●MTG  │              │
│10:00 │       │ 10-11 │              │
│      │       │       │              │
│  …   │       │       │              │
│22:00 │       │       │              │
└─────────────────────────────────────┘
```

- 縦軸: 8:00 - 22:00 (15 行、各 h-12 = 48px、計 720px、内部スクロール)
- 横軸: 3 列等幅
- 中央列が「当日」(背景 `bg-surface0/30` 相当だが透明禁止のため `bg-surface0` を 1 段薄く別色: `#262635` 等で別途定数追加 — それ未定の場合は単色 surface0)

### 5.2 イベントブロック

- 位置: `top = (time - 8) * 48 + 24`、`height = duration * 48` (px)
- 背景: type/status による色 (4.3 と共通) + 不透明
- text: title + time、`text-xs` overflow ellipsis

---

## 6. ListView

### 6.1 構造

```
┌─────────────────────────────────┐
│ ▼ 今日 (3)                       │ <- group header
│   ┌────────────────────────────┐│
│   │ [○] 09:00 チーム会議  #dev ││ <- ListItemRow
│   ├────────────────────────────┤│
│   │ [◐] life-editor 仕様...    ││ <- doing
│   └────────────────────────────┘│
│ ▼ 明日 (2)                       │
│ ▼ 今週 (5)                       │
│ ▼ 期限なし (4)                   │
└─────────────────────────────────┘
```

### 6.2 ListItemRow

- 高さ: 56px (line + tag chip)
- 左: StatusCheckbox (44×44 タップターゲット内に 24×24 visible)
- 中央: time (あれば) + title (1 行 ellipsis)
- 右: WikiTag chip 群 (最大 2 件 + +N、横スクロールなし)
- タップ: `openEditModal(item)`
- LongPress: 削除メニュー (本プロトタイプでは省略可、AddEventModal 内の削除で対応)

### 6.3 StatusCheckbox

24×24 visible / 44×44 ターゲット:

| status | 表現                                                  |
| ------ | ----------------------------------------------------- |
| todo   | 空丸 `border-2 border-overlay0`                       |
| doing  | `bg-yellow rounded-full` (filled circle)              |
| done   | `bg-green rounded-full` + 中央に Check icon (base 色) |

タップ → 循環 (todo → doing → done → todo)。`active:scale-90` で押下フィードバック。

---

## 7. DayDetailSheet ([SHEET-1] 不変)

### 7.1 構造

```
画面下半分 (h-1/2)
┌─────────────────────────────────┐
│ 5月21日 (火)                  X │ <- ヘッダー
├─────────────────────────────────┤
│ [○] 09:00 チーム会議            │
│ [◐] 14:00 デザインレビュー       │
│ ●     終日   ●ボブ誕生日         │
├─────────────────────────────────┤
│ [+ 予定を追加]  [3日ビューで開く]│ <- フッター 2 ボタン
└─────────────────────────────────┘
```

### 7.2 アニメーション

- バックドロップ: `bg-crust opacity-50` (Sheet 外、タップで閉じる)
- Sheet 本体: `transform translateY(100%↔0) transition-transform duration-300 ease-in-out`
- 開閉判定: `selectedDay !== null`

### 7.3 月外日付の保護

要件定義 03 FR-3 通り、月外日付セルは `onClick={undefined}` で無効化。

---

## 8. AddEventModal (フル画面)

### 8.1 構造

```
┌─────────────────────────────────┐
│ [X] 予定の追加          [保存]   │ <- ヘッダー (sticky top)
├─────────────────────────────────┤
│ タイトル                         │
│ [_____________________________]  │
│                                  │
│ タイプ                           │
│ ( task ) ( event ) ( birthday )  │ <- radio button row
│                                  │
│ 日付                             │
│ [2026-05-21]                     │
│                                  │
│ 時刻 (任意)                      │
│ [09:00] - [10:00]                │
│                                  │
│ タグ                              │
│ #dev × #work × [+]              │ <- chip + TagPicker
│                                  │
│ 説明 (任意)                      │
│ [_______________________________]│
│                                  │
│ ─────────────────────            │
│ [ゴミ箱] (編集モード時のみ表示)   │
└─────────────────────────────────┘
```

### 8.2 タイプ別の disabled

- `holiday`: 全フィールド read-only、保存ボタン無効、編集モード時のみ表示。バナー「祝日は編集できません」を上部に表示
- `birthday`: 時刻フィールド無効化 (終日固定)
- `event`: 時刻必須 (validation)
- `task`: 時刻任意

### 8.3 削除ボタン

- 編集モード時のみ表示 (新規時は非表示)
- 押下 → `ConfirmModal` → soft delete → モーダル閉 → 元画面に反映

### 8.4 アニメーション

- 開閉: 下から `translateY(100%→0)` 300ms ease-out
- TagPicker は同モーダル内で BottomSheet 風に展開 (画面遷移なし)

---

## 9. Sidebar (左ドロワー)

### 9.1 構造

```
┌──────────────┐
│ [Search][Filter]│ <- 排他展開アイコン (1.2)
├──────────────┤
│ ─ Search Panel │
│ [🔍________X] │
├──────────────┤
│ ─ Filter Panel │
│ ▼ タグ        │
│  □ #dev       │
│  □ #work      │
│  □ #biz       │
│  □ #holiday   │
│ ▼ ステータス  │
│  □ todo       │
│  □ doing      │
│  □ done       │
└──────────────┘
```

幅: 280px、左から `translateX(-100%→0)` 280ms ease-out。
背景: `C.mantle`、右辺 `border-r border-surface1`。

### 9.2 排他展開動作

- 「Search」アイコンタップ → SearchPanel 展開、FilterPanel 閉
- 「Filter」アイコンタップ → 逆
- 同じアイコンを再タップ → 閉じる

### 9.3 ChecboxRow

- 高さ 44px、左に □/■ アイコン、右に label
- 選択: `bg-surface0`
- 未選択 hover: なし (モバイル)

---

## 10. FAB ([FAB-1] 不変)

```
position: absolute
right: 16px (right-4)
bottom: 80px (bottom-20)  # BottomTab の上
size: 56×56 (w-14 h-14)
background: C.mauve
color: C.base
shadow: shadow-lg
icon: Plus (size=24, strokeWidth=2.5)
```

- 押下: `active:scale-95` 100ms
- スクロール追従しない (`absolute` で `<main>` の外側兄弟)

---

## 11. BottomTabBar (4 タブ全 enabled)

```
height: 56px (h-14)
background: C.mantle
border-top: 1px solid C.surface1
4 タブ等幅
```

各タブ:

- アイコン (size=20) + ラベル (text-[10px])
- 非選択: `text-overlay0`
- 選択 (active): `text-mauve`
- 押下: `active:opacity-70`
- リンク: `react-router-dom` の `<NavLink>`

---

## 12. 状態 4 種マトリクス (主要 UI)

| 要素                  | default         | hover  | active      | disabled                |
| --------------------- | --------------- | ------ | ----------- | ----------------------- |
| FAB                   | bg=mauve        | (省略) | scale-95    | bg=overlay0, opacity-50 |
| StatusCheckbox        | 空/yellow/green | —      | scale-90    | opacity-50              |
| ListItemRow           | bg=base         | —      | bg=surface0 | text=overlay0           |
| MonthView セル (当月) | bg=base         | —      | bg=surface0 | —                       |
| MonthView セル (月外) | bg=mantle       | —      | (無効)      | text=overlay0           |
| BottomTab             | text=overlay0   | —      | opacity-70  | (本書範囲外)            |
| AddEventModal 保存    | bg=mauve        | —      | scale-98    | bg=overlay0, opacity-50 |

---

## 13. アンチパターン (本書で禁止)

- **透明落ち**: `bg-transparent` / `bg-black/50` 等の opacity 指定で主要コンテナを描く (代わりに `C.crust` 等の不透明色を使う)
- **過剰モーション**: 500ms 超の transition / spring 物理演算
- **未定義 Tailwind クラス**: 例 `bg-foo-500` (Catppuccin Mocha に存在しない) → silent fail で透明落ち。必ず `bg-[#xxxxxx]` か `style={{ background: C.xxx }}`
- **IME 破壊**: input/textarea で Enter キー処理する際 `e.nativeEvent.isComposing` 未チェック → 変換確定 Enter を誤受信
- **WaterMark/Glassmorphism**: backdrop-blur など。Catppuccin Mocha の落ち着いた配色を活かす設計

---

## 14. 実装移植ヒント (CRUD 計画書 11 への引き継ぎ)

- `C` オブジェクトはファイル冒頭で定義、export しない (1 ファイル完結を維持)
- MonthView の paddingBottom: 150% パターンは `aspect-[2/3]` への変更禁止 (要件定義 03 §4 [MV-1])
- 配色 chip は `getStatusColor(item)` / `getTypeColor(item)` の小関数に切り出し、テスト容易性を確保
- AddEventModal は 1 つだけ mount、`isOpen` + `editingItem` で開閉制御 (2 つのモーダルを切替えない)

---

## Acceptance Criteria

- [ ] §1 デザイントークンが 08/09/10 で再定義されない (本書を参照)
- [ ] §2-11 各画面パーツの寸法・色・状態が表で明記されている
- [ ] §12 状態マトリクスが空欄なし
- [ ] §13 アンチパターンが具体例付き
- [ ] [MV-1] [FAB-1] [SHEET-1] [STATUS-1] [SIDEBAR-1] の不変要件がすべて反映

---

## References

- 要件定義 (Parent): `03_要件定義書_Schedule.md`
- 凍結原本: `prototype/_artifacts/life editor unified demo.tsx`
- design 参考: CLAUDE.md §6.4 (透明落ち禁止) / frontend-react-designer スキル
- 本書を参照する後続: `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。Catppuccin Mocha トークン化 / [MV-1] padding-bottom: 150% パターン明文化 / 状態マトリクス + アンチパターン整理
