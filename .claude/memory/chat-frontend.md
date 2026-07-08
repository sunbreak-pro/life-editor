# MEMORY (chat-frontend)

## 進行中

### 🔧 ClaudeDesign 全画面デザイン brief fan-out（着手日: 2026-07-04）

**対象**: `.claude/docs/design/`（README / briefs/\_TEMPLATE / briefs/\_COMMON-CONTEXT）
**計画書**: `.claude/docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md`

- 前回: PR #160 監査（静的 + 独立ビルド検証 全 pass）→ v3 ドキュメント同期 draft PR #161 → **両方 2026-07-06 に merge 済み**（origin/main `50db5e90`）
- 現在: 完成版 `App Shell.dc.html` を再取得し前回 Turn 2 分析と**バイト同一**を確認（= v3 ドキュメントは完成版と一致）→ Turn 2 対応方式が follow-up に確定 → **`shell-turn2-impl` オーダー新設**（impl fanout 計画書にレジストリ行 + 詳細 + 依存更新 + 「開始時 fetch+rebase」共通プロトコル化）+ worktree `.claude/worktrees/shell-turn2-impl`（branch `claude/shell-turn2-impl`・origin/main 起点）作成 → 登録 docs の draft PR 作成中
- 次: ユーザーが docs PR merge → shell-turn2-impl セッション起動（boot 1 行は提示済み）→ 残り 8 画面はデザイン生成のたびに `<section>-impl` 起動（セクションの依存 = shell-turn2-impl merge 後）。m2（settings ショートカット語彙）は settings-impl 実装時に確認

## 直近の完了

- Connect エラー→shared Toast 化 + Analytics per-range fetch（follow-up #6/#7 集約）✅（2026-07-04・**PR #116 merged**・squash `ce73f06d`）
- カラートークン rename `notion-*` → `ink-*`（93ファイル・803行 1:1 置換）✅（2026-06-30・**PR #111 merged 2026-07-02**。その後 #135 で `ink-*` → `lumen-*` に再改名 — 現行トークンは lumen-*）
- ClaudeDesign(Lumen UI) 新4部品 Toast/Sheet/Sidebar/Menu 生成・検証 ✅（2026-06-30・`_lumen-ext/` に実ソース・claude.ai クラウドカタログ・出荷UI未反映）

## 予定

- **semi-live ドキュメントの `notion-` 残**（`requirements/` `automation/` `skills/` 計19ファイル）を揃えるか判断（`archive/` `history/` `known-issues/` の履歴系は据え置き推奨）→ ✅ 2026-07-08 docs-consistency-cleanup（計画書 = plans/2026-07-07）で lumen-* 更新 / 歴史注記として対応
