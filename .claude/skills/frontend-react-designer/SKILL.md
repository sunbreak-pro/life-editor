---
name: frontend-react-designer
description: life-editor の React UI を新規作成・改修する際のデザイン判断ガイド。`lumen-*` トークン体系・Pattern A・Mobile Optional Provider・WAI-ARIA・motion・UI 状態 4 種を満たし、Anti-Pattern (透明落ち / 紫グラデ / 過剰 micro-interaction / a11y 欠落 / IME 破壊) を回避する。Use when building or refining React components, panels, dialogs, popovers, dropdowns, forms, lists, schedule blocks, or any visible UI in the life-editor frontend. Triggers include `UI 改善`, `デザイン整える`, `見た目を直す`, `アクセシビリティ`, `アニメーション追加`, `フォーム作成`, `スタイル調整`, `ダークモード対応`, `redesign`, `polish`, `accessibility audit`. 実装の機構 (file 配置 / Provider 登録) は `add-component` スキル側で扱うため、本スキルはデザイン判断・状態設計・a11y・モーションに集中する。
---

「frontend-react-designerを起動します」と表示する。

## このスキルの essence

> **このスキルは life-editor の React UI が "AI slop" に陥るのを防ぎ、`lumen-*` トークン体系と Pattern A 規約に整合した、操作可能でアクセシブルな UI を作るために存在する。**

life-editor は N=1 個人用ツール。市販の見た目より「作者にとって毎日使って疲れない密度・コントラスト・状態応答」が優先される。Claude が知っている一般 React/CSS 知識ではなく、life-editor 固有の規約 + Claude が省略しがちな部分のみをここに集約する。

スコープ境界:

- 機構（どのフォルダに何を置くか / Provider 登録）→ 配置と規約 = `rules/frontend.md` + CLAUDE.md §3.1
- DB → `docs/vision/db-conventions.md` + CLAUDE.md §7.3（旧 add-component / add-feature / add-ipc-channel / db-migration スキルは STALE・書き直しは #1336）
- 本スキル → **見た目・状態・a11y・motion の判断**（新規 UI 作成 **および既存 UI の系統的 remediation 両方**）

> ⚠️ **UI 2 層モデル（W0 2026-06-07 確定 = 案 A）**: `frontend/`（Tauri 時代）は **削除済み（2026-07-11 #197）**。新規 UI は `shared/src/components/` に集約し、Web / Electron / Capacitor が同一ソースを共用する（トークン / i18n も `shared/` 側）。本スキルは greenfield 作成だけでなく、既存 UI を本ガイドの基準に揃える remediation でも同じ判断軸を適用する。改修時は Anti-Patterns を「これから書かない」ではなく「既存から検出し直す」チェックリストとして使う（SSOT → CLAUDE.md §6 / `.claude/rules/frontend.md`）。

## ワークフロー (5 ステップ)

UI を新規作成または改修する依頼を受けたら、必ず以下を順に実施:

### 1. 目的とトーンを 1 行で言語化

「この UI が解決する具体的問題」と「何を一瞬で識別させたいか」を 1 行で書き出す。
life-editor のトーンは **Lumen calm minimal**（cobalt ink + mint 系。旧 Notion teal は retired）。派手な背景・装飾フォント・ネオン色は不採用。

### 2. データ状態の網羅 (Loading / Empty / Error / Idle)

UI を書く前に 4 状態すべてを設計する。Claude は Idle (データあり) だけを書きがち。詳細 → [`references/ui-states.md`](references/ui-states.md)

### 3. アクセシビリティの基線確認

WCAG 2.2 / フォーカス可視 / WAI-ARIA 3 点セット (`htmlFor` + `aria-describedby` + `aria-invalid`) / IME 安全。詳細 → [`references/accessibility.md`](references/accessibility.md)

### 4. トークンとスタイル

`lumen-*` トークン以外の hex / rgb 直書き禁止、不透明強制、`color-mix()` で alpha。詳細 → [`references/tokens-and-styling.md`](references/tokens-and-styling.md)

### 5. motion を控えめに加える

`prefers-reduced-motion` 尊重、既存 keyframes (`check-pop` / `slide-up` 等) 流用、duration 100-300ms 帯のみ。詳細 → [`references/motion.md`](references/motion.md)

## Anti-Patterns (life-editor 固有・絶対回避)

これらは Claude が自然に書いてしまうため、明示的に避ける:

1. **未定義トークンによる透明落ち**: `bg-lumen-bg-popover` `bg-lumen-surface-2` のように `shared/src/styles/tokens.css` に存在しないトークンを書くと Tailwind v4 は silent fail で透明になる。新トークンを使う前に必ず `shared/src/styles/tokens.css` の `@theme` ブロックに追加する。許容済みトークンは [`references/tokens-and-styling.md`](references/tokens-and-styling.md) §1 を参照。

