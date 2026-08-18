# MEMORY (chat-web-public)

## 進行中

（なし）

## 直近の完了

- #1005 公開 Web の CSP / Referrer-Policy（`web/public/_headers`）✅（2026-08-18・PR #1053 open・preview の Console 確認は chat-main 手番）
- #1037 iOS ホーム画面アプリのタブバー下の空白 ✅（2026-08-18・PR #1057 open・原因は `black-translucent` の押し上げで viewport が上 inset 分短くなること）
- #1009 `black-translucent` の白文字が朝刊で読めない ✅（2026-08-18・PR #1061 open・`default` へ。`default` vs `black` は D-20260818-web-1 待ち）

## 予定

- D-20260818-web-1 の回答後、#1061 を `default` のまま進めるか `black` へ差し替えるか決める
- #1061 が merge されたら `AppShell.tsx` の safe-area コメント（「`black-translucent` だから web view が画面全体に広がる」）を 1 行追随 PR で直す — #1057 と隣接行のため同時には触っていない
- 3 本の実機確認（朝刊のステータスバー / standalone のタブバー下 / CSP 違反ゼロ）は chat-main 手番
