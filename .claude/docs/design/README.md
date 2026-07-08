# docs/design — ClaudeDesign 用デザイン brief 置き場

ClaudeDesign (claude.ai/design) に貼るプロンプトの**正本**と、その根拠（要件・現状 UI・デザイン方針）をまとめるディレクトリ。

## 構成

| ファイル                    | 役割                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `IA.md`                     | **ナビ構成の正本**（サイドバー 本流 5 + ユーティリティ枠 2 = Settings / Trash・計 7 / header タブ / Mobile 4+More。2026-07-05 ユーザー承認） |
| `briefs/_TEMPLATE.md`       | brief の統一形式（全セッション必ず準拠）                                                                                                     |
| `briefs/_COMMON-CONTEXT.md` | 全プロンプト共通の前提ブロック（各プロンプト冒頭に**全文埋め込み**・版数管理あり）                                                           |
| `briefs/<section>.md`       | 各画面の brief（**1 セッション = 1 ファイル = 単一書込者**）                                                                                 |

## 運用原則

- **ClaudeDesign はリポジトリを読めない**。プロンプト本文は自己完結させる（パス参照・「上記参照」禁止）
- 生成 → 同期 → 移植の分業: 生成 = claude.ai/design 側 / Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- トークンの SSOT は `shared/src/styles/tokens.css`、ナビ構成の SSOT は `IA.md`。`_COMMON-CONTEXT.md` は両者に追随し、変更時は版数を上げる（正本 → \_COMMON-CONTEXT → 各 brief の順で同期・片方だけ変えない）
- **全 brief は現行実装ではなく `IA.md` の目標構成に向けてデザインする**

計画書: [`../vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`](../vision/plans/2026-07-04-claudedesign-screen-design-fanout.md)
