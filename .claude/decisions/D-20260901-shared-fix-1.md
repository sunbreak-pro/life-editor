---
id: D-20260901-shared-fix-1
type: decision
status: answered
asked: 2026-09-01
answered: 2026-09-02
chat: shared-fix
answer: A
topics: [tour, resume, ux, onboarding]
refs: ["#1359", "#1376"]
supersedes: []
superseded-by: []
implemented-by: ["#1376"]
promoted-to: null
---

# D-20260901-shared-fix-1: セクション再生は「続きから」再開してよいか

## 背景

（キュー原文 — 回答に伴いキューから削除。起票 = chat-shared-fix / PR #1376。質問 / 転記 / 昇格は chat-main が代行した）

- 背景: #1359 / PR #1376。中断位置を `TourProgress.sectionStepId` に保存し、`startSection` がそれを読んで**途中から**再開する形で実装済み。Issue の DoD は「保存する」までしか要求しておらず、**読み手を作るか**は書いていない。読み手を作らないと栞は誰も読まないデータになる（`shared/src/context/TourContext.tsx` の `startSection`）
- A: **現状のまま「続きから」再開する**（推奨 — 通しツアーが `stepId` からずっと無告知で再開してきたのと同じ作法。ランチャーの隣にある「最初から通しで歩く」= `restart` が先頭に戻す扉として既にある）
- B: 栞は保存するが `startSection` は常に先頭から始める（`setIndex(0)` に戻す。3 行の差分。ただし栞に読み手が無くなる）
- 補足: A を採るなら、ランチャーのセクション行に「続きから (3 / 5)」の可視キューを足す改善が別途あり得る（現状の手掛かりは吹き出し隅のカウンタだけ）。これは通しツアー側にも同じだけ当てはまるので別 Issue 相当
- 放置時: 現状（A）のまま。#1376 は動く状態なので作業は止まらない
- 期限感: いつでも（#1376 の merge を待たせない）

## 選択肢と裁定

- A: 現状のまま「続きから」再開する（**採用** — ユーザー回答 2026-09-02 AskUserQuestion・chat-main 代行。通しツアーと同じ作法で、先頭へ戻す扉は `restart` として既にある。PR #1376 は merge 済みなので追加作業なし）
- B: 常に先頭から始める（却下 — 栞が誰にも読まれないデータになる）

## 却下案が復活する条件（任意）

途中再開が「どこから始まったのか分からない」という報告が実機で出たら、B ではなく補足の可視キュー（「続きから (3 / 5)」）を別 Issue で足す方向で扱う。

## 波及

- なし（現状維持）。可視キューの改善は必要になったら Issue 起票依頼を outbox へ
