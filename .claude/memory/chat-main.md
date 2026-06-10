# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **PR #66** W1/W2 merge 後検証 + 統合修復 ✅（2026-06-10・merged f652a542）— #62/#63/#64 連続 squash merge の競合解決で W1 hunks 脱落 → main web build 破損を全数検証で検出。barrel に Settings 系 export 復元 / MainScreen に settings セクション + ShortcutConfigProvider 復元・#62 factory 一本化 / section.settings キー追加。shared build/web build/shared test 339緑/web lint 0 err。merged worktree 7個 prune 済（ローカル branch 削除はユーザー実行待ち）。**教訓: 同一ファイルを触る連続 squash merge 後は main で build 全数検証必須**
- [chat-main] **PR #64** web-parity **W2**（Trash + CommandPalette）✅（2026-06-09・merged 2026-06-10）— CommandPalette(Cmd+K/Ctrl+K・IMEガード・純粋部品i18n props化) + TrashView(5カテゴリ復元/完全削除・Modal confirm) を shared へ / web TrashScreen host が DataService 直叩き / DB変更ゼロ。role-qa PASS(C/H/M=0)。計画書 archive 済
- [chat-main] **PR #63** web-parity **W1**（Theme/FontSize/Language/Settings/ShortcutConfig）✅（2026-06-09・merged 2026-06-10）— web に Theme基盤新設(dark/light+font10段+language)を shared集約 / ShortcutConfig(Optionalバリアント) / Settings画面。role-qa PASS with concerns(C/H=0)。**申し送り: shortcut押下executor未配線→W3+で配線**。計画書 archive 済

## 予定

- 👀 **W1/W2 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ一覧・restore/permanentDelete confirm（+ 統合修復後: settings タブ表示・palette「Go to 設定」）
- **W3** — Work / Timer / Audio 統合（prototype-mobile チャットと境界調整要・着手前に comm 確認）。**W1 申し送りの shortcut keydown executor 配線をここで**（matchEvent→setSection/undo/redo/openPalette を MainScreen に）
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
