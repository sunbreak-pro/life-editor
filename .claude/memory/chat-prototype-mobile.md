# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- prototype Esc 重複リスナー修正 + origin/main ベースへブランチ移行 ✅（2026-06-06 / PR #48 / branch prototype/fix-schedule-esc-duplicate / tsc+build green）— AddEventModal の Esc クローズ useEffect 二重登録（Esc 1回で onClose 2回）を解消。PR #45/#46 squash 過程の事故。併せて「prototype 実装は PR #45/#46 で全て main 取込済み」と確認し、陳腐化した prototype/pomodoro-multitimer から origin/main 最新ベースの新ブランチへ移行
- C-3: add item を 5 role 選択化（セレクタのみ）✅（2026-06-06 / PR #46 で main 取込済み）— Schedule の add-item「種類」を task/event/routine/note/daily の5択へ。role 別フォーム出し分け（routine=繰り返し+開始日 / note・daily=本文中心・時刻なし）。routine/note/daily は描画導線なしのため save 時モック確定（トースト）。birthday は creation から外し event+tag に一本化
- Materials エディタ刷新: 本文を白紙キャンバス化（枠/等幅/タイトル下線撤去・サンセリフ・全面自動拡張・余白タップで書ける）＋ フォーマットツールを左端 + ハンドル方式へ再設計（カーソル行追従・タップで開閉・改行/別行/blur で自動クローズ・ミラー要素でカーソル位置実測）✅（2026-06-06 / PR #46 で main 取込済み）

## 予定

- 👀 Materials エディタ刷新の実機目視: 白紙化の見た目 / 左端 + ハンドルの縦位置・当たり判定 / + タップでツールバー開閉 / 改行・別行・blur で自動クローズ / カーソル位置追従精度
- 🛑 PR #48 (prototype/fix-schedule-esc-duplicate → main, Esc 重複リスナー修正) の merge 実行（ユーザー判断）
- 🛑 PR #40 (prototype/mobile-ui → main, MERGEABLE/CLEAN) の merge 実行（ユーザー判断）
- 👀 共通 Shell の実機目視: ドラッグ BottomSheet（半分↔全画面スナップ・下スワイプ閉じ）/ 検索モーダル（背景透け・空入力時非候補・kind/tag フィルタ）/ Calendar 月グリッド高さ均等 / Schedule・Work の stray ")" 消失
- 👀 M-1〜M-3 + C-2 + fix-pack の実機目視確認 → 不具合あれば次 fix-pack へ
- 👀 C-3 実機目視: add item「種類」5択の見た目（5列グリッド・44px タップ）/ role 切替でフォーム出し分け（routine の繰り返し・note/daily の本文化・時刻/日付の出し入れ）/ routine・note・daily 保存時のモックトースト / 編集時 birthday の保存可否
- M-4 は prototype スコープ外 (本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグ)
- C-2 の 5 role 拡張 (Routine/Note/Daily 統合) は本番 items_meta 完了後に対応
- 👀 残: 6 screens 全体の追加目視確認 (ユーザー B フロー)
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗 (別 worktree / 別 branch スコープ)
