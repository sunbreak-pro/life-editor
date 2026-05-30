# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- fix-pack: M-1 card layout SwipeRow 背景透明化 + 角丸 ✅（2026-05-30 commit `a85cb0f`）
- C-2: Calendar フィルタ (タイプ) + 並び順 (DayFlow) (iOS additions, prototype 4 type 範囲) ✅（2026-05-30 commit `0f8b982`）
- M-3: 空行ヒント + `/` キーバインド + IME ガード (iOS additions) ✅（2026-05-30 commit `cbcd743`）

## 予定

- 👀 M-1〜M-3 + C-2 + fix-pack の実機目視確認 → 不具合あれば次 fix-pack へ
- C-3: add item で 5 role 選択 (Mobile 対応、要件は Desktop 完了済 / Mobile 別 PR)
- M-4 は prototype スコープ外 (本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグ)
- C-2 の 5 role 拡張 (Routine/Note/Daily 統合) は本番 items_meta 完了後に対応
- 👀 残: 6 screens 全体の追加目視確認 (ユーザー B フロー)
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗 (別 worktree / 別 branch スコープ)
