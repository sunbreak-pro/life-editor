# MEMORY (chat-main)

## 進行中

### 🔧 DU-G G1: Notes Unified Service 機能拡張（着手日: 2026-05-24）

**対象**: `shared/src/services/{SupabaseNotesUnifiedService,DataService,SupabaseDataService}.ts` + `shared/src/services/__tests__/SupabaseNotesUnifiedService.*.test.ts`
**計画書**: `.claude/docs/vision/plans/2026-05-25-data-unification-g-notes-daily-unified.md`
**worktree**: `.claude/worktrees/du-g/`（branch `feat/du-g-notes-daily-unified`）

- 4 PR 直列分割: **G1 (Notes Service)** → G2 (Dailies Service) → G3 (Provider+web 切替) → G4 (legacy 死削除)
- G1 規模: +900 行 / +20 vitest / 5 新規メソッド (password / lock / search) + 4 既存メソッド完全化
- テスト戦略: 後追い検証（メソッド実装→vitest 追加サイクル）
- 現在: role-engineer (background) で実装中。完了後に session-verifier → role-qa → PR

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
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立に進められる
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。SECURITY DEBT 解消。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- worktree cleanup 判断: `worktree-policy` worktree（PR #26 merged で本来不要、prune 候補）
