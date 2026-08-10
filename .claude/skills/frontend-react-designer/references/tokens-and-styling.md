# Tokens & Styling — life-editor `lumen-*` 体系 + Tailwind v4

> 既存トークン一覧、不透明強制、`color-mix()` で alpha、ダークテーマ自動切替、タイポ階層。

## §1 既存 `lumen-*` トークン (`shared/src/styles/tokens.css` `@theme` 定義済み)

新規 UI でハードコードせず、必ず以下のいずれかを使う。

### Color tokens

| トークン                                  | 用途                             |
| ----------------------------------------- | -------------------------------- |
| `bg-lumen-bg` / `text-lumen-bg`           | Primary 背景 (アプリ最背面)      |
| `bg-lumen-bg-secondary`                   | Secondary 背景 (パネル / カード) |
| `bg-lumen-bg-subsidebar`                  | Sub-sidebar 背景                 |
| `text-lumen-text`                         | 本文テキスト                     |
| `text-lumen-text-secondary`               | 補助テキスト (見出しサブ等)      |
| `border-lumen-border`                     | 境界線                           |
| `text-lumen-accent` / `bg-lumen-accent`   | アクセント (cobalt blue 系)      |
| `bg-lumen-hover`                          | hover 背景 feedback              |
| `bg-lumen-hover-strong`                   | hover 背景 (強調 / active)       |
| `bg-lumen-bg-hover`                       | 背景 hover (bg 系の派生)         |
| `text-lumen-primary` / `bg-lumen-primary` | primary（操作主色）              |
| `text-lumen-secondary`                    | secondary（補助操作色）          |
| `text-lumen-success` / `bg-lumen-success` | 成功 (green)                     |
| `text-lumen-danger` / `bg-lumen-danger`   | エラー (red)                     |
| `text-lumen-calendar-header`              | カレンダー header 強調           |

> 上記は代表的な色トークン。トークン定義の SSOT は `shared/src/styles/tokens.css` の `@theme` ブロック（chip / schedule / status band / info / warning / surface-sunken / text-tertiary 等も含む）。**個数は本ファイルに複製せず**、全一覧は `grep -oE '\-\-color-lumen-[a-z0-9-]+' shared/src/styles/tokens.css | sort -u` を正とする（併せて `--radius-lumen-*` / `--spacing-lumen-*` / `--shadow-lumen-*` も定義）。ここに載らない `lumen-*` 名は未定義＝透明落ち。

### 派生 (chip / schedule)

`@theme` には登録されていないが `:root` / `[data-theme="dark"]` の CSS variable として存在し、コンポーネント内 `style={{ color: 'var(--color-chip-routine-fg)' }}` で参照する。Tailwind class 化したい場合は `@theme` に追加してから使う。

### Font

- `--font-sans`: system stack (`ui-sans-serif`, `BlinkMacSystemFont`...) — そのまま `font-sans` で。装飾フォント (`Inter` 等) を **追加しない**
- `--font-size-base`: 16px (theme で 10 段階 12-25px 切替可能、ユーザ設定)

## §2 トークン使用ルール

### 必須

- 色 / 背景 / 枠線は `lumen-*` か CSS variable のみ。**ハードコード `#hex` / `rgb()` / `rgba()` 禁止**
- ダークテーマ対応は `lumen-*` トークンを使うだけで自動 (CSS variable が `[data-theme="dark"]` で切り替わる)。`dark:` プレフィックスは **使わない** (life-editor は data-theme 駆動)

### 透明度の使用方針 (vision/coding-principles.md §5)

- ❌ 主要 UI コンテナ本体: `bg-*\/70` `bg-*\/80` + `backdrop-blur` (popover / dropdown / menu / dialog / panel)
- ❌ 未定義トークン: `bg-lumen-bg-popover` `bg-lumen-surface-2` 等 → silent fail で透明落ち
- ✅ ホバー feedback: `hover:bg-lumen-hover`
- ✅ モーダル背後 backdrop: `bg-black/30`
- ✅ アクセント薄塗り (chip / 選択状態): `bg-lumen-accent/10`
- ✅ ボーダー / リング: `border-lumen-border/60`、`ring-lumen-accent/40`
- ✅ disabled / dragging: `opacity-50` / `opacity-30`
- ✅ shadow: `shadow-*` (透明度ベースだが視認性貢献)

### 新トークン追加手順

1. `shared/src/styles/tokens.css` の `:root` (light) と `[data-theme="dark"]` (dark) の **両方** に CSS variable を追加
2. `@theme` ブロックに `--color-lumen-foo: var(--color-foo)` を追加 (Tailwind class 化したい場合)
3. PR で `vision/coding-principles.md §5` の更新が必要か確認 (透明度関連なら更新)

