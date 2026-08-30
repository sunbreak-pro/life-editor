# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- Settings まわり 3 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1210 AI 連携の可視化 / PR #1307**（Settings の AI カード + ビルド時生成 MCP ツールカタログ 35 本 + Briefing 帰属バッジ）・**#1293 Trash を Settings 配下へ / PR #1317**（section registry から `trash` を落とし Settings のカテゴリ行へ）・**#1294 ごみ箱の複数選択と一括削除 / PR #1323**。3 本とも CI `verify` 全ステップ + `docs-lint` をローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-08-30）
- Settings の見た目の小傷 2 件: #1243（ja だけカテゴリ行「予定」と本文見出し「スケジュール」で呼び名が割れる → `settings.schedule` を `section.schedule` に合わせ、同ペインの hint も揃えた / PR #1261 open）と #1253（狭幅フォントサイズのラベル二重表示 → `SettingsSegment` に `hideLabel`・大 22px でテーマカードの "System" が溢れる → ラベル行を `flex-wrap` + `min-w-0` + `break-words` / PR #1271 open）。どちらもローカル CI verify 15 ステップ + GitHub CI 両ジョブ全緑。溢れの実表示だけ jsdom で測れず merge 後 chat-main へ送った ✅（2026-08-30）
- #1174 merge 後の追随（2 本のコンフリクト解消）: #1182 / #1200 のブランチへ main を取り込み、Settings 画面・i18n catalog・shared barrel の衝突を手で解消して再 push。#1174 が Appearance / Account カードを `general` カテゴリの内側へ移したのが原因で、#1200 側はさらに main の `passwordRecoveryRedirectUrl` → `authRedirectUrl` 改名（#1197）も当たった（PR #1223 CI 緑 / PR #1229 は再走中）✅（2026-08-30）

## 予定

- **#1294（PR #1323）は #1275（PR #1321）の後**: 作業中に #1321 が立ち、`TrashView.tsx` / `trashView.test.tsx` / `TrashScreen.tsx` の 3 本が丸ごと重なった。#1321 merge → 本ブランチで main 取り込み → 衝突解消 の順。あわせて #1294 が足した一括処理の部分失敗バンド（`trash.bulkPartialFailure`）を NoticePanel へ寄せる
- **#1210 の計画書 archive**: `2026-08-29-ai-integration-visibility.md` は PR #1307 上で `IN PROGRESS`。merge 後に COMPLETED + `archive/` へ移す（👀 目視ゲート = Settings カード / Briefing バッジ / Mobile 幅 も merge 後 chat-main 側）
- #1200 のゲート後始末: ユーザーが `db push` と `functions deploy` を踏んだら、テストアカウントで実退会 E2E（再ログイン不可・当該 user_id の行 0 件）を確認して Issue を閉じる
- #1182 の px 値詰め: 実機で 14 / 18 / 22px の当たりを見て、必要なら `MOBILE_FONT_SIZE_STEPS` を 1 行差し替える
- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
