# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- 閉じて起動し直すと設定とツアー進捗が初期化される **#1775 / PR #1779**: 原因は #1636 の origin ではなく**プロセス**だった。`requestSingleInstanceLock` が 1 箇所も無く `closeToTray` 既定 true のため、2 回目の起動が 2 つ目の Electron プロセスを立て、Chromium の `Local Storage/leveldb` ロックを取れずに空の localStorage で動いていた。実機で 3 プロセス同居まで再現し、CDP で `life-editor-theme` が `"light"`（既定）対 `"dark"`（実値）・ツアー進捗が `null` 対 実値になることを実測。修正は main 2 行（lock 取得失敗で `app.exit(0)` / `second-instance` で `showMainWindow`）+ テキスト照合テスト 5 件。インストール済みビルドの asar を展開して main だけ差し替えたコピーで runtime 検証済み。CI `verify` 全ステップ + `docs-lint` ローカル全緑。インストーラ再作成での最終確認は 🛑 ユーザー手番 ✅（2026-09-20）
- Desktop 再起動で端末ローカル設定が消える **#1636 / PR #1649**: packaged renderer の配信を `loadFile`（`file://`）から `app://bundle/` に替え、origin を作って localStorage を永続化した。方式 A（カスタムスキーム）採用・B（IPC storage adapter）は shared の同期読み出しを全面的に非同期化するため不採用。#838 の認証ストレージ（main + safeStorage）は不変。新規 `desktop/src/main/appProtocol.ts` + テスト 21 件。CI `verify` 15 ステップ + `docs-lint` をローカル全緑。packaged 実機での再起動確認は PR に手順を書いて 🛑 ユーザー手番 ✅（2026-09-16）
- narrow 幅の TagEditModal 2 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1526 タグ編集パネルに閉じるボタンが無い / PR #1563**（ヘッダーを自前で組み 44px の × を追加・`closeLabel` は必須 prop）・**#1562 narrow のタップ対象が 44px 未満 / PR #1568**（#1512 残件。呼び出し側に `CARD_BTN_TAP` = `max-md:min-h-11` を載せる形で `Button` の size 表は不動）。2 本とも CI `verify` 全ステップをローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-09-07）
- narrow 幅の Settings 2 件を 1 課題 = 1 ブランチ（origin/main 分岐）で実装し PR まで: **#1525 カテゴリを選んでもドロワーが閉じない / PR #1532**（narrow のときだけ detail panel を `close`。Tips は modal なので据え置き）・**#1527 ゴミ箱のタイトル列が 111px / PR #1534**（narrow の行を 2 段にしてタイトルを約 270px へ）。2 本とも CI `verify` 全ステップ + `docs-lint` をローカル全緑。merge は P-001 でユーザー手番のため未実施 ✅（2026-09-06）

## 予定

- **#1294（PR #1323）は #1275（PR #1321）の後**: 作業中に #1321 が立ち、`TrashView.tsx` / `trashView.test.tsx` / `TrashScreen.tsx` の 3 本が丸ごと重なった。#1321 merge → 本ブランチで main 取り込み → 衝突解消 の順。あわせて #1294 が足した一括処理の部分失敗バンド（`trash.bulkPartialFailure`）を NoticePanel へ寄せる
- **#1210 の計画書 archive**: `2026-08-29-ai-integration-visibility.md` は PR #1307 上で `IN PROGRESS`。merge 後に COMPLETED + `archive/` へ移す（👀 目視ゲート = Settings カード / Briefing バッジ / Mobile 幅 も merge 後 chat-main 側）
- #1200 のゲート後始末: ユーザーが `db push` と `functions deploy` を踏んだら、テストアカウントで実退会 E2E（再ログイン不可・当該 user_id の行 0 件）を確認して Issue を閉じる
- #1182 の px 値詰め: 実機で 14 / 18 / 22px の当たりを見て、必要なら `MOBILE_FONT_SIZE_STEPS` を 1 行差し替える
- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