## §3 Tailwind v4 (CSS-first) の注意点

life-editor は **Tailwind v4.1.18** を使用 (`tailwind.config.js` は **存在しない**)。

### v3 と異なる点

- 設定は `shared/src/styles/tokens.css` の `@theme` で行う (JS config ではない)
- `dark:` プレフィックスのデフォルト挙動は `prefers-color-scheme`。life-editor は `data-theme` 駆動なので `dark:` は使わず CSS variable に任せる
- `@apply` は使えるが `@reference` ディレクティブが必要な場面あり (component file 内では推奨しない)
- `color-mix()` ベースの alpha (`bg-lumen-accent/10` 等) は Tailwind が自動展開
- `@import "tailwindcss"` 1 行で v3 の preflight + utilities が読み込まれる

### よくある v3 → v4 まちがい

- ❌ `tailwind.config.js` を増やす → ❌ 全く使われない (v4 では無視)
- ❌ `purge` / `content` 設定を書く → 不要 (v4 自動検出)
- ❌ `@layer components` で巨大な `@apply` ブロック → 必要なら可だが、最小限に

## §4 タイポ階層

life-editor は `--font-size-base` をユーザがテーマ設定で 12-25px の 10 段階で変更できる。コンポーネント側は **絶対値ピクセル指定を避け、相対単位 (rem) または Tailwind text-\* utility を使う**。

| 用途         | Tailwind            | 補足                     |
| ------------ | ------------------- | ------------------------ |
| 大見出し     | `text-2xl` 以上     | section header (h2 相当) |
| 中見出し     | `text-lg` `text-xl` | サブセクション           |
| 本文         | `text-base`         | 既定                     |
| 補助テキスト | `text-sm`           | 説明 / メタ情報          |
| Tiny / chip  | `text-xs`           | tag / chip / counter     |

`text-[14px]` のような任意値ハードコードは避ける (ユーザ設定追従不可)。

## §5 spacing / radius / shadow

### spacing

Tailwind 既定 (4px grid) を使う。`p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px) が頻出。`p-[7px]` のような任意値は避ける。

### radius

| トークン       | 推奨用途               |
| -------------- | ---------------------- |
| `rounded-sm`   | chip / inline marker   |
| `rounded-md`   | button / input / card  |
| `rounded-lg`   | dialog / sheet / panel |
| `rounded-full` | avatar / circular icon |

life-editor は **全要素を一律で `rounded-2xl` にしない** (公式 frontend-design が指摘する AI slop の典型)。

### shadow

| トークン         | 用途                        |
| ---------------- | --------------------------- |
| `shadow-sm`      | 軽い浮き (chip / row hover) |
| `shadow`         | card / panel                |
| `shadow-lg`      | dialog / popover            |
| `shadow-xl` 以上 | 控えめに使う                |

## §6 dark mode 確認 (実装後)

- [ ] light / dark 両方で見た目を確認 (`data-theme="dark"` を `<html>` に切替)
- [ ] 純白 / 純黒のハードコードが無い (`text-white` `bg-black` は OK だが文脈確認)
- [ ] 影 / グラデーションが両モードで違和感ない
- [ ] icon / illustration が両モードで視認可能 (SVG は `currentColor` を使う)

## §7 検出コマンド (PR 前)

```bash
# 未定義 lumen-bg-* (透明落ちリスク)
grep -rn "bg-lumen-bg-[a-z]" shared/src --include='*.tsx' | sort -u

# ハードコード hex (ハイフンや文字列内の # 除外)
grep -rnE "['\"]#[0-9a-fA-F]{3,8}['\"]" shared/src --include='*.tsx' | head

# `dark:` プレフィックス使用 (life-editor は使わない)
grep -rn "dark:" shared/src --include='*.tsx' | head
```

## §8 NG パターン早見

| NG                                           | 推奨                                             |
| -------------------------------------------- | ------------------------------------------------ |
| `bg-[#ffffff]` / `style={{ color: '#xxx' }}` | `bg-lumen-bg` / トークン                         |
| `bg-lumen-bg-popover` (未定義)               | `bg-lumen-bg`                                    |
| `dark:bg-zinc-900`                           | `bg-lumen-bg-secondary` (data-theme 自動切替)    |
| 全要素 `rounded-2xl`                         | 用途別に sm / md / lg を使い分け                 |
| `Inter` / `Roboto` フォント追加              | `font-sans` (system stack) を尊重                |
| 紫グラデ on white                            | 単色トークン背景 + 必要なら subtle gradient のみ |
