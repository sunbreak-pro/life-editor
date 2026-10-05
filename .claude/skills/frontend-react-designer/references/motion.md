# Motion — life-editor 控えめ運動 + reduced-motion

> 既存 keyframes の流用、長さ 3 段と easing 2 種のトークン、prefers-reduced-motion 対応、過剰回避ルール。数値の正本は `shared/src/styles/tokens.css` で、このファイルは使い方を書く。

## §1 既存 keyframes 一覧（正本 = `shared/src/styles/tokens.css`）

tokens.css に定義されている keyframes は下表の 5 つで、どれも入場用です。一覧の正本はコードなので、使う前に `grep -n "@keyframes" shared/src/styles/tokens.css` で確かめる。**新しい keyframes を増やす前に流用を検討する**。旧 `frontend/src/index.css` にあった `check-pop` / `slide-up` / `check-in` などは 2026-07-11 の #197 で消えていて、tokens.css には無い（class を書いても何も起きない）。

| keyframe / class       | 用途                                                  | 長さ / easing               | fill-mode |
| ---------------------- | ----------------------------------------------------- | --------------------------- | --------- |
| `lumen-drawer-in-left` | 狭幅の詳細パネル（ドロワー）が左端から入る            | normal / `--ease-lumen-out` | なし      |
| `lumen-scrim-in`       | ドロワーの背後の暗幕がフェードで入る                  | normal / `--ease-lumen-out` | なし      |
| `lumen-panel-in-right` | 広幅の詳細パネルが `margin-right` で本文を押して入る  | normal / `--ease-lumen-out` | なし      |
| `lumen-section-in`     | セクションを初めて開いたとき 8px 浮き上がってフェード | normal / `--ease-lumen-out` | `both`    |
| `lumen-digit-in`       | Work のカウントダウンで変わった桁だけがフェードで入る | fast / `--ease-lumen-out`   | なし      |

keyframes 名と class 名は同じで、class を付ければ動く（`className="lumen-section-in"`）。fill-mode の有無には理由がある。

- 詳細パネルの 3 つに fill-mode を付けない。ドラッグ中のドロワーはインラインの `transform` を書くため、`forwards` で最後のフレームが残るとそれに勝ってしまう（#792 / #1050）。
- `lumen-section-in` だけは `both` にする。動きを減らす設定で長さが 0.001ms に潰れても、最後の状態に着地させるため。最後のフレームは `translateY(0)` ではなく `transform: none` にする。恒等の transform でも `position: fixed` の子孫の基準になってしまうため（#1049）。

守りのテストは `shared/tests/panelEnterMotion.test.ts`・`sectionEnterMotion.test.ts`・`tokensSteps.test.ts` にある。

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

## §3 長さ 3 段と easing 2 種（値の正本 = tokens.css の `@theme`）

長さは下の 3 段だけを使う。値は旧来の 3 つの帯（100〜150 / 200〜300 / 400〜600ms）から 1 つずつ選んだもので、隣り合う段はおよそ 1.6 倍ずつ離れている（#2036）。

| トークン                  | 値    | 使う場面                                                 |
| ------------------------- | ----- | -------------------------------------------------------- |
| `--duration-lumen-fast`   | 150ms | hover / focus / 小さい状態変化 / 入れ替わる数字          |
| `--duration-lumen-normal` | 250ms | パネル・シート・ドロワー・暗幕の出入り、セクションの入場 |
| `--duration-lumen-slow`   | 400ms | 全画面の遷移（2026-10 時点で使っている所は無い）         |

fast は Tailwind の `transition` 系ユーティリティの既定値（150ms）と同じなので、`transition-colors` だけを書いた呼び出し元はそのまま fast の段に乗っている。`duration-200` のように別の数字を書くと段から外れる。3 段を超える長さは **意図がある場合のみ**使い、理由をコメントに残す。

| トークン           | 値                               | 使う場面                                      |
| ------------------ | -------------------------------- | --------------------------------------------- |
| `--ease-lumen-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 入場。動きの大半を最初に済ませて減速する      |
| `--ease-lumen-in`  | `cubic-bezier(0.64, 0, 0.78, 0)` | 退場。`--ease-lumen-out` の鏡像で加速して去る |

### 書き方

Tailwind v4 には長さの名前空間が無いので、長さは変数を直接渡す。easing は名前空間があるのでユーティリティになる。

```tsx
// transition: 長さは duration-(--…)、easing は ease-lumen-*
<button className="transition-colors duration-(--duration-lumen-fast) ease-lumen-out" />

