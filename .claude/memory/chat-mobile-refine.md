# MEMORY (chat-mobile-refine)

## 進行中

- **#1050 モバイルドロワーのスライド + エッジスワイプ** → **PR #1074 open**（2026-08-18 時点。`origin/main` 取り込み済み・MERGEABLE・CI 実行中）。閉じるアニメーションは**意図的に入れていない** — panel は close 時にツリーから消える設計で、退場を見せるには mount 維持が要り、`RightSidebarPortal` の中身が close 後も生き残るため。要否は PR 本文で提起済み

## 判断待ち（回答が付いたら消化 → 台帳へ昇格）

- （なし）

## 直近の完了

- **#1049 セクション初回表示の fade-in ✅**（2026-08-18・PR #1069 merged）
- **#1035 narrow 全セクションヘッダーの Undo/Redo ✅**（2026-08-18・PR #1066 merged）
- **#1039 narrow タブ帯の圧縮 + 44px 当たり判定 ✅**（2026-08-18・PR #1063 merged）／ **#1014 mobile-scope の裁定追随 ✅**（PR #1056 merged）

## 予定

- **#1035 の積み残し**: `mobile-scope.md` の #16 行が「Undo/Redo の導線 = その他シート」のまま。全セクションのヘッダーにも出るようになったので追随が要る（#1014 の PR と衝突させないため分離した）
- **merge 済み 4 本の実ブラウザ確認を chat-main へ依頼する**（このレーンは playwright を使えない = CLAUDE.md §7.4）。特に #1039 の 44px オーバーレイ（`TAP_TARGET_TALL`）は「見えない当たり判定が隣を食っていないか」を実機で見ないと確証が持てない
- #691 の残件 = Issue **#761**（Dayflow の Todo 行から完了・詳細へ）は `web/src/schedule/**` = schedule-refine の担当レーン
