---
name: add-component
description: life-editor の UI を 1 つ足すときの機構（どこに置くか / Pattern A の Context 3 ファイル / セクションを足す 2 箇所 / i18n と Provider の登録先）。デザイン判断そのものは frontend-react-designer、不変式と配置表の正本は rules/frontend.md。Use when creating a new component, panel, dialog, provider, context, hook, or section in shared/ or web/. Triggers include "コンポーネント追加", "部品を作る", "Provider を足す", "セクション追加", "画面を足す", "add component", "new panel", "new section".
---

# Add Component — UI を 1 つ足すときの機構

> **役割分担**: 本スキル = 置き場所と登録先（機構）。[`rules/frontend.md`](../../rules/frontend.md) = 不変式と配置表（`shared/src/**` / `web/src/**` を触ると自動ロードされる）。`frontend-react-designer` スキル = 見た目・状態設計・a11y・モーションの判断。
>
> **同じ表を 2 箇所に書かない**（CLAUDE.md §0 数値の非複製原則）。配置表・Provider 順序・デザイン不変式は rules 側だけを見ること。

## 0. 書く前に決める 2 つ

1. **`shared/` か `web/` か。** 部品（再利用される UI・Context・hook）は `shared/src/`、画面の組み立ては `web/src/`。Web / Electron / Capacitor の 3 配布形態が同じソースを共用するので、**特定の画面にしか出ない見た目でも部品側に置いてよい**が、`web/src` の他ファイルを import する部品は作らない（依存が逆流する）。
2. **Context が要るか。** 状態を兄弟コンポーネント間で共有するなら Pattern A（§2）。親から props で足りるなら作らない — Provider は 1 本増えるたびに全画面のマウントコストになる。

## 1. 単体の UI 部品

`shared/src/components/` にファイルを 1 つ作る（PascalCase・named export）。

```tsx
type Props = {
  title: string;
  actionLabel: string; // ← 文言は props で受ける。部品内で useTranslation() を呼ばない
  onAction: () => void;
};

export function MyPanel({ title, actionLabel, onAction }: Props) {
  return (
    <div className="bg-lumen-bg-secondary text-lumen-text border-lumen-border rounded-lg border p-4">
      <h2>{title}</h2>
      <Button onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}
```

- **文言は props 経由**。`t()` を呼ぶのは画面層（`web/src/`）。翻訳キーは `shared/src/i18n/locales/en.json` と `ja.json` の**両方**に足す。`fallbackLng: "en"` なので、**ja を忘れてもエラーにならず日本語表示のときだけ英語が出る** — 壊れ方が静かなので見落としやすい
- **色は `lumen-*` トークンだけ**。ハードコード禁止。主要 UI コンテナの背景に透明度を使わない（未定義クラスは silent fail で「透明落ち」する）
- **DataService はコールバック注入**。部品や hook の中で `getDataService()` を直接呼ばない
- `shared/src/components/index.ts` に export を足す（画面層はここから import する）

サブディレクトリを持つ領域（`Analytics/` `briefing/` `items/` `materials/` `schedule/` など）は、その領域の部品ならそちらへ。

## 2. Context / Provider（Pattern A = 3 ファイル）

```
shared/src/context/FooContextValue.ts   … interface + createContext<Foo | null>(null)
shared/src/context/FooContext.tsx       … Provider（hook 呼び出し + useMemo）
shared/src/hooks/useFooContext.ts       … createContextHook(FooContext, "useFooContext")
```

```ts
// hooks/useFooContext.ts
import { createContextHook } from "./createContextHook";
import { FooContext } from "../context/FooContextValue";

export const useFooContext = createContextHook(FooContext, "useFooContext");
```

`createContextHook`（`shared/src/hooks/createContextHook.ts`）が「Provider の外で呼んだら投げる」を引き受けるので、null チェックを自分で書かない。

登録:

1. `shared/src/context/index.ts` に Provider / Context / 型を export
2. **Provider 鎖に挿す**。グローバル層 = `web/src/main.tsx` + `web/src/AppProviders.tsx`、セクション層 = `web/src/sectionDescriptors.tsx` の該当行。**順序には依存制約がある**（内側は外側の Context に依存可・逆は不可）— 現行の並びは rules/frontend.md §Provider 順序が正本
3. モバイルで省略する Provider にするなら Optional バリアント必須（消費側は null ガードで no-op）

例外: 他の Provider から依存されない自己完結なものは 1 ファイルでよい（例 `ToastContext`）。

## 3. セクションを 1 つ足す（触るのは 2 箇所だけ）

1. **`shared/src/sections.ts` の registry** — `SectionId` / サイドバー順 / グループ / アイコン / i18n キー / モバイル順が全部ここから派生する
2. **`web/src/sectionDescriptors.tsx` の `SECTION_DESCRIPTORS`** — PageContainer の width / ヘッダーのタブ帯 / 狭幅の行 / body とその section 層 Provider

`Record<SectionId, …>` なので、registry に足して descriptor 行が無い間は**コンパイルが通らない**。これが「2 箇所で済む」の担保になっている。`MainScreen.tsx` は section id で分岐しないので触らない。

body が重い（Notes / Analytics 級）なら `web/src/lazySections.ts` で `lazy()` する。同じファイルの `SECTION_CHUNK_LOADERS` にも同じ specifier を並べる — **片方だけ直すと守りのテスト（`web/tests/lazySectionChunks.test.ts`）が落ちる**。

## 4. データを読む部品を作ったら

Realtime の更新を受け取るために、読む effect で `useSyncDomains("notes", …)` のように**自分が読むドメインを全部宣言**し、戻り値を deps に入れる。**申告漏れは無言の stale**（更新が来ず、ユーザーに直す手段がない）。迷ったら足す側に倒す — 過剰宣言の代償は余計な fetch 1 回だけ。

## 5. 出す前に

- `cd shared && npm run lint`（`web` の lint は `shared/` を歩かない）
- テストは `shared/tests/` か `web/tests/` に（コロケーションではない）→ `test-writing` スキル
- ゲート一式は CLAUDE.md §7.1（正本は `.github/workflows/ci.yml` の `verify` ジョブ）

## チェックリスト

- [ ] named export・PascalCase ファイル名
- [ ] 文言は props 経由で、en / ja 両方の catalog に追加した
- [ ] 色は `lumen-*` のみ・主要コンテナ背景に透明度なし
- [ ] `getDataService()` を部品 / hook 内で直呼びしていない
- [ ] Pattern A なら 3 ファイル + `shared/src/context/index.ts` + Provider 鎖への登録
- [ ] セクション追加なら registry と descriptor の両方
- [ ] データを読むなら `useSyncDomains` でドメインを宣言した
