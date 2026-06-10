# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] コア運用機構グローバル化 主要部 ✅（2026-06-07）— `~/dev/Claude/hooks-lib` 新設+4hook汎用化(ROOT検出 CLAUDE_PROJECT_DIR基準化)+`setup-per-chat.sh`(冪等/settings.json jqマージ)。novel に per-chat機構適用＋動作確認OK(既存inbox-check無傷)。card-battle は dirty作業ブランチで保留→⑦
- [chat-main] supabase prod バンドル消失疑い → **誤報決着** ✅（2026-06-07）— 原因はworktreeの.env.local欠落でcreateClient tree-shake削除。main(env あり)buildで残存確認・本番正常。memory: project_worktree_supabase_treeshake
- [chat-main] **PR #61** Batch A（web bundle manualChunks + shared relation mapper 6本 +63テスト 307緑）✅（2026-06-07）— Web移行整合監査(Dynamic Workflows 8並列)で抽出した非競合2レーン。QA PASS。branch `chore/batch-a-bundle-mapper-tests`

## 予定

- ⑥ Batch A 残3レーン(web-dataservice-factory/docs-sync-model-update/stale-comment-cleanup)は w0-shared-ui・docs-cleanup の main merge 後
- ⑦ グローバル化 follow-up: card-battle適用(clean後)/novel側per-chat分commit/project-setter更新/life-editorのhooks→hooks-libリンク化(任意)
- W0 全体(W0-1〜6, `feat/w0-shared-design-system`@`e86819e` 未merge)の main merge（git-orchestrator）+ `web/src/_w0demo/` 削除
- **Mobile 基準セクション統一（frontend）の Phase 2 Schedule / Phase 4 Settings は FROZEN（取り下げ）** — frontend は移行 Phase 5 で破棄予定・web に伝播しないため。今後の統一は web-desktop-parity-roadmap（W0-W4）側で実施。Phase 2 設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は web 移植仕様の参照元として保全（master プラン `2026-06-05-mobile-first-section-unification.md`）
- [chat-main] web Phase 2 残: S8 Supabase Realtime（SyncContext no-op→postgres_changes購読+debounce bump+publication migration 0017）/ S9 モバイルレスポンシブ（本番web/）
- [chat-main] Perf follow-up: M4（useScheduleItemsRoutineSync の syncScheduleItemsWithRoutines を updateFutureScheduleItemsByRoutine に一括化）/ M1（note一覧content_json除外・遅延取得+検索移行の設計変更要
- **Known Issue 025 Fixed 化**（任意・軽量）: prototype 系 worktree 関連。`prototype/mobile-ui` worktree は現在も生存中のため要状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
