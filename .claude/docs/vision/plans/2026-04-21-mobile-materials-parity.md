# Plan: Mobile Materials Parity — Pin / Folder / Password / WikiTag / Search Overlay

**Status:** IN_PROGRESS
**Created:** 2026-04-21
**Project:** /Users/newlife/dev/apps/life-editor
**Related:**

- `.claude/CLAUDE.md` §6.2 (Provider 順序) / §6.3 (Pattern A Optional バリアント)
- `.claude/docs/vision/mobile-porting.md`
- `frontend/src/components/Ideas/NotesView.tsx` (Desktop 実装の原本)
- `frontend/src/components/Ideas/NoteTreeNode.tsx`
- `frontend/src/components/shared/PasswordDialog.tsx`
- `frontend/src/context/WikiTagContext.tsx`

---

## Context

モバイル Materials ビューを Desktop と同等の情報アーキテクチャに近づける。現状 `MobileNoteView` はフラットなリストのみで、**Desktop の `isPinned` / `hasPassword` / `isEditLocked` / `parentId` (フォルダ) / WikiTag 紐付け** が同期されない・表示されない。また検索導線が存在しない。

### 要件(確定)

1. **Notes のみ** `isPinned` を有効化(Memos は対象外)
   - リスト UI: **お気に入り**(トグル) + **フォルダ/ノートツリー**(Desktop 忠実再現、展開/折りたたみ)
   - ソート: isPinned 最上位 → updatedAt 降順
2. **パスワードロック**: Notes の `hasPassword` + `isEditLocked` 両対応 / Memos 対象外
   - モバイル専用 **数字パッド風ダイアログ**、パスワード本体は Desktop と共通(DB 共有)
3. **WikiTags**: モバイルで **Provider 追加 + 付与/編集可能**。リストにタグチップ、詳細にピッカー
4. **プレビュー圧縮**: `line-clamp-2` → `line-clamp-1`、日付行を削除
5. **検索オーバーレイ**: ヘッダ右端の検索アイコン → **全画面モーダル**(周辺うっすら可視) → 候補 3-5 件 → タップで詳細遷移
   - 検索対象は当面 Materials(Notes+Memos)のみだが、**UI は汎用化**して Calendar 等に流用可能に

### Non-Goals

- Memos の `isPinned` / `hasPassword` 対応(要件外)
- Desktop の `@dnd-kit` による並び替え UX の完全再現(モバイルは長押し並び替えのみで十分)
- WikiTag サジェスト入力(インラインタグ抽出は不要、ピッカー経由のみ)
- Calendar / Tasks 横断検索(Phase 6 の UI 基盤のみで、データソース接続は後続)

---

## Steps

### Phase 1 — プレビュー圧縮(最小差分)

- [ ] `MobileNoteView.tsx` リスト項目の `line-clamp-2` を `line-clamp-1` に
- [ ] 日付表示 `<p>new Date(...).toLocaleDateString()</p>` を削除
- [ ] `MobileMemoView.tsx` も同様に圧縮(Memo は date 自体がプライマリなので日付は残すか検討)
  - 決定: Memo は date 自体がタイトル相当なので **現状維持**(Note 側のみ圧縮)

### Phase 2 — Mobile への WikiTagProvider 追加

- [ ] `main.tsx` Mobile 分岐(`isMobile` branch)の Provider ツリーに `WikiTagProvider` を追加
  - 位置: `TimerProvider` の内側 or 独立して末端(依存制約なし)
- [ ] `useWikiTagContextOptional` が存在しない場合、Optional バリアントを追加
  - `frontend/src/hooks/useWikiTagContextOptional.ts`: `useContext(WikiTagContext)` を return(null 許容)
- [ ] CLAUDE.md §6.2 「モバイル省略 Provider」リストから WikiTag を除去
- [ ] Feature matrix §2 の WikiTags 行を Desktop/iOS 両 ✓ に更新

### Phase 3 — Notes フォルダツリー + お気に入りセクション

- [ ] `MobileNoteTree` コンポーネント新規作成 (`frontend/src/components/Mobile/materials/MobileNoteTree.tsx`)
  - props: `notes: NoteNode[]`, `onSelect: (id) => void`, `onTogglePin: (id) => void`
  - ロジック: `notes` を parentId で木に組み立てる、expand/collapse state
  - お気に入りセクション: `isPinned === true` の **ノートのみ** を名前順 or updatedAt 順で並べる(フォルダ構造を無視したフラット表示)
