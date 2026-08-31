# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
（2026-08-19 昇格分 = D-20260818-shared-fix-1（回答 = A = rAF スロットル・実装 Issue #1103）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-26 昇格分 = D-20260824-shared-fix-1（回答 = A = 日曜に揃える・実装 Issue #1138）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-28 昇格分 = D-20260827-shared-fix-1（回答 = A = localStorage のまま）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-30 昇格分 = D-20260830-shared-fix-1（回答 = C = ConfirmDialog に寄せる・実装は #1279 で schedule-refine 推奨）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

### D-20260901-shared-fix-1: セクション再生は「続きから」再開してよいか

- 背景: #1359 / PR #1376。中断位置を `TourProgress.sectionStepId` に保存し、`startSection` がそれを読んで**途中から**再開する形で実装済み。Issue の DoD は「保存する」までしか要求しておらず、**読み手を作るか**は書いていない。読み手を作らないと栞は誰も読まないデータになる（`shared/src/context/TourContext.tsx` の `startSection`）
- A: **現状のまま「続きから」再開する**（推奨 — 通しツアーが `stepId` からずっと無告知で再開してきたのと同じ作法。ランチャーの隣にある「最初から通しで歩く」= `restart` が先頭に戻す扉として既にある）
- B: 栞は保存するが `startSection` は常に先頭から始める（`setIndex(0)` に戻す。3 行の差分。ただし栞に読み手が無くなる）
- 補足: A を採るなら、ランチャーのセクション行に「続きから (3 / 5)」の可視キューを足す改善が別途あり得る（現状の手掛かりは吹き出し隅のカウンタだけ）。これは通しツアー側にも同じだけ当てはまるので別 Issue 相当
- 放置時: 現状（A）のまま。#1376 は動く状態なので作業は止まらない
- 期限感: いつでも（#1376 の merge を待たせない）
