# Life Editor — Design System PRINCIPLES

> デザインシステム（部品層）を作る・使うときの**作成原則の SSOT**。
> CLAUDE.md §6 / `.claude/rules/frontend.md` / `.claude/docs/vision/coding-principles.md` の
> デザイン関連の不変式を 1 枚に移植・統合したもの。実装規約の正本は引き続き
> CLAUDE.md §6-7、本書は「デザインを作るときに従う原則」を集約する。
>
> Status: ACTIVE（ブランドパレット = Cobalt + Mint 確定・§3.3 / tokens.css 反映済み・2026-06-20）
> Home: `shared/design-system/`（部品・トークンと同じ `shared/` 配下に集約）

---

## 0. 目的とスコープ

- **対象**: 全配布形態（Web / Electron / Capacitor）で共有する**部品層**（ボタン / 入力 / カード / モーダル / シート / `lumen-*` トークン）。
- **非対象**: 各機能の画面組み立て（画面層）は機能特性で判断する（§4.1）。本書は「部品とトークンの作法」に限定する。
- **読者**: このデザインシステムで UI を作る人（人間 / AI）。迷ったら本書の不変式に従う。

---

## 1. 第一原則（破ってはいけない不変式トップ 6）

1. **色は必ずトークン経由**。`lumen-*` トークンのみ使用し、hex / Tailwind 既定色（`bg-blue-500` 等）を部品に直書きしない（§3.1）。
2. **主要 UI コンテナの背景に透明度を使わない**。ポップオーバー / メニュー / ダイアログ / カード / パネル本体は完全不透明トークンで塗る（§3.5）。
3. **新規 UI は `shared/src/components/` に集約**。`frontend/`（Tauri 時代）は FROZEN。3 配布形態が同一ソースを共用する（§4.2）。
4. **i18n は props 経由**。共有部品のフック内で `useTranslation()` を呼ばない。文言は en / ja 両 catalog に必ず追加（§6）。
5. **DataService はコールバック注入**。部品 / フック内で `getDataService()` を直呼びしない。
6. **本文テキストは WCAG AA（≥ 4.5:1）**。色を決めるときコントラストを検証する（§3.6）。

---

## 2. トークンの全体像

トークン実体は **`shared/src/styles/tokens.css`** が SSOT。構造は 3 層:

```
:root { --color-*  }          ← ライトテーマの生値（hex）
[data-theme="dark"] { … }     ← ダークテーマの差分（生値）
@theme { --color-lumen-* }   ← 上記を lumen-* セマンティック名にマッピング（Tailwind が読む）
```

部品が触ってよいのは **`lumen-*`（@theme 層）だけ**。生の `--color-bg-primary` 等を直接参照しない。
未定義の `bg-lumen-*` クラスは **silent fail で透明落ち**するので、使う色は必ず `@theme` に定義してから使う。

---

## 3. カラーシステム

### 3.1 トークン経由のみ（ハードコード禁止）

- ✅ `bg-lumen-bg` / `text-lumen-text` / `bg-lumen-accent` / `text-lumen-on-accent`
- ❌ `bg-[#2eaadc]` / `bg-sky-500` / `style={{ background: '#fff' }}`（部品では禁止）
- 新しい色が要るなら**まずトークンを足す**（§8 の手順）。部品側で hex を生やさない。

### 3.2 4 つの役割カテゴリ（重要）

色は役割で 4 つに分け、**テーマ可変かテーマ固定かが違う**。混同すると light/dark で破綻する。

| カテゴリ              | 例                                                          | テーマ                             | 意味                                                           |
| --------------------- | ----------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| **Chrome（地）**      | bg-primary / bg-secondary / text / border / hover           | **可変**（light↔dark で別値）      | アプリの下地・文字・枠。テーマで色が変わる                     |
| **Brand / Accent**    | accent / accent-hover / on-accent / accent-subtle           | **可変**                           | 選択状態・主ボタン・リンク。ブランドの主張                     |
| **Semantic**          | success / danger                                            | **可変**（彩度・明度をテーマ調整） | 肯定 / 破壊。意味を持つ                                        |
| **Functional / Data** | status band（todo/progress/done）/ chart series / chip 各色 | **固定**（light/dark 同値）        | 状態やデータを符号化する。テーマで変えると意味がブレるので固定 |

- **on-accent は白固定**でよい（accent 上で両テーマとも読めるため `tokens.css` でも共有）。
- **Functional / Data 系を新規追加するときは light/dark 同値**にする（既存の status band / chart series がそうなっている）。

### 3.3 ブランドパレット — Lumen（Cobalt Ink + Mint 系譜 / accent は Lumen blue・2026-07-04）