- [ ] `MobileNoteTreeItem`: 行表示
  - アイコン: フォルダ / ノート / 鍵(hasPassword) / ハート(isPinned)
  - タップ: フォルダなら展開、ノートなら詳細へ(hasPassword なら数字パッド)
  - 長押し: コンテキストメニュー(改名 / 削除 / ピン留め / パスワード設定 / タグ編集 / フォルダ作成)
- [ ] `MobileNoteView` リファクタ: ツリーとお気に入りを統合、新規作成ボタンにフォルダ/ノート選択
- [ ] ソート: **お気に入り セクション → 通常ツリー(root parentId === null)** の順で表示
- [ ] 展開状態は localStorage に保存(`mobile-note-expanded`)

### Phase 4 — 数字パッド風 PasswordDialog + ロックフロー

- [ ] `frontend/src/components/Mobile/shared/NumericPadPasswordDialog.tsx` 新規作成
  - 4-6 桁の数字パッド UI(0-9 + 削除 + キャンセル)
  - `mode: "set" | "verify" | "change" | "remove"` は Desktop と同じ契約
  - パスワード文字列は数字列そのまま(`setNotePassword(id, digits)`)
- [ ] `MobileNoteView` 詳細開始時: `note.hasPassword` → verify ダイアログ → OK なら表示
- [ ] `note.isEditLocked === true` 時: エディタを readonly、鍵アイコン表示、タップで解錠ダイアログ
- [ ] コンテキストメニュー(長押し)に「パスワード設定 / 変更 / 削除」「編集ロック切替」
- [ ] リスト項目で鍵アイコンを表示(hasPassword 時)
- [ ] パスワード検証失敗時の i18n メッセージ

### Phase 5 — WikiTags 表示 + 編集

- [ ] `MobileNoteTreeItem` にタグチップ表示(最大 2 個、超過時は `+N`)
- [ ] `MobileNoteDetail` にタグ編集バーを追加(タイトル下)
  - 現在のタグをチップ表示、`+` タップでピッカー展開
- [ ] `MobileTagPicker` 新規作成 (`frontend/src/components/Mobile/materials/MobileTagPicker.tsx`)
  - 既存タグリスト(検索可) + 新規作成ボタン
  - タップで toggle、確定で `setTagsForEntity(noteId, "note", tagIds)`
- [ ] `useWikiTagContext` で assignments / tags を取得、`getTagsForEntity(noteId)` で表示

### Phase 6 — 汎用 SearchOverlay + Materials 検索

- [ ] `frontend/src/components/shared/MobileSearchOverlay.tsx` 新規作成
  - props: `isOpen`, `onClose`, `placeholder`, `onSearch: (query) => Promise<Result[]>`, `onSelect: (result) => void`, `renderResult?: (result) => ReactNode`
  - 全画面モーダル、背景 `bg-black/30 backdrop-blur-sm`(周辺うっすら)
  - 検索結果はスクロール可能パネル、上位 3-5 件
  - 候補タップで `onSelect(result)` 呼び出し、オーバーレイは閉じる
- [ ] `MobileLayout` ヘッダ右端に検索アイコン(`Search` from lucide)を追加
  - 現状 `activeTab === "materials"` のときのみ有効(他タブでは disabled or hidden)
  - 将来の Calendar 等への流用余地を残す: `onSearchOpen?: () => void` を `MobileLayout` の prop として受ける
- [ ] `MobileApp` で Materials 選択時に検索オーバーレイを制御、検索ロジックを Notes+Memos にまたがる形で実装
  - Notes: `searchNotes(query)` (既存) / Memos: 全件取得して content をフィルタ
  - 結果 schema: `{ kind: "note" | "memo", id, title, excerpt }`
- [ ] 候補タップで `MobileMaterialsView` の `activeTab` を該当側に切替 + 選択 ID を流し込む(状態引き上げ)

### Phase 7 — 検証 + 記録

- [ ] `cd frontend && npm run test`
- [ ] `cd frontend && npm run typecheck`(存在すれば)
- [ ] `cargo build`
- [ ] iOS 実機 or sim で受け入れテスト(Verification セクション)
- [ ] CLAUDE.md §2 機能差分マトリクス + §6.2 Provider 順序を更新
- [ ] `.claude/HISTORY.md` / `.claude/MEMORY.md` を task-tracker 経由で更新
- [ ] 完了後、本プランを `.claude/archive/` に移動

---

## Files

