# HISTORY (chat-design-trash)

### 2026-07-05 - Trash 画面デザイン brief 新規作成

#### 概要

ClaudeDesign fan-out（計画書 2026-07-04-claudedesign-screen-design-fanout.md）の作業オーダー `design-trash`（旧 D9）として、Trash 画面（ソフトデリート復元・Desktop + Mobile）のデザイン brief を `.claude/docs/design/briefs/trash.md` に新規作成。branch `claude/design-trash` で draft PR 提出。

#### 変更点

- **brief 新規作成**: `_TEMPLATE.md` §1-6 全充足。§4 の Desktop / Mobile 両プロンプトに `_COMMON-CONTEXT.md` **v2**（2026-07-05・Lumen accent `#1d4ed8`）を verbatim 埋め込み。目標 IA 準拠（Trash = サイドバー最下部ユーティリティ枠 / Mobile は More → ボトムシート / 構造分岐不要）
- **画面設計**: web（W2）現行実装の 5 カテゴリ（tasks / notes / dailies / routines / events）のグループ表示 + 件数バッジ。「復元」= 主導線（ラベル付き secondary）/「完全削除」= danger + 確認モーダル（カスケード警告）の危険度非対称を明記。状態網羅: 通常 / カテゴリ空（畳む）/ 全体空 / ローディング（skeleton）/ エラー（再読込）/ busy（行スピナー）
- **要件差分の記録**: 要件は 7 ドメイン + CustomSounds を Trash 対象に挙げるが現行 web は 5 カテゴリのみ（Databases / Templates / CustomSounds 未実装）。本デザインは現行に合わせた旨を §6 に明記
- **機械チェック**: v2 マーカー 4 件 / 旧 accent hex 0 件 / プロンプト fence 内リポジトリパス 0 件 / §1-6 見出し完備 — 全 pass
