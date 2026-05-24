---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md
Previous: .claude/docs/vision/plans/02_実装計画書_プロトタイプ環境.md
---

# Plan: Schedule 画面 要件定義 (Prototype Mobile)

> 段階 A — 「何を作るか」を確定する書類。UIUX (07) と CRUD (11) は本書を Parent とする。

---

## Context

- **動機**: prototype の Schedule 画面 (`prototype/src/screens/ScheduleScreen.tsx`) はオリジナル demo を移植済だが、CalendarTag 廃止と Tasks/Events のデータ統合という新方針を反映する必要がある。本書は CRUD 実装に入る前の機能スコープを SSOT として固定する
- **制約**: 1 ファイル TSX 維持 / Provider 不使用 / Catppuccin Mocha 固定 / localStorage 名前空間 `lifemobile-mock:*` のみ例外許可 (要件定義 01 NFR-2 の例外緩和)
- **Non-goals**: 本番 `frontend/` への変更 / DataService 接続 / Tauri/Electron/Capacitor バンドリング / 実通知 / E2E テスト

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/03_要件定義書_Schedule.md          (本書)
prototype/src/screens/ScheduleScreen.tsx                     (将来の実装対象、本書では参照のみ)
prototype/_artifacts/life editor unified demo.tsx            (凍結原本、参照のみ)
```

本書は要件定義のみ。コード変更は CRUD 計画書 (11) のスコープ。

---

## 1. 用語と上位データモデル合意

本書および 04/05/06/11 で共通利用する型を定義する。**プロトタイプ内 mock store の型**であり、本番 `frontend/` の型とは別物 (本書 §9 マッピング参照)。

```ts
// 全画面横断の共通型 (mock store)
type EntityId = string; // `task-<uuid>` / `event-<uuid>` / `note-<uuid>` / `daily-YYYY-MM-DD`
type TaskStatus = "todo" | "doing" | "done";
type ScheduleItemType = "task" | "event" | "birthday" | "holiday";

interface ScheduleItem {
  id: EntityId;
  title: string;
  type: ScheduleItemType;
  status: TaskStatus; // 'task'|'event' で循環、'birthday'|'holiday' は固定
  due?: string; // 'YYYY-MM-DD' (未設定 = 期限なし)
  time?: string; // 'HH:mm' (未設定 = 終日 or 期限なし)
  endTime?: string; // 'HH:mm' (時間幅イベント用)
  description?: string; // Tag UI 上から見える短文 (本文ではない)
  wikiTagIds: string[]; // WikiTag (全エンティティ共通プール)
  isDeleted: boolean; // soft delete
  deletedAt?: number; // epoch ms
  createdAt: number;
  updatedAt: number;
}

