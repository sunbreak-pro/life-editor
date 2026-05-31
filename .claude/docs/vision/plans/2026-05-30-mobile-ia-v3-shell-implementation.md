---
Status: IN PROGRESS
Created: 2026-05-30
Branch: prototype/mobile-ui
Owner-chat: prototype-mobile
Parent: docs/vision/plans/12_design_information-architecture-v3.md (PROPOSED) + 13_..._eval.md (GO)
Project: /Users/newlife/dev/apps/life-editor/.claude/worktrees/prototype-mobile/prototype
---

# Plan: Mobile プロトタイプ 共通 Shell（Header + Sidebar + 横断検索）実装

> 目的: IA v3（doc 12 / eval doc 13 = GO）を実装に落とす。全セクション共通の不変 Header、
> 各セクションごとに中身が変わる Sidebar(Drawer)、Header の検索アイコンから開く横断検索 Overlay。
> ユーザー確定（2026-05-30, AskUserQuestion 全 4 問 = 推奨案）:
>
> 1. Header = **App レベル共通レイアウト**（Router 外側・再マウントなし）
> 2. 検索アイコン = **検索オーバーレイ新規**（CrossSearch ロジック流用）
> 3. 画面固有操作 = **Header 直下 sub-toolbar に残す**
> 4. Header タイトル = **現在のセクション名**

## Context

- 現状: 各画面が独自 Header / BottomTabBar / `const C` を重複保持。Sidebar は Schedule のみ。Context 皆無。
- 技術: React + react-router-dom v7（`<Route element>` + `<Outlet>` 利用可）/ Vite / Tailwind v3 / TS strict
- 重要制約:
  - `tsconfig.json` は **`noUnusedLocals` 等は未設定だが `strict: true`**。型エラーは `npx tsc --noEmit` で検出（build は `vite build` のみ＝型を見ない）。**検証は `npx tsc --noEmit` を正とする**
  - `useMockStore` は **セレクタ必須**: `useMockStore((s) => s.scheduleItems)`。引数なし呼び出し不可
  - データモデル: tasks は `scheduleItems(type==='task')` / dailies は `notes(kind==='daily')` / タグは各エンティティの **inline `wikiTagIds`**（別テーブルなし）
  - 配色は `import { C } from "../lib/theme"`（重複 `const C` は撤去）

## Scope (Touchable Paths)

```
prototype/src/lib/theme.ts                  # NEW (done)
prototype/src/context/ShellContext.tsx      # NEW (done)
prototype/src/components/AppShell.tsx        # NEW (done)
prototype/src/components/AppHeader.tsx       # NEW (done)
prototype/src/components/BottomTabBar.tsx    # NEW (done)
prototype/src/components/Drawer.tsx          # NEW (done)
prototype/src/components/SearchOverlay.tsx   # NEW (done)
prototype/src/components/CrossSearchBody.tsx # NEW (done)
prototype/src/App.tsx                         # EDIT (done — AppShell layout route)
prototype/src/screens/ScheduleScreen.tsx     # EDIT (reference refactor)
prototype/src/screens/WorkScreen.tsx         # EDIT
prototype/src/screens/MaterialsScreen.tsx    # EDIT
prototype/src/screens/SettingsScreen.tsx     # EDIT
prototype/src/screens/TrashScreen.tsx        # EDIT
prototype/src/screens/CrossSearchScreen.tsx  # EDIT (→ thin wrapper of CrossSearchBody)
```

`prototype/src/dev/IndexPage.tsx` は **shell 外**（セクションではない開発ゲートウェイ）。触らない。

## Foundation Contract（subagent はこの契約に従う。foundation ファイルは変更しない）

`useShell()` returns `{ sidebarOpen, openSidebar, closeSidebar, searchOpen, openSearch, closeSearch }`.
`<Drawer open onClose title? children>` = backdrop + 左スライド aside。body は `flex flex-col`（強制スクロールなし、children がスクロール領域を持つ）。
AppShell が Header(menu/section title/search) + `<Outlet/>` + BottomTabBar + SearchOverlay を描画し、ルート変更時に drawer/search を閉じる。

### 各画面 refactor 手順（6 セクション共通）

