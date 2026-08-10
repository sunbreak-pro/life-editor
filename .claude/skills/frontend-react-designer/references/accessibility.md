# Accessibility — life-editor 必達基線

> WCAG 2.2 を必達、APCA は補足。フォーム 3 点セット、focus-visible、キーボード操作、スクリーンリーダー要点。

## §1 コントラスト基準 (WCAG 2.2 + APCA 補足)

### 必達: WCAG 2.2

- 通常テキスト (< 18.66px / < 14pt bold): **4.5:1**
- 大きいテキスト (>= 24px / >= 18.66px bold): **3:1**
- インタラクション可能な UI コンポーネント / アイコン: **3:1**

life-editor の `lumen-*` トークンは light / dark の両方で上記を満たす配色だが、**ホバー / disabled / muted は確認漏れしやすい**。具体的には:

- `text-lumen-text-secondary` を small text で本文に使うと WCAG 2.2 を割る可能性 → 重要情報には使わない
- `bg-lumen-hover` 上の `text-lumen-text` は OK
- カラーチップの `chip-completed-fg` などは選択中 / hover 時のコントラスト確認

### 補足: APCA (Lc 値)

WCAG 3.0 候補。フォントサイズ依存で精度高い。`https://apcacontrast.com/` で確認。
推奨基線:

- Body text (16px regular): **Lc 75 以上**
- Headlines (24px+): **Lc 60 以上**
- Disabled state: Lc 30 まで OK (操作可能性が無いため)

WCAG 2.2 を満たした上で APCA で再確認するのが安全。

## §2 focus-visible スタイル (キーボード対応)

`outline-none` で消したまま放置は **絶対禁止**。`focus-visible:` で代替を必ず提供。

### 標準パターン (interactive 要素共通)

```tsx
<button
  className="
    rounded-md px-3 py-1.5 text-lumen-text bg-lumen-bg-secondary
    hover:bg-lumen-hover
    focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2
    focus-visible:ring-offset-lumen-bg
  "
>
```

`focus-visible` (キーボード起因のフォーカスのみ) を使うことで、マウスクリック時のチラつきを避けつつキーボード操作の視認性を確保できる。`focus:` ではなく `focus-visible:` を使う。

### 注意点

- `ring-offset-lumen-bg` は背景色と合わせる (light / dark でトークンが切り替わるので自動追従)
- input / textarea は `focus-visible:ring-2` の代わりに `focus:border-lumen-accent` でも OK (枠線変化で示す)
- card / row 全体をクリッカブルにする場合は `tabIndex={0}` + `role="button"` + キーボードで Enter/Space を発火

## §3 フォームの WAI-ARIA 三点セット

すべての input / textarea / select / カスタムコントロールに以下 3 点を必ず付ける:

```tsx
<label htmlFor="task-name">{t("tasks.name.label")}</label>
<input
  id="task-name"
  aria-describedby={hasError ? "task-name-error" : "task-name-help"}
  aria-invalid={hasError || undefined}
  ...
/>
<p id="task-name-help" className="text-xs text-lumen-text-secondary">
  {t("tasks.name.help")}
</p>
{hasError && (
  <p id="task-name-error" role="alert" className="text-xs text-lumen-danger">
    {errorMessage}
  </p>
)}
```

3 点 = `<label htmlFor>` / `aria-describedby` / `aria-invalid`。エラー文言は `role="alert"` でスクリーンリーダーに通知。

### Radix / カスタムコントロール

カスタム dropdown / combobox は `aria-haspopup` / `aria-expanded` / `aria-controls` の 3 点を実装。Radix を使えば自動。手書きする場合は `react-aria` (`@react-aria/*`) のフックが安全。

## §4 キーボード操作の必須セット

| 操作                | キー                      | 必須対象                              |
| ------------------- | ------------------------- | ------------------------------------- |
| Tab 順遷移          | Tab / Shift+Tab           | すべての操作可能要素                  |
| 起動 / 確定         | Enter / Space             | button / role="button" / link         |
| キャンセル / 閉じる | Esc                       | dialog / popover / dropdown / menu    |
| メニュー内移動      | ↑ ↓ (Home / End も推奨)   | dropdown / select / menubar / listbox |
| 並び替え (DnD)      | Space → ↑↓ → Space (drop) | `@dnd-kit` の `KeyboardSensor` 有効化 |

**Esc で popover / dialog が閉じない**は超頻出 NG。`onKeyDown` でグローバル監視するか、Radix のような library 標準動作に乗る。

## §5 スクリーンリーダー要点 (life-editor で頻出)

### Live regions (Toast / 動的更新)

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {toastMessage}
</div>
```

`role="status"` + `aria-live="polite"` で控えめにアナウンス。エラーは `role="alert"` (assertive 同等)。

### Visual のみのアイコンボタン

```tsx
<button aria-label={t("tasks.delete")}>
  <TrashIcon aria-hidden="true" />
</button>
```

アイコンには `aria-hidden="true"`。ボタン自体に `aria-label`。テキスト併記の場合はアイコンに `aria-hidden`、テキストはそのまま。

### Heading の階層 (h1 → h2 → h3)

セクション切替時に h1 が 2 つ出ない / h3 を h1 配下にいきなり置かない。`App.tsx::activeSection` で section 変わるとき、各セクションの最上位 heading を h2 に揃える (App 全体の h1 はアプリ名)。

### Hidden だが SR に届けたい

```tsx
<span className="sr-only">{t("tasks.completedCount", { count })}</span>
```

`sr-only` (Tailwind) でビジュアル隠し / SR には届く。

## §6 motion preference (a11y 領域)

[`./motion.md`](./motion.md) で詳述。`prefers-reduced-motion: reduce` を必ず尊重。

## §7 検査ツール (実装後に確認)

- `@axe-core/react` を dev mode で常駐 (重大違反のみ console 出力)
- Chrome DevTools の Lighthouse Accessibility (CI 化検討)
- VoiceOver (macOS Cmd+F5) で 1 度実機確認 — 特に dialog / popover / 日本語の読み上げ
- キーボードのみで全機能を 1 周できるか手動テスト

## §8 a11y のよくある回避方法 (NG)

| NG                                  | 推奨                                          |
| ----------------------------------- | --------------------------------------------- |
| `div onClick`                       | `button` / `role="button"` + Enter ハンドラ   |
| `placeholder` だけで label 省略     | `<label>` を併設 (placeholder は補助のみ)     |
| `tabIndex={-1}` でフォーカス飛ばす  | フォーカス順は DOM 順で設計、`-1` は最終手段  |
| `aria-label` を全要素に乱発         | テキストがあれば `aria-label` 不要 (重複読み) |
| 色だけで状態を表現 (赤=エラー など) | アイコン or テキスト併記                      |
