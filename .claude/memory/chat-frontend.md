# MEMORY (chat-frontend)

## 進行中

（なし）

## 直近の完了

- Connect エラー→shared Toast 化 + Analytics per-range fetch（follow-up #6/#7 集約）✅（2026-07-04・**PR #116 merged**・squash `ce73f06d`）
- カラートークン rename `notion-*` → `ink-*`（93ファイル・803行 1:1 置換）✅（2026-06-30・**PR #111 open**・base main・未merge・commit `66a4a2f3`）
- ClaudeDesign(Lumen UI) 新4部品 Toast/Sheet/Sidebar/Menu 生成・検証 ✅（2026-06-30・`_lumen-ext/` に実ソース・claude.ai クラウドカタログ・出荷UI未反映）

## 予定

- **PR #111 merge**（🛑 人手ゲート・ユーザー判断）。merge 後: 残 worktree/branch 整理
- **Lumen → `shared/` 移植**（当初本命の出荷UI化）。token ギャップ橋渡しが必要: `info`/`warning`（現状 success/danger のみ）・`surface-sunken`・text 3段階（現状 2段階）・`space`/`radius`/`shadow` スケール（現状 Tailwind 既定）
- **semi-live ドキュメントの `notion-` 残**（`requirements/` `automation/` `skills/` 計19ファイル）を揃えるか判断（`archive/` `history/` `known-issues/` の履歴系は据え置き推奨）
