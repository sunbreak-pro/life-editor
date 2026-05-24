---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md
Previous: .claude/docs/vision/plans/04_要件定義書_Work.md
---

# Plan: Materials 画面 要件定義 (Prototype Mobile)

> 段階 A — 「何を作るか」を確定する書類。UIUX (09) と CRUD (11) は本書を Parent とする。Schedule (03) / Work (04) のデータモデル合意を継承。Notes / Daily の RichEditor で `[[title]]` リンク + Backlink を扱う。

---

## Context

- **動機**: prototype の Materials 画面 (`prototype/src/screens/MaterialsScreen.tsx`) は Notes と Daily の一覧 + エディタ。本書では「Notebook」概念を **WikiTag に統合廃止** し、`[[title]]` 記法による全エンティティ参照 + Backlink パネルを新規追加要件として確定する
- **制約**: 1 ファイル TSX 維持 / Provider 不使用 / Catppuccin Mocha 固定 / localStorage 名前空間 `lifemobile-mock:*` のみ例外許可 / 外部 RichText ライブラリ追加禁止 (TipTap も今回は入れない、素の textarea + 簡易構文ハイライト)
- **Non-goals**: 画像添付 / 録音添付 / コードブロックのシンタックスハイライト / Markdown → HTML 変換 / 検索インデックス / 全文検索エンジン / 同期競合解決

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/05_要件定義書_Materials.md          (本書)
prototype/src/screens/MaterialsScreen.tsx                     (将来の実装対象、本書では参照のみ)
prototype/_artifacts/materials demo.tsx                       (凍結原本、参照のみ)
```

---

## 1. 上位データモデル合意

`WikiTag` は Schedule 03 §1 を参照。Materials 画面で追加で必要な型:

```ts
type MaterialKind = "notes" | "daily";
type Mood = "green" | "sky" | "yellow" | "peach" | "red";

