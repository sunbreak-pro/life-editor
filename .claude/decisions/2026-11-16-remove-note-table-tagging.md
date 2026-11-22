---
id: 2026-11-16-remove-note-table-tagging
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 消す
topics: [feature-removal, notes, tags, mcp]
refs: ["#2716", "#2761", "#2094", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: []
superseded-by: []
implemented-by: ["#2796", "#2802"]
promoted-to: null
---

# ノートの表へのタグ付けを消すか

## 背景

> キューを経ていません。2026-11-16 の 2 回目の AskUserQuestion で「残したいもの」に選ばれず削除の候補に移り、こうだいさんが同じ日にチャットの文で削除を決めました。

- **何が起きているか。** ノートの本文の表は、タグを初めて付けたときだけ 1 件のアイテム（`items_meta.role = 'table'`）になります（Issue #2094）。画面・データの処理・MCP の道具（`tag_entity` と `search_by_tag`）にまたがります。
- **なぜ決める必要があるか。** 削除の候補のままだと、期日（2026-12-30）までに保つ範囲が決まりません。
- **回答。** こうだいさんは「不要のため削除」と答えました。

## 選択肢と裁定

- 消す（**採用** — ユーザー回答 2026-11-16）。表そのもの（作る・編集する）は残し、タグ付けとアイテムにする処理だけを消します。
- 残す（却下）。

## 却下案が復活する条件

表を単位にして探したり集めたりしたくなったとき。

## 波及

- 実装は Issue #2761 です。DB の表 `tables_payload` と `items_meta_role_check` は変えません。
- 本番に `role = 'table'` の行があるかは、着手の前に数えます（未確認）。行があれば、付いているタグが見えなくなることをこうだいさんに伝えてから進めます。
- MCP の道具から表を外すので、道具の一覧と拡張アプリの窓口の仕様を作り直します。
