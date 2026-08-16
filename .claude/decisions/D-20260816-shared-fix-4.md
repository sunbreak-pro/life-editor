---
id: D-20260816-shared-fix-4
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-16
chat: chat-shared-fix
answer: A
topics: [auth, security, password-policy, supabase]
refs:
  [
    "#956",
    "#919",
    "#930",
    "docs/vision/plans/2026-08-07-web-mobile-public-url.md:161-164",
  ]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260816-shared-fix-4: パスワードの最小長を 6 のままにするか、10-12 に上げるか

## 背景

（キューのエントリ本文をそのまま貼る）

- 背景: 無料プランのため漏洩パスワード検査が使えず（`docs/vision/plans/2026-08-07-web-mobile-public-url.md:161-164`）、守りは「使い回しのない長いパスワード」という運用だけだった。#919 でその設定画面をアプリ内に作ったので、画面が出す下限がそのまま実効ポリシーになる
- A: 10-12 に上げる（推奨 — 変更は `web/src/hooks/usePasswordUpdate.ts` の定数と各カードの既定値、en / ja の文言 2 行だけ。Supabase 側の Minimum password length も揃える）
- B: 6 のまま（サインアップが閉じていて攻撃対象が 1 アカウントに固定されているぶん、総当たりの現実味は低い）
- 放置時: B の現状維持（6 のまま）
- 期限感: いつでも

## 選択肢と裁定

- **A: 10-12 に上げる**（**採用** — ユーザー回答 2026-08-16）。無料プランで漏洩パスワード検査が使えない以上、実効の守りは長さだけになる。#919 で設定画面をアプリ内に作った結果、画面が出す下限がそのまま実効ポリシーになったため、そこを上げるのが最も安い手当てになる
- B: 6 のまま（却下 — サインアップが閉じていて攻撃対象が 1 アカウントに固定されている点は事実だが、公開 Web URL が開いている以上、長さ以外の守りが無い状態を据え置く理由にならない）

## 却下案が復活する条件

- Supabase を有料プランへ上げ、漏洩パスワード検査（HaveIBeenPwned 連携）が使えるようになった場合。長さ一本槍でなくなるため、下限の見直し余地が生まれる

## 波及

- 実装 Issue = **#956**（`10-12` のうち具体値は実装時に 1 つへ決める。定数と en / ja 文言で数値を二重管理しないことが DoD）
- Supabase ダッシュボード側の Minimum password length も同じ値へ揃える（🛑 こうだいさんの手番）
