# Outbox — chat-lumen-shared

> 発信箱（書くのは本人のみ・読むのは全員）。最新が上。

---

## 2026-07-03 — Lumen 移植: 2回目独立 QA PASS + polish（PR #113 更新済み）

- 確定コミット差分に対し role-qa（別コンテキスト）で 2 回目監査 → **PASS / Blocking 0**。AC①〜④を実測再検証（shared build 0・test 526・web build 0）、越境なし（frontend/ と connect/analytics/perf-data/schedule 未変更）
- QA 指摘のうち 2 点を反映: (1) MenuItem doc に「選択後の close はホスト責務」を明記、(2) Menu の idx=-1 経路（未フォーカス ArrowUp→末尾）を直接テスト化
- 見送り（挙動バグでなく merge 非ブロック）: keydown effect の onClose 依存での再登録（軽微 perf）／ Sheet focus-trap の offsetParent 判定
- 🛑 draft PR #113 の merge はユーザー判断のまま

## 2026-07-02 — Lumen UI 出荷部品を shared に移植 + デザイントークン橋渡し（draft PR 済み）

**ブランチ**: `feat/lumen-shared-port`（origin/main 基点） / **QA**: role-qa 独立レビュー PASS（Blocking 0）

### やったこと

ClaudeDesign(Lumen) カタログの 4 部品を `shared/src/components/` に出荷 UI として新規実装し、前段でトークンの不足分を橋渡しした。

- **tokens.css**: 機能色 `info` / `warning`、`surface-sunken`、第3テキスト階調 `text-tertiary` を light+dark 両方に追加（@theme で `ink-*` マッピング）。`radius-ink-*` / `spacing-ink-*` スケールを @theme に単一定義（テーマ不変）。shadow は既存 `shadow-ink-*` を流用
- **新4部品**: `Toast`(+`ToastViewport`) / `Sheet`(多方向ドロワー) / `Sidebar`(+`SidebarItem`) / `Menu`(+`MenuItem`)。全て純プレゼン層・ink-* トークンのみ・props 注入 i18n

### 他レーンへの影響（重要）

- **触ったのは `shared/` 配下のみ**（tokens.css / 新規部品4 / components barrel `index.ts` / tests）。`frontend/` は未変更。connect / analytics / perf-data / schedule レーンのファイルは未変更
- **barrel `shared/src/components/index.ts` は追記のみ**（既存 export 不変）。**`tokens.css` も追記のみ**（既存トークン不変・改名なし）。もし同ファイルを触るレーンがあれば追記同士の軽微な conflict になりうるが、既存行は動かしていない
- 既存 `SidebarNav`/`NavItem`・`BottomSheet` は**据え置き**。新 `Sidebar`/`Sheet` は別責務（Lumen グルーピング nav / 多方向ドロワー）として並存

### 使い方メモ

- 新トークンを使いたい他レーンは `bg-ink-info` / `bg-ink-warning` / `bg-ink-surface-sunken` / `text-ink-text-tertiary` / `rounded-ink-*` / `p-ink-*` 等で参照可（surface-sunken と spacing は現状未使用なので使った瞬間 Tailwind が emit）
- `Menu` はトリガーを素朴なトグル配線にしない（outside-pointerdown が click 前に閉じて再オープンする罠。doc コメント参照）

### 検証

`cd shared && npm run build` → 0 / `npm run test` → 525 passed(46 files) / `cd web && npm run build` → 0。新部品に hex ハードコード 0。

### 残タスク

- 🛑 **draft PR の merge はユーザー判断**（人手ゲート）
- 任意 polish: 既存 nav/sheet プリミティブとの使い分け指針を PRINCIPLES に一行追記（role-qa の Non-blocking 提案）
