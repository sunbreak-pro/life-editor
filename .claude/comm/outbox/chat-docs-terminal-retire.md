# chat-docs-terminal-retire outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

Terminal 機能退役（2026-07-05 ユーザー決定）の docs 反映を完了し、draft PR #147 を提出しました（work-order `docs-terminal-retire` / 旧 ID T1）。

- branch: `claude/docs-terminal-retire`・draft **PR #147**（タイトル: `docs: retire Terminal feature per 2026-07-05 decision`）。merge はユーザー判断（🛑）
- 成果物 2 ファイル（コード変更ゼロ）:
  - `.claude/CLAUDE.md` §2 / §3.2 / §5 / §8 — Terminal 記述を退役へ差し替え・Tier 1 コア 7→6
  - `.claude/docs/requirements/tier-1-core.md` — Feature: Terminal に `Status: ✗RETIRED (2026-07-05)`（本文は履歴として保持）
- ⚠️ 重要: 退役は **Terminal（Claude Code 起動導線）のみ**。**MCP Server は存続**。誤読防止のため各所で明示済み
- コード側の terminal 除去（`SectionId` / i18n en・ja / shortcut コメント・FROZEN `frontend/` は対象外）は **Issue #146** で追跡
- 補足: tier-2（Theme / Shortcuts）・tier-3 の Terminal stale 参照が残存 → #146 の追跡対象に追記済み
- 他レーンへの影響: なし（docs のみ・成果物は互いに素）
