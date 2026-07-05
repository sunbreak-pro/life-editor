# HISTORY (chat-docs-terminal-retire)

### 2026-07-05 - Terminal 機能退役の docs 反映（work-order docs-terminal-retire / T1）

#### 概要

2026-07-05 ユーザー決定の Terminal 機能廃止を docs へ反映。計画書 `2026-07-04-claudedesign-screen-design-fanout.md` の work-order「docs-terminal-retire」を実行。コード変更ゼロ・成果物は CLAUDE.md と tier-1-core.md の 2 ファイルのみ。MCP Server は存続することを各所で明示（誤読防止）。

#### 変更点

- **CLAUDE.md §2**: 「Terminal + MCP は Desktop 専用」→「MCP は Desktop 専用（Terminal は 2026-07-05 退役決定 → §8。MCP Server 自体は存続）」
- **CLAUDE.md §3.2**: SectionId は現行 7 種だが `terminal` は退役決定・実効 6 種と注記。`terminal` / `TerminalPanel` 撤去はコード整理 Issue で追跡と明記
- **CLAUDE.md §5**: MCP 自動接続の起動導線記述を調整（起動導線だったアプリ内ターミナルは退役・再設計、MCP Server 存続を明示）
- **CLAUDE.md §8**: Tier 1 コア 7→6、Terminal を列挙から除去し退役注記
- **tier-1-core.md**: Feature: Terminal に `Status: ✗RETIRED (2026-07-05)` 付与（本文は履歴として保持）+ MCP Server（別 Feature・存続）ではないと明示。MCP Server Feature の依存行「Terminal（起動経路）」にも退役波及・存続注記
- **完了**: ユーザー承認後に draft PR #147 提出・コード側 terminal 除去は Issue #146 で起票（`SectionId` / i18n en・ja / shortcut コメント対象・FROZEN frontend/ は対象外）
- **QA フォロー（role-qa PASS）**: tier-1-core:6 の機能数に退役注記を追加（CLAUDE.md §8 の 6 との橋渡し）/ outbox の commit ハッシュ参照を PR #147 参照へ訂正 / tier-2（Theme・Shortcuts）・tier-3 の Terminal stale 参照は成果物スコープ外のため #146 の追跡へ委譲
