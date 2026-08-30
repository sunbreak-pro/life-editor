---
paths:
  - "shared/src/**"
  - "web/src/**"
---

# Frontend 実装規約（path-scoped rule）

> CLAUDE.md §6 の詳細。`shared/` / `web/` のファイルを扱う時のみ自動ロードされる。
> 作成手順は `add-component` スキル、デザイン判断は `frontend-react-designer` スキル（rules = 不変式と表、skills = 手順）。

## UI 2 層モデル（W0 2026-06-07 確定 = 案 A）

- 新規 UI は `shared/src/components/`（部品層）に集約し、画面層は `web/src/`。Web / Electron / Capacitor の 3 配布形態が同一ソースを共用する（デザインシステム + `lumen-*` トークン + i18n en/ja catalog も `shared/` 側）。詳細 → `docs/vision/coding-principles.md §6`。旧 `frontend/`（Tauri 時代）は 2026-07-11 削除済み（#197・復元 = git tag `pre-tauri-removal`）

## セクションを 1 つ足すときに触る 2 箇所（#676 (b)）

- **アイデンティティ = `shared/src/sections.ts` の registry**（`SectionId` / nav 順 / グループ / アイコン / i18n key / mobile 順）
- **web ホストの描き方 = `web/src/sectionDescriptors.tsx` の `SECTION_DESCRIPTORS`**（PageContainer の width / ヘッダーのタブ帯 / 狭幅レイアウトの行 / body とその section 層 Provider）。`Record<SectionId, …>` なので registry に足すと descriptor 行が無い間はコンパイルが通らない
- `MainScreen.tsx` は section id で分岐しない（旧 `MOBILE_HAMBURGER_SECTIONS` / `ownsFullBleed` / 4 分岐のタブ帯 / 7 分岐の body はすべて descriptor 行に移動済み）。重い body（Notes / Analytics）の `lazy()` は `web/src/lazySections.ts`（守り = `web/tests/lazySectionChunks.test.ts`。3 本目だった旧 Connect は #1152 でセクションごと退役。#1171 の新 Connect = Tag hub は**意図的に分割していない** — 重いのはベンダースタック側で、この画面は React と既存アイコンしか持たないため分割しても取り出せる重量が無い）。同じファイルの `SECTION_CHUNK_LOADERS`（#1158 のアイドル先読み）は同じ specifier をもう一度並べるので、**重い body を足す / 消すときは `lazy()` 側と 2 箇所セットで直す** — 片方だけだと削除済みモジュールを `import()` することになり、守りのテストが落ちる

## 命名（プロジェクト固有のみ）

- Context Value 型は PascalCase ファイル名: `AudioContextValue.ts`。他は一般的 TS/React 慣習（コンポーネント PascalCase / フック `use`+camelCase / 定数 SCREAMING_SNAKE_CASE）

## Sync の再取得はドメイン単位（#499）

Realtime の変更通知は**ドメインごとのカウンタ**（一覧は `shared/src/context/syncDomains.ts` の `SYNC_DOMAINS` が正）に振り分けられる。データを読む effect は `useSyncDomains("notes", …)` で**自分が読むドメインを全部宣言**し、その戻り値を deps に入れる。

- **申告漏れは無言の stale になる**（更新が来ず、ユーザーに直す手段がない）。1 つの effect が複数ドメインを読むなら全部並べる。過剰宣言は余計な fetch 1 回で済むので、迷ったら足す側に倒す
- 新しいテーブルを `REALTIME_TABLES` に足したら `syncDomains.ts` の対応表にも足す（`syncDomains.test.ts` の lockstep が落ちる）
- **1 テーブル = 1 ドメインだが、読み手が分かれるなら既存ドメインに相乗りさせずドメインを分ける**（#993: 書き込みの多い `timer_sessions` を settings 系と同じ `timer` に載せていたため、ポモドーロ操作のたびに TimerProvider が設定 2 本を取り直していた）
- 読み取りメソッドの中で書き込まない。`fetchTimerSettings` が「無ければ作る」upsert を毎回投げていたため、ノート編集が `timer_settings` に POST していた（#499 の実測）

