# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- C-3: add item を 5 role 選択化（セレクタのみ）✅（2026-06-06 / branch prototype/pomodoro-multitimer / tsc+build green / 実機目視待ち）— Schedule の add-item「種類」を task/event/routine/note/daily の5択へ。role 別フォーム出し分け（routine=繰り返し+開始日 / note・daily=本文中心・時刻なし）。routine/note/daily は描画導線なしのため save 時モック確定（トースト）。birthday は creation から外し event+tag に一本化
- Materials エディタ刷新: 本文を白紙キャンバス化（枠/等幅/タイトル下線撤去・サンセリフ・全面自動拡張・余白タップで書ける）＋ フォーマットツールを左端 + ハンドル方式へ再設計（カーソル行追従・タップで開閉・改行/別行/blur で自動クローズ・ミラー要素でカーソル位置実測）✅（2026-06-06 / branch prototype/pomodoro-multitimer / tsc+build green / 実機目視待ち）
- Pomodoro 強化: タイマー実時刻化＋セクション間継続 / Settings 再設計＋横断 a11y / HISTORY 削除(スワイプ)・コメント / マルチタイマー最大3並行 ✅（2026-06-03 / branch prototype/mobile-ui・PR 作成予定 / tsc+build green）

## 予定

- 👀 Materials エディタ刷新の実機目視: 白紙化の見た目 / 左端 + ハンドルの縦位置・当たり判定 / + タップでツールバー開閉 / 改行・別行・blur で自動クローズ / カーソル位置追従精度
- 🛑 PR #40 (prototype/mobile-ui → main, MERGEABLE/CLEAN) の merge 実行（ユーザー判断）
- 👀 共通 Shell の実機目視: ドラッグ BottomSheet（半分↔全画面スナップ・下スワイプ閉じ）/ 検索モーダル（背景透け・空入力時非候補・kind/tag フィルタ）/ Calendar 月グリッド高さ均等 / Schedule・Work の stray ")" 消失
- 👀 M-1〜M-3 + C-2 + fix-pack の実機目視確認 → 不具合あれば次 fix-pack へ
- 👀 C-3 実機目視: add item「種類」5択の見た目（5列グリッド・44px タップ）/ role 切替でフォーム出し分け（routine の繰り返し・note/daily の本文化・時刻/日付の出し入れ）/ routine・note・daily 保存時のモックトースト / 編集時 birthday の保存可否
- M-4 は prototype スコープ外 (本番 frontend/MobileMaterialsView.tsx 側のレイアウトバグ)
- C-2 の 5 role 拡張 (Routine/Note/Daily 統合) は本番 items_meta 完了後に対応
- 👀 残: 6 screens 全体の追加目視確認 (ユーザー B フロー)
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗 (別 worktree / 別 branch スコープ)