// 任意値の animation でも数字を書かずに変数を渡す
<div className="motion-safe:animate-[lumen-section-in_var(--duration-lumen-normal)_var(--ease-lumen-out)_both]" />
```

tokens.css に新しい keyframes を足すときも `animation:` には数字を書かず、`var(--duration-lumen-*)` と `var(--ease-lumen-*)` を渡す（`tokensSteps.test.ts` が数字の直書きを落とす）。段を増やしたいときは tokens.css の `@theme` に足し、このファイルの表と design-critique の `scripts/measure.js` の `MOTION_BANDS` を同じ PR で揃える。

## §4 `prefers-reduced-motion` 対応 (必達)

### 実装済みの一括無効化（tokens.css の末尾）

tokens.css の末尾にある 2 つのブロックが、全要素の `animation-duration` と `transition-duration` を `0.001ms !important` に潰す。0 ではなく 0.001ms にしているのは、`transitionend` / `animationend` を待つ処理を止めないためである。効く条件は Settings の 3 択（`<html data-reduce-motion>`）で決まる。

- 属性なし（system）: OS の `prefers-reduced-motion: reduce` に従う。
- `reduce`: OS に関係なく止める。
- `off`: OS が減らす設定でも動かす。

上書きは長さの longhand に `!important` で効くので、shorthand の中で `var(--duration-lumen-*)` を使っていても止まる。部品ごとに reduced-motion の分岐を書く必要は無い。**重要な状態変化 (例: dialog 表示) を CSS animation のみに依存させない**。`opacity:0` の状態が残ったまま見えなくなる事故を避けるため、最終状態に着地する設計にする（`lumen-section-in` の `both` がその例）。

### Tailwind utilities

```tsx
<span className="animate-spin motion-reduce:animate-none" />
```

一括の上書きは長さを潰すだけで、無限ループのスピナーは 1 回だけ回って止まる。止めたうえで別の手がかりを出したいときは `motion-reduce:` で個別に制御する（例: `BUSY_SPINNER` と `<Button busy busyLabel>`）。`motion-safe:` / `motion-reduce:` が付けられるのは Tailwind のユーティリティだけで、tokens.css の `lumen-*` class には付かない。§1 の class は一括の上書きに任せる。

## §5 React で motion ライブラリを使う基準

life-editor は現在 `framer-motion` / `motion` ライブラリを **採用していない**。導入条件:

- **CSS のみで表現困難な制御**: gesture (drag / swipe) 連動、AnimatePresence の exit animation、layout animation (`layoutId`)
- **追加すべきでない場面**: 単なる open/close / fade / slide / hover → CSS で十分

導入する場合は `motion` (旧 framer-motion v12+) の軽量版を使い、bundle size 増加を確認。

## §6 motion デザイン原則 (短く)

| 原則                   | 内容                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| 入力には即応           | fast（150ms）以内に視覚 feedback (button press / hover)                       |
| 大きいものはゆっくり   | dialog / sheet / パネルは normal（250ms）。豆粒 chip は fast                  |
| 入退場で easing 変える | 入場: `--ease-lumen-out` (素早く減速)、退場: `--ease-lumen-in` (加速して去る) |
| stagger は等間隔       | 30-50ms 刻み。リストが 10+ なら最大 200ms 程度で打ち切る                      |
| pop / overshoot 慎重   | チェック等の達成感に限定。常用すると "おもちゃ感"                             |

## §7 例: 既存 keyframe の流用パターン

```tsx
// 1. 詳細パネル（狭幅はドロワー + 暗幕、広幅は押し込み）
<div className="lumen-scrim-in" />
<aside className="lumen-drawer-in-left">
<aside className="lumen-panel-in-right" style={{ "--lumen-panel-w": `${width}px` }}>

// 2. セクションの初回入場（誰に付けるかは useFirstAppearance が決める）
<PageContainer className={firstTime ? "lumen-section-in" : undefined}>

// 3. 入れ替わった桁だけ（key を値にして、変わった span だけ再マウントする）
<span key={digit} className="lumen-digit-in">{digit}</span>

// 4. ページ stagger (10 件まで)。fade-up を流用し、長さは normal の段
{items.map((item, i) => (
  <Card
    key={item.id}
    className="motion-safe:animate-[lumen-section-in_var(--duration-lumen-normal)_var(--ease-lumen-out)_both]"
    style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}
  />
))}
```

## §8 motion チェックリスト

- [ ] 既存 keyframes の流用を最初に検討した
- [ ] 長さは `--duration-lumen-fast / normal / slow` のどれかで、数字を直書きしていない（例外はコメントで理由を書いた）
- [ ] easing は入場 `--ease-lumen-out`・退場 `--ease-lumen-in` にした
- [ ] hover で同時に複数の transform が走らない
- [ ] 動きを減らす設定（OS と Settings の 3 択）で止まる。tokens.css の一括上書きに任せ、無限ループは `motion-reduce:` で個別に止めた
- [ ] アニメーション後の最終状態が CSS animation 無しでも視認可能 (DOM 上に残る)
- [ ] scroll-trigger / intersection observer に頼った装飾アニメは入れていない (life-editor 不採用)