## Provider 順序（依存制約）

一本鎖ではなく **2 階建て**: 常時マウントの**グローバル層**と、section switch の内側で入れ替わる**セクション層**。実際のネストはコードが正（`web/src/main.tsx` + `web/src/AppProviders.tsx` — #676 で Provider 鎖を `MainScreen.tsx` から移設済み）。

- **グローバル層**（外→内）: I18n → Theme（`main.tsx`）→ Toast → Sync → UndoRedo（`UndoRedoHost` 経由）→ ShortcutConfig → Audio → Timer（`TimerHost` 経由）→ RightSidebar（`AppProviders.tsx`）
- **セクション層**（section switch の内側。セクションごとに独立した鎖で、横並びの兄弟関係）:
  - Materials: WikiTagsUnified → TodoTree / NotesUnified / DailiesUnified
  - Schedule: TagGroup → Routine → ScheduleItems
  - Analytics: AnalyticsFilter（`components/Analytics/AnalyticsView.tsx` 内）
- **不変式**: 内側 Provider は外側 Context に依存可、逆は不可（例: ScheduleItemsProvider → RoutineProvider、TimerProvider → AudioProvider）。**#676 (c) で Audio と Timer を入れ替えた** — 完了チャイムを鳴らすのは Timer 側なので Audio が外。旧構成では ref（`chimeRef` + `AudioChimeBridge`）で内→外へ関数を渡し戻していた
- **セクション層 gotcha**: セクション層 Provider は画面遷移で unmount するが、グローバル層は生き残る。グローバル層に状態を預ける機能は unmount 跨ぎの整合を自前で守ること（実例 = `TodoTreeContext.tsx` の unmount 時 UndoRedo stack clear）
- **Mobile 省略ガードは配線済み**（#320）: web ホスト（`web/src/AppProviders.tsx` の ShortcutConfigHost）が `isNativeMobile()`（`utils/platform.ts`）で native mobile 時に ShortcutConfig Provider を省略する（一覧は CLAUDE.md §2 が正）。Audio は Provider 維持（完了チャイム維持 = `docs/requirements/mobile-scope.md` #10/#11）で Ambient mixer UI のみ `WorkScreen.tsx` 側で native 省略。省略 Provider は Optional バリアント必須（→ `docs/vision/coding-principles.md §4`）— 消費側は null ガードで no-op にする

## Pattern A（Context/Provider 標準 — 3 ファイル）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

`context/index.ts` に Provider / Context / type を export。例外: 他 Provider が依存しない自己完結なら単一ファイル可（例 `ToastContext`）。

## 共有コンポーネント配置（shared/ 内）

| 種別          | 配置先                            |
| ------------- | --------------------------------- |
| 共有 UI       | `shared/src/components/`          |
| 共有フック    | `shared/src/hooks/`               |
| Context       | `shared/src/context/`             |
| 共有型        | `shared/src/types/`               |
| Schedule 共通 | `shared/src/components/schedule/` |

（旧 frontend/ 内の配置表は削除済み。UndoRedo は #304 で web 移植済み — `web/src/UndoRedoHost.tsx` / `HeaderUndoRedo.tsx` + `shared/src/utils/undoRedo/`）

## デザイン規約（不変式）

- `lumen-*` トークン使用（色のハードコード禁止）
- **主要 UI コンテナ背景に透明度禁止**（不透明トークン使用。未定義クラスは silent fail で透明落ち）
- i18n は props 経由（部品フック内で `useTranslation()` 禁止）。文言は `react-i18next` の en / ja 両 catalog に追加
- DataService はコールバック注入（フック内で `getDataService()` 直呼び禁止）
- ジェネリクスで型外部化
- **`lumen-*` はネストした `data-theme` に追随しない**（#887）: `@theme` の別名（`--color-lumen-bg: var(--color-bg-primary)`）は Tailwind が `:root` に出し、**宣言された要素**で中身が確定して子孫はその確定値を継承する。サブツリーに `data-theme="dark"` を付けても lumen-\* 側は塗り替わらない（Settings のテーマカード 3 枚が同じ見た目になっていた原因）。**部分テーマで使うトークンは `tokens.css` の `[data-theme]` エイリアスブロックに 1 行足す**（色値のコピーは禁止・守り = `shared/tests/tokensNestedTheme.test.ts`）
- 詳細 → `docs/vision/coding-principles.md §5`

