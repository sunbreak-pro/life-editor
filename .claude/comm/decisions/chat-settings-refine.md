# Decision Queue — chat-settings-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## G-20260829-settings-1: #1200 アカウント削除の 🛑 人手ゲート 2 本（判断ではなく実行依頼）

P-007 のとおり本番設定変更はキューで自動的に進めない。**これは A/B の判断ではなく「こうだいさんの手でしか踏めない 2 手」の控え**で、同じ内容をメインチャットでも口頭報告済み。踏むまで #1200 の削除ボタンは 500 で失敗する（データは 1 行も消えない — 下記のとおり全か無か）。

- 背景: Issue #1200 / PR (claude/settings-1200-account-deletion)。ローカルで実装できる範囲（SQL 関数・Edge Function のソース・クライアント経路・確認 UI・テスト）はすべて入っている。
- **手 1（DDL push）**: `cd supabase && npm run db:push` — `supabase/migrations/0025_delete_my_account.sql` を適用する。新規テーブルは無いので RLS ゲートの検査対象は増えない。
- **手 2（Edge Function deploy）**: `supabase functions deploy delete-account` — `supabase/functions/delete-account/index.ts`。**新しいシークレットは不要**（`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は Supabase が Edge Function に自動注入する）。
- 順番: 手 1 → 手 2。逆にすると deploy 直後の関数が存在しない RPC を呼ぶ。
- 放置時: 削除導線は「押すと失敗する」状態のまま。**データは消えない**（SQL 関数は取りこぼし検査で例外を投げ、トランザクションごと巻き戻す）ので、放置そのものは安全側。ログアウト導線（狭幅レイアウトの穴を塞いだ側）は 2 手のどちらにも依存せず、merge した時点で効く。
- 期限感: #1200 の DoD「テストアカウントで削除実行 → 再ログイン不可・当該 user_id の行が 0 件」を実測するまで。第三者配布より前。

（2026-08-12 昇格分 = D-20260802-settings-1 — `.claude/decisions/` 台帳へ）

## D-20261003-settings-1: ヘルプに載せる「GitHub がなくても使える連絡先」を何にするか（#1989 の 🛑 Gate）

- 背景: #1989 の導線（Settings と認証画面のヘルプ）は PR #2003 で merge 済みです。連絡先の差し込み口 `web/src/legal/operator.ts` の `DIRECT_CONTACT` は `null` のままで、ダイアログは GitHub Issues だけを出しています。GitHub アカウントを持たない配布ユーザーは、今のままでは連絡できません。D-20260829-web-3 で「個人メールは公開ページに載せない」と決まっています。認証画面のヘルプはログイン前に誰でも開ける公開ページです
- A: 無料の問い合わせフォーム（Google フォームなど）の URL を入れる（推奨 — アドレスを公開ページに出さずに済み、費用は $0 のままで、D-20260829-web-3 の方針とも両立するため。フォームはこうだいさんが作り、URL を受け取ったら `operator.ts` の 1 行を埋める PR を出します）
- B: 問い合わせ専用のメールアドレス（個人用とは別のアドレス）を入れる。確認メールの差出人（D-20260926-web-1 の Brevo 用 Gmail）と同じにすれば、受け取った人はすでに知っているアドレスになります。ただし認証画面は公開ページなので、収集されて迷惑メールが届く恐れがあります
- C: GitHub Issues だけで確定し、差し込み口は空のまま #1989 を close する。GitHub を持たない人は連絡できないままで、#1989 の動機は満たされません
- 放置時: 差し込み口は `null` のままで、ダイアログは GitHub Issues だけを出します。#1989 は open のまま保留にします
- 期限感: 配布開始の前まで（D-20260923-main-2 の配布前 4/4）
