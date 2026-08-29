# MEMORY (chat-web-public)

## 進行中

（なし）

## 直近の完了

- #1199 トップレベル ErrorBoundary（復帰導線つきフォールバック）✅（2026-08-29・PR #1215 open・GitHub CI 両ジョブ pass）
- #1197 メール確認の「確認待ち」状態を AuthScreen に実装 ✅（2026-08-29・PR #1219 open・GitHub CI 両ジョブ pass・Supabase のトグルは D-20260829-web-1 待ち）
- #1198 プライバシーポリシー + 利用規約と auth 画面からの導線 ✅（2026-08-29・PR #1222 open・文面確定は D-20260829-web-2 / -3 待ち）

## 予定

- D-20260829-web-1 / -2 / -3 の回答を消化する（回答が付いたら `.claude/decisions/` へ昇格してからキューを消す）
- 3 本とも merge 待ち（P-001）。merge 後、実ブラウザ確認（フォールバック UI の目視 / 確認メール一連 / ポリシーページ）は chat-main 手番
- #1197 の実ブラウザ確認は Supabase の Confirm email が ON になるまで着手できない（D-20260829-web-1 に従属）
