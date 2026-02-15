# Routine UIUX 強化プラン

**Status**: COMPLETED
**Created**: 2026-02-15

---

## Context

現在のRoutine機能はMemoViewの1タブとして基本的なCRUD・完了トグル・ストリーク表示を提供しているが、**習慣化を促進するための行動心理学的な仕掛け**が不足している。本プランでは、行動科学の知見（Hook Model、Identity-Based Habits、Don't Miss Twice）と主要アプリ（Atoms, Streaks, Habitify）のベストプラクティスを取り入れ、Routineを独立セクションに昇格させ、習慣の定着率を高めるUI/UXを実現する。

---

## Phase 1: 独立セクション昇格 + レイアウト

### 1.1 ナビゲーション変更

**変更ファイル**:

- `frontend/src/types/taskTree.ts` — `SectionId` に `'routine'` 追加
- `frontend/src/components/Layout/LeftSidebar.tsx` — menuItems に Routine 追加（`Repeat` アイコン、`memo` と `music` の間に配置）
- `frontend/src/App.tsx` — `renderContent()` の switch に `case "routine"` 追加
- `frontend/src/i18n/locales/{en,ja}.json` — `sidebar.routine` 追加

### 1.2 レイアウト構成

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar │  MainContent (flex-1)                          │
│         │                                                │
│ [Tasks] │  ┌─RoutineView─────────────────────────────┐   │
│ [Memo]  │  │ Header: "Routine" + [+追加] + [📊Stats]│   │
│▶[Routine]│  │                                        │   │
│ [Music] │  │ ┌─Today Section───────────────────────┐ │   │
│ [Work]  │  │ │ 朝のルーティン                      │ │   │
│ [Cal]   │  │ │  ☑ 瞑想 (🔥12)  ☑ ストレッチ (🔥5)│ │   │
│ [Stats] │  │ │ 昼のルーティン                      │ │   │
│ [⚙]    │  │ │  ☐ 読書 (🔥3)                       │ │   │
│         │  │ │ 夜のルーティン                      │ │   │
│         │  │ │  ☐ 日記 (🔥20)   ☐ 振り返り        │ │   │
│         │  │ │ いつでも                             │ │   │
│         │  │ │  ☑ 水を飲む (🔥45)                  │ │   │
│         │  │ └─────────────────────────────────────┘ │   │
│         │  │                                        │   │
│         │  │ ┌─Weekly Heatmap (直近7週)────────────┐ │   │
│         │  │ │ M T W T F S S                       │ │   │
│         │  │ │ ■ ■ □ ■ ■ ■ □   ← 色の濃淡で達成率 │ │   │
│         │  │ │ ■ ■ ■ ■ □ ■ ■                      │ │   │
│         │  │ │ ...                                  │ │   │
│         │  │ └─────────────────────────────────────┘ │   │
│         │  │                                        │   │
│         │  │ ┌─Habit Stacks───────────────────────┐ │   │
│         │  │ │ 🌅 Morning Flow (3/4 完了)          │ │   │
│         │  │ │  1. ☑ 瞑想 → 2. ☑ ストレッチ →    │ │   │
│         │  │ │  3. ☑ コーヒー → 4. ☐ ジャーナル   │ │   │
│         │  │ │  [▶ 次を開始]                       │ │   │
│         │  │ └─────────────────────────────────────┘ │   │
│         │  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**SubSidebarは使用しない** — Routineは1画面で全体を見渡せるシングルペインレイアウト。コンテンツ量がtask/memoほど多くないため、MainContent直接描画が適切。

### 1.3 MemoViewからの移行

- MemoViewの「Routine」タブは**削除**する
- `frontend/src/components/Memo/MemoView.tsx` からRoutineタブを除去
- `frontend/src/components/Memo/RoutineView.tsx` 等のコンポーネントは新セクションで再利用・リファクタ

---

## Phase 2: 柔軟なスケジューリング

### 2.1 時間帯カテゴリ

ルーティンに `timeSlot` プロパティを追加し、表示をグループ化する。

| timeSlot    | ラベル (ja) | ラベル (en) | 表示順 |
| ----------- | ----------- | ----------- | ------ |
| `morning`   | 朝          | Morning     | 1      |
| `afternoon` | 昼          | Afternoon   | 2      |
| `evening`   | 夜          | Evening     | 3      |
| `anytime`   | いつでも    | Anytime     | 4      |

**データモデル変更** (`RoutineNode` に追加):

```
timeSlot: "morning" | "afternoon" | "evening" | "anytime" (default: "anytime")
```

