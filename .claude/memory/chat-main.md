# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **PR #64** web-parity **W2**（Trash + CommandPalette）✅（2026-06-09・未merge）— CommandPalette(Cmd+K/Ctrl+K・IMEガード・純粋部品i18n props化) + TrashView(5カテゴリ tasks/notes/dailies/routines/events 復元/完全削除・Modal confirm・書き直し) を shared へ / web TrashScreen host が DataService 直叩き(per-section Provider制約) / DB変更ゼロ。shared build/web build/shared test 328緑(新規10)/web lint緑。role-qa PASS(C/H/M=0・5カテゴリ配線を実装本体まで遡り取り違えゼロ確認)。Low(untitled→common.untitled新設)修正取込。子計画書: 2026-06-08-web-parity-w2-trash-palette.md
- [chat-main] **PR #63** web-parity **W1**（Theme/FontSize/Language/Settings/ShortcutConfig）✅（2026-06-09・未merge）— web に Theme基盤新設(dark/light+font10段12-25px+language)を shared集約・documentElementに data-theme/font-size適用・localStorage永続化 / ShortcutConfig(Optionalバリアント) / Settings画面(レスポンシブ単一) / Shortcut ID web実在10件選別(nav再キー)。shared build/web build/shared test 332緑/web lint緑。role-qa PASS with concerns(C/H=0)。Low#1(accent token名)修正取込。**申し送り: shortcut押下executor未配線(Step7スコープ外)→W3+で配線**。子計画書: 2026-06-07-web-parity-w1-ux-settings.md
- [chat-main] **PR #62** Batch A 残3レーン（factory集約 + S8 comment正確化 + CLAUDE.md sync §10修正）✅（2026-06-08）— w0/docs マージ後に実施。QA が comment の技術誤り(schedule_items×Realtime因果)をP1検出→修正反映。shared 321緑/web build緑

## 予定

- 🛑 **W1 PR #63 / W2 PR #64 の merge**（ユーザー判断）。merge 順序は **W1→W2 推奨**（両者 `shared/src/components/index.ts` + i18n locales を触る・W1 先で W2 マージ時 i18n JSON 軽微競合回避）。merge 後 worktree prune（w1-ux-settings / w2-trash-palette）
- 👀 **W1/W2 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ一覧・restore/permanentDelete confirm
- **W3** — Work / Timer / Audio 統合（prototype-mobile チャットと境界調整要・着手前に comm 確認）。**W1 申し送りの shortcut keydown executor 配線をここで**（matchEvent→setSection/undo/redo/openPalette を MainScreen に）
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