| File                                                                 | Operation | Notes                                            |
| -------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| `frontend/src/components/Mobile/MobileNoteView.tsx`                  | Rewrite   | ツリー + お気に入り + ピン + 鍵 + タグチップ     |
| `frontend/src/components/Mobile/MobileMemoView.tsx`                  | Edit      | preview コンパクト(Note 側のみ)                  |
| `frontend/src/components/Mobile/materials/MobileNoteTree.tsx`        | Create    | 再帰ツリー描画                                   |
| `frontend/src/components/Mobile/materials/MobileNoteTreeItem.tsx`    | Create    | 行 UI + アイコン群                               |
| `frontend/src/components/Mobile/materials/MobileTagPicker.tsx`       | Create    | タグ選択ピッカー                                 |
| `frontend/src/components/Mobile/shared/NumericPadPasswordDialog.tsx` | Create    | 数字パッド UI                                    |
| `frontend/src/components/shared/MobileSearchOverlay.tsx`             | Create    | 汎用検索モーダル                                 |
| `frontend/src/components/Layout/MobileLayout.tsx`                    | Edit      | ヘッダ右端に検索アイコン、onSearchOpen prop 追加 |
| `frontend/src/MobileApp.tsx`                                         | Edit      | 検索オーバーレイ state、Materials への橋渡し     |
| `frontend/src/components/Mobile/MobileMaterialsView.tsx`             | Edit      | selectedId props 受け入れ、タブ自動切替          |
| `frontend/src/hooks/useWikiTagContextOptional.ts`                    | Create    | Optional バリアント                              |
| `frontend/src/main.tsx`                                              | Edit      | Mobile 分岐に WikiTagProvider 追加               |
| `frontend/src/i18n/locales/ja.json` / `en.json`                      | Edit      | 新規 key (search / tags / password.numeric 等)   |
| `.claude/CLAUDE.md`                                                  | Edit      | §2 マトリクス + §6.2 Provider 順序更新           |

---

## Verification

### 自動

- [ ] `npm run test` 全 pass
- [ ] `npm run typecheck` (あれば) pass
- [ ] `cargo build` pass

### 手動 — Phase 1 (preview)

- [ ] Mobile Materials の Notes タブで、リスト行が **タイトル + 本文 1 行** のみ表示される
- [ ] 日付が表示されない

### 手動 — Phase 2-3 (folders + pin)

- [ ] Desktop でフォルダを作成 → Mobile に同期、展開/折りたたみ可能
- [ ] Desktop で isPinned のノートを作成 → Mobile のお気に入りセクション最上位に表示
- [ ] Mobile でピン留めトグル → Desktop に反映
- [ ] Mobile でフォルダ作成 → Desktop に反映
- [ ] 展開状態は localStorage 保持、アプリ再起動後も維持

### 手動 — Phase 4 (password)

- [ ] Desktop で hasPassword のノートを作成 → Mobile リストに鍵アイコン
- [ ] Mobile でタップ → 数字パッド表示、正しいパスワードで復号
- [ ] 誤パスワードでエラー表示、リトライ可能
- [ ] Mobile で新規パスワード設定 → Desktop で verify 成功
- [ ] isEditLocked → Mobile エディタが readonly

### 手動 — Phase 5 (wiki tags)

- [ ] Desktop でタグを 3 つ付けたノート → Mobile リストで 2 個 + `+1`
- [ ] Mobile 詳細でタグピッカー開く → 既存タグ選択 + 新規作成
- [ ] 変更が Desktop に即座(または Cloud Sync 経由)に反映

### 手動 — Phase 6 (search)

- [ ] ヘッダ右端の検索アイコンをタップ → 全画面モーダル
- [ ] 背景の Materials がうっすら見える
- [ ] クエリ入力 → 3-5 件の候補
- [ ] 候補タップ → 該当ノート/メモの詳細へ直接遷移、オーバーレイ閉じる
- [ ] 他タブ(Schedule / Work / Settings)では検索アイコンが hidden or disabled

### リグレッション

- [ ] Desktop 側 Notes / Memos / WikiTag 操作は変更なし
- [ ] Mobile Schedule / Work / Settings 動作変化なし
- [ ] Cloud Sync 経由で全変更が他端末に反映

---

## Open Questions / Risks

1. **タグピッカーの UX**: 大量タグ(50+)時の検索パフォーマンス — クライアントフィルタで問題ないか
2. **数字パッドパスワードと既存パスワードの互換性**: Desktop で英数パスワードを設定済みの場合、Mobile 数字パッドでは入力不可 → 要警告表示 or 汎用入力にフォールバック
3. **検索結果のメモ内容マッチング**: `MemoNode.content` は TipTap JSON — plain text 抽出が必要(既存 `extractPlainText` ヘルパー流用)
4. **フォルダ展開 state の localStorage**: 削除済みフォルダの ID が残留しても実害ないが、cleanup タイミングを検討
5. **iOS Safe Area**: オーバーレイモーダルの top offset で notch と被らないか
