# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- **Multi-chat Worktree Policy proactive rollout** ✅（2026-05-26 PR #33 merged, `15941c1`）
  - `.session-branch` 言及を reactive→proactive 化（session-manager / git-orchestrator / lead-pipeline / CLAUDE.md §7.4 を「worktree 作成 4 ステップ 1 セット」へ）
  - 統合計画書 `2026-05-25-worktree-rollout-and-cleanup.md`（du-g セットアップ Annex A/B + 規約整備 R2-_ + prototype+mobile-ui 退役 P3-_）
  - Known Issue 028 作成（Bash `cd` が worktree 跨ぎで持続 → `git -C` / サブシェル推奨）
  - prototype+mobile-ui worktree は prune 済確認
- **DU-G G1-G3**（Notes/Dailies Unified Service + Provider+web 切替）✅（2026-05-26 PR #29/#30/#31 merged）
- **DU archive cleanup**（2026-05-24 chore/du-archive-cleanup）

## 予定

- **du-g worktree セットアップ → Notes/Daily Unified Service 本作業**（次セッション）: 別チャットで起動 → `role-pm` を呼び要件固めからスタート。worktree `feat/du-g-notes-daily-unified` は計画書 Annex A/B の手順で新規作成
- **du-g3 worktree 退役判断**（別チャット）: PR #31 で main 着地済、cleanup 基準（PR merged + 固有 commit 0 + dirty なし + active session 0）を満たすか確認 → 退役コマンド提示
- **Known Issue 025 Fixed 化**（任意・軽量）: prototype+mobile-ui worktree prune 済で実質解決。INDEX を Active→Fixed へ
- **DU-G G4**（legacy 死削除）: 4 PR 直列分割の最終。G1-G3 完了済
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
