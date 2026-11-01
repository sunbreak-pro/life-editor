# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- 「目標と Todo」の 7 Issue を 1 Issue 1 PR で出した（#2362〜#2368）✅（2026-10-28・**#2370 merged / #2375 #2377 #2378 #2380 #2381 #2382 open**）。#2283 は PR #2316 が merge 済みで 10-21 の実ブラウザ確認も合格のため、新しい PR は出していない
- Connect のアイテム行のチェックボックスを常時表示にした（ユーザー直依頼・Issue なし）✅（2026-09-21・**PR #1814**）
- Step 12 で出た設計との差分 3 件を畳んだ（#1734 / D-20260919-connect-2 = A）✅（2026-09-21・**PR #1809 merged**）

## 予定

- **#2380（#2366）は merge の前に `supabase db push` で 0044 を入れる**。`GOALS_PAYLOAD_COLUMNS` が `start_date` / `end_date` を名指しするので、逆順だと web の目標の読み込みが 42703 で止まる（memory: merge-before-db-push-breaks-prod-web と同じ形）
- **#2377 / #2378 / #2380 / #2381 / #2382 は同じ `GoalTreeView.tsx` と `goalTreeRenameDrag.test.tsx` を触る**。どれも origin/main から独立に切ったので、merge するたびに次の PR で衝突の解消が要る
- **#2283 の close は chat-main の手番**（DoD は PR #2307 / #2316 で満たし、10-21 の実ブラウザ確認で合格）
- **chat-main 側の実ブラウザ確認**: #2370（Todo をその場で編集）/ #2377（「追加」が折れない）/ #2378（持ち運ぶドラッグ。Safari の `setDragImage`）/ #2380（期間の指定と 4 件目）/ #2381（3 アイコン）/ #2382（完了済みの一覧）
- **範囲外として残したこと**: 目標の範囲を詳細パネルで直す口、MCP の `create_goal` / `list_goals` の範囲、朝刊の目標の欄の 3 件上限と範囲（#2380 の PR 本文に記載）
