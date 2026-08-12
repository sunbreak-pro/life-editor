# MEMORY (chat-mobile-refine)

## 進行中

- **Epic #716「裁定済み・実装の着地が未確認」3 件の実測** → **PR #803 open**（コード無変更・`.claude/decisions/D-20260730-mobile-{1,2,3}.md` の `implemented-by` と根拠セクションのみ）。**3 件とも現状のコードで満たされていた**（mobile-1 → #494 / mobile-2 → #539 / mobile-3 → #541）ため、未達ゼロ = 起票依頼なし

## 判断待ち（回答が付いたら消化 → 台帳へ昇格）

- （なし）— `D-20260810-mobile-1` / `-2` / `-3` と `D-20260812-mobile-1` はいずれも回答済みで、2026-08-12 に chat-main が台帳へ昇格済み

## 直近の完了

- **Epic #716 裁定 3 件の着地確認 ✅**（2026-08-13・PR #803 open）
- **#691 Mobile の Dayflow ✅**（PR #750 merged）／ **#692 Mobile の月ビュー ✅**（PR #758 merged）。**この 2 本は history に詳細エントリが無い**（前セッションが tracker END を通していない）
- **#632 mobile FAB の位置統一 ✅**（2026-08-10・PR #660 merged）。Notes 側の未達は `D-20260810-mobile-3` = B で「現状維持」に決着済み

## 予定

- `D-20260810-mobile-1` = A / `-2` = A の docs 追随（`mobile-scope.md` の #9 の目標列を「閲覧 + 名前のみ追加 + 色」に、#1 / #4 を「Consumption + Quick capture」に）。どちらも台帳の `implemented-by` が空のまま
- #691 の残件 = Issue **#761**（Dayflow の Todo 行から完了・詳細へ）は `web/src/schedule/**` = schedule-refine の担当レーン
- **merge 済み 2 本の実ブラウザ確認を chat-main へ依頼済み**（outbox 2026-08-12。このレーンは playwright を使えない = CLAUDE.md §7.4）
