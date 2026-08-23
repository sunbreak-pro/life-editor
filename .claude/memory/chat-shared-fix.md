# MEMORY (chat-shared-fix)

## 進行中

### 🔄 7 件一括（/goal・着手日: 2026-08-23）— 3 件 PR 済み・4 件残

対象 = #1103 / #993 / #1086 / #1102 / #1087 / #1079 / #992。**各 Issue に origin/main から切ったブランチ + CI verify 全ステップ緑 + PR** が完了条件。

- 済: **#1103**（PR #1111 = **merged**）・**#993**（PR #1117 open）・**#1086**（PR #1119 open）
- 残: **#1102**（偵察済み・実装のみ）/ **#1087**（判断 2 件が要る）/ **#1079**（**偵察が API エラーで欠落・要やり直し**）/ **#992**（下記のとおり前提が崩れた）

### 🛑 #992 は「実装するか close するか」の判断待ちになった（2026-08-23）

**#994 の実ブラウザ計測が着地し（PR #1112 merged）、#992 は今日の実データでは再現しないと確定した。**

- レポート §8.3 = ノート 5 / Daily 3 / Todo 4 / Event 0 / タグ 2。**`scrollHeight > clientHeight` を満たす要素がゼロ**で、モバイル幅でスクロールできるリストが 1 つも無い
- Issue 本文が自分で「計測で実害が出なければ close してよい」と書いており、その条件が満たされた（P-003 = 見送りは正当な決着）
- レポートの提言 = 「仮想化は今の体感を直す施策ではなくデータが増えた後に効く先行投資。着手するなら合成データで閾値を先に決めるのが筋」
- **こうだいさんの /goal は 7 件すべてに PR を求めている**ので、close 推奨と PR 作成が衝突する。次セッション冒頭で確認する

## 直近の完了

- #1086 known-issues の参照実績を測るスクリプト（`.claude/scripts/known-issue-usage.mjs` + docs-lint (f)。**DoD の「参照 0 = 7 本」は再現せず実測 5 本** — 手作業計測の閾値が実測ヒストグラムより遥かに厳しく、総称正規表現が日付ファイル名と衝突していた。首位 031 = 56 / 027 = 30 が「どちらも注入で自発参照でない」という Issue の中心的前提は再現 — PR #1119 open・Closes 付き）✅（2026-08-23）
- #993 セッション終了が Briefing の streak まで届くことを pin（**製品コードの変更ゼロ** — 実装は PR #1078 で着地済みで、Issue のタイトル「購読を外す」は今のコードと逆。既存ガードは全部「再取得の effect が走ったか」止まりで、**空でない sessions で StreakDisplay を描くテストが 1 本も無かった** — PR #1117 open）✅（2026-08-23）
- #1103 サイドバーのリサイズを rAF で間引いた（`setWidth` は useLocalStorage の setter なので 1 回ごとに同期 setItem が走り、width が open / close と同じ context 値に同梱されているので幅を読まない消費者まで再描画されていた。**放し際の flush と unmount の cancel が本体**。D-20260818-shared-fix-1 = A — PR #1111 **merged**）✅（2026-08-23）

- #1007 ブラウザ UI の色をアプリのテーマに追従させた（**私の close 推奨は前提が誤っていた** — メタは OS を見る一方 themeMode の既定は light なので、OS ダーク機では既定のままツールバーだけ夕刊色になる。manifest は不可触 = `background_color` はインストール時に焼き付く — PR #1084 merged）✅（2026-08-18）
- #993 `timer_sessions` を専用 `sessions` ドメインへ分離（**Issue の「消費者がいない」は誤り** — Briefing が #499 以来ずっと消費していた。キューの A / B はどちらも Briefing の live 更新を黙って止める案だった — PR #1078 merged）✅（2026-08-18）
- #1002 mcp-server の Supabase テストスタブを 1 本化（記録型を土台にし、in-memory 実行を `fromTables()` の select コールバックとして被せる。適用できない演算子は throw = 黙って全行返さない — PR #1072 merged）✅（2026-08-18）
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
- outbox に積んだ起票依頼の消化は chat-main の手番: 2026-08-13 の 4 件（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）+ 2026-08-16 の 3 件（公開 Web の CSP / Referrer-Policy・#956 で古くなった他レーン docs 2 本・**#947 のついでに見つけた manifest `theme_color` のライト固定** → #1007 として起票され、2026-08-18 に PR #1084 で決着）
- #947 の実機確認は merge 後 chat-main の手番（コンソールに当該警告が出ないことの目視。worktree では dev server / playwright を起動しない規約 = CLAUDE.md §7.4）
- ~~**#1007 / #999 は close 推奨として outbox に出した**~~ → **2026-08-18 に決着**。#999 は実測どおり実装済みで、根拠を書いて close した。**#1007 の close 推奨は撤回**（outbox に撤回を追記済み）— 「メタが manifest を上書きするからツールバーはテーマ追従済み」は**メタが追従するのは OS であってアプリのテーマではない**点を見落としており、既定（themeMode = light）の端末では食い違ったままだった。PR #1084 で実装して merge 済み
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 がその決定の却下案を、決定自身が書いた復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き（改名するなら移行が要る）。機能名「Tasks」は 2026-08-14 に全 live docs で改名済み
- #874 / #880 とも実機での見え方は未確認（worktree では実ブラウザ検証をしない規約）。特に #874 は「全画面にしなかったシートで、キーボードの上に残る不可視の帯」が新しく生じる見え方なので merge 後の chat-main 実測が要る
