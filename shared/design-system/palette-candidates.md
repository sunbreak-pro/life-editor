# Brand Palette Candidates (2026-06-20)

> ブランドパレット 4 案の記録。視覚比較は `.claude/reports/2026-06-20-brand-palette-4options.html`（git 非追跡）。
> 生成: brand-palette workflow（6 方向探索 → 4 厳選 / WCAG AA 検証済み）。
>
> ⚠️ **SUPERSEDED（2026-07-18 #269）**: Chrome/Accent は「朝刊・夕刊」パレット（light = 燈色 / dark = 藍）に置換。現行値は `PRINCIPLES.md §3.3` / `tokens.css` を参照。Mint 第2アクセントと Functional/Data は継続。以下は当時の採用記録。
>
> ✅ **確定（2026-06-20・当時）**: **Cobalt Ink** をベースに **ライトミントの第2アクセントを追加した「B. Cobalt + Mint」** を採用。
> 確定値は `PRINCIPLES.md §3.3` + `shared/src/styles/tokens.css` に反映済み。
> 緑バリアント比較: `.claude/reports/2026-06-20-cobalt-green-variants.html`。

| #   | 案                   | ムード                               | accent (light / dark) | 状態                            |
| --- | -------------------- | ------------------------------------ | --------------------- | ------------------------------- |
| 1   | **Terracotta Press** | 温かい紙とインク、余白のクレイレッド | `#a4492a` / `#cf7a52` | 不採用                          |
| 2   | **Slate Meridian**   | 冷たいスレート、スチールインディゴ   | `#4359c4` / `#8093e8` | 不採用                          |
| 3   | **Garden Study**     | セージとオート、フォレストオリーブ   | `#4f6646` / `#9bb083` | 不採用                          |
| 4   | **Cobalt Ink**       | ほぼモノクロ＋電撃コバルト一点       | `#1f4fff` / `#5b82ff` | ✅ 採用（+ Mint 第2アクセント） |

## ✅ 採用: Cobalt + Mint（確定値）

- accent (cobalt): light `#1f4fff` / dark `#5b82ff`、on-accent light `#ffffff` / dark `#0a1024`
- accent-secondary (mint): light `#1fa56e` / dark `#5fd1a0`、chip light `#daf3e7`+`#0c6f4e` / dark `#133024`+`#7fe0b3`
- フル値は `PRINCIPLES.md §3.3` / `tokens.css` が正本。

## 1. Terracotta Press

- Light: bg `#faf6ef` / text `#2b2622` / accent `#a4492a` / on-accent `#fdf6ee` / success `#3f7d52` / danger `#b23a2e`
- Dark: bg `#1c1916` / text `#ece4d8` / accent `#cf7a52` / on-accent `#1c1916` / success `#6cbb86` / danger `#e07a6a`

## 2. Slate Meridian

- Light: bg `#f7f8fb` / text `#1c2330` / accent `#4359c4` / on-accent `#ffffff` / success `#0f7b6c` / danger `#c43d3d`
- Dark: bg `#14171f` / text `#e7eaf1` / accent `#8093e8` / on-accent `#10131a` / success `#4dab9a` / danger `#f0726f`

## 3. Garden Study

- Light: bg `#f7f5ef` / text `#2b2e26` / accent `#4f6646` / on-accent `#f7f5ef` / success `#3f7d4f` / danger `#b3402f`
- Dark: bg `#1c1f1a` / text `#ecebe0` / accent `#9bb083` / on-accent `#1c1f1a` / success `#7fc08a` / danger `#e0796a`

## 4. Cobalt Ink

- Light: bg `#fafafa` / text `#1a1a1f` / accent `#1f4fff` / on-accent `#ffffff` / success `#0f7b6c` / danger `#d92d20`
- Dark: bg `#16161a` / text `#f2f2f5` / accent `#5b82ff` / on-accent `#0a1024` / success `#4dab9a` / danger `#ef4444`

> 各案フル値（bg-secondary / subsidebar / border / border-strong / accent-hover）は HTML ビューと workflow 出力に保持。確定案のみ tokens.css へ転記する。