**DB変更** (V16マイグレーション):

```sql
ALTER TABLE routines ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'anytime';
```

### 2.2 Grace Period（"Don't Miss Twice" ルール）

ストリーク計算ロジックを変更: **1日のミスではストリークを切らない。2日連続でミスした場合のみリセット。**

- `useRoutines.ts` の `getStatsForRoutine` 内のストリーク計算を修正
- UI上で「1日ミスした状態」を視覚的に区別（オレンジ色の警告アイコン等で「今日やらないとストリーク切れるよ」を伝える）
- `RoutineStats` に `isAtRisk: boolean` を追加（1日ミス中かどうか）

### 2.3 頻度パターン拡張

現在の `daily | custom` に加え、以下を追加:

| frequencyType  | 説明     | 追加パラメータ                       |
| -------------- | -------- | ------------------------------------ |
| `daily`        | 毎日     | なし (現行通り)                      |
| `custom`       | 特定曜日 | `frequencyDays: number[]` (現行通り) |
| `timesPerWeek` | 週N回    | `timesPerWeek: number` (新規)        |

**データモデル変更** (`RoutineNode` に追加):

```
timesPerWeek?: number  // frequencyType === "timesPerWeek" の場合のみ使用
```

**DB変更** (V16マイグレーション):

```sql
ALTER TABLE routines ADD COLUMN times_per_week INTEGER;
```

---

## Phase 3: Habit Stacking

### 3.1 データモデル

新テーブル `routine_stacks`:

```sql
CREATE TABLE routine_stacks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE routine_stack_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (stack_id) REFERENCES routine_stacks(id) ON DELETE CASCADE,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
  UNIQUE(stack_id, routine_id)
);
```

**型定義** (`routine.ts` に追加):

```
interface RoutineStack {
  id: string;
  name: string;
  order: number;
  items: RoutineStackItem[];  // position順
  createdAt: string;
  updatedAt: string;
}

interface RoutineStackItem {
  id: number;
  stackId: string;
  routineId: string;
  position: number;
}
```

### 3.2 UI設計

**スタック表示**: メインビュー下部にカード形式で表示

- スタック名 + 進捗バー（3/4完了）
- 各ルーティンを順番に表示、完了済みはチェック表示
- 「次を開始」ボタンで未完了の次のルーティンにフォーカス

**スタック作成**:

- 「+スタック作成」ボタンからダイアログ
- スタック名入力 + 既存ルーティンからドラッグ or 選択で順番に追加
- ルーティンは複数のスタックに所属可能

### 3.3 タイマー連携（深い統合）

スタック内のルーティンに対して:

- 「▶ 次を開始」→ 該当ルーティンのポモドーロを自動開始
- ポモドーロ完了時にルーティンを自動チェック + スタック内の次へ自動遷移
- この連携には `TimerContext` の `startTimer` と `RoutineContext` の `toggleLog` を組み合わせる

---

## Phase 4: 進捗ダッシュボード

### 4.1 Stats モーダル / パネル

ヘッダーの「📊Stats」ボタンで表示切り替え（メインビュー内の表示をトグル、またはスライドパネル）。

**含むコンポーネント**:

#### ヒートマップ（GitHub Contributions風）

- 直近12週間（約3ヶ月）の日別達成率を色の濃淡で表示
- 色: 0%=薄いグレー → 100%=濃い緑（4段階）
- 各セルにホバーで「2026-02-15: 4/5 完了」のツールチップ

#### 達成率推移グラフ

- 週単位の達成率を折れ線グラフで表示（直近12週）
- 既存の `AnalyticsView` のチャートパターンを参考にする（もしあれば）
- 軽量実装: CSS Grid + divベースのバーチャート（外部ライブラリ不要）

#### ストリーク履歴

- 各ルーティンの現在ストリーク + 最長ストリーク
- `RoutineStats` に `bestStreak: number` を追加
- ストリークのタイムライン表示（いつストリークが始まり・切れたか）

#### マイルストーン一覧

- 達成済みマイルストーンのバッジ表示（7日、30日、100日、365日）
- `RoutineStats` に `milestones: number[]`（達成済みマイルストーンの日数リスト）

### 4.2 データ計算

既存の `useRoutines.ts` の `getStatsForRoutine` を拡張:

- `bestStreak` 計算を追加
- `heatmapData` 計算（日別の全ルーティン達成率）
- `weeklyRates` 計算（週単位の達成率推移）

---

## Phase 5: マイクロインタラクション

### 5.1 完了時アニメーション

チェックボックスクリック時:

