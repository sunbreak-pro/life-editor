# MEMORY (chat-main)

## 進行中

（DU-F / Worktree Policy / DU archive cleanup すべて完了。次の進行中タスクは未着手）

## 直近の完了

- **DU archive cleanup**（2026-05-24 chore/du-archive-cleanup）
  - DU 親計画書 + DU-B 親+子 計 3 plans を `.claude/archive/` へ移動 + Status: COMPLETED
  - memory/chat-main.md の DU-F 進行中エントリ + stale 予定を整理
  - data-unification/items-meta-redesign branch を retire（local `-D` + remote `gh api DELETE`）
- **Multi-chat Worktree Policy** ✅（2026-05-24 PR #26 merged, `a649458`）
  - "1 chat = 1 worktree = 1 branch" 規約 (CLAUDE.md §7.4 / hook 検査 F / lead-pipeline / session-manager / git-orchestrator §2.5)
- **DU-F Step 6-14 + Notes/Daily 永続化 Unified bridge fix** ✅（2026-05-24 PR #25 merged, `94e32ba`）
  - 4 role 共通 Tag/Link UI (TagPill / TagPicker / LinkPanel) + wiki_tag_groups CRUD (WikiTagsManagementView)
  - 親計画書 DoD 達成宣言 / CLAUDE.md §4.3 composite FK + Routine UX / 移行 SSOT に DU レーン完了記録
  - 実機検証で顕在化した Notes/Daily 永続化 (legacy stub error) + RLS items_meta exists check 403 を bridge delegate で同時 fix
- **DU-F Step 1-5**: WikiTagsUnifiedProvider 配置 + CalendarTag 死削除 ✅（2026-05-24 commit `074ec53`）
- **subagent self-contained brief 規約 + worktree integrity 改善** ✅（2026-05-24 PR #22 merged）
- **Anthropic Cloud Routine 2 本セットアップ**（朝の歴史学習 + 帰宅時モバイル開発準備）✅（2026-05-24）

## 予定

- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path (4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI)
- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- DU-G Notes/Daily Unified 完全切替（SupabaseNotesUnifiedService 機能拡張 + Provider 切替 + UI 動作確認。スケルトン `2026-05-25-data-unification-g-notes-daily-unified.md`）
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立に進められる
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- worktree cleanup 判断: `worktree-policy` worktree（PR #26 merged で本来不要、prune 候補）
