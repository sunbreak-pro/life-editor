# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **PR #68 (W3-0) + PR #69 (W3-A)** web-parity **W3 前半2レーン** ✅（2026-06-10・未merge）— [W3-0] shortcut keydown executor 配線: eventToBinding + useGlobalShortcuts(IME/inputガード・rebind即反映) + headless GlobalShortcuts。⌘K/⌘1-5/⌘, 設定駆動化。shared test 357緑(+18)。QA PASS with concerns(C/H 0) / [W3-A] **前提崩れ発見**(timer/sound テーブル不在・DataService throw stub) → migration 0018(6テーブル・RLS24 policy initplan全数・未適用) + DataService 22メソッド実装(interface 変更ゼロ)。shared test 356緑(+17)。QA PASS with concerns(C/H 0)。子計画書: 2026-06-10-web-parity-w3-work-timer-audio.md(W3-A が運搬・4レーン分割)
- [chat-main] **PR #66** W1/W2 merge 後検証 + 統合修復 ✅（2026-06-10・merged f652a542）— #62/#63/#64 連続 squash merge の競合解決で W1 hunks 脱落 → main web build 破損を全数検証で検出・修復。merged worktree 7個 prune 済。**教訓: 同一ファイルを触る連続 squash merge 後は main で build 全数検証必須**
- [chat-main] **PR #63 (W1) + PR #64 (W2)** web-parity ✅（2026-06-09・merged 2026-06-10）— W1=Theme基盤/Settings/ShortcutConfig、W2=Trash/CommandPalette。両 QA PASS。計画書 archive 済

## 予定

- 🛑 **PR merge 3本（ユーザー判断）**: #67(tracker) / #68(W3-0 executor) / #69(W3-A foundation)。#68/#69 は領域分離済みで順不同可
- 🛑 **W3-A merge 後のユーザー作業**: (1) `supabase db push`（0018 適用）→ migration 末尾 POST-APPLY VERIFICATION A-D 実行（24 policy initplan / advisor WARN 0 / publication 6件）(2) W3-C 前に Storage 公開バケット `sounds` 作成 + プリセット音源6種アップロード
- **W3-B** — TimerContext/Reducer 共有層化（開始時刻ベース）+ Pomodoro UI + Work タブ + new-task/undo/redo executor 結線 + REALTIME_TABLES 結線（**W3-A merge + db push 後に着手**）。QA 申し送り: timer_settings singleton race の upsert 化 / activeInInput 二重管理の解消をここで検討
- **W3-C** — AudioProvider（Optional）+ ミキサー UI + Storage URL 再生（W3-A merge + バケット作成後）。sync-auditor を通す
- 👀 **W1/W2 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ一覧・restore/permanentDelete confirm（+ 統合修復後: settings タブ表示・palette「Go to 設定」）
- 👀 **W3-0 実機目視**（merge 後）: ⌘K パレット / ⌘1-5 section 切替 / ⌘, settings / rebind 即反映 / input 入力中 "n" 非発火 / palette 表示中の ⌘2 裏切替の体感評価（QA Medium・気になれば抑制を別タスク化）
- ローカル merged branch 8本の削除（`git branch -D` は deny ルールのためユーザー実行: chore/batch-a-_ ×2 / docs/web-first-v2-and-bash-rule / feat/w0-_ / feat/w1-_ / feat/w2-_ / fix/w1-w2-merge-integration / chore/tracker-w1-w2）
- **W4** — Analytics + Connect（Tier3・後回し・複雑画面=分割寄り）
- W1 残 Low（非ブロッキング・別バッチ）: `text-white` の accent オン文字トークン化 / `FONT_SIZE_PX` の ThemeContext↔SettingsAppearance 重複を `constants/` 一元化
- **Mobile 基準セクション統一（frontend）の Phase 2 Schedule / Phase 4 Settings は FROZEN（取り下げ）** — frontend は移行 Phase 5 で破棄予定・web に伝播しないため。今後の統一は web-desktop-parity-roadmap（W0-W4）側で実施。Phase 2 設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は web 移植仕様の参照元として保全（master プラン `2026-06-05-mobile-first-section-unification.md`）
- [chat-main] web Phase 2 残: S8 Supabase Realtime（SyncContext no-op→postgres_changes購読+debounce bump+publication migration 0017）/ S9 モバイルレスポンシブ（本番web/）
- [chat-main] Perf follow-up: M4（useScheduleItemsRoutineSync の syncScheduleItemsWithRoutines を updateFutureScheduleItemsByRoutine に一括化）/ M1（note一覧content_json除外・遅延取得+検索移行の設計変更要
- **Known Issue 025 Fixed 化**（任意・軽量）: prototype 系 worktree 関連。`prototype/mobile-ui` worktree は現在も生存中のため要状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
