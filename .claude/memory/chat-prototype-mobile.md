# MEMORY (chat-prototype-mobile)

> 🧹 2026-06-27 chat-main 棚卸し: PR #40 / #46 / #48 は全て **MERGED** 済（gh 確認）。「merge 実行待ち」項目は解消。worktree/branch prune 済でレーン休眠。残りは 👀 実機目視のみ（ユーザー認可の cross-lane reconciliation）。

## 進行中

（なし）

## 直近の完了

- prototype Esc 重複リスナー修正 + origin/main ベースへブランチ移行 ✅（2026-06-06・**PR #48 merged**）— AddEventModal の Esc クローズ useEffect 二重登録を解消（Esc 1回で onClose 2回）。PR #45/#46 squash 過程の事故。陳腐化した prototype/pomodoro-multitimer から origin/main 最新ベースへ移行
- prototype/mobile-ui 取込 ✅（**PR #40 merged**）/ C-3 add item 5 role 選択化 ✅（**PR #46 merged**）/ Materials エディタ刷新（白紙キャンバス化 + 左端ハンドル方式）✅（**PR #46 merged**）

## 予定

- 👀 Materials エディタ刷新の実機目視: 白紙化の見た目 / 左端 + ハンドルの縦位置・当たり判定 / + タップでツールバー開閉 / 改行・別行・blur で自動クローズ / カーソル位置追従精度
- 👀 共通 Shell の実機目視: ドラッグ BottomSheet（半分↔全画面スナップ・下スワイプ閉じ）/ 検索モーダル（背景透け・空入力時非候補・kind/tag フィルタ）/ Calendar 月グリッド高さ均等 / Schedule・Work の stray ")" 消失
- 👀 M-1〜M-3 + C-2 + fix-pack の実機目視確認 → 不具合あれば次 fix-pack へ
- 👀 C-3 実機目視: add item「種類」5択の見た目（5列グリッド・44px タップ）/ role 切替でフォーム出し分け（routine の繰り返し・note/daily の本文化・時刻/日付の出し入れ）/ routine・note・daily 保存時のモックトースト / 編集時 birthday の保存可否
- 👀 残: 6 screens 全体の追加目視確認（ユーザー B フロー）
- M-4 は prototype スコープ外（本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグ）
- C-2 の 5 role 拡張（Routine/Note/Daily 統合）は本番 items_meta 完了後に対応
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗（別 worktree / 別 branch スコープ）
