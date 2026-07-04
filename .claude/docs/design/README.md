# docs/design — ClaudeDesign 用デザイン brief 置き場

ClaudeDesign (claude.ai/design) に貼るプロンプトの**正本**と、その根拠（要件・現状 UI・デザイン方針）をまとめるディレクトリ。

## 構成

| ファイル                    | 役割                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `briefs/_TEMPLATE.md`       | brief の統一形式（全セッション必ず準拠）                             |
| `briefs/_COMMON-CONTEXT.md` | 全プロンプト共通の前提ブロック（各プロンプト冒頭に**全文埋め込み**） |
| `briefs/<section>.md`       | 各画面の brief（**1 セッション = 1 ファイル = 単一書込者**）         |

## 運用原則

- **ClaudeDesign はリポジトリを読めない**。プロンプト本文は自己完結させる（パス参照・「上記参照」禁止）
- 生成 → 同期 → 移植の分業: 生成 = claude.ai/design 側 / Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- トークンの SSOT は `shared/src/styles/tokens.css`。`_COMMON-CONTEXT.md` の palette 表は tokens.css と同期させる（片方だけ変えない）

計画書: [`../vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`](../vision/plans/2026-07-04-claudedesign-screen-design-fanout.md)
