# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- Connect ワークベンチの残り 4 Issue を 5 PR で出した（#1676 / #1644 / #1645 / #1646）✅（2026-09-19・**#1676 = PR #1685 merged**、**PR #1696 / #1698 / #1703 / #1709 open = merge 待ち**）。計画書 `2026-09-14-connect-tag-link-workbench.md` は Status COMPLETED で `archive/` へ
- タグ編集モーダルを Connect に畳み、タグマスタの編集所を一本化した（#1643・`D-20260912-main-1` Q1-A）✅（2026-09-16・**PR #1657 open = merge 待ち**）
- 繰り返しアイテムのタグが Connect に出ず、タグ編集で「その他 (無題)」になる問題を直した（#1631）✅（2026-09-16・**PR #1650 merged**）
- narrow の絞り込み入力の箱を `label` にして余白タップでフォーカスが入るようにした（#1578・#1561 の残件）✅（2026-09-09・**PR #1585 merged**）

## 予定

- **4 本の PR は merge 順が決まっている**（どれも base = main。後ろの PR は前の内容を含む）: #1696 → #1698 → #1703 → #1709。merge はユーザー（P-001）
- **merge 後に chat-main 側で実ブラウザ確認**（計画書 Step 12 = 👀）: 1440×900 で盤面 1a〜2f、390×844 で Mobile 1a〜1l、light / dark 両方。一括操作 10 件の体感（Realtime の再取得が詰まらないか）もここで実測する
- **判断待ち**: Mobile の上部バー「＋」（`decisions/chat-connect-refine.md` の D-20260919-connect-1）
- **PR #1657 の merge 後に chat-main 側で実ブラウザ確認**（CLAUDE.md §7.4 — worktree は build / 型検証まで）: 1440×900 で盤面 1a〜2f、light / dark 両方。特に編集ブロックの色スウォッチ 2 段 6 列とレールの「…」ホバー表示
- chat-main 側で 390 幅の実測（PR #1585 merged 済み）: 絞り込み枠の上端 4px 下をタップして `document.activeElement === input` になるか
- `web/tests/briefingEveningLazyMount.test.tsx` のフル実行時 flake 起票（outbox に投函済み・chat-main 待ち）
