# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- タグ編集モーダルを Connect に畳み、タグマスタの編集所を一本化した（#1643・`D-20260912-main-1` Q1-A）✅（2026-09-16・**PR #1657 open = merge 待ち**）
- 繰り返しアイテムのタグが Connect に出ず、タグ編集で「その他 (無題)」になる問題を直した（#1631）✅（2026-09-16・**PR #1650 merged**）
- narrow の絞り込み入力の箱を `label` にして余白タップでフォーカスが入るようにした（#1578・#1561 の残件）✅（2026-09-09・**PR #1585 merged**）

## 予定

- **次は #1644**（複数選択・一括タグ操作・タグ統合 = D8〜D11 / D14）。#1643 で持ち越した「アイテム単位のタグ外し」はここに入る。stacked で進めてよいが、base が main 以外の PR は merge 後に main 着地を実測する
- そのあと #1645（右パネルの近傍モード）→ #1646（Mobile 3 段）
- **PR #1657 の merge 後に chat-main 側で実ブラウザ確認**（CLAUDE.md §7.4 — worktree は build / 型検証まで）: 1440×900 で盤面 1a〜2f、light / dark 両方。特に編集ブロックの色スウォッチ 2 段 6 列とレールの「…」ホバー表示
- chat-main 側で 390 幅の実測（PR #1585 merged 済み）: 絞り込み枠の上端 4px 下をタップして `document.activeElement === input` になるか
- `web/tests/briefingEveningLazyMount.test.tsx` のフル実行時 flake 起票（outbox に投函済み・chat-main 待ち）