interface WikiTag {
  id: EntityId; // `tag-<uuid>`
  name: string; // 一意 (大文字小文字区別なし)
  color: string; // Catppuccin Mocha のキー (mauve/pink/peach/...)
  createdAt: number;
}
```

**重要な統合決定**: 旧 demo の `ListItem` (タスク) と `DayEvent` (日付別イベント) は **単一 `ScheduleItem` 型に統合** する (DATA-1 課題の解消)。ListView と MonthView は同じデータをフィルタして表示する。

---

## 2. 機能要件 (FR)

### FR-1: 3 ビュー切替 (Month / Three / List)

ScreenHeader 中央のセグメントコントロールで切替。state のみ、URL 変更なし。

- **MonthView**: 月単位、42 セル、各セルに ScheduleItem を最大 3 件 + 「+N」集約
- **ThreeDayView**: 当日中心の 3 日タイムライン (8:00-22:00 を縦軸)
- **ListView**: 「今日 / 明日 / 今週 / 期限なし」グループ化

### FR-2: ScheduleItem の CRUD

- **Create**: 右下 FAB → AddEventModal → 保存 (タイトル / type / due / time / endTime / wikiTagIds)
- **Read**: 上記 3 ビューおよび DayDetailSheet で表示
- **Update**: ListItem/DayEventRow タップ → AddEventModal (編集モード) で保存
- **Delete**: AddEventModal の「ゴミ箱」アイコン → 確認モーダル → soft delete (`isDeleted=true`, `deletedAt=Date.now()`)
- **Status 循環**: StatusCheckbox タップ → `todo → doing → done → todo` (type=task|event のみ。birthday|holiday は循環しない)

### FR-3: DayDetailSheet

- 起動条件: MonthView の **当月** 日付セルタップ (月外日付は無効)
- 高さ: 画面の 50% 固定 (`h-1/2`)
- 「+ 予定を追加」: AddEventModal を **選択日プリセット** で開く (due=選択日)
- 「3日ビューで開く」: scheduleView を 'three' に切替、シートは閉じる
- 開いたまま他日付タップ → 内容のみ切替、シートは閉じない
- 閉じる: バックドロップタップ or X ボタン

### FR-4: Sidebar (左ドロワー) フィルタ・検索

- 左上 Menu アイコン → Sidebar 展開
- Sidebar 最上部: 「検索」「フィルタ」アイコン横並び、**排他展開** (一方を開くと他方は閉じる)
- **検索パネル**: テキスト入力 (Search アイコン + Input + クリア)。タイトル / description の部分一致
- **フィルタパネル**: 2 セクション
  - **タグ** (WikiTag の一覧、複数選択可、AND マッチ)
  - **ステータス** (todo / doing / done、複数選択可、OR マッチ)
- **旧「カレンダー」セクションは廃止** (CalendarTag 廃止に伴う本書での確定)

### FR-5: 横断ビュー (WikiTag 起点)

ScheduleItem の WikiTag chip をタップ → フル画面の **横断検索ビュー** を起動 (詳細は 06 Settings の横断検索章および 11 CRUD で実装)。

- 横断ビュー = 「そのタグを持つ全エンティティ (Notes / Daily / Events / Tasks)」を 1 画面で時系列表示
- 横断ビューから「戻る」で Schedule に復帰

### FR-6: 祝日のハードコード読み取り

- 日本の法定休日を mock data として事前投入 (`prototype/src/data/holidays.ts` 新設想定。CRUD 11 で確定)
- `type: 'holiday'` で `wikiTagIds: ['#holiday']` を強制付与
- ユーザー操作で **編集/削除不可** (AddEventModal を開いても read-only バナー表示)

### FR-7: 誕生日の手動入力

- ユーザーが AddEventModal で `type: 'birthday'` を選択して登録
- 自動付与: `wikiTagIds: ['#birthday']` を初期値に
- ステータス循環なし、年次繰り返し表示 (mock: 当年のみ表示で可)

### FR-8: BottomTabBar (Schedule タブが active)

- 4 タブ: Schedule / Work / Materials / Settings
- すべて enabled (旧 TAB-1 のグレーアウト要件は **段階 B 以降で廃止**、本書の確定事項)
- タップで該当ルートへ遷移 (`/schedule` `/work` `/materials` `/settings`)

### FR-9: FAB (Floating Action Button)

- 右下固定、常時表示、スクロール追従しない
- タップ: AddEventModal を「今日プリセット」で開く

---

## 3. 非機能要件 (NFR)

### NFR-1: 起動・操作応答

- `npm run dev` 起動から `/schedule` 表示まで 1 秒以内
- 3 ビュー切替・FAB タップ・モーダル開閉のすべてが 100ms 以内に視覚反応

### NFR-2: 永続化

- ScheduleItem / WikiTag は localStorage に保存 (`lifemobile-mock:schedule-items` / `lifemobile-mock:wiki-tags`)
- リロード後も状態保持
- IndexPage から「mock データ全消去」ボタンで初期化可 (Dev 用、Settings に移すかは 06 で決める)

### NFR-3: 想定解像度・操作

- 375 × 812 (iPhone 標準縦) を基準
- すべてのタップターゲットは 44×44 px 以上 (iOS HIG 準拠)
- スクロール領域以外で **意図しない overscroll が発生しないこと**

### NFR-4: 依存

- 既存 prototype の依存セットを増やさない (`react / react-dom / react-router-dom / lucide-react` のみ)
- DnD・日付ピッカー・モーダル系のライブラリ追加禁止 (素の input + Tailwind で実装)

---

## 4. 不変要件 (Invariants)

旧 demo から **維持** する不変要件:

- **[MV-1] MonthView Cell**: 42 セルすべて幅:高さ = 1:1.5 固定、`padding-bottom: 150%` パターン、最大 3 件 + 「+N」集約 (UI 詳細は 07 UIUX)
- **[FAB-1] FAB 固定配置**: スクロール追従なし、`<main>` の外側兄弟、ルートは `h-screen`
- **[STATUS-1] ステータス循環**: 未→中→完→未、未=空 / 中=Yellow / 完=Green
- **[SHEET-1] DayDetailSheet**: 高さ 50% 固定、月外日付タップ無効、開いたまま他日付タップで内容切替

旧 demo から **変更** する要件:

- **[TAB-1] 廃止**: Work/Materials/Settings をグレーアウト要件 → 段階 B 以降は全タブ enabled
- **[SIDEBAR-1 改定]**: 旧「カレンダー」セクションを削除、フィルタは「タグ + ステータス」のみ
- **[DATA-1 解消]**: ListItem と DayEvent を `ScheduleItem` 単一型に統合

---

## 5. 画面遷移

```
/schedule
  ├─ ScheduleScreen (Month/Three/List)
  │    ├─ Sidebar (Menu アイコン → 左ドロワー)
  │    │    ├─ SearchPanel
  │    │    └─ FilterPanel (Tag / Status)
  │    ├─ DayDetailSheet (MonthView セルタップ)
  │    │    ├─ 「+ 予定を追加」 → AddEventModal (選択日プリセット)
  │    │    └─ 「3日ビューで開く」 → ScheduleScreen (view='three')
  │    ├─ AddEventModal (FAB / ListItem タップ / DayEventRow タップ)
  │    │    ├─ 保存 → ScheduleScreen に戻る
  │    │    └─ 削除 → 確認モーダル → soft delete
  │    └─ WikiTag chip タップ → 横断ビュー (フル画面)
  └─ BottomTabBar → /work /materials /settings へ遷移