- **リップルエフェクト**: チェックボックスから緑のリップルが広がる（CSS animation）
- **スケールバウンス**: チェックマークが少し拡大→縮小（transform: scale）
- 所要時間: 300-400ms、CSS only（JSアニメーションライブラリ不要）

### 5.2 マイルストーン祝福

ストリークがマイルストーンに到達した瞬間:

- **7日**: 小さなバッジ表示 + 短いパルスアニメーション
- **30日**: バッジ + 「🔥30日連続！」トースト通知
- **100日**: バッジ + 祝福モーダル（簡素）
- **365日**: バッジ + 特別な祝福モーダル

検出タイミング: `toggleLog` で完了にした時、直前のストリーク値+1がマイルストーン値と一致するかチェック

### 5.3 効果音連携

完了時の効果音:

- 既存の `AudioContext` を利用
- チェック完了時に短い効果音を再生（既存のエフェクト音量設定に従う）
- `localStorage` の `STORAGE_KEYS.EFFECT_VOLUME` を参照

### 5.4 今日の進捗インジケータ

Sidebar の Routine アイコン横に小さなプログレスドット:

- 全完了: 緑ドット
- 一部完了: オレンジドット
- 未着手: 表示なし

---

## Phase 6: 深い統合（タイマー + サウンド）

### 6.1 ルーティンからポモドーロ開始

RoutineItem に「▶」ボタンを追加（ホバーで表示）:

- クリックで `TimerContext.startTimer()` を呼び出し
- ルーティン名をタイマーの表示名として使用
- ポモドーロ完了時にルーティンの完了を提案（自動チェックではなく確認）

**実装アプローチ**:

- `RoutineNode` に `linkedTaskId?: string` は追加しない（ルーティンはタスクとは独立）
- タイマー開始時にルーティンIDを `TimerContext` に渡す新しい関数 `startRoutineTimer(routineId, title, durationMinutes)` を追加
- `TimerContext` に `activeRoutineId: string | null` を追加

### 6.2 サウンドプリセット連携

ルーティンに任意でサウンドプリセットを関連付け:

**データモデル変更** (`RoutineNode` に追加):

```
soundPresetId?: string  // sound_presets テーブルのIDを参照
```

**DB変更** (V16マイグレーション):

```sql
ALTER TABLE routines ADD COLUMN sound_preset_id TEXT;
```

**動作**:

- ルーティンのタイマー開始時に、関連付けられたサウンドプリセットを自動適用
- 編集ダイアログに「サウンドプリセット」選択ドロップダウンを追加
- 既存の `useLocalSoundMixer` / `AudioContext` で再生

---

## 変更対象ファイル一覧

### 新規作成

| ファイル                                                  | 説明                               |
| --------------------------------------------------------- | ---------------------------------- |
| `frontend/src/components/Routine/RoutineSection.tsx`      | 新メインビュー（独立セクション）   |
| `frontend/src/components/Routine/RoutineItemCard.tsx`     | リデザインされたルーティンアイテム |
| `frontend/src/components/Routine/RoutineHeatmap.tsx`      | ヒートマップコンポーネント         |
| `frontend/src/components/Routine/RoutineStatsPanel.tsx`   | 統計パネル                         |
| `frontend/src/components/Routine/RoutineStackCard.tsx`    | Habit Stack カード                 |
| `frontend/src/components/Routine/RoutineStackDialog.tsx`  | Stack 作成/編集ダイアログ          |
| `frontend/src/components/Routine/RoutineCreateDialog.tsx` | 既存ダイアログの拡張版             |
| `frontend/src/components/Routine/MilestoneToast.tsx`      | マイルストーン祝福表示             |
| `electron/database/routineStackRepository.ts`             | Stack CRUD                         |
| `electron/ipc/routineStackHandlers.ts`                    | Stack IPC ハンドラ                 |

### 変更

