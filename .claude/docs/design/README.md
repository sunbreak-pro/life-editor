# docs/design — ClaudeDesign 用デザイン brief 置き場

ClaudeDesign (claude.ai/design) に貼るプロンプトの**正本**と、その根拠（要件・現状 UI・デザイン方針）をまとめるディレクトリ。

## 構成

| ファイル                        | 役割                                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IA.md`                         | **ナビ構成の正本**（サイドバー = 本流 + ユーティリティ枠 / header タブ / Mobile 固定 4 + More。2026-07-05 ユーザー承認。**個数と並びは `shared/src/sections.ts` の registry を数える** — 数値の非複製原則） |
| `briefs/_TEMPLATE.md`           | brief の統一形式（新しい案を考えさせる brief はこれに準拠）                                                                                                                                                 |
| `briefs/_TEMPLATE-reproduce.md` | 今の画面を写させる brief の形式（#2153。下の「今の画面を Claude Design に写させる手順」）                                                                                                                   |
| `briefs/_COMMON-CONTEXT.md`     | **引退済み**（#2152）。旧・全プロンプト共通の前提ブロック。後継は部品集の 2 枚で、新しく作る brief からは参照しない（下の運用原則）                                                                         |
| `briefs/<section>.md`           | 各画面の brief（**1 セッション = 1 ファイル = 単一書込者**）                                                                                                                                                |

## 運用原則

- **ClaudeDesign はリポジトリを読めない**。プロンプト本文は自己完結させる（パス参照・「上記参照」禁止）
- 生成 → 同期 → 移植の分業: 生成 = claude.ai/design 側 / Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- トークンの SSOT は `shared/src/styles/tokens.css`、ナビ構成の SSOT は `IA.md`。
- **アプリの説明と設計の意図はプロンプトに埋め込まない**（#2152）。部品集の `shared/design-system/claude-design/foundations/app.html`（アプリの説明）と `intent.html`（設計の意図）が DesignSystem プロジェクト経由で毎回読み込まれるため、旧 `_COMMON-CONTEXT.md` の役目はこの 2 枚が引き継いだ。部品集と tokens.css・`sections.ts` のずれは `shared/tests/designKitFreshness.test.ts` が見つける
- **全 brief は現行実装ではなく `IA.md` の目標構成に向けてデザインする**

## 今の画面を Claude Design に写させる手順（#2153）

新しい案を考えさせる指示書とは別に、今の画面をそのまま写させる指示書の型があります。料理でいうと、新しい献立を考えてもらう前に、まず今の味を正確に再現してもらう段階です。再現できてから、その上で余白や文字の大きさを微調整します。

- **型**: `briefs/_TEMPLATE-reproduce.md`。frontmatter の `Kind: reproduce` が目印です。上の運用原則の「`IA.md` の目標構成に向けてデザインする」は、この型には当てはまりません。今の実装を写すのが目的だからです。
- **最初の 1 画面**: `briefs/schedule.md`（v3）。値は main（`07ead4ab`）のコードを換算し、2026-10-10 の撮影と計測（メインのクローンの `shots/2026-10-10-design-capture/`）で確かめました。
- **全画面をまとめて試作にする一式**（`prototype/`）との使い分け: 一式は全画面の外枠と操作を一度に作らせます。再現用の指示書は 1 画面の値を細かく渡して、ずれを直すのに使います。一式で作った試作のプロジェクトに続けて送っても、単独で送っても使えます。

### 回し方

1. **撮って測る**（chat-main）: `design-critique` スキルの手順 1〜2 で、Desktop / Mobile × ライト / ダークの 4 通りを撮影し、`measure.js` で値を取ります。
2. **指示書を書く**: 型の §2（構成）・§3（値の表）・§4（スクリーンショットの一覧）を埋め、§5 の最初のプロンプトに値を書き写します。
3. **再現させる**（こうだいさん）: §5 を Claude Design に送り、§4 の「1 回目」のスクリーンショットを添付します。
4. **比べる**: 型の §7 の手順でずれの表を作り、Issue にコメントします。ずれの行を §6 のプロンプトに貼って送り、手順 4 をくり返します。
5. **記録する**: 回ごとに型の §8 に 1 行足します。揃ったら Status を `Matched` にします。

### 振り返り

Schedule での再現の回数・揃った値・効いたプロンプトは、ここに書き足します。2026-10-11 の時点では、手順 3（Claude Design での再現）がまだで、回の記録はありません。

計画書（COMPLETED・2026-08-01 に archive へ移動）: [`../../archive/2026-07-04-claudedesign-screen-design-fanout.md`](../../archive/2026-07-04-claudedesign-screen-design-fanout.md)

デザイン追跡の実務は Epic #321 + [`../requirements/mobile-scope.md`](../requirements/mobile-scope.md) + Issue 群が引き継いでいる。