```

---

## 6. データシード (mock data 初期値)

CRUD 11 で `prototype/src/data/seed.ts` に集約。Schedule 関連の初期データ規模:

| データ                  | 件数 | 内容                                                                           |
| ----------------------- | ---- | ------------------------------------------------------------------------------ |
| ScheduleItem (task)     | 10   | 期限なし / 当日 / 今週 / 来週を混在                                            |
| ScheduleItem (event)    | 8    | 時刻付き、当日〜来月                                                           |
| ScheduleItem (birthday) | 2    | サンプル誕生日                                                                 |
| ScheduleItem (holiday)  | 5    | 2026 年の主要祝日のみ (元日 / 成人の日 / 春分 / GW / 文化の日 等から 5 件)     |
| WikiTag                 | 8    | `dev` / `arch` / `book` / `idea` / `personal` / `biz` / `birthday` / `holiday` |

---

## 7. CRUD 操作一覧 (CRUD 計画書 11 への要件)

| Op                   | 対象                    | トリガー                  | 保存先                       |
| -------------------- | ----------------------- | ------------------------- | ---------------------------- |
| `addScheduleItem`    | ScheduleItem            | AddEventModal 保存 (新規) | localStorage                 |
| `updateScheduleItem` | ScheduleItem            | AddEventModal 保存 (編集) | localStorage                 |
| `deleteScheduleItem` | ScheduleItem            | AddEventModal 削除 → 確認 | soft delete (isDeleted=true) |
| `toggleStatus`       | ScheduleItem            | StatusCheckbox タップ     | inline update                |
| `addWikiTag`         | WikiTag                 | TagPicker 内「新規作成」  | localStorage                 |
| `attachTag`          | ScheduleItem.wikiTagIds | TagPicker で選択          | inline update                |
| `detachTag`          | ScheduleItem.wikiTagIds | chip × タップ             | inline update                |
| `filterByTags`       | ScheduleItem[]          | FilterPanel               | UI 派生 (永続化なし)         |
| `filterByStatus`     | ScheduleItem[]          | FilterPanel               | UI 派生 (永続化なし)         |
| `searchByQuery`      | ScheduleItem[]          | SearchPanel               | UI 派生                      |

---

## 8. Acceptance Criteria (本書の完了条件)

本書は要件定義書のため、機械検証は限定的。以下を満たせば段階 A としてレビュー可能。

- [ ] §1 のデータモデル合意 (ScheduleItem / WikiTag) が 04/05/06 と矛盾しない
- [ ] §2 機能要件が網羅的 (旧 demo に存在した機能 + 新規追加要件をカバー)
- [ ] §4 不変要件で「維持」と「変更」が明示されている
- [ ] §7 CRUD 操作が 11 計画書の入力として十分
- [ ] §9 本番移植マッピングが具体的に書かれている

---

## 9. 本番移植マッピング (Production Port Mapping)

プロトタイプ完成後、本番 `frontend/` へ移植する際の対応関係を明示する (必須章)。

### 9.1 ファイル対応

| Prototype                                               | 本番 `frontend/`                                                   | 備考                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `prototype/src/screens/ScheduleScreen.tsx` (1 ファイル) | `frontend/src/components/Mobile/MobileScheduleView.tsx` + 配下分割 | Pattern A 3 ファイル (Provider/Context/hook) に分解しない (Mobile では Provider 省略可) |
| `prototype/src/lib/mockStore.ts` (CRUD 11)              | `frontend/src/services/getDataService()` の呼び出し                | `addScheduleItem` → `DataService.createScheduleItem`                                    |
| `prototype/src/data/seed.ts`                            | 削除 (Supabase / SQLite からロード)                                |                                                                                         |
| `prototype/src/data/holidays.ts`                        | 本番でも残す or holidayService 化                                  | 祝日は同期不要なローカル定数で可                                                        |

### 9.2 型対応

| Prototype 型            | 本番型                                                                                              | 差分                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ScheduleItem` (統合型) | `frontend/src/types/scheduleItem.ts` 新規作成、または既存 `tasks` + `schedule_items` を内部で union | 本書が確定する統合型を **本番にも持ち越す** ことを推奨 (DATA-1 課題の本質解消) |
| `WikiTag`               | 既存 `wiki_tags` テーブル (`frontend/src/types/`)                                                   | id 体系が `tag-<uuid>` → uuid のみに変更                                       |
| `wikiTagIds: string[]`  | `wiki_tag_assignments` テーブル経由                                                                 | 関係テーブル化される                                                           |

