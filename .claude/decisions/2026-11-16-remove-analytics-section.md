---
id: 2026-11-16-remove-analytics-section
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: セクションごと消す
topics: [feature-removal, analytics, sections]
refs: ["#2716", "#2754", "#2717", "#2720", "docs/requirements/tier-3-experimental.md", "docs/reports/2026-11-16-feature-inventory-for-removal.html", "https://claude.ai/artifact/7XVyuwdr2WXwxcRHmZiLiv"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# Analytics をセクションごと消すか

## 背景

> キューを経ていません。2026-11-16 に main のチャットが、機能の棚卸し（Issue #2716 の手順 1）の報告のあとに AskUserQuestion で聞いた問いを、そのまま写しました。

- **何が起きているか。** Analytics は、作業タブが Work 画面の削除（#2717）で空になり、記録タブが拡張アプリとの接続の削除（#2720）で空になります。残るのは概要・Todo・予定の 3 タブとスマホ幅の画面で、概要は作業の数字が抜けます。要件の文書は 4 タブを凍結としていましたが、隠す仕組みは無く、5 タブとも表示されていました。
- **なぜ決める必要があるか。** 残すなら、概要とスマホ幅の画面の作り直しが期日（2026-12-30）までの予定に入ります。決まらないと、週ごとの予定（Issue #2714）を組めません。
- **推奨と根拠。** セクションごと消すほうを推奨しました。要件の文書でも 2026-07 から凍結の扱いで、5 タブのうち 2 タブが入力を失うためです。

## 選択肢と裁定

- セクションごと消す（**採用** — ユーザー回答 2026-11-16）。部品と画面で約 7,300 行、集計で約 1,240 行を外します。朝刊の右パネルが借りている部品だけを移します。
- 予定と Todo のタブだけ残す（却下）。2 タブの小さな画面にする案でした。スマホ幅の画面の作り直しが要ります。
- 今のまま残す（却下）。空になるタブと数字を直す作業が、期日までの予定に入ります。

## 却下案が復活する条件

完成のあとに、Todo や予定の推移を画面で見たくなったとき。2026-07-16 の「破棄しない・完成間近に更新を再開する」（`docs/requirements/tier-3-experimental.md` の Analytics の Verdict）は、この決定で置き換えます。

## 波及

- 実装は Issue #2754 です。#2717 と #2720 が着地してから進めます。
- 朝刊の右パネル「きのうまでの自分」を、Todo 完了の推移 1 枚に縮めて残す形は、Claude Code の案です。パネルごと消すかは、#2754 の着手前にこうだいさんに聞きます。
- Mobile の下のバーは、Work と Analytics が抜けると固定の 4 つが変わります。並びは試作で確かめてから決めます（`rules/design-first-planning.md`）。
- CLAUDE.md §8、`rules/frontend.md` の Provider の順序、`docs/requirements/tier-3-experimental.md`、`mobile-scope.md` は、#2754 の PR で合わせます。
