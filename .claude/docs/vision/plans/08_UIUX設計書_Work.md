---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/04_要件定義書_Work.md
Previous: .claude/docs/vision/plans/07_UIUX設計書_Schedule.md
---

# Plan: Work 画面 UIUX 設計 (Prototype Mobile)

> 段階 B — Pomodoro Timer / History / Preset Settings の視覚仕様。共通トークン (色・spacing・モーション・ジェスチャ・a11y) は **07 §1 を継承** し、本書では Work 固有の差分のみ記述する。

---

## Context

- **動機**: 要件定義 04 で定めた Pomodoro 機能を、Timer の「見た目で時間経過がわかる」UX と History の「日付別 grouping の見やすさ」、Preset Settings の「即編集」体験で具現化する
- **制約**: 07 §1 の共通トークン継承 / 1 ファイル TSX 維持 / 外部アニメライブラリ禁止 / Web Audio API 禁止
- **Non-goals**: Circular Progress Indicator (SVG arc) のリッチ実装 / Haptic Feedback / 音声通知

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/08_UIUX設計書_Work.md
prototype/src/screens/WorkScreen.tsx
```

---

## 1. 全体レイアウト

```
┌────────────────────────────────────┐ max-w-md / h-screen
│ SubTabBar (h-12, mantle bg)        │ <- 上部に固定
│  ─── Timer | History | Settings ── │
├────────────────────────────────────┤
│                                    │
│   <main> (flex-1, overflow-auto)   │
│                                    │
│   TimerTab / HistoryTab /          │
│   SettingsTab                      │
│                                    │
├────────────────────────────────────┤
│ BottomTabBar (h-14, mantle bg)     │ <- 07 §11 共通仕様
└────────────────────────────────────┘
```

Schedule の ScreenHeader に相当する月送り・View 切替が **不要**なため、SubTabBar が画面トップ。FAB なし (Pomodoro 制御は TimerTab 内のボタン群)。

---

## 2. SubTabBar (Timer / History / Settings)

```
height: 48px (h-12)
background: C.mantle
border-bottom: 1px solid C.surface1
3 タブ等幅
```

| state         | bg                           | text     |
| ------------- | ---------------------------- | -------- |
| 非選択        | mantle                       | overlay0 |
| 選択 (active) | mantle + underline mauve 2px | text     |
| 押下          | opacity-70                   | —        |

選択中は下端 2px の `border-b-2 border-mauve`、非選択は `border-b-2 border-transparent` (位置ずれ防止)。

---

## 3. TimerTab

### 3.1 構造

```
┌────────────────────────────────────┐
│ SessionTypeTabs (h-9)              │
│  [WORK] [BREAK] [LONG BREAK]       │ <- segment (running 中は disabled)
├────────────────────────────────────┤
│                                    │
│        ┌──────────────┐            │
│        │              │            │
│        │    25 : 00   │ <- Countdown (text-7xl, mono)
│        │              │            │
│        └──────────────┘            │
│                                    │
│   ●●●○  (session dots, 4/4)        │ <- ロングブレーク到達カウント
│                                    │
│   今選んでいるタスク                │
│   ┌────────────────────────────┐  │
│   │ ● life-editor 仕様レビュー  │  │ <- 現在 Task chip
│   │ #dev                       X│  │
│   └────────────────────────────┘  │
│                                    │
│   [+ タスクを選ぶ]                 │ <- 未選択時のみ表示
│                                    │
│ ┌───────────────────────────────┐ │
│ │ [Reset]   [▶ Start]   [Skip] │ │ <- Controls (h-14)
│ └───────────────────────────────┘ │
│                                    │
│ [✓ Task 完了]                      │ <- Task 選択時のみ表示
└────────────────────────────────────┘
```

### 3.2 CountdownDigits

- フォント: `font-mono`, `text-7xl` (72px) / `font-bold tracking-tight`
- 色: `C.text` (default) / WORK 残り 10 秒 → `C.peach` / 残り 5 秒 → `C.red` + 振動アニメ (`animate-pulse` 相当)
- `mm:ss` 固定、:colon は `opacity-50` で controls からの分離感
- 中央配置、上下 `py-12`

### 3.3 Pulse (完了瞬間)

完了時 `pulseKey++` で key 更新、`animate-[pulse_0.6s_ease-out_1]` で 1 回再生 (Tailwind v3 arbitrary):

```tsx
<div key={pulseKey} className="animate-[ping_0.6s_ease-out_1]">
  {/* CountdownDigits */}
