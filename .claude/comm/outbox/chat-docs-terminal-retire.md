# chat-docs-terminal-retire outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

Terminal 機能退役（2026-07-05 ユーザー決定）の docs 反映を完了し commit しました（work-order `docs-terminal-retire` / 旧 ID T1）。

- branch: `claude/docs-terminal-retire`・commit `21bfb4c3`（PR タイトル予定: `docs: retire Terminal feature per 2026-07-05 decision`）
- 成果物 2 ファイル（コード変更ゼロ）:
  - `.claude/CLAUDE.md` §2 / §3.2 / §5 / §8 — Terminal 記述を退役へ差し替え・Tier 1 コア 7→6
  - `.claude/docs/requirements/tier-1-core.md` — Feature: Terminal に `Status: ✗RETIRED (2026-07-05)`（本文は履歴として保持）
- ⚠️ 重要: 退役は **Terminal（Claude Code 起動導線）のみ**。**MCP Server は存続**。誤読防止のため各所で明示済み
- 残（ユーザー承認待ち）: (1) コード側 terminal 除去 Issue 起票（`SectionId` / i18n en・ja / shortcut コメントが対象・FROZEN `frontend/` は対象外）(2) draft PR 作成。両方とも外部書き込みが auto-mode classifier にブロックされ承認待ち
- 他レーンへの影響: なし（docs のみ・成果物は互いに素）