1. `const C = {...}` を削除 → `import { C } from "../lib/theme";`
2. ローカル `function BottomTabBar()` の **定義と `<BottomTabBar />` の描画を両方削除**（AppShell が描画）。未使用になった import（NavLink / タブ用 icon 等）を撤去し `tsc --noEmit` を緑に
3. 画面独自の **最上部 app ヘッダー**（menu+title+search を持つ `<header>`／ScheduleScreen の `<ScreenHeader>`／CrossSearchScreen の back+title header 等）を削除。menu/title/search は AppHeader が担う
4. 画面固有操作（ビュー切替・Notes/Daily タブ・月ナビ・sort/filter/layout 等）は **sub-toolbar** として画面 body 最上部に sticky/shrink-0 で残す
5. ルート要素を `h-screen`/`100dvh` から **`h-full`** に変更（AppShell の `<main flex-1 min-h-0>` を満たす）。スクロール領域は `flex-1 min-h-0 overflow-y-auto`。**二重スクロール禁止**
6. Sidebar を共有 Drawer で描画:
   ```tsx
   const { sidebarOpen, closeSidebar } = useShell();
   ...
   <Drawer open={sidebarOpen} onClose={closeSidebar} title="...">
     {/* セクション固有のサイドバー中身 */}
   </Drawer>
   ```
   ローカル `sidebarOpen` state / 独自 backdrop+aside は撤去
7. `npx tsc --noEmit` exit 0（自分の画面起因のエラー 0）

### セクション別 sub-toolbar / Drawer 中身（ユーザーは詳細未確定 → 過剰実装しない・セクション差を出す）

- **Schedule**: sub-toolbar = 月タイトル + 前/今日/次（month のみ）+ SegmentControl(月/3日/リスト)。Drawer = 既存 検索/フィルタ/並び順パネル（既存 `Sidebar` 内の panel 切替 + SearchPanel/FilterPanel を Drawer children に移設。`onClose`→`closeSidebar`）
- **Work**: sub-toolbar = 既存 Timer/History/Settings タブ。Drawer = プリセット quick 切替 + History/Settings へのジャンプ（セクション関連の最小限）
- **Materials**: sub-toolbar = Notes/Daily タブ + layout(card/row) + sort + filter（既存 TopBar から menu/search を除いたもの）。Drawer = タグ絞り込み + 並び順 + 「ピン留めのみ」等。TopBar の旧 search は撤去（横断検索 Overlay が代替）
- **Settings**: sub-toolbar = なし可。Drawer = 設定グループへのアンカー（テーマ/言語/フォント/通知）+ ゴミ箱(/trash)へのリンク
- **Trash**: sub-toolbar = タイプ絞り込み / 並び順。Drawer = タイプ別フィルタ + 「空にする」+ 並び順
- **CrossSearch**: 本体を `<CrossSearchBody initialTag={?tag} />` に置換（`?tag=` を `useSearchParams` で読む）。Drawer = 最小（検索ヒント等のプレースホルダで可）。ルート `/cross-search` は維持

## Steps

| #   | Step                                                                          | Gate  | Acceptance                                                                              |
| --- | ----------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| 1   | Foundation 8 ファイル + App.tsx 作成                                          | 🤖    | `npx tsc --noEmit` exit 0（foundation 単体）                                            |
| 2   | ScheduleScreen を契約通り refactor（reference）                               | 🤖    | tsc 緑 / 二重 Header なし                                                               |
| 3   | build 検証（Schedule + foundation）                                           | 🤖    | `npx tsc --noEmit` + `npm run build` exit 0                                             |
| 4   | Work / Materials / Settings / Trash / CrossSearch を並列 refactor（subagent） | 🤖    | 各 tsc 緑                                                                               |
| 5   | 全体 build + 目視（dev 起動）                                                 | 👀    | `npm run build` exit 0 / ユーザー目視で Header 不変・各 Sidebar 表示・検索 Overlay 動作 |
| 6   | session-verifier → role-qa → task-tracker END → PR                            | 🤖/🛑 | QA 合格・PR                                                                             |

## Acceptance Criteria（機械検証可能）

- [ ] `cd prototype && npx tsc --noEmit` exit 0
- [ ] `cd prototype && npm run build` exit 0
- [ ] `grep -rn "const C = {" prototype/src/screens prototype/src/dev` が 0 件（theme.ts に集約）
- [ ] `grep -rn "function BottomTabBar" prototype/src/screens` が 0 件（共有化）
- [ ] 全 6 セクション画面が `useShell()` + `<Drawer` を含む
- [ ] `/schedule /work /materials /settings /trash /cross-search` で Header（menu/section名/検索）が同一構造

## DB Migration Notes

該当なし（プロトタイプは localStorage モック、DDL なし）。

## References

- 設計: `12_design_information-architecture-v3.md`（PROPOSED）/ `13_..._eval.md`（GO）
- 既存実装の正本: `prototype/src/screens/ScheduleScreen.tsx`（Sidebar/SegmentControl）/ `CrossSearchScreen.tsx`（検索ロジック）

---

## 追補: 2026-05-30 横断検索強化 + ドラッグ可能ボトムシート（ユーザー追加要望）

ユーザー確定（AskUserQuestion 2回目）:

- 横断検索フィルタ = **Tasks / Events / Notes / Daily / Tags**（誕生日・祝日は Events に内包）
- ボトムシートのドラッグ挙動 = **半分↔全画面スナップ + 下スワイプで閉じる**
- 適用範囲 = **全セクションの全ボトムシート**