</div>
```

### 3.4 Controls (3 ボタン)

| ボタン      | 幅     | 色                   | アイコン      | 機能                                             |
| ----------- | ------ | -------------------- | ------------- | ------------------------------------------------ |
| Reset       | flex-1 | surface0 / text=text | RotateCcw     | 残り時間をプリセット秒に戻す                     |
| Start/Pause | flex-2 | mauve / text=base    | Play or Pause | 走行切替 (走行中は Pause icon)                   |
| Skip        | flex-1 | surface0 / text=text | SkipForward   | 現セッションを skip → 自動 sessionEnd(skip=true) |

- 高さ 56px (h-14)
- 押下: `active:scale-[0.98]`
- Start ボタンのみ accent (他は subtle)

### 3.5 Session Dots (ロングブレーク到達カウント)

- 横並び `<activePreset.sessionsBeforeLongBreak>` 個
- 完了済み: `bg-mauve w-2 h-2 rounded-full`
- 未完了: `bg-surface1 w-2 h-2 rounded-full`
- 4/4 達成で次セッションが LONG_BREAK

### 3.6 Current Task chip

- 高さ 56px (`min-h-14`)
- 背景: `C.surface0`
- 左: WikiTag dot (タスクの 1 つ目のタグ色)
- 中央: title (1 行 ellipsis)
- 下: WikiTag chip 群 (1 件目のみ表示)
- 右: X icon (44×44 ターゲット、押下で `currentTask=null`)
- 押下: TaskPickerModal 起動

### 3.7 「タスクを選ぶ」ボタン (未選択時)

- 高さ 48px、border `dashed border-overlay0`、text `subtext0`
- 押下: TaskPickerModal

### 3.8 Task 完了ボタン

- 表示条件: `currentTask !== null` かつ `currentTask.status !== 'done'`
- 高さ 48px、background `C.green / 30%` 相当 (透明禁止のため不透明な `#3a4e3f` 風の別定数。または `bg-green text-base`)
- 押下: ConfirmModal → `scheduleItemUpdate({ status: 'done' })`

### 3.9 SessionTypeTabs

- 3 ボタン segmented
- 非選択: `bg-surface0 text-subtext0`
- 選択: `bg-[sessionTypeColor] text-base` (WORK=mauve / BREAK=green / LONG_BREAK=sky)
- 走行中: `opacity-50 pointer-events-none`

---

## 4. TaskPickerModal

### 4.1 構造

```
画面下から 80% スライドイン
┌────────────────────────────────┐
│ [X] タスクを選ぶ              │
│ [🔍 検索______________________]│ <- 検索欄 sticky
├────────────────────────────────┤
│ ▼ #dev                         │ <- WikiTag group header
│   ● life-editor 仕様レビュー   │
│   ● MCP Server の検証          │
│ ▼ #biz                         │
│   ● 請求書作成                  │
│ ▼ #personal                    │
│   ● ランニング計画              │
└────────────────────────────────┘
```

### 4.2 グルーピング

- ScheduleItem (type='task') を `wikiTagIds` の 1 つ目で group (タグなし → 「タグなし」)
- group header: `text-xs uppercase tracking-wide text-subtext0` (07 §1.4)
- 完了済 (status='done') はデフォルト非表示、`[✓ 完了を表示] toggle` で展開

### 4.3 行 (タスク)

- 高さ 56px
- 左: StatusCheckbox (07 §6.3 と共通)
- 中央: title
- 右: WikiTag chip 1 件
- 押下: `setCurrentTask` + Modal 閉

### 4.4 検索

- title の部分一致 (大文字小文字区別なし)
- IME 対策: `e.nativeEvent.isComposing` 中は filter 更新しない (確定後のみ反映)

---

## 5. HistoryTab

