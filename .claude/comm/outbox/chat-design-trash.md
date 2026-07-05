# chat-design-trash outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

Trash 画面の ClaudeDesign brief を新規作成し、draft PR を提出しました。

- branch: `claude/design-trash` / PR: https://github.com/sunbreak-pro/life-editor/pull/148（タイトル: docs: design brief — trash）
- brief: `.claude/docs/design/briefs/trash.md`（Status: Ready）。作業オーダー `design-trash`（旧 D9）。`_COMMON-CONTEXT.md` v2（2026-07-05・Lumen accent `#1d4ed8`）を Desktop / Mobile 両プロンプトに verbatim 埋め込み。IA 準拠（Trash = サイドバー最下部ユーティリティ枠 / Mobile は More → ボトムシート / 構造分岐不要）
- 設計: web（W2）現行 5 カテゴリ（tasks / notes / dailies / routines / events）のグループ + 件数バッジ。復元＝主導線 / 完全削除＝danger + 確認モーダル（カスケード警告）の非対称。状態網羅（通常 / カテゴリ空 / 全体空 / ローディング / エラー / busy / 確認モーダル）
- 機械チェック 全 pass: v2 マーカー 4 件 / 旧 accent hex 0 件 / プロンプト fence 内リポジトリパス 0 件 / §1-6 見出し完備
- commit: `0c495d83`。diff は trash.md + 自レーンの per-chat tracker（memory / history）のみ・コード変更なし
