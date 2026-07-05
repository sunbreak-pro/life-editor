# MEMORY (chat-frontend)

## 進行中

### 🔧 ClaudeDesign 全画面デザイン brief fan-out（着手日: 2026-07-04）

**対象**: `.claude/docs/design/`（README / briefs/\_TEMPLATE / briefs/\_COMMON-CONTEXT）
**計画書**: `.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`

- 前回: 第 2 波 9 本 merge（#144〜#153）→ 最終整合監査 → 監査 fix 3 連（#156 audit-fixes / #157 connect v2 / #158 drift 注記）全 merge — **9 brief 全機械チェック合格**
- 現在: 受け渡し経路の実証完了（DesignSync push `briefs/shell.md` → ClaudeDesign がプロジェクト内 brief を読んで App Shell 生成成功）。**実装 fan-out を work-order 化** — 計画書 `2026-07-05-design-implementation-fanout.md`（レジストリ 9 slug・shell-impl に import URL 登録済み）+ 起動スクリプト `impl-work.sh`（whitelist = レジストリ grep・二重管理なし）を draft PR 化
- 次: 実装 fan-out PR merge → `shell-impl` 起動（最優先・他は shell merge 後）→ 画面のデザイン生成のたびに `<section>-impl` を起動。m2（settings ショートカット語彙）は settings-impl 実装時に確認。残り 8 brief の DesignSync push は必要時に実施

## 直近の完了

- Connect エラー→shared Toast 化 + Analytics per-range fetch（follow-up #6/#7 集約）✅（2026-07-04・**PR #116 merged**・squash `ce73f06d`）
- カラートークン rename `notion-*` → `ink-*`（93ファイル・803行 1:1 置換）✅（2026-06-30・**PR #111 open**・base main・未merge・commit `66a4a2f3`）
- ClaudeDesign(Lumen UI) 新4部品 Toast/Sheet/Sidebar/Menu 生成・検証 ✅（2026-06-30・`_lumen-ext/` に実ソース・claude.ai クラウドカタログ・出荷UI未反映）

## 予定

- **semi-live ドキュメントの `notion-` 残**（`requirements/` `automation/` `skills/` 計19ファイル）を揃えるか判断（`archive/` `history/` `known-issues/` の履歴系は据え置き推奨）
