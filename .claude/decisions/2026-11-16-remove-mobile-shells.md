---
id: 2026-11-16-remove-mobile-shells
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 消す（今後もネイティブのアプリは作らない）
topics: [feature-removal, mobile, platform]
refs: ["#2716", "#2760", "D-20260807-main-1", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: ["decisions/D-20260807-main-1.md のうち、ネイティブ殻を併存させる部分"]
superseded-by: []
implemented-by: ["#2789"]
promoted-to: null
---

# iOS と Android のアプリの殻を消すか

## 背景

> キューを経ていません。2026-11-16 に main のチャットが AskUserQuestion で聞いた問いに回答が付かず、こうだいさんが同じ日にチャットの文で答えました。

- **何が起きているか。** `mobile/` は、Web の画面を包んでスマホのアプリにする殻（Capacitor）です。CI の確認には入っていません。スマホからの主な入口は、2026-08-07 の決定で公開 Web の URL になっていて、殻は併存の扱いでした。
- **なぜ決める必要があるか。** 残すと、殻の中かどうかで分かれる処理（`isNativeMobile()`）と、殻の文書を期日（2026-12-30）まで保つ手間が残ります。
- **回答。** こうだいさんは「今後実装しないため削除して OK」と答えました。

## 選択肢と裁定

- 消す（**採用** — ユーザー回答 2026-11-16）。`mobile/` と、殻の中だけで動く分岐を消します。
- 残す（却下）。将来アプリとして出す余地を残す案でした。

## 却下案が復活する条件

ブラウザではできないこと（通知やウィジェットなど）が要ると分かったとき。

## 波及

- 置き換えるのは、2026-08-07 の決定のうち「ネイティブ殻は併存」の部分だけです。スマホからの主な入口が公開 Web の URL であることは有効なままなので、元の決定に `superseded-by` は足しません。
- 画面幅で出るモバイルの UI と PWA の Service Worker は残します。
- CLAUDE.md §2、`docs/requirements/mobile-scope.md`、`ios-additions.md`、移行の計画書の Phase 4 は、実装の Issue #2760 の PR で合わせます。
- CLAUDE.md §1 の「作者本人（macOS + iOS）」は、iOS のブラウザで使う意味で有効なままです。
