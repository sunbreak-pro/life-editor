# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- narrow 幅の TagEditModal 2 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1526 タグ編集パネルに閉じるボタンが無い / PR #1563**（ヘッダーを自前で組み 44px の × を追加・`closeLabel` は必須 prop）・**#1562 narrow のタップ対象が 44px 未満 / PR #1568**（#1512 残件。呼び出し側に `CARD_BTN_TAP` = `max-md:min-h-11` を載せる形で `Button` の size 表は不動）。2 本とも CI `verify` 全ステップをローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-09-07）
- narrow 幅の Settings 2 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1525 カテゴリを選んでもドロワーが閉じない / PR #1532**（narrow のときだけ detail panel を `close`。Tips は modal なので据え置き）・**#1527 ゴミ箱のタイトル列が 111px / PR #1534**（narrow の行を 2 段にしてタイトルを約 270px へ）。2 本とも CI `verify` 全ステップ + `docs-lint` をローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-09-06）
- Settings まわり 3 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1210 AI 連携の可視化 / PR #1307**（Settings の AI カード + ビルド時生成 MCP ツールカタログ 35 本 + Briefing 帰属バッジ）・**#1293 Trash を Settings 配下へ / PR #1317**（section registry から `trash` を落とし Settings のカテゴリ行へ）・**#1294 ごみ箱の複数選択と一括削除 / PR #1323**。3 本とも CI `verify` 全ステップ + `docs-lint` をローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-08-30）
- Settings の見た目の小傷 2 件: #1243（ja だけカテゴリ行「予定」と本文見出し「スケジュール」で呼び名が割れる → `settings.schedule` を `section.schedule` に合わせ、同ペインの hint も揃えた / PR #1261 open）と #1253（狭幅フォントサイズのラベル二重表示 → `SettingsSegment` に `hideLabel`・大 22px でテーマカードの "System" が溢れる → ラベル行を `flex-wrap` + `min-w-0` + `break-words` / PR #1271 open）。どちらもローカル CI verify 15 ステップ + GitHub CI 両ジョブ全緑。溢れの実表示だけ jsdom で測れず merge 後 chat-main へ送った ✅（2026-08-30）

## 予定

- **#1294（PR #1323）は #1275（PR #1321）の後**: 作業中に #1321 が立ち、`TrashView.tsx` / `trashView.test.tsx` / `TrashScreen.tsx` の 3 本が丸ごと重なった。#1321 merge → 本ブランチで main 取り込み → 衝突解消 の順。あわせて #1294 が足した一括処理の部分失敗バンド（`trash.bulkPartialFailure`）を NoticePanel へ寄せる
- **#1210 の計画書 archive**: `2026-08-29-ai-integration-visibility.md` は PR #1307 上で `IN PROGRESS`。merge 後に COMPLETED + `archive/` へ移す（👀 目視ゲート = Settings カード / Briefing バッジ / Mobile 幅 も merge 後 chat-main 側）
- #1200 のゲート後始末: ユーザーが `db push` と `functions deploy` を踏んだら、テストアカウントで実退会 E2E（再ログイン不可・当該 user_id の行 0 件）を確認して Issue を閉じる
- #1182 の px 値詰め: 実機で 14 / 18 / 22px の当たりを見て、必要なら `MOBILE_FONT_SIZE_STEPS` を 1 行差し替える
- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
