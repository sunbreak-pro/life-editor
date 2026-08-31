---
name: test-writing
description: life-editor でテストを書くときの現行作法（shared/tests と web/tests への配置・stubDataService / makeDS の型付きスタブ・jsdom にレイアウトが無い制約・typecheck:tests という独立ゲート・実行コマンド）。Use when writing or fixing vitest suites for shared/ or web/. Triggers include "テスト書いて", "テスト追加", "vitest", "テストが落ちる", "モック", "write tests", "test coverage".
---

# Test Writing — 現行の作法

> 型は `vitest` / `@testing-library/react`。**コロケーションではない** — テストは `tests/` ディレクトリに集約されている。迷ったら**同じ領域の既存スイートに倣うのが最優先** — `shared/tests/` と `web/tests/` に十分な前例がある。

## どこに置くか

| 対象 | 置き場所 |
| --- | --- |
| `shared/src/**`（部品 / hook / Context / mapper / utils） | `shared/tests/<slug>.test.ts(x)` |
| `web/src/**`（画面の組み立て / エディタ / ルーティング） | `web/tests/<slug>.test.ts(x)` |
| `mcp-server/src/**` | `mcp-server/tests/` |
| `desktop/src/**` | `desktop/tests/`（現在 1 本 = IPC 契約のみ） |

ファイル名は**何を確かめるか**を表す camelCase（`domainLoadSnapshot.test.tsx` / `trashScreenActions.test.tsx`）。ソースファイル名の写しにしない — 1 ソースに複数の観点でスイートが並ぶ。

環境はどちらも **jsdom**、共有ヘルパは `shared/tests/helpers/` と `web/tests/helpers/`。

## DataService のスタブ

`shared/tests/helpers/dataServiceStub.ts` の `stubDataService` を使う。**手書きの `as unknown as DataService` を書かない。**

```ts
import { stubDataService } from "./helpers/dataServiceStub";

function makeDS(): DataService {
  return stubDataService({
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    updateTodo: vi.fn().mockResolvedValue(undefined),
  });
}
```

キーは `keyof DataService` で**名前が型検査される**（値は緩いまま — サブジェクトが読む 3 フィールドだけ返す形を許すため）。生キャストで書くとこの検査が切れて、**改名済みメソッド名のスタブがコンパイルも通り「通り続ける」**（サブジェクトは実名を呼んで `undefined` を得て、無関係な場所で落ちるか、落ちない）。

ラッパは慣習として `makeDS` と名付ける（grep できるようにするため。#777 で 3 通りの綴りを 1 つに寄せた経緯）。

## 何をどう確かめるか

- **純関数**（mapper / utils）はそのまま呼んで assert する。最も価値が高く書きやすい
- **hook** は `renderHook` + `waitFor`。Provider が要るなら Provider ごと wrapper に入れる
- **ボタンの挙動は、画面ごと render してハンドラを叩き、引数と呼び先を assert する**のが既定（[`D-20260812-refactor-2`](../../decisions/D-20260812-refactor-2.md) = A+B。実例 = `web/tests/trashScreenActions.test.tsx`）。純関数を切り出して直接呼ぶ形は、**その画面が jsdom に載らないときだけの逃げ道**（Provider 一式 + 実レイアウトが要る `CalendarTab` 等）— 載る画面でやるとテスト専用の間接層が 1 枚増えるだけになる
- DOM 検索は `getByRole` > `getByText` > `getByTestId` の順に優先する
- ユーザー操作は `@testing-library/user-event`、非同期は `waitFor`

## jsdom にレイアウトが無い（一番刺さる制約）

**要素の座標がすべて 0** で、`elementFromPoint` は null。画面座標を文書位置へ戻す経路（ProseMirror の `posAtCoords` と、その上の `handleClickOn` / `handleClick`）は**ここでは検証できない**。

なので**そもそも座標に依存する入力経路を作らない** — DOM イベント + `closest("[data-…]")` で対象を引く（実例 = `web/src/notes/itemLinkNode.ts` の `handleDOMEvents.click`）。座標依存のままだとテストが書けず、#475 のように壊れても気付けない。

`web/tests/setup.ts` が `document.elementFromPoint` を「null を返す」形で補っている（レイアウトの無い文書に対する正直な答え）。これに寄りかからないこと。

## 実行

```bash
cd shared && npm run test          # 全体
cd shared && npx vitest run tests/domainLoadSnapshot.test.tsx   # 単体
cd web && npm run test
```

**`typecheck:tests` は独立のゲート**で、`build` はテストファイルを見ず `vitest` は型を見ない。両方緑でもここだけ赤くなる — 実装を触っていなくてもテストの型は壊れる。

```bash
cd shared && npm run typecheck:tests
cd web && npm run typecheck:tests
```

`shared/tsconfig.test.json` と `web/tsconfig.test.json` に **`exclude` は無い** — 導入時の隔離リスト（BASELINE）は #711 で全件直して削除済みで、**今は全スイートが検査される**。新しいスイートを除外して通す道は意図的に閉ざされているので、型を直す側で解決する（コンパイルしないスイートは、コードについて嘘をついているスイートだから）。

## 落ちたときに疑うこと

- **web の vitest が briefing の lazy-mount で落ちる** → transform キャッシュが冷えている / CPU を取り合っている可能性。単体では緑になる。verify の最後に静かな状態で回す
- **mcp-server の日付テスト** → `vitest.config.ts` が TZ を `Asia/Tokyo` に pin している。ランナーは UTC なので、pin を外すと局所日付のテストが別の意味で緑になる
- **`shared/` の lint エラーが web の lint で出ない** → `web` の lint は `web/` 配下しか歩かない。`cd shared && npm run lint` で見る

ゲート一式の正本は `.github/workflows/ci.yml` の `verify` ジョブ（CLAUDE.md §7.1）。**触ったパッケージだけでなく全部回す** — 依存が shared → web → desktop / mcp-server と一方向に繋がっている。
