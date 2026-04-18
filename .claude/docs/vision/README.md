# Vision

実装計画書として具体化しきれていない構想・ビジョン・抽象的な設計思想を置くディレクトリ。

## 役割

- **実装プラン (archive/) との違い**: 実装プランは具体的な手順・検証基準を持つ（完了後 archive 行き）。vision/ は「なぜそれを作るのか」「どう進化させたいか」など抽象度の高い議論・要件・テンプレートを長期保管
- **CLAUDE.md との違い**: CLAUDE.md は現状の SSOT（実装済みの規約・アーキテクチャ）。vision/ は未実装の構想や、CLAUDE.md に入れるには詳細すぎる背景情報

## 収録内容

| ファイル                                        | 内容                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `core.md`                                       | Core Identity / Target User / Value Propositions / Non-Goals / Platform Strategy の詳細版 |
| `ai-integration.md`                             | Cognitive Architecture (ADR-0005) の要旨 / 利用シナリオ / AI 不使用時の機能割合           |
| `2026-04-17-daily-life-hub-requirements.md`     | Daily Life Hub 要件（PropertyType 拡張、Database 機能拡充）                               |
| `2026-04-18-application-definition-template.md` | アプリ再定義ワークシート（Phase A-2 テンプレート、再利用可能）                            |

## ライフサイクル

- 構想段階 → vision/ に置く
- 実装フェーズに入る → 実装計画書を `.claude/` 直下に作成し、vision/ ファイルから相互リンク
- 完全実装済み → CLAUDE.md 該当章に統合 → vision/ ファイルは参考資料として残置 or archive/ へ移動
