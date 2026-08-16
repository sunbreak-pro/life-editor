---
id: D-20260816-shared-fix-2
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-16
chat: chat-shared-fix
answer: A
topics: [auth, supabase, security, password-recovery]
refs: ["#919", "#930", "web/src/App.tsx", "D-20260816-shared-fix-1"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260816-shared-fix-2: リカバリーを implicit フローのまま置くか、PKCE に切り替えるか

## 背景

（キューのエントリ本文をそのまま貼る）

- 背景: #919 で `detectSessionInUrl: true` にした（D-20260816-shared-fix-1 = A）。既定の implicit フローはトークンを URL のフラグメントに載せるため、(a) supabase-js の後片付けが `location.hash = ""` の代入だけで、生トークンを持つ履歴エントリが 1 つ前に残る（ページ内からは消せない）(b) `access_token` が載っていれば無条件に受けるので、攻撃者のトークンを載せた URL を踏ませると被害者が黙って攻撃者のアカウントにログインする（セッション固定）。PR では現在のフラグメント除去だけ実装済み（`web/src/App.tsx` の `stripAuthFragment`）で、上の 2 つは残る
- A: implicit のまま受け入れる（推奨 — N=1 でサインアップは閉じており、セッション固定を成立させるには「攻撃者が作った URL を本人に踏ませる」必要がある。実損は本人が気づかず攻撃者のアカウントに書き続けた場合に限られる）
- B: `flowType: "pkce"` に切り替える（トークンが URL に載らず両方消える。ただし code 交換に同一ブラウザの `code_verifier` が要るので、**殻（Electron / Capacitor）から再設定を要求 → OS 既定ブラウザで開く**という今回の設計が必ず失敗する。殻では要求ボタンを出さない等、導線の作り替えとセット）
- 放置時: A の現状維持。#919 の PR はそのまま
- 期限感: いつでも（急がない。殻からの再設定を実際に使う場面が来たら再検討）

## 選択肢と裁定

- **A: implicit のまま受け入れる**（**採用** — ユーザー回答 2026-08-16）。N=1 でサインアップが閉じているため、セッション固定は「攻撃者の作った URL を本人が踏む」まで成立しない。残る実損は本人が気づかず攻撃者のアカウントに書き続けた場合に限られる
- B: `flowType: "pkce"` へ切り替え（却下 — トークンが URL に載らなくなる代わりに、code 交換が同一ブラウザの `code_verifier` を要求する。殻から再設定を要求 → OS 既定ブラウザで開く、という #919 の導線が必ず失敗するため、導線の作り替えとセットでなければ成立しない）

## 却下案が復活する条件

- 殻（Electron / Capacitor）からのパスワード再設定を実際に常用しはじめ、導線を作り替える体力があるとき
- 公開 Web URL を本人以外にも開くようになり、サインアップを開けた場合（セッション固定の前提が変わる）

## 波及

- `web/src/App.tsx` の `stripAuthFragment` による現在のフラグメント除去はそのまま維持（履歴 1 つ前に残る問題は A の受け入れ範囲）