> ✅ **確定**: ほぼモノクロのコバルトグレー neutrals ＋ Lumen blue 系（accent は blue-700 `#1d4ed8`。
> ホバー背景上の accent 文字も WCAG AA 4.5:1 を満たす深さ）の主アクセント ＋
> ライトミントの第2アクセント。旧 Notion teal-blue（`#2eaadc`）は退役。トークン名は `lumen-*`。
> 実体は `shared/src/styles/tokens.css`。本表と tokens.css は常に同期させる（片方だけ変えない）。

**Chrome / Accent / Semantic（テーマ可変）**

| Role           | Light     | Dark      | lumen トークン         |
| -------------- | --------- | --------- | ---------------------- |
| bg-primary     | `#fafafa` | `#16161a` | `lumen-bg`             |
| bg-secondary   | `#f1f1f3` | `#1e1e23` | `lumen-bg-secondary`   |
| bg-subsidebar  | `#f5f5f6` | `#1e1e23` | `lumen-bg-subsidebar`  |
| text-primary   | `#1a1a1f` | `#f2f2f5` | `lumen-text`           |
| text-secondary | `#5c5c66` | `#a0a0ad` | `lumen-text-secondary` |
| border         | `#e3e3e7` | `#2e2e35` | `lumen-border`         |
| border-strong  | `#cfcfd6` | `#44444d` | `lumen-border-strong`  |
| accent         | `#1d4ed8` | `#5b8cff` | `lumen-accent`         |
| accent-hover   | `#1e40af` | `#7aa2ff` | `lumen-accent-hover`   |
| on-accent      | `#ffffff` | `#0a1024` | `lumen-on-accent`      |
| accent-subtle  | `#dbeafe` | `#21273f` | `lumen-accent-subtle`  |
| hover          | `#e8e8ec` | `#2a2a31` | `lumen-hover`          |
| success        | `#0f7b6c` | `#4dab9a` | `lumen-success`        |
| danger         | `#d92d20` | `#ef4444` | `lumen-danger`         |

**Mint 第2アクセント（light-green の差し色）**

| Role                   | Light     | Dark      | lumen トークン                 |
| ---------------------- | --------- | --------- | ------------------------------ |
| accent-secondary       | `#1fa56e` | `#5fd1a0` | `lumen-accent-secondary`       |
| accent-secondary-hover | `#18895b` | `#74d9af` | `lumen-accent-secondary-hover` |
| chip-mint-bg           | `#daf3e7` | `#133024` | `lumen-chip-mint-bg`           |
| chip-mint-fg           | `#0c6f4e` | `#7fe0b3` | `lumen-chip-mint-fg`           |

- **on-accent はテーマで切替**: light = 白 / dark = near-black `#0a1024`（dark accent が明るいコバルトのため白だとボタン文字が読めない）。
- **mint は差し色**: チップ / タグ / ポジティブ状態に使う。**主アクション・主選択は cobalt 固定**。
- **task チップは accent をミラー**: 旧 teal だったので cobalt 系に再調整済み（他の chip = routine 藍 / event 紫 / completed 緑 / progress 琥珀は entity 別色なので不変）。
- Functional/Data（status band・chart series・schedule bg・calendar-header）は**テーマ固定の符号化**として現状維持（§3.2）。

### 3.4 ライト / ダークの作り方

- **ダークは pure #000 を使わない**。ブランド色相を帯びた near-black（`#16161a`）にする。
- **ライトは clinical な pure #ffffff を避ける**（cobalt mono でも `#fafafa`）。わずかな地色のほうが長時間読書で疲れない。
- chrome は light↔dark で別値を入れる（`[data-theme="dark"]` ブロック）。Functional/Data は同値のまま。
- **accent はダークで明度を上げる**（`#1d4ed8` → dark `#5b8cff`）。明るくした分、**dark の on-accent は near-black に切替**（白だとコントラスト不足）。

### 3.5 透明度ポリシー（coding-principles §5 を移植）

**主要 UI コンテナの背景に透明度は使わない**。本体背景は完全不透明トークンで塗る。

許容する透明（意匠として継続）:

- ホバー feedback（`hover:bg-lumen-hover`）
- モーダル背後のバックドロップ（`bg-black/30` 等）
- アクセントの薄塗りチップ選択状態（`bg-lumen-accent/10` 等）
- ボーダー / リング装飾（`border-lumen-border/60` 等）
- disabled / dragging（`opacity-50` 等）／ 影（`shadow-*`）

禁止:

- ❌ 未定義の `bg-lumen-bg-popover`（→ 透明落ち）
- ❌ ポップオーバー本体に `bg-*/70` `bg-*/80`（コントラスト不足）
- ❌ メインコンテナの `backdrop-blur-*`（OS 半透過は不採用）

### 3.6 アクセシビリティ（コントラスト）