### 5.1 構造

```
┌────────────────────────────────┐
│ ▼ 今日 (4)                      │ <- section header
│  09:30 ●life-editor 仕様レビュー│ <- SessionListRow
│        WORK   25m              │
│  10:25 ●life-editor 仕様レビュー│
│        WORK   25m              │
│  10:55 (休憩)                  │
│        BREAK  5m               │
│ ▼ 昨日 (5)                      │
│  ...                           │
│ ▼ 5月22日(火) (4)               │
│  ...                           │
└────────────────────────────────┘
```

### 5.2 SessionListRow

- 高さ 56px
- 左: time `text-sm font-mono` (`14:30`)
- 中央: SessionType dot + Task title (taskTitle が null なら 「(休憩)」)
- 右: SessionType chip + 実時間 `font-mono`
- LongPress (600ms): 削除確認モーダル

### 5.3 SessionType chip

| type       | bg    | text |
| ---------- | ----- | ---- |
| WORK       | mauve | base |
| BREAK      | green | base |
| LONG_BREAK | sky   | base |

- 高さ 20px、横 padding-x 8px、`rounded-full`、`text-[10px]`

### 5.4 空状態

- 中央配置、TimerIcon + 「セッション履歴はまだありません」
- 「Timer タブで開始しましょう」

---

## 6. SettingsTab (Preset 設定)

### 6.1 構造

```
┌────────────────────────────────┐
│ プリセット                       │
│ [Classic ✓] [Long Focus]       │
│ [Short Burst] [+ 追加]          │
├────────────────────────────────┤
│ アクティブプリセット              │
│ Classic                        │
│ ┌────────────────────────────┐ │
│ │ WORK         25 min        │ │
│ │ [────●─────] 1-180         │ │ <- SliderRow
│ ├────────────────────────────┤ │
│ │ BREAK         5 min        │ │
│ │ [─●─────────] 1-60         │ │
│ ├────────────────────────────┤ │
│ │ LONG BREAK   15 min        │ │
│ │ [───●───────] 1-60         │ │
│ ├────────────────────────────┤ │
│ │ ロングブレーク間隔  4 回    │ │
│ │ [──●────────] 1-10         │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│ オプション                       │
│ □ 休憩を自動で開始              │ <- ToggleRow
├────────────────────────────────┤
│ [Classic を削除]                │ <- 危険色 (red)
└────────────────────────────────┘
```

### 6.2 Preset chip (切替)

- 高さ 36px、横 padding 12px、rounded-full
- 非選択: `bg-surface0 text-subtext1`
- 選択: `bg-mauve text-base` + 右に Check icon
- 押下: 走行中なら ConfirmModal、停止中なら即切替

### 6.3 SliderRow

- 高さ 64px
- 上段: label (text-sm) + 値 (text-base font-mono)
- 下段: native `<input type="range">` + min/max 表示
- スライダー thumb: `bg-mauve` (CSS で `appearance: none` + 独自 style)
- 値変更時 throttle 100ms で `updatePreset`

### 6.4 ToggleRow

iOS 風 toggle:

- track: `w-10 h-6 rounded-full bg-surface1 transition-colors`
- thumb: `w-5 h-5 rounded-full bg-text translate-x-0` / 選択時 `translate-x-4 bg-mauve` + track `bg-mauve/30` 相当 (不透明な薄 mauve 別定数または `bg-mauve` 弱)
- 押下: thumb scale-90

### 6.5 危険な操作 (プリセット削除)

- 高さ 48px、`text-red`、左に Trash2 icon
- 押下: ConfirmModal → soft delete
- 最後の 1 つの場合: `opacity-50 pointer-events-none` + 注釈 「最後のプリセットは削除できません」

---

## 7. モーダル群

### 7.1 SessionCompletionModal

- 全画面オーバーレイ (`fixed inset-0 bg-crust/80` 相当 — 透明 ng のため `bg-[#11111b]` 不透明 + `flex` 中央配置)
- 中央 card: `bg-surface0 rounded-2xl p-6 max-w-xs`
- 内容:
  - SessionType chip + 「セッション完了!」
  - Task title (あれば)
  - 経過時間 (`font-mono text-3xl`)
  - 2 ボタン: 「次のセッションへ」(mauve) / 「やめる」(surface1)