## Schedule Provider 分割

- 現行は `TagGroupProvider` → `RoutineProvider` → `ScheduleItemsProvider`（外→内）。`TagGroupProvider` は #1173 で `CalendarProvider` の枠をそのまま引き継いだもの（カレンダー台帳 = 1 タグのフィルタ を、多タグの「グループ」へ置換）。`CalendarTagsProvider` は DU-F Step 3-5 で撤去済み（tag/link は `WikiTagsUnified` が引き継ぎ）、後方互換ファサード `useScheduleContext()` も現存しない — 個別 hook を直接使用する。複数参照される部品は `shared/src/components/schedule/` へ（背景 → `docs/vision/coding-principles.md §3`）

## テスト環境の制約（座標に依存する入力経路を作らない）

jsdom にレイアウトが無い（座標がすべて 0）という環境の事実の正本は **CLAUDE.md §7.1**。`shared/tests/` も同じで、`elementFromPoint` は null・画面座標を文書位置へ戻す経路（ProseMirror の `posAtCoords` と、その上に載る `handleClickOn` / `handleClick`）は検証できない。

- 規約: UI の入力経路は座標に依存しない形で組む — DOM イベント + `closest("[data-…]")` で対象を引く（実例 = `web/src/notes/itemLinkNode.ts` の `handleDOMEvents.click`）
- **規約（ボタンの処理をどう固定するか。[`D-20260812-refactor-2`](../decisions/D-20260812-refactor-2.md) = A+B）: 既定は Testing Library で画面ごと render してハンドラを叩き、引数と呼び先を assert する**（実例 = `web/tests/trashScreenActions.test.tsx`）。**純関数を切り出して直接呼ぶ形は、その画面が jsdom に載らないときの逃げ道**（Provider 一式 + 実レイアウトが要る `CalendarTab` 等。実例 = `web/src/schedule/todoChipUndoWiring.ts`）— 載る画面で使うとテスト専用の間接層が 1 枚増えるだけになる

## Gotchas

- **`cn` は tailwind-merge ではない**（`shared/src/components/cn.ts` = ただの文字列連結）。同じプロパティのクラスを 2 つ載せると**後から渡した方ではなく CSS の記述順が勝つ** — Tailwind v4 は接尾辞順に吐くので `.max-w-[860px]` は `.max-w-md` より上に来て負ける。**既定値を呼び出し側に上書きさせたい部品は `className` 任せにせず prop で出し分ける**（実例 = `Modal` の `size` / `padded`。860px を渡したタグ編集パネルが 448px で描かれていた = #830）
- **IME**: keydown 処理は **`isImeComposing(e)`（`shared/src/utils/imeGuard.ts`）必須**（日本語入力破壊防止）。`isComposing` を直に見ない — WebKit（macOS + iOS = 主ターゲット）は変換を**確定する** Enter を `isComposing: false` + `keyCode === 229` で飛ばすため、フラグ単独だと一番まずいキーだけ素通りする（#737。React 合成イベント・native イベントのどちらも同じヘルパで受ける）
- **リッチテキスト**: TipTap
- **DnD**: `@dnd-kit`。ツリーの入れ子は #418 で退役（2026-07-27 ユーザー判断、復活せず = 2026-08-27 確定）。**ツリー移動の API は Todos / Notes とも存在しない** — 旧 `moveNode` / `moveToRoot` は呼び出し元ゼロのまま残っていたため #1156 でフックごと削除した。並び替えは各リスト側の order 更新で行う
