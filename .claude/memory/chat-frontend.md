# MEMORY (chat-frontend)

## 進行中

### 🔧 ClaudeDesign 全画面デザイン brief fan-out（着手日: 2026-07-04）

**対象**: `.claude/docs/design/`（README / briefs/\_TEMPLATE / briefs/\_COMMON-CONTEXT）
**計画書**: `.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`

- 前回: work-order 方式へ改定（#142 merge）→ 全 10 オーダー並列起動 → 第 2 波 9 本 merge（#144〜#153・Terminal code 除去 Issue #146）
- 現在: 最終整合監査完了（C1: connect-v2 未実行 → ユーザー再走中）。監査 fix（M1 タブ標準統一 / M2 Status 昇格 / m1 両論併記解消 / m3 計画書同期）を `claude/design-audit-fixes` で draft PR 化。受け渡し調査済み（本命 = GitHub デザインシステムインポート / DesignSync は要 /design-login / .md 添付は要実測）。監査レポート = `.claude/reports/2026-07-05-fanout-final-audit.md`
- 次: connect-v2 PR merge 確認 → m2（settings ショートカット例の語彙）ユーザー判断 → 受け渡しルート実測（.md 添付 → DesignSync）→ Step 6 ClaudeDesign 投入

## 直近の完了

- Connect エラー→shared Toast 化 + Analytics per-range fetch（follow-up #6/#7 集約）✅（2026-07-04・**PR #116 merged**・squash `ce73f06d`）
- カラートークン rename `notion-*` → `ink-*`（93ファイル・803行 1:1 置換）✅（2026-06-30・**PR #111 open**・base main・未merge・commit `66a4a2f3`）
- ClaudeDesign(Lumen UI) 新4部品 Toast/Sheet/Sidebar/Menu 生成・検証 ✅（2026-06-30・`_lumen-ext/` に実ソース・claude.ai クラウドカタログ・出荷UI未反映）

## 予定

- **semi-live ドキュメントの `notion-` 残**（`requirements/` `automation/` `skills/` 計19ファイル）を揃えるか判断（`archive/` `history/` `known-issues/` の履歴系は据え置き推奨）