### 7.2 ConfirmModal (汎用)

- card: `bg-surface0 rounded-2xl p-6 max-w-xs`
- 上: タイトル `text-base font-semibold`
- 中: メッセージ `text-sm text-subtext0`
- 下: 2 ボタン横並び `[キャンセル] [OK]`
  - キャンセル: `bg-surface1 text-text`
  - OK: 危険なら `bg-red text-base`、通常なら `bg-mauve text-base`

### 7.3 AddPresetModal

- 下から 70% スライド
- フォーム: name (text) + 4 つの number input + 「追加」「キャンセル」

### 7.4 共通モーション

- オーバーレイ fade: 200ms `ease-out`
- card scale-in: `scale-95 → scale-100`, 200ms `ease-out`
- BottomSheet 系 (TaskPicker, AddPreset): 300ms `ease-out` (07 §1.5 共通)

---

## 8. 状態 4 種マトリクス (Work 固有)

| 要素              | default             | active           | running                  | disabled               |
| ----------------- | ------------------- | ---------------- | ------------------------ | ---------------------- |
| Start/Pause btn   | bg=mauve, icon=Play | scale-98         | bg=mauve, icon=Pause     | —                      |
| Reset/Skip btn    | bg=surface0         | scale-98         | (running 中も使用可)     | —                      |
| SessionTypeTabs   | bg=surface0         | bg=sessionColor  | (= disabled, opacity-50) | bg=surface0 opacity-50 |
| Preset chip       | bg=surface0         | bg=mauve + check | (切替時 ConfirmModal)    | —                      |
| Task Picker 行    | bg=base             | bg=surface0      | —                        | —                      |
| Delete preset btn | text=red            | scale-98         | —                        | opacity-50 (last 1)    |

---

## 9. アンチパターン (Work 固有追加)

07 §13 に加え:

- **Countdown を 1 秒 setInterval で更新するときの drift**: 本プロトタイプでは許容 (NFR-1 範囲外)。ただし pause/resume 時に `Date.now()` を保存しないと累積誤差発生 → resume 時に `remainingSec` ベースで再開し、過去 elapsed 加算しない
- **Modal 二重起動**: SessionCompletionModal が開いた状態で Pomodoro 続行ボタン → 即次セッション開始 → 0 秒到達で再度 Modal、という再起。`modal.open && remainingSec===0` の guard 必要
- **TaskPicker の検索中 IME 確定 Enter で Modal 閉**: enter キーハンドラを置かない or `isComposing` チェック必須

---

## 10. 実装移植ヒント (CRUD 計画書 11 への引き継ぎ)

- `intervalRef` の cleanup は `useEffect` の return で確実に行う (Modal 中も含めて)
- `currentTask` は ScheduleItem ID で保持し、render 時に `scheduleItems.find()` で解決 (削除されたら null 化される)
- TaskPickerModal は `BottomSheet` 共通コンポーネント (09 Materials で利用) と統一可能 → 共通化候補だが本プロトタイプでは各 TSX で重複可
- SliderRow throttle は `useRef<NodeJS.Timeout>` で実装、ライブラリ追加禁止

---

## Acceptance Criteria

- [ ] §1-7 各画面パーツの寸法・色・状態が表で明記されている
- [ ] §8 状態マトリクスが空欄なし
- [ ] §9 アンチパターンが Work 固有問題を含む
- [ ] [W-COUNTDOWN-1] [W-PRESET-1] [W-DELETE-1] が反映 (04 §4)
- [ ] 07 §1 の共通トークンを再定義していない (継承して差分のみ)

---

## References

- 要件定義 (Parent): `04_要件定義書_Work.md`
- 前 UIUX (共通トークン): `07_UIUX設計書_Schedule.md`
- 凍結原本: `prototype/_artifacts/mobile work section demo.tsx`
- 本書を参照する後続: `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。CountdownDigits の色変化 / Session Dots / TaskPickerModal のグルーピング (folder→WikiTag) / Pulse animation 設計
