---
id: 2026-11-16-remove-data-export
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 消す
topics: [feature-removal, settings, export]
refs: ["#2716", "#2759", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# 設定画面のデータの書き出しを消すか

## 背景

> キューを経ていません。2026-11-16 に main のチャットが AskUserQuestion で聞いた問いに回答が付かず、こうだいさんが同じ日にチャットの文で答えました。

- **何が起きているか。** 設定画面の「データの書き出し」は、全データを JSON で保存する機能です。配布向けに作りました。呼び出し元は設定画面のカード 1 つだけです。機能の棚卸し（Issue #2716）で「迷う」に残っていました。
- **なぜ決める必要があるか。** 決まらないと、配布向けの機能を消す Issue の列（#2749〜#2753）のあとに、設定画面をもう一度触るかが決まりません。
- **回答。** こうだいさんは「今後実装しないため削除して OK」と答えました。

## 選択肢と裁定

- 消す（**採用** — ユーザー回答 2026-11-16）。
- 残す（却下）。手元に控えを取る手段として残す案でした。

## 却下案が復活する条件

データを別の道具へ移すと決めたとき。そのときは、Supabase の側から直接取り出す方法と比べてから作ります。

## 波及

- 実装は Issue #2759 です。アカウント削除の削除（#2753）と Analytics の削除（#2754）のあとに進めます。
- 掃除の Issue #2757 が同じファイル `userDataExport.ts` の行を触るので、2 本は直列にします（#2757 にコメント済み）。