- **本文テキスト / bg**: WCAG AA ≥ 4.5:1（必達）。
- **secondary テキスト / bg**: ≥ 4.5:1 を目標、最低 3:1。
- **on-accent / accent**: ≥ 4.5:1（ボタン文字が読めること）。
- 色だけで状態を伝えない（status はバンド + ラベル / 形でも区別）。

---

## 4. レイアウトと部品

### 4.1 UI 2 層モデル（coding-principles §6 を移植）

| 層                             | 内容                                                            | 共通化方針                                                      |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **部品層（デザインシステム）** | ボタン / 入力 / カード / モーダル / シート / `lumen-*` トークン | **全環境で完全共通**（`shared/src/components/`）                |
| **画面層（レイアウト）**       | 各機能画面の組み立て                                            | **機能特性で判断**：単純 = レスポンシブ単一 / 複雑 = 環境別分割 |

- 単純画面（縦並びリスト: Settings / Trash / Notes / Daily）= 1 コンポーネントを幅で伸縮。
- 複雑画面（PC とスマホで操作モデルが別物: Schedule カレンダー / Tasks DnD ツリー / Work タイマー）= 環境別に分割。
- 迷ったら単一で始め、必要になってから分割する（やりすぎ回避）。

### 4.2 集約先（W0 案 A）

- 部品: `shared/src/components/`（barrel `index.ts` → `shared/src/index.ts`）
- トークン: `shared/src/styles/tokens.css`（host が `@import` + `@source` でスキャン）
- i18n: `shared/src/i18n/`（catalog + init）
- `frontend/`（Tauri 時代）は **FROZEN**。新規はすべて `shared/`。

### 4.3 Context/Provider Pattern A（3 ファイル）

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

- 内側 Provider は外側 Context に依存可（逆不可）。
- DataService 依存はコールバック注入。ジェネリクスで型を外部化。
- 自己完結する小規模 Context は単一ファイル可（`ToastContext` 等）。

### 4.4 Mobile Optional Providers

- Mobile 省略 Provider（Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig）に依存する共有部品は **Optional バリアント必須**。
- 必須 hook（`createContextHook`）= Provider 外で throw（Desktop 用）。
- Optional hook（`createOptionalContextHook`）= Provider 外で null → 共有部品側で `if (!ctx) return null` ガード。

---

## 5. タイポグラフィ & スケーリング

- フォント: `--font-sans`（system stack。`-apple-system` / `Segoe UI` 等）。
- **10-step font-size システム**: ルート `--font-size-base`（既定 16px）を 1 つ変えると全体が拡縮する相対 em 設計。
- ユーティリティ: `.text-scaling-xs / sm / base / lg / xl`（em ベース・line-height 同梱）。
- 部品はサイズを px 直書きせず、em / スケーリングユーティリティに乗せる。

---

## 6. i18n

- **共有部品のフック内で `useTranslation()` を呼ばない**。文言は **props 経由**で受け取る。
- `useTranslation` を使ってよいのは**画面層（アプリ側）だけ**。`shared` は singleton 解決のため i18next を再エクスポートするのみ。
- 文言追加は **en / ja 両 catalog**（`shared/src/i18n/locales/`）に同時に入れる。片方だけは不可。

---

## 7. Gotchas（デザイン実装でハマる箇所）

- **IME（日本語入力）**: keydown 処理に `e.nativeEvent.isComposing` チェック必須（変換確定の Enter で誤発火しない）。
- **silent transparent fail**: 未定義 `bg-lumen-*` は透明落ち。色は `@theme` 定義後に使う。
- **DnD（@dnd-kit）**: `moveNode`（並び替え）と `moveNodeInto`（階層移動）は別操作。混同しない。
- **AudioContext**: `suspended` 開始。ユーザー操作後に `resume()` 必須（音系部品）。
- **リッチテキスト**: TipTap を使用。

---

## 8. 新しいトークン / 色を足す手順

1. `tokens.css` の `:root` に生値（light）を追加。
2. `[data-theme="dark"]` に dark 値を追加（Functional/Data 系なら light と同値で OK）。
3. `@theme` に `--color-lumen-<name>: var(--color-<name>);` のマッピングを追加。
4. 部品からは `bg-lumen-<name>` / `text-lumen-<name>` で参照。
5. コントラスト検証（§3.6）。本文・on-accent は AA を満たすか確認。
6. PR で `tokens.css` と本書 §3.3 を同時更新（色の SSOT を 2 箇所で食い違わせない）。

---

## 9. 関連ドキュメント

- 実装規約の正本: `CLAUDE.md §6-7`
- path-scoped フロント規約: `.claude/rules/frontend.md`
- 設計原則の「なぜ」: `.claude/docs/vision/coding-principles.md`
- トークン実体: `shared/src/styles/tokens.css`
- 部品: `shared/src/components/`
