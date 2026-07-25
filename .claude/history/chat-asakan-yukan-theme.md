# HISTORY (chat-asakan-yukan-theme)

### 2026-07-18 - Issue #269 朝刊・夕刊テーマ全画面適用

#### 概要

提案書 `asakan-yukan-theme.html`（§6/§3）の朝刊（light = 生成り + 燈色）/ 夕刊（dark = 藍）配色を tokens.css の Chrome/Accent 群差し替えで全画面に適用し、Briefing 専用の朱/琥珀 duo トークンを新設して BriefingView に配線した。

#### 変更点

- **tokens.css**: light/dark の bg-primary/secondary/subsidebar・surface-sunken・text 3 層・border/border-strong・accent 系・hover を提案書 §6 の値へ差し替え（Functional/Data = chip/schedule/status/chart/semantic/calendar-header/mint は不変）。冒頭コメントを Cobalt Ink 系譜 → 朝刊・夕刊系譜に更新
- **Briefing duo 新設**: `--color-briefing-shu / -shu-subtle / -kohaku / -kohaku-subtle` を light/dark 両ブロックに追加し、`@theme` に `--color-lumen-briefing-*` 4 本を var() マッピング（透明落ち防止のためマッピング先行）
- **BriefingView.tsx**: 朱 = 段標バー・焦点約物・時刻数字・完了チェック・持ち越し日数 / 琥珀 = AI コメント罫と地・purpose・ルーティン札・補足ヒントに配線。汎用 hover:text-lumen-accent は据え置き
- **docs 追随**: PRINCIPLES.md Status 行 + §3.3 表（Chrome/Accent 更新 + Briefing duo 表追加）+ §3.4 例示値、palette-candidates.md に SUPERSEDED 注記
- **検証**: shared vitest 917 pass / shared tsc -b pass / web build + lint pass / role-qa 監査 PASS（hex 全数照合・コントラスト AA 計算済み）
