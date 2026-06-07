# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] web-desktop parity **W0-4/5/6**（i18n 基盤 + 共有 UI mount 検証 + 2層モデル記録）✅（2026-06-07）— react-i18next + en/ja locales（各 1778 key・parity 一致）/ 共有 i18n provider / web mount 検証 / coding-principles §6「2層モデル」記録 + CLAUDE.md/移行SSOT に Option A 記録。**role-qa + security-reviewer 並列独立監査 PASS**（Critical/High 0）。worktree `w0-shared-ui` / branch `feat/w0-shared-design-system` @`e86819e`（**未 merge**）。follow-up: W0 sign-off 時に `web/src/_w0demo/` 削除
- [chat-main] セクション統一 Phase 3 Materials dead code 整理 ✅（2026-06-07, PR #53 merged `9349d12`）— Daily/Notes は既に共有済みのため統一作業不要、未使用 Mobile 6 ファイル削除のみ（Files タブは Desktop 維持）
- [chat-main] web Phase 2 perf改善 + S7オフラインバナー + RLS migration本番適用 ✅（2026-06-03, PR #43/#44 merged）— WikiTags N+1解消 / Note・Task tree O(1) / Schedule debounce / TipTap lazy / offline banner / 0015 dailies initplan + 0016 events routine owner

## 予定

- **Mobile 基準セクション統一（frontend）の Phase 2 Schedule / Phase 4 Settings は FROZEN（取り下げ）** — frontend は移行 Phase 5 で破棄予定・web に伝播しないため。今後の統一は web-desktop-parity-roadmap（W0-W4）側で実施。Phase 2 設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は web 移植仕様の参照元として保全（master プラン `2026-06-05-mobile-first-section-unification.md`）
- [chat-main] web Phase 2 残: S8 Supabase Realtime（SyncContext no-op→postgres_changes購読+debounce bump+publication migration 0017）/ S9 モバイルレスポンシブ（本番web/）
- [chat-main] Perf follow-up: M4（useScheduleItemsRoutineSync の syncScheduleItemsWithRoutines を updateFutureScheduleItemsByRoutine に一括化）/ M1（note一覧content_json除外・遅延取得+検索移行の設計変更要
- **Known Issue 025 Fixed 化**（任意・軽量）: prototype 系 worktree 関連。`prototype/mobile-ui` worktree は現在も生存中のため要状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
