# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- **Autonomous Dev Routine（夜間 Cloud Routine + 安全レール）** ✅（2026-05-31 PR #37 merged）
  - 夜間自律開発ルーチン本体 + 安全レール。`git reset --hard origin/main` で破棄された draft tracker commit (`b488599` "PR #37 draft") を実態（MERGED）で再記録
- **Multi-chat Worktree Policy proactive rollout** ✅（2026-05-26 PR #33 merged, `15941c1`）
  - `.session-branch` 言及を reactive→proactive 化（session-manager / git-orchestrator / lead-pipeline / CLAUDE.md §7.4 を「worktree 作成 4 ステップ 1 セット」へ）
  - 統合計画書 `2026-05-25-worktree-rollout-and-cleanup.md`（du-g セットアップ Annex A/B + 規約整備 R2-_ + prototype+mobile-ui 退役 P3-_）
  - Known Issue 028 作成（Bash `cd` が worktree 跨ぎで持続 → `git -C` / サブシェル推奨）
- **DU-G G1-G3**（Notes/Dailies Unified Service + Provider+web 切替）✅（2026-05-26 PR #29/#30/#31 merged）

## 予定

- **Known Issue 025 Fixed 化**（任意・軽量）: prototype 系 worktree 関連。`prototype/mobile-ui` worktree は現在も生存中のため要状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