2. **ポップオーバー / ドロップダウン / メニュー / ダイアログ本体に `bg-*\/70` `bg-*\/80` + `backdrop-blur`**: vision/coding-principles.md §5 で禁止。ガラス UI は不採用。本体は `bg-lumen-bg` または `bg-lumen-bg-secondary` の不透明のみ。

3. **`Inter` / `Roboto` / `Arial` / 紫グラデ / 中央揃え多用**: 公式 frontend-design が "AI slop" として挙げる代表例。life-editor は `--font-sans` の system stack 既定を尊重し、装飾フォントは導入しない。色も `lumen-accent` (cobalt blue 系 #1d4ed8) を主軸に保つ。

4. **`onChange` 時の即時 commit で IME 破壊**: 日本語入力で確定前の文字列で onSubmit / API 送信が走ると IME が壊れる。`e.nativeEvent.isComposing` を必ずチェック。Enter キーハンドラも同様。詳細 → [`references/ui-states.md`](references/ui-states.md) §3。

5. **共有コンポーネントから直接 `useFooContext()` (必須版) を呼ぶ**: Mobile で Provider が無い箇所では crash。Mobile 省略 Provider に依存する共有 UI は `useFooContextOptional()` を呼び `if (!ctx) return null` でガードする。**WikiTag / SidebarLinks は Mobile でも有効なので gate 不要**。省略対象 Provider の一覧は CLAUDE.md §2 が SSOT（数を本ファイルに複製しない — 過去に CalendarTags 撤去で不一致が発生）。Provider 順序 → `.claude/rules/frontend.md`。

6. **Loading でいきなりスピナー全画面**: 既存データがある再フェッチでは stale indicator (Toast 連携) のみ。初回ロードのみ skeleton または spinner。詳細 → [`references/ui-states.md`](references/ui-states.md) §1。

7. **focus outline を `outline-none` で消したまま放置**: キーボード操作不可になる。必ず `focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2` 等で代替を提供。詳細 → [`references/accessibility.md`](references/accessibility.md) §2。

8. **アニメーションを scattered に多発**: hover で個別に scale / rotate / shadow を散らすと "AI ぽい". `slide-up` / `check-pop` のような **イベントの瞬間に 1 つだけ** 効かせる。詳細 → [`references/motion.md`](references/motion.md) §2。

9. **`hex` / `rgba()` 直書き**: `lumen-*` トークン以外は禁止。alpha は `color-mix()` または許容済みの `bg-lumen-accent/10` などのトークン + opacity で表現。

10. **Dark mode 想定漏れ**: `[data-theme="dark"]` で `:root` 変数だけが切り替わる仕組み。コンポーネント側で `dark:` プレフィックスを使ってはいけない (Tailwind v4 既定 + life-editor は `data-theme` 駆動)。`lumen-*` トークンを使えば自動で両対応。

## i18n / IME 注意点 (規約再確認)

- 全テキストは `t('namespace.key')` 経由。en.json と ja.json の両方に同時追加。
- フック内では `useTranslation()` を呼ばず props 経由で文字列を受ける（`.claude/rules/frontend.md` デザイン規約）。
- Composition イベント中 (`e.nativeEvent.isComposing === true`) は Enter / Tab で確定処理を走らせない。

## 仕上げチェック (PR を出す前)

- [ ] Loading / Empty / Error / Idle 4 状態を実装した
- [ ] WCAG 2.2 4.5:1 (大テキスト 3:1) を満たすコントラスト
- [ ] focus-visible スタイルが見える
- [ ] keyboard で全操作可能 (Tab / Esc / 矢印)
- [ ] IME 中の操作で破壊されない (input / textarea / Tiptap)
- [ ] `prefers-reduced-motion: reduce` でアニメーション停止
- [ ] light / dark 両方で確認 (`data-theme="dark"` 切替)
- [ ] Mobile で必要なら Optional Provider gate を入れた
- [ ] ハードコード色 / 未定義 `lumen-*-*` トークンが無い (`grep -rn "bg-lumen-bg-[a-z]" shared/src --include='*.tsx' | sort -u` で確認)
- [ ] i18n テキストを en / ja 両方追加した

## 参考: なぜこのスキルの粒度が適切か

公式 Anthropic skills (`frontend-design` / `theme-factory` / `web-artifacts-builder`) は意図的に分割されているが、それは想定ユーザが多様で「Create / Transform / Stack 初期化」が排他的に発火するから。life-editor は N=1 個人用で Create と既存 remediation が中心、shadcn/ui ではなく独自トークンを使うため、Theme Factory に相当するスキルは不要。横断的な自動監査 (E3 Guard) や Storybook 連携が必要になった段階で `frontend-react-reviewer` を別スキルとして切り出す（本スキルは判断軸、reviewer は機械的検出を担う想定）。