### 9.3 配色対応

| Prototype                                        | 本番                                                 |
| ------------------------------------------------ | ---------------------------------------------------- |
| `const C = { mauve: '#cba6f7', ... }` インライン | `notion-*` Tailwind トークン (`bg-notion-purple` 等) |
| arbitrary value `bg-[#1e1e2e]`                   | `bg-notion-bg-primary`                               |

### 9.4 移植時の注意

- 旧 demo の 1907 行 TSX を **そのまま** 移植せず、本書 §1 の統合型に変換しながら移植
- `useState` ベースの mock CRUD を DataService 呼び出しに置換 (各 handler 1:1 対応)
- WikiTag UI (chip + TagPicker) は本番 `frontend/src/components/shared/WikiTagChip.tsx` などに再利用前提で抽出 (Materials 移植時に共通化)

### 9.5 移植時に **持ち込まない** もの

- localStorage 永続化レイヤ (`lifemobile-mock:*`)
- `prototype/src/data/seed.ts`
- IndexPage の dev ルート
- AddEventModal の `type: 'birthday' | 'holiday'` 強制制約 (本番では編集制御を別レイヤで)

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` を grep:
  - `MonthView` / `aspect-ratio` 関連の既知バグ
  - `IME` (Tag 入力時の Composition イベント) 関連
- 新規 known issue 候補:
  - 統合型 `ScheduleItem` に `type: 'task'|'event'` を持たせると、UI の判定分岐が増える → ListView/MonthView 側で view-model に変換するか
  - WikiTag の name 一意性 (大文字小文字区別なし) のバリデーション

---

## References

- 親計画書: `01_要件定義書_プロトタイプ環境.md` / `02_実装計画書_プロトタイプ環境.md`
- 凍結原本: `prototype/_artifacts/life editor unified demo.tsx`
- vision: `.claude/docs/vision/coding-principles.md` / `db-conventions.md`
- 本書を参照する後続: `07_UIUX設計書_Schedule.md` / `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。CalendarTag 廃止 / DATA-1 解消 / TAB-1 廃止 / Tasks-Events 統合 / WikiTag 全エンティティ付与の合意を反映
