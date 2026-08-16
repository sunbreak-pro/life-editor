# MEMORY (chat-shared-fix)

## 進行中

- **#1002 = 順序待ち**（難しさではなく衝突回避）: 触る `mcp-server/tests/searchSupabaseStub.ts` を open PR #1021（#1003）が変更中。**#1021 merge 後に着手**する
- **#993 = 判断待ち**（`D-20260816-shared-fix-6` をキューに提出済み）: 購読リストに lockstep の見張りが 2 本あり、Scope どおり 1 行消すだけでは通らない。DDL を打つか不変式を変えるかの二択
- **#992 = 計測待ち**: Issue 本文が「実データの行数 / FPS を測ってから着手」と着手条件を明記。計測は chat-main 手番

## 直近の完了

- #991 初回ダウンロードを **gzip 586 → 361 KB（−38.5%）**・先読みファイル 5 → 1（効いていなかった理由は「重い 2 つが別の入口から引き戻されていた」— TipTap は Briefing / Daily / Todo 詳細の直 import、recharts は shared の朝刊パネル経由。`manualChunks` はファイルを分けるだけでダウンロードは分けないので撤去。見張り 2 本を追加 — PR #1027 open・Closes 付き）✅（2026-08-16）
- #1011 環境変数で落ちるテストを直した（`getSupabase` をスパイにして「DB まで届いたか」を直接見る。**資格情報あり / なしの両方で 288/288** — PR #1026 open・Closes 付き）✅（2026-08-16）
- #1008 BottomSheet の下部 safe-area（`pb-6` → `pb-[max(1.5rem,env(safe-area-inset-bottom))]`。fullScreen は inline style で加算のまま = 別ルールなのでテストで両方留めた — PR #1024 open・Closes 付き）✅（2026-08-16）
- #1003 `search_all` の LIKE エスケープと NULL `task_type`（後者は #702 ② が `list_todos` で塞いだ穴の取り残し。新テスト 3 本が修正前に落ちることを実測 — PR #1021 open・Closes 付き）✅（2026-08-16）
- #1004 README の陳腐化した列挙を参照形へ（**場所は Issue 記載の `docs/requirements/README.md` ではなく repo 直下の `README.md`**。`LIFE_EDITOR_DB_PATH` / `FILES_ROOT` がコードにも `.mcp.json` にも無い死んだ変数と実測 — PR #1019 merged）✅（2026-08-16）
- #1001 mcp-server の tests に型検査ゲートを追加（**初回検査で実ドリフト 24 件**。23 件が `.catch(e => e as Error)` の型偽装で、reject しなくなると的外れな失敗文になる罠つき → `tests/rejection.ts` へ集約。テスト用 config は bundler 解決 = vitest の実際の解決に合わせた — PR #1017 merged）✅（2026-08-16）
- #947 `mobile-web-app-capable`（標準名）の meta を追加して Chrome の deprecation 警告を消した（apple 版は残す = 置き換えではなく併記。Chrome は標準名しか読まず iOS Safari は apple 版しか読まないため。`web/index.html` 1 ファイル・PR #977 open・Closes 付き。CLAUDE.md §7.1 の全ゲート緑）✅（2026-08-16）
- #956 パスワードの最小長 6 → 12（`D-20260816-shared-fix-4` = A の実装。数値は `shared/src/constants/password.ts` の `PASSWORD_MIN_LENGTH` 1 箇所で、en / ja 文言は `{{min}}` 差し込みに変えて数値を持たない — PR #967 open・Closes 付き。回答済み判断 5 件の台帳昇格も同日）✅（2026-08-16）
- #919 パスワードの変更 / 再設定の導線（`detectSessionInUrl` を全面 true = `D-20260816-shared-fix-1` / サインイン画面の「忘れた場合」→ リンク要求 → 再設定 / Settings のアカウントカード。security-reviewer 通過後にリロード抜けと URL フラグメント残りを追加修正 — PR #930 merged・Closes 付き）✅（2026-08-16）
- #874 Mobile の詳細・編集パネルを全画面化 + 背後が持ち上がる原因の除去（`BottomSheet` に `fullScreen` / `AppShell` のタブバーを unmount → `invisible` — PR #917 merged・Closes 付き・実機目視は merge 後 chat-main）✅（2026-08-15）

## 予定

- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測（ここが済むまでリカバリーは通し確認できない）② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（揃えるまで「アプリは 12 を求めるのに実際は 6 で通る」状態が残る。手順は PR #967 本文）
- #700（MCP 検証用ツール）— verification 3 ツールと Step 2 記録は chat-main 側で進行済みの形跡（main の tools.ts + tracker 記録）。着手前に重複がないか状況確認
- PR #828 / #832 merge 後、#782 は Closes で自動 close（#822 の merge で既に close 済みの可能性 — 3 本出揃いの旨は各 PR 本文に記載済み）
- outbox に積んだ起票依頼の消化は chat-main の手番: 2026-08-13 の 4 件（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）+ 2026-08-16 の 3 件（公開 Web の CSP / Referrer-Policy・#956 で古くなった他レーン docs 2 本・**#947 のついでに見つけた manifest `theme_color` のライト固定**）
- #947 の実機確認は merge 後 chat-main の手番（コンソールに当該警告が出ないことの目視。worktree では dev server / playwright を起動しない規約 = CLAUDE.md §7.4）
- **#1007 / #999 は close 推奨として outbox に出した**（どちらも実装不要と実測で確定）: #1007 = `<meta name="theme-color">` が manifest を上書きするため**ツールバーは既にテーマ追従済み**（起票時に precedence を確認しなかった私の不正確な報告が発端）／ #999 = 対象 2 つとも #876 と #874 + #831 で消えており `92vh` はリポジトリ全体で 0 件
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 がその決定の却下案を、決定自身が書いた復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き（改名するなら移行が要る）。機能名「Tasks」は 2026-08-14 に全 live docs で改名済み
- #874 / #880 とも実機での見え方は未確認（worktree では実ブラウザ検証をしない規約）。特に #874 は「全画面にしなかったシートで、キーボードの上に残る不可視の帯」が新しく生じる見え方なので merge 後の chat-main 実測が要る
