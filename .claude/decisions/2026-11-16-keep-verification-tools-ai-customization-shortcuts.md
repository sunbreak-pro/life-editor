---
id: 2026-11-16-keep-verification-tools-ai-customization-shortcuts
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 検証用の MCP の道具・AI のカスタマイズ・ショートカットの割り当て直しを残す
topics: [feature-removal, mcp, settings, shortcuts]
refs: ["#2716", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# 迷うと削除の候補に残った 3 件を残すか

## 背景

> キューを経ていません。2026-11-16 に、こうだいさんがチャットの文で答えました。

- **何が起きているか。** 機能の棚卸し（Issue #2716）の 2 回の回答のあと、検証用の MCP の道具が「迷う」に、AI のカスタマイズとショートカットの割り当て直しが「削除の候補」に残っていました。
- **なぜ決める必要があるか。** 決まらないと、期日（2026-12-30）までに保つ範囲が確定しません。
- **回答。** こうだいさんは「MCP は使う」「ほかふたつの機能はそのまま」と答えました。

## 選択肢と裁定

- 検証用の MCP の道具（**残す** — ユーザー回答 2026-11-16）
- AI のカスタマイズ（**残す** — ユーザー回答 2026-11-16）
- ショートカットの割り当て直し（**残す** — ユーザー回答 2026-11-16）

## 波及

- アプリの殻を消す Issue #2760 は、殻の中でショートカットの設定を省く分岐を外します。割り当て直しの機能そのものは残します。
- これで、棚卸しの 79 件の振り分けがすべて決まりました。
