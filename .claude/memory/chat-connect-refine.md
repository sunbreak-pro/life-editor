# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- narrow の絞り込み入力の箱を `label` にして余白タップでフォーカスが入るようにした（#1578・#1561 の残件）✅（2026-09-09・**PR #1585 open = merge 待ち**）
- Tag hub の narrow 行と絞り込み枠を 44px に底上げ（#1561）✅（2026-09-07・**PR #1574 merged**）
- 呼び出し元ゼロの backlink 部品を削除（#1239・`D-20260829-connect-1` = B）✅（2026-08-30・**PR #1258 merged**。#1220 の PR #1256 も merged）

## 予定

- **PR #1585 の merge 後に chat-main 側で 390 幅の実測**（CLAUDE.md §7.4 — worktree は build / 型検証まで）: 絞り込み枠の上端 4px 下をタップして `document.activeElement === input` になるか。jsdom は label の activation を持たないので、テストは「箱が label で control が input」の契約だけを固定している
- `web/tests/briefingEveningLazyMount.test.tsx` のフル実行時 flake 起票（outbox に投函済み・chat-main 待ち）
- `section:connect` の open Issue は #1578 だけで、PR #1585 で対応済み。次は `shared-fix` ラベルの自分宛を拾う
