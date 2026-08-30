# Motion — life-editor 控えめ運動 + reduced-motion

> 既存 keyframes の流用、duration の 3 帯、prefers-reduced-motion 対応、過剰回避ルール。

## §1 既存 keyframes 一覧（正本 = `shared/src/styles/tokens.css`）

既存 keyframes の出典は現行の本流 CSS **`shared/src/styles/tokens.css`**（一覧はコードが正 — `@keyframes` を grep。`kanban-*` / `lumen-*` 系が定義済み）。下表は旧 `frontend/src/index.css`（2026-07-11 #197 で削除済み）由来の歴史カタログで、**tokens.css に未移植** — 使うには git tag `pre-tauri-removal` から復元して tokens.css に移植する（未定義のまま class を書くと無効になる）。**新しい keyframes を増やす前に必ず流用を検討する**:

| keyframe         | 用途                        | duration / easing      |
| ---------------- | --------------------------- | ---------------------- |
| `check-pop`      | チェックボックス チェック   | 300ms ease-out         |
| `routine-check`  | ルーチン項目の達成          | 400ms ease-out         |
| `check-in`       | 軽い fade-in (リスト追加)   | 150ms ease-out         |
| `slide-up`       | パネル / Toast / Sheet 出現 | 300ms ease-out         |
| `slide-in-toast` | Toast 進入                  | 300ms ease-out         |
| `fade-out-toast` | Toast 退出                  | 300ms ease-in forwards |

使い方:

```tsx
<div className="animate-[slide-up_300ms_ease-out]">{children}</div>
```

または Tailwind v4 `@theme` で `--animate-slide-up` を定義しているなら `animate-slide-up` でも可 (定義を確認すること)。

## §2 過剰回避ルール (`AI slop` の典型回避)

公式 frontend-design が指摘する「scattered micro-interactions」を避ける。

### 推奨

- **イベントの瞬間に 1 つだけ**: チェック / 削除 / 追加 / モーダル開閉 など、ユーザ操作に直結する 1 つの瞬間
- **stagger 複数**: ページロード時のリスト表示で 1 アイテムごとに `animation-delay` を 30-50ms ずつずらす程度
- **継続感のある loading**: skeleton の shimmer は 1500ms-2000ms の slow loop で OK

### 禁止

- すべての hover で scale / rotate / shadow が一斉に動く
- スクロール連動で複数要素が同時に動く
- アイコンの永続 spin / pulse (loading 以外)
- bounce / wobble / elastic 系の演出 (Lumen calm minimal にそぐわない)

## §3 duration の 3 帯

```
fast    : 100-150ms  → hover / focus / 小さい state change
normal  : 200-300ms  → modal / sheet / popover の開閉、リスト追加
slow    : 400-600ms  → 全画面遷移 / ページロード stagger
```

これを超える duration は **意図がある場合のみ**。

### CSS variable で集中管理 (推奨)

```css
@theme {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Tailwind v4 で `transition-[duration:var(--duration-normal)]` のように参照できる。新規導入の際は `shared/src/styles/tokens.css` に追加してから使う (未定義トークンは透明落ちと同じく無効になる)。

## §4 `prefers-reduced-motion` 対応 (必達)

### CSS で一括無効化 (推奨)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
}
```

`shared/src/styles/tokens.css` の `@layer base`（または host 側 entry CSS）に 1 度書けば全コンポーネントに効く。**重要な状態変化 (例: dialog 表示) を CSS animation のみに依存させない**。`opacity:0` の状態が残ったまま見えなくなる事故を避けるため、最終状態 (`forwards` 相当) に固定する設計を心がける。

### Tailwind utilities

```tsx
<div className="motion-safe:animate-[slide-up_300ms_ease-out] motion-reduce:animate-none">
```

個別制御したい場合は `motion-safe:` / `motion-reduce:` を使う。

## §5 React で motion ライブラリを使う基準

life-editor は現在 `framer-motion` / `motion` ライブラリを **採用していない**。導入条件:

- **CSS のみで表現困難な制御**: gesture (drag / swipe) 連動、AnimatePresence の exit animation、layout animation (`layoutId`)
- **追加すべきでない場面**: 単なる open/close / fade / slide / hover → CSS で十分

導入する場合は `motion` (旧 framer-motion v12+) の軽量版を使い、bundle size 増加を確認。

## §6 motion デザイン原則 (短く)

| 原則                   | 内容                                                        |
| ---------------------- | ----------------------------------------------------------- |
| 入力には即応           | 100-150ms 以内に視覚 feedback (button press / hover)        |
| 大きいものはゆっくり   | dialog / sheet は 250-300ms。豆粒 chip は 150ms             |
| 入退場で easing 変える | 入場: `ease-out` (素早く減速)、退場: `ease-in` (徐々に去る) |
| stagger は等間隔       | 30-50ms 刻み。リストが 10+ なら最大 200ms 程度で打ち切る    |
| pop / overshoot 慎重   | チェック等の達成感に限定。常用すると "おもちゃ感"           |

## §7 例: 既存 keyframe の流用パターン

```tsx
// 1. Sheet 出現
<aside className="motion-safe:animate-[slide-up_300ms_ease-out]">

// 2. リスト追加 (新規アイテム)
<li className="motion-safe:animate-[check-in_150ms_ease-out]">

// 3. Toast
<div className="motion-safe:animate-[slide-in-toast_300ms_ease-out]" data-leaving={isLeaving}>
// data-leaving 時に fade-out-toast を当て直す

// 4. ページ stagger (10 件まで)
{items.map((item, i) => (
  <Card
    key={item.id}
    className="motion-safe:animate-[check-in_200ms_ease-out_both]"
    style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}
  />
))}
```

## §8 motion チェックリスト

- [ ] 既存 keyframes の流用を最初に検討した
- [ ] duration が 100-300ms 帯に収まっている (例外時のみ 400-600ms)
- [ ] hover で同時に複数の transform が走らない
- [ ] `prefers-reduced-motion: reduce` で停止する
- [ ] アニメーション後の最終状態が CSS animation 無しでも視認可能 (DOM 上に残る)
- [ ] scroll-trigger / intersection observer に頼った装飾アニメは入れていない (life-editor 不採用)
