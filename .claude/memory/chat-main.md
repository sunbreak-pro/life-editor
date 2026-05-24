# MEMORY (chat-main)

## 進行中

（DU-F クローズ済。次の進行中タスクは未着手）

## 直近の完了

- **DU-F Step 6-14 + Notes/Daily 永続化 Unified bridge fix** ✅（2026-05-24 commit `8a45397`）
  - 4 role 共通 Tag/Link UI (TagPill / TagPicker / LinkPanel) + wiki_tag_groups CRUD (WikiTagsManagementView)
  - 親計画書 DoD 達成宣言 / CLAUDE.md §4.3 一行追記 / 移行 SSOT に Data Unification レーン完了記録
  - DU-G + Link UX 強化 のスケルトン計画書作成
  - 実機検証で顕在化した Notes/Daily 永続化 (legacy stub error) + RLS items_meta exists check 403 を bridge delegate で同時 fix
  - DU-C+ / DU-F 両計画書を `.claude/archive/` に Status=COMPLETED で移動
- DU-F Step 1-5: WikiTagsUnifiedProvider 配置 + CalendarTag 死削除 ✅（2026-05-24 commit `074ec53`）
- subagent self-contained brief 規約 + worktree integrity 改善（PR #22 draft）✅（2026-05-24）
- Anthropic Cloud Routine 2 本セットアップ（朝の歴史学習 + 帰宅時モバイル開発準備）✅（2026-05-24）

## 予定

- 👀 ユーザー実機確認待ち: DU-C-6 (Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ)
- 🛑 DU-F 完了後の PR レビュー + main へ merge（role-qa 別コンテキストで監査予定）
- DU-G Notes/Daily Unified 完全切替（SupabaseNotesUnifiedService 機能拡張 + Provider 切替 + UI 動作確認。スケルトン `2026-05-25-data-unification-g-notes-daily-unified.md`）
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立に進められる
- DU-E Calendar 2 ビュー再実装（DU-F / DU-G 完了後）
- DU-B 子計画書 + 詳細計画書の archive 移動（DU-B 全体クローズ時）
