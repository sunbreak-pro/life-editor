# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **W3-C（Web Audio Mixer + 完了音）** ✅ merged（2026-06-14・PR #75 squash `ca0dbe1b`）— AudioProvider(Optional・Pattern A 3ファイル) + 環境音5種ミキサー(rain/wind/ocean/birds/fire・thunder無し) + Storage公開URL再生(DataService.getSoundAssetUrl・Proxy登録) + 完了音(host ref-bridge で TimerProvider.onSessionComplete 結線) + sound_settings realtime consumer(syncVersion・self-echo回避) + AudioMixer pure primitive。独立監査3本(role-qa PASS / security approve / sync-auditor 整合OK)+polish2件適用。**merge 後処理完了**: main 同期(ca0dbe1b)+ worktree w3-c-audio prune + 計画書 COMPLETED→archive + build 全数検証 + Storage `sounds`(public) に音源6種アップロード確認済(birds/complete/fire/ocean/rain/wind.mp3)。**残: 👀 実機目視のみ**
- [chat-main] **main 同期**（PR #73 squash 7a46fbb7 + #74 b8bdec2c 取込）✅（2026-06-14）— local main 分岐(local3/remote2)を byte 一致検証の上 `reset --hard origin/main` で解消(損失ゼロ)。HEAD=7a46fbb7
- [chat-main] **PR #70/#71 merge 後処理** ✅（2026-06-11）— main 同期 + build 全数検証 + w3-b prune + 計画書 archive + W3-C 前提実測

## 予定

- 👀 **W3-C 実機目視**（merge済・要確認）: トグルでループ再生 / スライダー音量 / 複数同時ミックス / フェーズ完了で完了音1回 / 初回操作後 resume 発音 / cross-tab 設定反映。バケット `sounds` + 音源6種は本番反映済
- 🛑 **`feat/w3c-audio-mixer` branch 削除**（local + remote。`git branch -D` / `git push origin --delete` は deny ルールのためユーザー実行）
- 👀 **W3-B 実機目視**（merge後）: Pomodoro 計測→timer_sessions 保存 / WORK→BREAK→LONG_BREAK 遷移（auto-start 含む）/ preset 作成・適用・削除 / TaskSelector タスク紐付け / new-task shortcut で tasks へ navigate
- **既存テーブルの initplan WARN 48 件**（任意・別タスク候補）: calendars/items*meta/payload系/wiki*/routine\_ に auth_rls_initplan 警告。0018 新テーブルは 0 件。0010 適用済みのはずの既存に残存 — 原因調査 + 一括 initplan 化 migration
- 👀 **W1/W2/W3-0 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ・restore/permanentDelete confirm / [W3-0] ⌘K パレット・⌘1-5 section・⌘, settings・rebind 即反映・input 入力中単キー非発火
- **W4** — Analytics + Connect（Tier3・後回し・複雑画面=分割寄り）。W3-B 申し送り: undo/redo 結線（activeInInput:false の input 内 ⌘Z 抑制の意図確認）/ Skip の cadence 非対称裁定（SET_PHASE は LONG_BREAK へ飛べず completedSessions 不増）/ new-task の create-and-focus lift（現状 navigate のみ）
- W1 残 Low（非ブロッキング・別バッチ）: `text-white` の accent オン文字トークン化 / `FONT_SIZE_PX` の ThemeContext↔SettingsAppearance 重複を `constants/` 一元化
- **Mobile 基準セクション統一（frontend）の Phase 2 Schedule / Phase 4 Settings は FROZEN（取り下げ）** — frontend は移行 Phase 5 で破棄予定・web に伝播しないため。Phase 2 設計は web 移植仕様の参照元として保全（master プラン `2026-06-05-mobile-first-section-unification.md`）
- web Phase 2 残: S8 Supabase Realtime（実装済）/ S9 モバイルレスポンシブ（本番 web/）
- Perf follow-up: M4（useScheduleItemsRoutineSync の一括化）/ M1（note一覧 content_json 除外・遅延取得+検索移行の設計変更要）
- **Known Issue 025 Fixed 化**（任意・軽量）: `prototype/mobile-ui` worktree 状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）/ DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）