interface Note {
  id: EntityId; // `note-<uuid>` (kind=notes) / `daily-YYYY-MM-DD` (kind=daily)
  kind: MaterialKind;
  title: string;
  excerpt: string; // body から自動抽出 (先頭 80 文字程度、改行 → space)
  body: string; // 本文 (Markdown 風プレーンテキスト + [[title]] リンク)
  wikiTagIds: string[]; // WikiTag (全エンティティ共通プール、03 §1)
  pinned: boolean;
  // Daily 専用フィールド
  date?: string; // 'YYYY-MM-DD' (kind=daily のみ必須)
  weekday?: string; // '月'..'日' (date から派生、表示用キャッシュ)
  mood?: Mood; // 体調・気分 (kind=daily のみ)
  pomodoroSessions?: number; // 当日の TimerSession 数 (mock では 0 固定、Work 04 と将来連携)
  // 共通
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Backlink (派生データ、永続化しない)
interface Backlink {
  fromEntityId: EntityId; // Note の場合 `note-...`、ScheduleItem の場合 `task-...`
  fromTitle: string;
  fromKind: "note" | "daily" | "task" | "event" | "birthday" | "holiday";
  matchedText: string; // 元の [[title]] 表記そのまま
}
```

**重要な統合決定**: 旧 demo の `Notebook` (フォルダ的な分類: "プロジェクト" / "日記" / "読書ログ" 等) は **廃止**、WikiTag (`#proj` `#journal` `#book` 等) で代替する。フィルタも Notebook → WikiTag に置換。

**Daily の ID 規約**: `daily-YYYY-MM-DD` 固定 (1 日 1 件)。新規 FAB タップ時、当日 ID が存在すれば既存を開く (重複生成しない)。

---

## 2. 機能要件 (FR)

### FR-1: List / Editor の 2 ビューモード

`view: 'list' | 'editor'` で切替。Editor は List の上に右からスライドインで重ねる (List はマウント維持)。

### FR-2: Kind 切替 (Notes / Daily)

ListView 上部のセグメントコントロールで切替。

- **Notes**: 自由形式のメモ。FAB タップで新規作成
- **Daily**: 日記。FAB タップで当日分 Daily を開く (なければ DAILY_TEMPLATE で新規作成)

### FR-3: Layout 切替 (Card / Row)

ListView 右上のアイコンで切替 (`layout: 'card' | 'list'`)。state は localStorage 保存。

### FR-4: Note CRUD

- **Create**:
  - Notes kind: FAB タップ → 空 Note 生成 → Editor を即座に開く
  - Daily kind: FAB タップ → 当日 Daily (なければ DAILY_TEMPLATE で生成) → Editor を即座に開く
- **Read**: ListView (Card / Row 切替) + EditorView
- **Update**: EditorView の title input / body textarea で逐次 `updatedAt` 更新 (debounce 500ms 想定)
- **Delete**: 行 long press → ItemMenuSheet → 「削除」→ 確認 → soft delete
- **Pin / Unpin**: 行 long press → ItemMenuSheet → 「ピン留め」(pinned グループは sortFn 適用前に上に固定表示)
- **Duplicate**: 行 long press → ItemMenuSheet → 「複製」→ title に "(コピー)" 付与した新規 Note を先頭に挿入

### FR-5: 検索とフィルタ

- **検索**: ListView 上部の Search アイコン → 入力欄展開 → title / excerpt / wikiTagIds 名の部分一致
- **フィルタ**: FilterSheet (BottomSheet)
  - **WikiTag フィルタ**: 複数選択、OR マッチ (旧 Notebook フィルタを統合)
  - 旧 Notebook セクションは廃止
- **ソート**: SortSheet
  - 更新日時 (default) / 作成日時 / タイトル

### FR-6: WikiTag UI (Editor 内)

- Editor 上部に WikiTag chip 列 + 「+」ボタン
- 「+」タップ → TagSheet 起動 (既存タグから選択 or 新規作成、IME 対策: `e.nativeEvent.isComposing` チェック)
- chip タップ → 削除 (短押し) / 横断ビューへ遷移 (長押し)
- 新規 WikiTag 作成時、name は trim + 大文字小文字無視で一意性チェック (重複なら既存タグを返す)

### FR-7: `[[title]]` リンク記法 (新規追加要件)

- **Editor 入力時**:
  - `[[` を検出 → ポップアップで候補一覧表示 (Notes / Daily / ScheduleItem の title 部分一致、最大 10 件)
  - 候補選択 → `[[title]]` を本文に挿入してポップアップ閉じる
  - IME 入力中は候補表示しない (`isComposing` チェック)
- **Editor 表示時**:
  - `[[title]]` をスタイリング (青系下線、タップ可能)
  - タップ → 該当エンティティへ遷移 (Note なら同 Editor で開き直し、ScheduleItem なら `/schedule` へ + ハイライト)
  - 解決不可 (該当 title がない) → 警告色 (red 系下線) で表示、タップしても遷移しない (削除はしない)
- **解決ロジック**: title の完全一致 (大文字小文字区別なし、trim)。複数該当時は updated 降順で先頭を採用

### FR-8: Backlink パネル (新規追加要件)

- EditorView の下部に折りたたみセクション「このノートを参照しているもの (N)」
- 内容: 全 Note / 全 ScheduleItem の body / description を走査し、`[[<このノートの title>]]` を含むものを列挙
- 各 backlink エントリ: from タイトル + アイコン (kind 別) + マッチ箇所のスニペット
- タップ → 該当エンティティへ遷移
- title が空のノートは backlink を持たない (リンク不可)

### FR-9: Editor メニュー (右上 More)

EditorMenuSheet で以下を提供:

- ピン留め切替
- 複製
- 共有 (mock: console.log + Toast)
- 削除 (soft delete + List 復帰)

### FR-10: Daily 専用機能

- **mood 選択**: Editor 上部に色アイコン (green/sky/yellow/peach/red)、タップで MoodSheet → 選択
- **pomodoroSessions 表示**: 当日の TimerSession 数 (Work 04 連携、mock では `currentTask` から導出 or 固定値)

### FR-11: BottomTabBar (Materials タブが active)

03 §FR-8 と同じ (4 タブ全 enabled)。

---

## 3. 非機能要件 (NFR)

### NFR-1: 入力応答

- title / body 入力で 16ms 以内に画面反映 (controlled component)
- `[[` 候補ポップアップは 100ms 以内に表示

### NFR-2: 永続化

- `notes[]`, `kind`, `layout`, `sortKey`, `filterTagIds[]` を localStorage 保存
- 「保存中」ステータス UI は出すが実際は localStorage 同期保存 (即時)

### NFR-3: 想定解像度・操作

- Schedule 03 NFR-3 と同じ
- 追加: 行 long press = 600ms 押下で発火 (タップとの誤判定回避)

### NFR-4: 依存

- 既存 prototype 依存セットを増やさない (RichText ライブラリ追加禁止)
- `[[title]]` のシンタックスハイライトは contentEditable や正規表現ベースの light highlight (要素 split + style 適用) で実装

---

## 4. 不変要件 (Invariants)

旧 demo から **維持**:

- **[M-EDITOR-1] Editor スライドイン**: 右から `translateX(100%→0)`、duration 300ms、List はマウント維持
- **[M-LIST-PIN-1] Pin グループ表示**: pinned アイテムは normal の上に section 区切りで表示
- **[M-DAILY-1] Daily ID 一意**: 1 日 1 件、FAB は重複生成しない
- **[M-LONGPRESS-1] LongPress**: 600ms 押下 = メニュー、それ未満 = タップ (openEditor)
- **[M-IME-1] IME 安全**: 入力中 (`e.nativeEvent.isComposing`) は補完ポップアップ非表示、Enter で確定しない

旧 demo から **変更**:

- **[M-NOTEBOOK 廃止]**: `Notebook` 概念を削除 → WikiTag に統合
- **[M-LINK 追加]**: `[[title]]` 記法のサポート (FR-7)
- **[M-BACKLINK 追加]**: Backlink パネル (FR-8)

---

## 5. 画面遷移

```
/materials
  ├─ MaterialsScreen (view='list')
  │    ├─ ListView (kind=notes|daily, layout=card|row)
  │    │    ├─ Search 入力
  │    │    ├─ SortSheet (BottomSheet)
  │    │    ├─ FilterSheet (BottomSheet, WikiTag フィルタ)
  │    │    ├─ Note 行タップ → openEditor(id) → view='editor'
  │    │    ├─ Note 行 long press → ItemMenuSheet
  │    │    │    ├─ ピン留め / 解除 → togglePin
  │    │    │    ├─ 複製 → duplicateNote
  │    │    │    └─ 削除 → 確認 → soft delete
  │    │    └─ FAB → handleFab → 新規 Note or 当日 Daily → openEditor
  │    └─ MaterialsScreen (view='editor')
  │         ├─ EditorView (title input + body textarea)
  │         ├─ WikiTag chip 列 + TagSheet
  │         ├─ [[ 入力 → 候補ポップアップ → 挿入
  │         ├─ [[title]] タップ → 解決して遷移
  │         ├─ Mood 選択 → MoodSheet (Daily のみ)
  │         ├─ Backlink パネル (折りたたみ)
  │         └─ More メニュー → EditorMenuSheet (Pin/複製/共有/削除)
  └─ BottomTabBar → /schedule /work /settings へ遷移
```

---

## 6. データシード (mock data 初期値)

CRUD 11 で `prototype/src/data/seed.ts` に集約。Materials 関連:

| データ                            | 件数                                                        | 内容                                                                              |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Note (kind=notes)                 | 8                                                           | 設計メモ / 振り返り / 学習メモ等、相対時刻 H(2)..H(168) 範囲                      |
| Note (kind=daily)                 | 8                                                           | 過去 8 日分、`date='YYYY-MM-DD'`、mood ばらつき                                   |
| WikiTag (Materials 寄り)          | `#proj` `#journal` `#book` `#arch` `#retro` `#idea` `#sync` | (Schedule/Work と共通プール、03 §6 にマージ)                                      |
| 既存 seed 内の `[[title]]` リンク | 各 Note に 1-2 件                                           | 「life-editor 設計メモ」が「Tauri 2.0 移行」(Task) を参照する等、横断リンクのデモ |

---

## 7. CRUD 操作一覧 (CRUD 計画書 11 への要件)

| Op                          | 対象                     | トリガー                                    | 保存先                           |
| --------------------------- | ------------------------ | ------------------------------------------- | -------------------------------- |
| `addNote`                   | Note (kind=notes)        | FAB (kind=notes)                            | localStorage                     |
| `getOrCreateDaily`          | Note (kind=daily)        | FAB (kind=daily)                            | localStorage                     |
| `updateNote`                | Note                     | title / body / mood / pomodoroSessions 変更 | localStorage (debounce 500ms)    |
| `togglePinNote`             | Note                     | ItemMenuSheet → ピン                        | inline update                    |
| `duplicateNote`             | Note                     | ItemMenuSheet → 複製                        | localStorage                     |
| `deleteNote`                | Note                     | ItemMenuSheet → 削除 → 確認                 | soft delete                      |
| `attachTag` / `detachTag`   | Note.wikiTagIds          | TagSheet / chip ×                           | inline update (03 §7 と共通実装) |
| `addWikiTag`                | WikiTag                  | TagSheet 新規作成                           | localStorage (03 §7 と共通)      |
| `resolveLink(title)`        | EntityId \| null         | `[[title]]` レンダリング時                  | UI 派生                          |
| `searchSuggestions(prefix)` | (Note \| ScheduleItem)[] | `[[` 入力時                                 | UI 派生                          |
| `listBacklinks(title)`      | Backlink[]               | Editor 開時                                 | UI 派生                          |

---

## 8. Acceptance Criteria (本書の完了条件)

- [ ] §1 のデータモデル合意 (Note / Backlink) が 03/04/06/11 と矛盾しない
- [ ] §2 機能要件で `[[title]]` リンク (FR-7) と Backlink (FR-8) が網羅的
- [ ] §4 不変要件で「維持」と「変更」が明示 (M-NOTEBOOK 廃止 / M-LINK / M-BACKLINK 追加)
- [ ] §7 CRUD 操作が 11 計画書の入力として十分
- [ ] §9 本番移植マッピングが具体的

---

## 9. 本番移植マッピング (Production Port Mapping)

### 9.1 ファイル対応

| Prototype                                                | 本番 `frontend/`                                                    | 備考                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `prototype/src/screens/MaterialsScreen.tsx` (1 ファイル) | `frontend/src/components/Mobile/MobileMaterialsView.tsx` + 配下分割 | TipTap は本番で初導入 (Pattern A 3 ファイル化)           |
| `mockStore.notes`                                        | `frontend/src/services/getDataService().listNotes` + `listDailies`  | Notes / Daily が本番では別テーブル (`notes` / `dailies`) |
| `[[title]]` 解決ロジック                                 | `frontend/src/utils/wikiLinkResolver.ts` 新規作成                   | 全エンティティ走査、結果は memo                          |

### 9.2 型対応

| Prototype 型                        | 本番型                                         | 差分                                                                       |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `Note` (統合型 kind={notes\|daily}) | `frontend/src/types/note.ts` + `daily.ts` (別) | 本番の `notes` / `dailies` テーブル分離に合わせて分割                      |
| `Notebook`                          | 廃止                                           | 本番からも削除 (本番の `notebook_id` 等のフィールドがあれば削除 migration) |
| `Mood`                              | 既存 enum or 新規                              | 本番 daily テーブルの mood カラム互換                                      |
| `Backlink` (派生)                   | `frontend/src/types/backlink.ts` 新規          | 派生型のため永続化なし                                                     |

### 9.3 配色対応

Schedule 03 §9.3 と同じ。

### 9.4 移植時の注意

- 本書 §FR-7 / §FR-8 (リンク + Backlink) は本番では **Tier 2 補助機能** として新規追加 (現状の `frontend/` には未実装)
- TipTap 導入時、`[[title]]` ノードを Mark or Node Extension として実装 → エディタネイティブ表示
- 当面の本番では `body` は plain text + 構文ハイライト、後で TipTap に格上げ
- Backlink 走査は全 Note + 全 ScheduleItem を毎回走査 (mock では計算量低い)。本番では Supabase の `LIKE '%[[<title>]]%'` クエリ or 専用 index テーブル
- Daily の `mood` / `pomodoroSessions` は Work 04 連携 (TimerSession から派生)

### 9.5 移植時に **持ち込まない** もの

- localStorage 永続化レイヤ
- `INITIAL_NOTES` / `H()` 等の seed
- `Notebook` 関連の全コード (本番にも入れない)

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` を grep:
  - IME (Composition) 関連の入力バグ
  - LongPress と Scroll の競合
- 新規 known issue 候補:
  - `[[title]]` 解決での title 衝突 (同名 Note が複数ある場合の挙動)
  - Backlink 走査の計算量 (mock では問題ないが本番では index 必須)
  - Daily の date を変えると ID が変わる問題 → date 変更不可 UI で対応

---

## References

- 親計画書: `01_要件定義書_プロトタイプ環境.md` / `02_実装計画書_プロトタイプ環境.md`
- 前計画書 (データモデル合意元): `03_要件定義書_Schedule.md` / `04_要件定義書_Work.md`
- 凍結原本: `prototype/_artifacts/materials demo.tsx`
- 本書を参照する後続: `09_UIUX設計書_Materials.md` / `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。Notebook 廃止 (M-NOTEBOOK) / `[[title]]` リンク (M-LINK 追加) / Backlink パネル (M-BACKLINK 追加) / Daily の WikiTag 統合
