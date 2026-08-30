# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- Settings の見た目の小傷 2 件: #1243（ja だけカテゴリ行「予定」と本文見出し「スケジュール」で呼び名が割れる → `settings.schedule` を `section.schedule` に合わせ、同ペインの hint も揃えた / PR #1261 open）と #1253（狭幅フォントサイズのラベル二重表示 → `SettingsSegment` に `hideLabel`・大 22px でテーマカードの "System" が溢れる → ラベル行を `flex-wrap` + `min-w-0` + `break-words` / PR #1271 open）。どちらもローカル CI verify 15 ステップ + GitHub CI 両ジョブ全緑。溢れの実表示だけ jsdom で測れず merge 後 chat-main へ送った ✅（2026-08-30）
- #1174 merge 後の追随（2 本のコンフリクト解消）: #1182 / #1200 のブランチへ main を取り込み、Settings 画面・i18n catalog・shared barrel の衝突を手で解消して再 push。#1174 が Appearance / Account カードを `general` カテゴリの内側へ移したのが原因で、#1200 側はさらに main の `passwordRecoveryRedirectUrl` → `authRedirectUrl` 改名（#1197）も当たった（PR #1223 CI 緑 / PR #1229 は再走中）✅（2026-08-30）
- Settings 3 課題を各ブランチで実装し PR まで（#1174 rightSidebar カテゴリタブ + Schedule 初期ビュー / PR #1218 merged・#1182 狭幅の文字サイズ 3 段階 / PR #1223 open・#1200 セルフ退会 + 狭幅ログアウト / PR #1229 open。#1200 は 🛑 人手ゲート 2 手が `G-20260829-settings-1` として decisions キューに残る）✅（2026-08-29）

## 予定

- #1200 のゲート後始末: ユーザーが `db push` と `functions deploy` を踏んだら、テストアカウントで実退会 E2E（再ログイン不可・当該 user_id の行 0 件）を確認して Issue を閉じる
- #1182 の px 値詰め: 実機で 14 / 18 / 22px の当たりを見て、必要なら `MOBILE_FONT_SIZE_STEPS` を 1 行差し替える
- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