### 要望 → 実装方針

1. **空入力時は候補非表示**: query 空 AND フィルタ未選択なら結果を出さずヒントのみ（CrossSearchBody `active` フラグ）。done
2. **横断検索をモーダル化**（背景が透ける）: SearchOverlay を全画面 flat → 上部に隙間を残すドラッグ可能シート（backdrop opacity 0.45）。done
3. **フィルタ拡張**: kind chips（タスク/予定/ノート/デイリー）+ tag chips をインライン化。ネスト TagPickerSheet 廃止。done
4. **既存検索の全廃 → Header に集約**: 撤去対象 =
   - ScheduleScreen Sidebar 内 search panel（searchQuery state + panel="search"）
   - MaterialsScreen Sidebar 内 search input（searchQuery state）
   - **残す**: WorkScreen TaskPicker の「タスク検索」input / Materials TagSheet・Schedule TagSheet の「タグ検索/新規作成」input（これらは横断検索ではなく "ピッカー内の選択補助" であり、消すと選択機能が壊れる）
5. **全ボトムシートをドラッグ可能 BottomSheet 化**: 共通 `src/components/BottomSheet.tsx`（snap [0.5, 0.92] / ハンドル drag / 下で dismiss）に置換。
   - 対象13シート（Explore 調査）: Materials BottomSheetShell 配下6（Sort/Filter/ItemMenu/EditorMenu/Mood/Tag）/ Schedule DayDetailSheet・TagSheet / Work TaskPickerModal・AddPresetModal / Settings RadioSheet / CrossSearch TagPicker(→廃止済)
   - **対象外（中央モーダルは据置）**: ConfirmModal 各種 / SessionCompletionModal / InfoModal / AddEventModal（編集フォーム＝ドラッグ閉じで入力事故防止のため据置）

### 新規 foundation（done・変更禁止）

- `src/components/BottomSheet.tsx` — `<BottomSheet open onClose title? rightLabel? onRightClick? snapPoints? initialSnapIndex? backdropOpacity? children>`。height 方式・ハンドルドラッグ・snap・下 dismiss。z-[80]/[81]。
- `src/components/SearchOverlay.tsx` — ドラッグ可能モーダル化（自前 drag、検索 autofocus 維持）。
- `src/components/CrossSearchBody.tsx` — 空入力非候補 + kind/tag インラインフィルタ。

### 追加 Steps

| #   | Step                                                                              | Gate | Acceptance                                   |
| --- | --------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| 7   | BottomSheet/SearchOverlay/CrossSearchBody 作成                                    | 🤖   | tsc 緑（done）                               |
| 8   | Schedule: Sidebar 検索撤去 + DayDetailSheet/TagSheet を BottomSheet 化            | 🤖   | tsc 緑 / 検索パネル消滅                      |
| 9   | Materials: Sidebar 検索撤去 + 6シート(BottomSheetShell→BottomSheet)化             | 🤖   | tsc 緑 / searchQuery 撤去                    |
| 10  | Work: TaskPickerModal/AddPresetModal を BottomSheet 化（タスク検索 input は残す） | 🤖   | tsc 緑                                       |
| 11  | Settings: RadioSheet を BottomSheet 化                                            | 🤖   | tsc 緑                                       |
| 12  | 全体 build + 目視                                                                 | 👀   | build 0 / ドラッグ・空入力・モーダル透け確認 |

### 追加 Acceptance（機械検証可能）

- [ ] `grep -rn "searchQuery" prototype/src/screens` が 0 件（ローカル横断検索撤去。ピッカー内 `query` は別名で残る）
- [ ] `grep -rn "BottomSheetShell" prototype/src/screens` が 0 件（共通 BottomSheet へ移行）
- [ ] `grep -rln "BottomSheet" prototype/src/screens` が Schedule/Materials/Work/Settings に存在
- [ ] `cd prototype && npx tsc --noEmit && npm run build` exit 0

## Worklog

### 2026-05-30 (chat prototype-mobile) — IA v3 shell

- Foundation 8 ファイル + App.tsx 作成。CrossSearchBody は当初 `useMockStore()` 無引数 + 非存在フィールド（tasks/dailies/tagAssignments）で型エラー → CrossSearchScreen 実ロジックの忠実移植に書き直して解消。
- 6画面 refactor（subagent 並列）→ tsc/build 緑。QA Major（Trash ConfirmModal z-index）修正済。

### 2026-05-30 (chat prototype-mobile) — 横断検索強化 + ドラッグシート

- BottomSheet / SearchOverlay（モーダル化）/ CrossSearchBody（空入力非候補 + kind/tag フィルタ）作成 → tsc 緑。
- 既存検索撤去 + 各シート BottomSheet 化を subagent 並列実行。
