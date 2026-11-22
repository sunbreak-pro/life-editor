---
id: 2026-11-16-remove-event-work-time
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 消す
topics: [feature-removal, work-time, timer-sessions, schedule]
refs: ["#2716", "#2717", "#2718", "#2407", "#2553", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: []
superseded-by: []
implemented-by: ["#2767", "#2773"]
promoted-to: null
---

# 予定の実績時間を残すか

## 背景

> キューを経ていません。2026-11-16 に main のチャットが、機能の棚卸し（Issue #2716 の手順 1）の報告のあとに AskUserQuestion で聞いた問いを、そのまま写しました。

- **何が起きているか。** Work 画面と Todo の実働時間を消すと、作業記録（`timer_sessions`）に書き込むのは、予定の編集パネルの「実績時間」の欄だけになります。2026-08-01 以降の手入力は 2 件で、1 件は検証用でした。
- **先にあった決定。** 予定の実績時間を消すことは、2026-11-12 にこうだいさんが一度決めています（#2717 と #2718 の 2026-11-12 のコメント）。main のチャットはこのコメントを見落として聞き直し、同じ答えを受け取りました。この記録は、その再確認です。
- **なぜ決める必要があるか。** 決まらないと、Work 画面を消す Issue #2717 で、作業記録を読む所（Analytics の作業の数字、朝刊の右パネル、夕刊とデイリーの作業時間、MCP の道具 `list_work_sessions`）を消すか残すかを決められません。
- **推奨と根拠。** 消すほうを推奨しました。入力が 2 件しかなく、残すと読む側を期日（2026-12-30）までに直す手間が残るためです。

## 選択肢と裁定

- 消す（**採用** — ユーザー回答 2026-11-16）。予定の実績時間の欄（`WorkTimeField.tsx`・`web/src/schedule/useEventWorkTime.ts`・`EventEditorPane.tsx` の欄）を消し、作業記録を読む画面と道具もまとめて外します。
- 残す（却下）。手入力の時間だけを見せる形で読む所を残し、ポモドーロの数や休憩の割合のように意味を失う表示だけを外す案でした。入力が少なく、直す手間に見合いません。

## 却下案が復活する条件

予定にかかった時間を記録して振り返りたくなったとき。そのときは、タイマーの記録の表を使い回さず、予定の側に欄を持つ形で作り直します。

## 波及

- Issue #2717（Work 画面の削除）と #2718（Todo の実働時間の削除）に、決まった内容をコメントで足しました。
- `shared/src/components/briefing/eveningDay.ts` は、夕刊の予定と Todo の行も作っています。消すのは作業の行と作業時間の集計だけです。
- Issue #2407 の「実績時間の入力」の部分と #2553 は、この決定と逆向きになります。仕分けは Issue #2714 で行います。
- DB の表 `timer_sessions` は DROP しません。2026-11-12 にこうだいさんが「0018 の表は残し、画面と道具だけを消す」と決めています（#2717 の 2026-11-12 のコメント）。
