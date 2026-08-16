---
id: D-20260816-shared-fix-3
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-16
chat: chat-shared-fix
answer: A
topics: [auth, supabase, security, settings]
refs: ["#919", "#930", "shared/src/services/SupabaseAuth.ts"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260816-shared-fix-3: ログイン中のパスワード変更に再認証を要求するか

## 背景

（キューのエントリ本文をそのまま貼る）

- 背景: `shared/src/services/SupabaseAuth.ts` の `updatePassword` は `updateUser({ password })` を素で呼ぶ。ログイン済みの端末に数十秒触れた第三者が、現行パスワードを知らないまま書き換えて所有権を奪える
- A: 現状維持（推奨 — 端末が自分専用で、ロック解除された端末を他人に渡す状況が現実的でないなら、追加の入力欄は毎回の手間だけが残る）
- B: Supabase の "Secure password change" を ON にする、または Settings のフォームに現行パスワード欄を足して `signInWithPassword` で検証してから変更する。**注意**: 同じ `updatePassword()` をリカバリー経路も通るので、ON にする前に「リカバリーセッションが弾かれないか」の実測が要る。抜けると「忘れた人が再設定できない」最悪形に戻る
- 放置時: A の現状維持
- 期限感: いつでも

## 選択肢と裁定

- **A: 現状維持（再認証を要求しない）**（**採用** — ユーザー回答 2026-08-16）。端末は本人専用で、ロック解除された端末を他人に渡す状況が現実的でない。追加の入力欄を置いても毎回の手間だけが残る
- B: "Secure password change" を ON にする / 現行パスワード欄を足す（却下 — 同じ `updatePassword()` をリカバリー経路も通るため、ON にする前に「リカバリーセッションが弾かれないか」の実測が要る。抜けると「忘れた人が再設定できない」という #919 以前より悪い形に戻る）

## 却下案が復活する条件

- 端末を他人と共有する運用に変わったとき
- 公開 Web URL を共用端末（ネットカフェ等）から開く運用が出てきたとき

## 波及

- B を将来採る場合の必須の前提: リカバリーセッションが `updatePassword()` を通れるかの実測を先に済ませること（この注意書きは B 復活時の入口として残す）
