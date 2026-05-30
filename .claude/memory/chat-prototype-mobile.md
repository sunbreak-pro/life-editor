# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- M-3: 空行ヒント + `/` キーバインド + IME ガード (iOS additions, prototype 実装) ✅（2026-05-30）
- M-2: スラッシュコマンドメニュー (iOS additions, prototype 実装、ja 固定で AC3 のみ deferred) ✅（2026-05-30）
- 計画書 Status 整合性掃除 (要件監査 a) — 01/02/11 prototype 計画 + tier-1-core + per-chat-split の Status 修正 ✅（2026-05-30 commit `d9f7dbc`）
- M-1: Materials 行スワイプで edit/pin/delete (iOS additions, prototype 実装) ✅（2026-05-30）
- Phase 3.F PR #32 作成 (base=main へ変更) ✅（2026-05-30）
- Phase 3.J fix: swipe transition 条件再修正 + アクセサリーバー iOS 風リスタイル ✅（2026-05-25）

## 予定

- M-4: prototype スコープ外 (本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグのため。prototype TopBar に該当構造なし)
- C-2: Calendar フィルタ・並び替え (iOS additions 残作業)
- C-2: Calendar フィルタ・並び替え
- 👀 残: 6 screens 全体の追加目視確認 (chat-prototype-mobile 担当外でユーザー確認中)
- M-1 layout=card 時の SwipeRow 背景 `C.crust` が gap-3 隙間に出る見た目課題 → 次 fix-pack 候補
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗 (別 worktree / 別 branch スコープ)
