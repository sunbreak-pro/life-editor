# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **PR #71** CLAUDE.md 三軸スリム化 ✅（2026-06-11・未merge）— 253→112 行（公式 200 行以下目標・over-specified 解消・章番号 §0-§9 維持）+ §6 詳細を path-scoped rule `.claude/rules/frontend.md`（63 行・`frontend/src/**` + `shared/src/**` read 時のみロード）へ移管 + 計画書 2026-06-11-claude-md-three-axis-slimming.md 作成。検証: 不変式 18 項目 + 参照パス 20 件 全 OK。一時 worktree 経由 push（claude-md-slim・削除済）
- [chat-main] **PR #70 (W3-B)** Pomodoro Timer + Work タブ ✅（2026-06-11・未merge）— TimerContext/Reducer 共有層化（Pattern A・開始時刻ベース計測 = startedAt + pause 累積 offset・setInterval は再レンダーのみ）+ Pomodoro UI 3 部品 + Work タブ（History/Music/FREE 削除・TaskSelector 維持・preset CRUD）+ QA 申し送り 2 件解消（singleton race → upsert ignoreDuplicates+再select / activeInInput フラグ駆動 SSOT 化）+ new-task 結線（navigate のみ・undo/redo は W4 送り）+ REALTIME_TABLES 6 テーブル（publication lockstep 20/20）。テスト 374→402(+28)。ultracode 監査 3 本並列: role-qa PASS with concerns / security approve / sync-auditor 整合 OK（C/H 全ゼロ）
- [chat-main] **PR #68 (W3-0) + PR #69 (W3-A)** web-parity **W3 前半2レーン** ✅（2026-06-10・merged 2026-06-10）— [W3-0] shortcut keydown executor 配線（eventToBinding + useGlobalShortcuts + headless GlobalShortcuts・⌘K/⌘1-5/⌘, 設定駆動化）/ [W3-A] **前提崩れ発見**(timer/sound テーブル不在) → migration 0018(6テーブル・RLS24 policy・2026-06-11 適用実測済) + DataService 22メソッド実装(interface 変更ゼロ)。両 QA PASS with concerns(C/H 0)。子計画書: 2026-06-10-web-parity-w3-work-timer-audio.md

## 予定

- 🛑 **PR #70 (W3-B) merge（ユーザー判断）** → merge 後: main 同期 + build 全数検証 + w3-b-timer-work worktree prune
- 🛑 **PR #71 (CLAUDE.md 三軸スリム化) merge（ユーザー判断）** → merge 後: main 同期 + 計画書 2026-06-11-claude-md-three-axis-slimming.md を COMPLETED 化して archive へ
- 🛑 **W3-C 前のユーザー作業**: Storage 公開バケット `sounds` 作成 + プリセット音源6種アップロード
- **W3-C** — AudioProvider（Optional バリアント）+ ミキサー UI + Storage URL 再生 + **onSessionComplete 結線（完了音/通知）** + sound 3 テーブルの realtime consumer 追加（W3-B merge + バケット作成後）。申し送り: REALTIME_TABLES へ再追加禁止（登録済・重複でテスト落ち）/ self-echo 回避は TimerContext と同構造（write 戻り値を fetch trigger に繋がない）/ 同一 migration ファイルに publication array 2 ブロック禁止（lockstep テスト抽出器の前提）/ AudioContext suspended→resume() 必須
- 👀 **W3-B 実機目視**（merge 後）: Pomodoro 計測→timer_sessions 保存 / WORK→BREAK→LONG_BREAK 遷移（auto-start 含む）/ preset 作成・適用・削除 / TaskSelector タスク紐付け / new-task shortcut で tasks へ navigate
- **既存テーブルの initplan WARN 48 件**（任意・別タスク候補）: 2026-06-11 advisor 実測で calendars/items*meta/payload 系/wiki*\_/routine\_\_ に auth_rls_initplan 警告。0018 新テーブルは 0 件。0010 適用済みのはずの既存テーブルに残存 — 原因調査 + 一括 initplan 化 migration を検討
- 👀 **W1/W2 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ一覧・restore/permanentDelete confirm（+ 統合修復後: settings タブ表示・palette「Go to 設定」）
- 👀 **W3-0 実機目視**（merge 後）: ⌘K パレット / ⌘1-5 section 切替 / ⌘, settings / rebind 即反映 / input 入力中 "n" 非発火 / palette 表示中の ⌘2 裏切替の体感評価（QA Medium・気になれば抑制を別タスク化）
- ローカル merged branch 8本の削除（`git branch -D` は deny ルールのためユーザー実行: chore/batch-a-_ ×2 / docs/web-first-v2-and-bash-rule / feat/w0-_ / feat/w1-_ / feat/w2-_ / fix/w1-w2-merge-integration / chore/tracker-w1-w2）
- **W4** — Analytics + Connect（Tier3・後回し・複雑画面=分割寄り）。W3-B 申し送り: undo/redo 結線（activeInInput:false で input 内 ⌘Z 抑制になる挙動の意図確認 — OS 標準編集 undo に委ねるなら現状が正）/ Skip の cadence 非対称裁定（SET_PHASE は LONG_BREAK へ飛べず completedSessions 不増 — skip() 追加 or 現仕様の正式化）/ new-task の create-and-focus lift（現状 navigate のみ）
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
