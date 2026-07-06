# MEMORY (chat-frontend)

## 進行中

### 🔧 ClaudeDesign 全画面デザイン brief fan-out（着手日: 2026-07-04）

**対象**: `.claude/docs/design/`（README / briefs/\_TEMPLATE / briefs/\_COMMON-CONTEXT）
**計画書**: `.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`

- 前回: 実装 fan-out work-order 化（#159 merge）→ shell-impl 起動 → **draft PR #160**（Turn 1 版シェル実装）
- 現在: ①PR #160 整合監査 — 静的監査は全 pass（brief §3 / IA.md 一致・hex 0・純表示・i18n 両 catalog・スコープ越境なし）。ビルド独立検証は結果回収中。②**App Shell デザイン Turn 2**（rightSidebar 詳細パネル + Mobile ハンバーガー・ユーザーフィードバック）**のドキュメント同期完了** — IA.md 決定 4 点目 / `_COMMON-CONTEXT` **v3** 化 / 9 brief 埋め込み同期（機械チェック pass: v3 = 各 2・materials 8 / v2 残 0）/ shell brief §3 rightSidebar 標準 + Status: Generated / 計画書 2 本に Turn 2 スコープ + Worklog 追記。draft PR 準備中
- 次: v3 同期 draft PR 作成 → PR #160 監査結果 + shell-impl の Turn 2 対応方式（#160 に追加 or merge 後 follow-up = 🛑）をユーザー報告 → 残り 8 画面の生成のたびに `<section>-impl` 起動。m2（settings ショートカット語彙）は settings-impl 実装時に確認

## 直近の完了

- Connect エラー→shared Toast 化 + Analytics per-range fetch（follow-up #6/#7 集約）✅（2026-07-04・**PR #116 merged**・squash `ce73f06d`）
- カラートークン rename `notion-*` → `ink-*`（93ファイル・803行 1:1 置換）✅（2026-06-30・**PR #111 open**・base main・未merge・commit `66a4a2f3`）
- ClaudeDesign(Lumen UI) 新4部品 Toast/Sheet/Sidebar/Menu 生成・検証 ✅（2026-06-30・`_lumen-ext/` に実ソース・claude.ai クラウドカタログ・出荷UI未反映）

## 予定

- **semi-live ドキュメントの `notion-` 残**（`requirements/` `automation/` `skills/` 計19ファイル）を揃えるか判断（`archive/` `history/` `known-issues/` の履歴系は据え置き推奨）
