# Life Editor — Design System PRINCIPLES

> デザインシステム（部品層）を作る・使うときの**作成原則の SSOT**。
> CLAUDE.md §6 / `.claude/rules/frontend.md` / `.claude/docs/vision/coding-principles.md` の
> デザイン関連の不変式を 1 枚に移植・統合したもの。実装規約の正本は引き続き
> CLAUDE.md §6-7、本書は「デザインを作るときに従う原則」を集約する。
>
> Status: ACTIVE（ブランドパレット = 朝刊・夕刊（燈色 + 藍）確定・§3.3 / tokens.css 反映済み・2026-07-18 #269。旧 Cobalt + Mint のうち Chrome/Accent を置換・Mint 第2アクセントと Functional/Data は継続）
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

### 3.3 ブランドパレット — Lumen（朝刊・夕刊 系譜 / light = 燈色・dark = 藍・2026-07-18 #269）

> ✅ **確定**: 「朝刊・夕刊」エディションパレット（提案正本 = `asakan-yukan-theme.html`・全ペア WCAG AA 機械検証済み）。
> Light = **朝刊**: 生成り（卵殻色）の紙 neutrals ＋ 朝日の**燈色（ひいろ）** accent `#ad4409`。
> Dark = **夕刊**: 藍染めの夜空 neutrals ＋ 月明かりの薄藍 accent `#85aaff`。
> 旧 Cobalt Ink + Mint 系譜（2026-06-20〜07-05）の Chrome/Accent を置換。ライトミントの
> 第2アクセントは継続、旧 Notion teal-blue（`#2eaadc`）は退役済み。トークン名は `lumen-*`。
> 実体は `shared/src/styles/tokens.css`。本表と tokens.css は常に同期させる（片方だけ変えない）。

**Chrome / Accent / Semantic（テーマ可変）**

| Role           | Light     | Dark      | lumen トークン         |
| -------------- | --------- | --------- | ---------------------- |
| bg-primary     | `#fbf4e8` | `#101a2c` | `lumen-bg`             |
| bg-secondary   | `#f5ebda` | `#18243c` | `lumen-bg-secondary`   |
| bg-subsidebar  | `#f8efe1` | `#18243c` | `lumen-bg-subsidebar`  |
| surface-sunken | `#efe3cd` | `#0a1220` | `lumen-surface-sunken` |
| text-primary   | `#2b2015` | `#edf1f9` | `lumen-text`           |
| text-secondary | `#6b5a45` | `#a4b2ca` | `lumen-text-secondary` |
| text-tertiary  | `#857054` | `#75839d` | `lumen-text-tertiary`  |
| border         | `#eadec6` | `#263650` | `lumen-border`         |
| border-strong  | `#d6c3a2` | `#3c4e70` | `lumen-border-strong`  |
| accent         | `#ad4409` | `#85aaff` | `lumen-accent`         |
| accent-hover   | `#8f3807` | `#a3c0ff` | `lumen-accent-hover`   |
| on-accent      | `#ffffff` | `#0a1024` | `lumen-on-accent`      |
| accent-subtle  | `#fbe3c6` | `#1e2d4b` | `lumen-accent-subtle`  |
| hover          | `#f0e5d0` | `#22314e` | `lumen-hover`          |
| success        | `#0f7b6c` | `#4dab9a` | `lumen-success`        |
| danger         | `#d92d20` | `#ef4444` | `lumen-danger`         |

**Briefing 紙面アクセント duo — 朱 × 琥珀（テーマ可変・#269 新設）**

朱 = 行動と現在（段標・焦点約物・時刻数字・完了チェック・持ち越し日数）、琥珀 = 文脈と補足（AI コメント罫と地・purpose・ルーティン札・補足ヒント）。Briefing 紙面専用 — 汎用ボタン等の主アクセントは `lumen-accent` を使う。

| Role                   | Light     | Dark      | lumen トークン                 |
| ---------------------- | --------- | --------- | ------------------------------ |
| briefing-shu           | `#ad2f1d` | `#f0907c` | `lumen-briefing-shu`           |
| briefing-shu-subtle    | `#f7e0d6` | `#35201f` | `lumen-briefing-shu-subtle`    |
| briefing-kohaku        | `#8a5c06` | `#dcb267` | `lumen-briefing-kohaku`        |
| briefing-kohaku-subtle | `#f6e7c8` | `#2e2513` | `lumen-briefing-kohaku-subtle` |

**Mint 第2アクセント（light-green の差し色）**

| Role                   | Light     | Dark      | lumen トークン                 |
| ---------------------- | --------- | --------- | ------------------------------ |
| accent-secondary       | `#1fa56e` | `#5fd1a0` | `lumen-accent-secondary`       |
| accent-secondary-hover | `#18895b` | `#74d9af` | `lumen-accent-secondary-hover` |
| chip-mint-bg           | `#daf3e7` | `#133024` | `lumen-chip-mint-bg`           |
| chip-mint-fg           | `#0c6f4e` | `#7fe0b3` | `lumen-chip-mint-fg`           |

- **on-accent はテーマで切替**: light = 白 / dark = near-black `#0a1024`（dark accent が明るい薄藍のため白だとボタン文字が読めない）。
- **mint は差し色**: チップ / タグ / ポジティブ状態に使う。**主アクション・主選択は accent（燈色 / 薄藍）固定**。
- **task チップは旧 cobalt 系のまま維持**: chip は Functional/Data（entity 符号化）なので #269 の Chrome/Accent 置換に追随しない（routine 藍 / event 紫 / completed 緑 / progress 琥珀と同様に不変）。
- Functional/Data（status band・chart series・schedule bg・calendar-header）は**テーマ固定の符号化**として現状維持（§3.2）。

### 3.4 ライト / ダークの作り方

- **ダークは pure #000 を使わない**。ブランド色相を帯びた near-black（藍の夜空 `#101a2c`）にする。
- **ライトは clinical な pure #ffffff を避ける**（朝刊は生成りの `#fbf4e8`）。わずかな地色のほうが長時間読書で疲れない。
- chrome は light↔dark で別値を入れる（`[data-theme="dark"]` ブロック）。Functional/Data は同値のまま。
- **accent はダークで明度を上げる**（燈色 `#ad4409` → dark 薄藍 `#85aaff`）。明るくした分、**dark の on-accent は near-black に切替**（白だとコントラスト不足）。

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