| ファイル                                         | 変更内容                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/types/taskTree.ts`                 | `SectionId` に `'routine'` 追加                                                                                                        |
| `frontend/src/types/routine.ts`                  | `timeSlot`, `timesPerWeek`, `soundPresetId` 追加、`RoutineStack` 型追加、`RoutineStats` に `bestStreak`, `isAtRisk`, `milestones` 追加 |
| `frontend/src/hooks/useRoutines.ts`              | Grace Period ストリーク計算、ヒートマップデータ、週次レート、Stack管理                                                                 |
| `frontend/src/components/Layout/LeftSidebar.tsx` | `menuItems` に routine 追加                                                                                                            |
| `frontend/src/App.tsx`                           | `renderContent` に `case "routine"` 追加                                                                                               |
| `frontend/src/components/Memo/MemoView.tsx`      | Routine タブ削除                                                                                                                       |
| `frontend/src/contexts/RoutineContext.tsx`       | Stack関連の値・メソッド追加、タイマー連携                                                                                              |
| `frontend/src/services/DataService.ts`           | Stack CRUD メソッド追加                                                                                                                |
| `frontend/src/services/ElectronDataService.ts`   | Stack IPC 実装追加                                                                                                                     |
| `electron/database/migrations.ts`                | V16 マイグレーション追加                                                                                                               |
| `electron/ipc/registerAll.ts`                    | Stack ハンドラ登録                                                                                                                     |
| `electron/preload.ts`                            | Stack チャンネルをホワイトリスト追加                                                                                                   |
| `frontend/src/i18n/locales/en.json`              | 新規翻訳キー追加                                                                                                                       |
| `frontend/src/i18n/locales/ja.json`              | 新規翻訳キー追加                                                                                                                       |

---

## 実装順序

**Step 1**: Phase 1（独立セクション昇格） — 他のすべての基盤
**Step 2**: Phase 2（柔軟なスケジューリング） — UIグループ化の土台
**Step 3**: Phase 5（マイクロインタラクション） — 早期に体感改善
**Step 4**: Phase 4（進捗ダッシュボード） — データ可視化
**Step 5**: Phase 3（Habit Stacking） — 最もデータモデル変更が大きい
**Step 6**: Phase 6（深い統合） — Phase 3 完了後に連携実装

---

## 検証方法

1. **独立セクション**: Sidebar の Routine アイコンクリックで新セクション表示確認
2. **スケジューリング**: 各 timeSlot のルーティン作成 → グループ化表示確認
3. **Grace Period**: 1日ミス後にストリーク維持確認、2日連続ミスでリセット確認
4. **マイクロインタラクション**: チェック完了時のアニメーション目視確認
5. **ヒートマップ**: 過去データからの正確な達成率表示確認
6. **Habit Stack**: スタック作成 → 順次実行 → タイマー連携確認
7. **サウンド連携**: プリセット関連付け → タイマー開始時の自動適用確認
8. **既存テスト**: `npm run test` が全パス
9. **i18n**: en/ja 切り替えで全新規文言の表示確認
10. **データ移行**: 既存 routine_logs データが正常に保持されることの確認

---

## 行動心理学の根拠

| 機能                     | 心理学的根拠                                 | 出典                          |
| ------------------------ | -------------------------------------------- | ----------------------------- |
| ストリーク表示           | ドーパミン報酬ループ                         | Psychology Today              |
| Don't Miss Twice         | 完璧主義防止、柔軟性が継続率を高める         | Atomic Habits (James Clear)   |
| 時間帯グループ化         | 認知負荷軽減、既存ルーティンへのアンカリング | Implementation Intentions研究 |
| Habit Stacking           | 既存習慣をキューとして利用                   | BJ Fogg / James Clear         |
| マイクロインタラクション | 即時フィードバック = 即時報酬                | Hook Model (Nir Eyal)         |
| ヒートマップ             | 自己モニタリング効果（19,000人メタ分析）     | Psychology Today              |
| マイルストーン祝福       | 可変報酬 + Identity-Based Habits             | Hook Model + Atomic Habits    |
| Sidebarプログレスドット  | 外部トリガー（リマインダー）                 | Hook Model                    |

---

## リサーチソース

- [Hook Users With Habit-Forming UX Design | UXPin](https://www.uxpin.com/studio/blog/hook-users-habit-forming-ux-design/)
- [The Science Behind Habit Tracking | Psychology Today](https://www.psychologytoday.com/us/blog/parenting-from-a-neuroscience-perspective/202512/the-science-behind-habit-tracking)
- [Atoms - The Official Atomic Habits App](https://atoms.jamesclear.com/)
- [Habit Stacking | James Clear](https://jamesclear.com/habit-stacking)
- [Habit Tracker Comparison 2026 | Cohorty](https://blog.cohorty.app/habit-tracker-comparison/)
- [The Habit Loop | Netcore](https://netcorecloud.com/blog/the-habit-loops-key-to-building-habit-forming-app-experiences/)
- [Best Habit Tracking Apps 2026 | Fhynix](https://fhynix.com/best-habit-tracking-apps/)
- [Gamified Habit-Building Apps 2026 | Gamification+](https://gamificationplus.uk/which-gamified-habit-building-app-do-i-think-is-best-in-2026/)
