# Decision Queue — 判断で止まらない

ユーザー判断が必要になったら、待ちで作業を止めず `.claude/comm/decisions/chat-<self>.md` にエントリを書いて次の作業単位へ進む（形式は decisions/README.md）。

- まず `decisions/POLICY.md` を確認 — 該当する恒久裁定があれば聞かずにそれに従う
- キューに書くのは「A/B に割れる判断」だけ。不可逆操作は P-007 に従い同期確認
- 実装中に計画外の変更が浮上したら **P-008**（実装せずキューへ・現計画を続行・Scope / AC の自己免除はしない）
- セッション開始時に `decisions/ANSWERS.md` を確認し、自分宛の回答を消化してから新規作業に入る
- エントリの「放置時」は必ず安全側（保留・別作業へ）。無回答で作業が勝手に進む設計にしない
- **回答が付いたら消す前に台帳へ昇格する**（2026-08-09 D-20260809-main-1）: `.claude/decisions/D-<id>.md` を作成（キュー本文をそのまま貼る）→ キューから削除 → `node .claude/scripts/records.mjs index` を同一コミットで実行。手順の正本 = `.claude/decisions/README.md`
