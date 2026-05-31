# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- モバイル共通 Shell 化 + 横断検索強化 + ドラッグ可能 BottomSheet + 表示バグ修正 + main マージ衝突解決 ✅（2026-05-31 commit `566a648`+`fbb35ef` / PR #40 MERGEABLE / 計画書: archive/2026-05-30-mobile-ia-v3-shell-implementation.md）
- fix-pack: M-1 card layout SwipeRow 背景透明化 + 角丸 ✅（2026-05-30 commit `a85cb0f`）
- C-2: Calendar フィルタ (タイプ) + 並び順 (DayFlow) (iOS additions, prototype 4 type 範囲) ✅（2026-05-30 commit `0f8b982`）

## 予定

- 🛑 PR #40 (prototype/mobile-ui → main, MERGEABLE/CLEAN) の merge 実行（ユーザー判断）
- 👀 共通 Shell の実機目視: ドラッグ BottomSheet（半分↔全画面スナップ・下スワイプ閉じ）/ 検索モーダル（背景透け・空入力時非候補・kind/tag フィルタ）/ Calendar 月グリッド高さ均等 / Schedule・Work の stray ")" 消失
- 👀 M-1〜M-3 + C-2 + fix-pack の実機目視確認 → 不具合あれば次 fix-pack へ
- C-3: add item で 5 role 選択 (Mobile 対応、要件は Desktop 完了済 / Mobile 別 PR)
- M-4 は prototype スコープ外 (本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグ)
- C-2 の 5 role 拡張 (Routine/Note/Daily 統合) は本番 items_meta 完了後に対応
- 👀 残: 6 screens 全体の追加目視確認 (ユーザー B フロー)
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗 (別 worktree / 別 branch スコープ)
