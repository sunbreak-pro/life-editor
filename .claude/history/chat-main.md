# HISTORY (chat-main)

### 2026-08-13 - #530 Windows 実機 golden path 通過（CLOSED）+ 11 レーンへの /goal 配布

#### 概要

open Issue 23 件を実測して 11 レーンへ /goal で配り、chat-main 自身の手番だった **#530（Windows 実機起動）を最後まで通して CLOSED** した。08-02 から止まっていた前提（`desktop/.env` 不在・#548 の白画面）が両方解けたため、ビルドからインストール、golden path の目視までを一続きで実施。途中で `npm run dev` だけが壊れている環境問題を踏み、known-issues 033 として記録した。

#### 変更点

- **/goal fan-out（11 レーン）**: Issue 本文の「担当レーン」指定と、直近 merge PR のブランチ名（誰が続きを持っているか）で割り当てた。schedule-refine = #789 → #774 → #708 → #790 / shared-fix = #672 残り → #782 / refactor-core = #701 Step 2 → #673 → #675 / web-public = #791 → #676 残り / tags-docs = #674 残り → #777 / materials-refine = #776 / settings-refine = #779 → #778 / mobile-refine = #716 の裁定済み 3 件 / work-refine = #781 / briefing-refine = #780 / harness-loop = #700 Step 2
- **#530 の前提解除**: `desktop/.env` は `web/.env.local` に必要な 2 キーが揃っていたのでコピーで配線（値を読まずに済み・`.gitignore:83` で除外済み）。renderer への注入は `out/renderer/assets/index-*.js` に `supabase.co` が 39 ヒット / `VITE_SUPABASE_URL` の未置換リテラルが 0 で確認（08-11 の実測は逆で `undefined` のままだった）
- **#530 の検証**: `build:win` exit 0 → `win-unpacked` 起動でプロセス 4 本 → NSIS サイレントインストール（`/S`・per-user）で実体を 08-02 13:17 → 08-13 00:07 に更新 → インストール先から起動して 4 本 → **ログイン → Todo 追加・編集・削除が PASS**（目視）。Menu / Tray / ウィンドウサイズ復元も PASS で、`%APPDATA%\desktop\config.json` に `windowBounds` が書かれることを実測
- **起動判定の基準**: 「プロセスが生きている」ではなく **4 本立つこと**。#545 は 1 本だけ立って落ちており、生存だけを見た煙試験が見抜けなかった
- **known-issues 033 新設**: `npm run dev` が `Error: Electron uninstall` で落ちる件。`node_modules/electron/dist` にライセンスファイル 1 個しか無く `path.txt` も欠けていた。**`build:win` は緑のまま**なので CI ゲートを素通りする（dev と electron-builder で Electron の入手経路が違う）。キャッシュ済み zip の手動展開で復旧。`path.txt` を `echo` で書くと改行がパスに混ざって `ENOENT` になる落とし穴つき（`printf` を使う）
- **新規起票 2 件**: **#831** = コード上の名前を Task → Todo に統一する（画面表示は既に Todo・DB は据え置き。実測 = ファイル 55 本 / 出現 3,470 箇所。据え置きは ID prefix `task-` / `role: "task"` の値 / DB 列名の 3 点）。**#837** = userData が `%APPDATA%\desktop` に入り `productName: Life Editor` と一致しない
- **#831 の着手条件**: `gh pr list --state open` が 0 件の谷間。起票直後に 11 レーンへ /goal が配られて open PR 4 件になったため、その旨を Issue にコメントして条件を明文化した

### 2026-08-13 - #700 Step 2: 検証用 MCP ツール 3 本（投入 / 読み出し / 後片付け）

#### 概要

検証を画面操作に頼らず回すための MCP ツールを 3 本足した（PR #821 open）。撒き先は 2026-08-12 に確定した `D-20260812-shared-fix-3`（案 A = 検証専用アカウント + RLS 分離）に従う。**「何を撒いたかツール側が覚えている」形**にしたので、検証データの削除がユーザー手番のまま残らない。実装は `mcp-server/**` に閉じ、規約を `db-conventions.md` §14 に足しただけで実運用コードには触れていない。

#### 変更点

- **`seed_verification_state`**: 指定日に task / event / note をまとめて作る。`preset: "busy_day"` = 重なった予定 2 本 + 終日予定 + 完了済み Todo + 未着手 Todo + 日付なし Todo。**書き込みは既存の `createTask` / `createScheduleItem` / `createNote` を通す**（専用の書き込み経路を持つと「その経路の fixture」になり、orphan recovery や §10.2 の bump が実データと違ってしまうため）
- **`read_verification_state`**: `items_meta` + `<role>_payload` の 2 行を 1 つの塊で返す。`run_id` / `date` / `id` のいずれか 1 つで選択（2 つ渡すと「聞かれていない条件で答える」ので拒否）。**soft delete された行も隠さず出す** — 「画面から消えた」と「行が消えた」を区別できるようにするのがこのツールの価値
- **`cleanup_verification_state`**: 台帳の id だけを hard delete（payload → `items_meta` の順。composite FK が NO ACTION のため）。soft では Trash に残るので hard。dry_run あり
- **台帳 = `mcp-server/.verification-ledger.json`**（git 非追跡）: 撒いた行を記録し、削除に成功した分だけ台帳から消す。**失敗した行は残るので再実行が復旧手順**になる。撒く途中で落ちた場合も書けた分は `finally` で記録される
- **二重の安全弁**: ① RLS（全テーブル `auth.uid() = user_id`・MCP は anon key + `signInWithPassword` の一般ユーザーで service_role を使わない）② `LIFE_EDITOR_VERIFICATION_MODE=1` が無いと 3 ツールとも**書く前に throw**。パスワードからは接続先アカウントを判別できないので、宣言を要求する形にした
- **daily は撒けない仕様**: id が日付由来（`daily-<YYYY-MM-DD>`）で実データと区別できず、id で消す cleanup が本物の日記を巻き込むため。task / event / note はランダム id なので衝突しない
- **`.mcp.json` は変更していない**（Scope 外 + 認証情報はユーザー手番）。併存方式は「検証用エントリをもう 1 本立て、その env でだけ credentials とフラグを渡す」と決め、スニペットを `db-conventions.md` §14 に記載
- **検証**: mcp-server 12 files / 196 tests・shared 217 / 1980・web 32 / 269・docs-lint すべて exit 0。テストは Supabase をメモリ上の偽テーブルに差し替えて一巡を回す（実 DB には触れない）
- **注意（実測で踏んだ）**: `npm run build \| tail` は exit code が tail のものになるため、`tsc` 未インストールの失敗が「緑」に見えた。パイプするなら `${PIPESTATUS[0]}` を見る（worktree-policy の既知の罠と同型）

### 2026-08-11 - backlog 一斉棚卸し（Phase 1 並列調査 → Phase 2 実ブラウザ検証 → Phase 3 反映）

#### 概要

chat-main の backlog を 4 体並列の読み取り専用調査 + 実ブラウザ検証 1 体で棚卸しし、Issue 側へ反映した。**実ブラウザは PASS 5 / BLOCKED 3 / FAIL 0・回帰なし**。判断キューの回答 3 件を台帳へ昇格し、実測で浮いた課題 2 件を schedule レーンへ起票（#707 / #708）。**停止条件に 2 件当たったので、#627 の子 Issue 一斉起票と #321 の close は保留**して判断キューへ積んだ。

#### Phase 2 実ブラウザ検証の結果（main = `da9ae58b` / dev server 5173）

| 項目                                               | 判定                               | 実測                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#681** blur は下書き保持・保存されない           | **PASS**                           | タイトル変更 → メモ欄へ blur で「Saved」→「Unsaved」・保存ボタン有効化・チップは旧タイトルのまま。Esc で破棄確認 → リロードしても DB は旧値（`items_meta.updated_at` 未更新）                                                                                        |
| **#681** 保存ボタンで確定する                      | **PASS**                           | 保存 → チップ即更新・「Saved」復帰・ボタン disabled・リロード後も保持（`updated_at` 更新）                                                                                                                                                                           |
| **#681** 繰り返しは保存ボタンを経由せず即時 commit | **PASS**（PR 記載どおりの caveat） | 未編集状態で「Daily」を押しただけで `POST items_meta` → `POST routines_payload` → `PATCH events_payload` → オカレンス一括 INSERT。表示は「Saved」のまま・Undo も無効                                                                                                 |
| **#684** Event ⇄ Todo 変換で id 維持               | **PASS**                           | 往復とも `schedule-b7d3c2d2-5ce2-48a3-ae03-9b18671f8e3f` で完全一致（`PATCH items_meta` で role のみ差し替え）                                                                                                                                                       |
| **#684** routine 由来は「変換は不可能です」        | **PASS**                           | 文言完全一致・書き込みリクエスト 0 件。ただし**ネイティブ `window.alert`**（`web/src/schedule/CalendarTab.tsx:1818`）→ #707 起票                                                                                                                                     |
| **#684** 子を持つ Todo の変換拒否                  | **BLOCKED**                        | 子 Todo を作る UI が無く再現不可（`shared/src/components/TaskAddDialog.tsx:72` が常に `parentId: null`・既存データにも `parent_item_id` 0 件）。入れ子は #418 で退役済みなので到達不能な分岐                                                                         |
| **#686** routine 作成の undo                       | **BLOCKED**                        | `createRoutine`（undo を積む唯一の関数 = `shared/src/hooks/useRoutinesAPI.ts:81,129`）の呼び出しが `web/src/` に 0 件。UI からの繰り返し作成は `convertEventToRoutine` 経由で意図的に undo なし（`useRoutinesAPI.ts:344-350`）                                       |
| **#686** routine 更新の undo + 翻訳トースト        | **PASS**                           | 「毎日」→「曜日」を Undo で `frequency_type: daily` に復元。トースト「元に戻しました: 繰り返しの変更」= 生キーではない                                                                                                                                               |
| **#686** routine 削除の undo + 翻訳トースト        | **PASS**（ただし要判断）           | `is_deleted: false` に戻りリスト復帰・トースト「元に戻しました: 繰り返しの削除」。**戻るのはルーチン行だけ**で、種イベント（`schedule-b7d3c2d2`）と元オカレンス（`si-1fe619b3` / `si-25634b94`）は削除済みのまま、当日分が新 id（`si-9d18df3c`）で再生成 → #708 起票 |

console error は操作区間で 0 件（warning は `apple-mobile-web-app-capable` の deprecation のみ）。テストデータは全てゴミ箱送り・言語設定は English へ復帰済み。**保存ボタン経路に回帰なし**。

#### Phase 1 調査の結果

- **#587（Notes 神ファイル分割）**: 実測 `useNotesUnifiedAPI.ts` 967 → **431 行**、`SupabaseNotesUnifiedService.ts` 842 → **303 行**（PR #642 / #647 で着地）。DoD 1〜3 はコードで満たされる（公開 IF diff・呼び出し側 diff ともに `git show --stat` が空）。**落ちているのは DoD 4 だけ** = `notesUnifiedHelpers.ts`（220 行・純粋関数 11 本）のテスト参照が repo 全体で 0 件、`useNotesUnifiedCRUD.ts`（374 行）に専用テストなし → **open のまま維持**
- **#627（保存ボタン統一 Epic）**: 起票時 5 行 → 実測 **19 行**（追加 12 / 削除 0 / 記述訂正 1）。Schedule は PR #681 で save-button 化済みだが繰り返しだけ immediate = 厳密には mixed。Settings 4 パネルは immediate だが**書き込み先が localStorage で DataService 非経由**。Briefing / Tags 画面は起票時に丸ごと抜けていた。`TaskDetailPanel` の Tasks / Schedule 両用は確認（実描画は `KanbanView.tsx:532` と `CalendarTab.tsx:2178` の 2 箇所のみ）
- **#290（Schedule redesign Epic）**: Step 2〜7 が**コード上 9/9 DONE**・本文チェックボックスと実装の乖離なし・子 Issue 9 件すべて CLOSED。残は実ブラウザ検証のみ
- **#321（Mobile UI/UX Epic）**: コード 8/8 DONE・子 Issue 11 件すべて CLOSED。ただし本文が想定しない open が 5 件（#691 / #692 と mobile 裁定 3 件）
- **#512（パレット safe-area）**: 未着手。`CommandPalette.tsx:206-216` は `paddingTop: viewport.height * 0.12` のままで safe-area 参照なし。本文の引用行番号がドリフト（`:158-164` → 実際は `:206-216`）
- **#530（Windows desktop）**: `cd desktop && npm run typecheck` / `npm run build` とも **exit 0**。`desktop/.env` は不在で、**`web/.env.local` は desktop ビルドに効かない**（electron-vite の `envDir` が `desktop/`）。今ある成果物は資格情報が `undefined` に置換されており、ログインすると落ちる。インストール済み実体は 08-02 04:17 UTC ビルドで **#548 の修正より前**なのでインストーラ作り直しが先

#### 反映

- Issue コメント: #587 / #290 / #512 / #530 / #321。**#627 は本文ごと実測表へ差し替え**（DoD 1・2 を [x] 化）
- **判断キューの回答 3 件を台帳へ昇格**（`records.mjs index` 同一コミット）: **D-20260809-main-2 = A**（`records.mjs` に archive スキャンを足して `archive/INDEX.md` を生成）/ **D-20260804-main-1 = A**（Windows タスクスケジューラ + `claude -p` で 06:03・22:33 に発火）/ **D-20260810-main-3 = A**（STALE スキル 5 本を現行アーキで書き直す）
- **新規起票**: **#707**（変換の確認・拒否をネイティブ dialog から in-app へ）/ **#708**（繰り返し削除の Undo で種イベントとオカレンスが戻らない — 方式 A/B/C の裁定が先）。どちらも `section:schedule` 単一レーン
- **停止条件 2 件を判断キューへ**: **D-20260811-main-1**（#627 の対象範囲 — Settings / Briefing / 作成フォームを含めるか。差が 2 行を大きく超えたため子 Issue の一斉起票を保留）/ **D-20260811-main-2**（#321 のスコープ確定 — #692 は完了済み #467 の巻き戻しを含むため close 前に裁定が要る）

#### 判明した運用上の事実

- **`chore/tracker-main-20260811` は使えなかった**: 別 worktree（harness-loop）が占有中で、かつその PR #682 は既に MERGED。merge 済み PR のブランチへ後追い push しても main に届かないため、**`chore/tracker-main-20260811-2` を新設**した
- サブエージェントの引用は全数スポットチェックした（`EventEditorPane.tsx:589` / `TaskDetailPanel.tsx:85,87` / `CommandPalette.tsx:206-216` / `useCalendarNav.ts:32` / `BriefingScreen.tsx:66` / `MobileShellActions.tsx:51-70` / `CalendarTab.tsx:1818` / `useRoutinesAPI.ts:344-350` / `TaskAddDialog.tsx:72` ほか）。**存在しない引用はゼロ**

### 2026-08-10 - /goal バッチのオーケストレーションと merge 後の一括検証（実ブラウザ 9 PASS / FAIL 0）

#### 概要

open Issue 20 件を Issue タイトルのレーン接頭辞どおり 8 レーンへ `/goal` プロンプトで分配し（briefing-refine worktree 新設込み）、同日中に merge された 17 PR を main へ取り込んで一括検証した。静的ゲート（shared 1554 / web 167 tests）全緑・playwright 実ブラウザ検証 9 PASS / FAIL 0。検証で発覚した DDL 未適用（0023）をユーザーが push してタグ機能を復旧し、最後の BLOCKED だった #626 も実測 PASS で締めた。

#### 変更点

- **オーケストレーション**: 8 レーン（schedule-refine / shared-fix / mobile-refine / briefing-refine / materials-refine / refactor-core / work-refine / tags-docs）へ `/goal` を配布。達成条件は「担当 Issue が closed / CI 緑 PR で merge 待ち / 判断キュー待ちのいずれか」。レーン間依存は #631 → #632 の 1 本だけと明示。briefing-refine worktree を新設（絶対パス・`.session-branch` / `.session-name` 同時作成）
- **取り込みと静的ゲート**: main `8a701323` → `3a64470e`（86 files・+5,772/−2,238。Notes 神ファイル分割 #587 / #588 を含む）。web は vitest 不在で空振り → `npm install` で解消（この Windows 機の `web/node_modules` が古かった）
- **実ブラウザ検証（playwright-ui-verifier）**: PASS 9 = #590 Work レイアウト / #593 Todo チップグリフ / #592 Todo 文言統一 / #572 タグ色空状態 a11y / #587+#588 Notes 回帰（エラー 0）/ materials 3 画面 / #586 モーダル・グラフ回帰 / #631 ドキュメント不動（モバイル幅実測）/ #633 シート max-height + 内部スクロール。ログインは資格情報がこの PC に無くユーザーの手動サインインで解除（Playwright 永続プロファイルにセッション保持）
- **DDL 適用（ユーザー実行）**: `0023_wiki_tag_connections_origin` 未適用が発覚 — `wiki_tag_connections` への GET が 400（`column origin does not exist`）になり `useWikiTagsUnifiedAPI` の `Promise.all` ごと reject してタグ機能がアプリ全体で無効化されていた。supabase CLI 不在のため `npx supabase link + db push` で適用 → #626（チップ詳細のタグ付け外し）を実測 PASS・テストデータ片付け完了（`verify-20260810-tag` 削除含む）
- **裏取り**: パスワードノートの set / remove UI 不在は分割前 `8a701323` の NotesView でも `mode: "verify"` しか配線されていなかった = #588 の欠落ではなく従前からのギャップ
- **起票 / 追記**: **#680**（i18n 取りこぼし 3 点 — trash 行 aria-label / エディタ placeholder / en 単複）を新規起票、**#632** へ FAB の実測コメント追記（#631 着地により着手可能化）
- **残**: #632（mobile-refine）/ #628・#625（判断キュー待ち）/ #623・#609・#585（briefing-refine）/ #586 残り（PR #649 open）/ iPhone 目視 3 点（#631 pull-to-refresh・#633 シート上端・#512 パレット safe-area）

### 2026-08-10 - ユーザー要望 7 件の起票と、最優先 1 本（#624 ポモドーロ数値入力）の実装

#### 概要

ユーザーから届いた要望 7 件を重複チェックのうえ GitHub Issue 6 本（#623〜#628）に落とし、そのうち唯一の `type:bug` である #624 を実装した（**PR #629 merged → iPhone Chrome で実機確認 OK → #624 CLOSED**）。要件の 1 つは既存 Issue に該当したので新規は立てず、実測結果をコメントで足した。あわせて #607 / #608 の計画書を乖離レビュー付きで archive し、**同じ実機確認で残っていた目視 4 点も全て消化**した（#607 / #608 とも CLOSED）。

#### 変更点

- **起票 6 本**: **#623** 朝刊の本文 / rightSidebar に `+` を置き Schedule アイテムを追加（`section:briefing`）/ **#624** ポモドーロ数値入力の空欄バグ（`type:bug` `sev:important` `section:work`）/ **#625** Event⇄Todo の相互変換（`section:schedule`）/ **#626** Todo の詳細からもタグを付け外し（`section:schedule`）/ **#627** Epic「編集の確定を保存ボタンに統一（Note・Daily 除く）」（`shared-fix` `[all]` — `[all]` は Epic に限り可）/ **#628** その段階 1 = Schedule 詳細編集パネル（`section:schedule`）
- **要件「Task→Todo 改称」は起票せず #592 にコメント**: Work 画面の i18n 名前空間（`work.*` / `pomodoro.*` / `taskDetail.*` / `kanban.*`）は既に全て Todo 表記で、`.ts` / `.tsx` の「タスク」ハードコードもテスト 2 本の中だけだった。残存は #592 が既に列挙している schedule 系キーのみなので、スコープを広げず実測結果だけ足した
- **#625 / #628 は Issue 本文に「先に決めること」を明記**: #625 = 変換で id を維持するか（維持ならタグ / リンクが無傷だが、payload 生成列 `parent_item_role` の都合で「旧 payload 削除 → `items_meta.role` UPDATE → 新 payload INSERT」の順序が要る）・落ちるフィールド・routine occurrence の可否。#628 = 保存ボタンでのみ確定するか blur 保存を残すか。どちらも着手レーンが判断キューへ積んでから実装に入る（P-005）
- **#624 の原因**（`shared/src/components/PomodoroSettings.tsx:211-239`）: `NumberField` が毎キーストロークで `Number(e.target.value)` を commit していたため、欄を空にすると `Number("") === 0` が飛び、`TimerContext.tsx:276` の `clampMinutes` が最小値 1 に丸めて書き戻していた。制御コンポーネントなので次のキーが来る前に `1` が再描画され、その上に `50` が乗って **`150`** になる
- **修正 = 「空欄」を独立した状態に**: 空にした欄は `""` を表示して**何も commit しない**（保存済みの値は数値が入るまで無傷）。それ以外は従来どおり host の値が正なので clamp は今も見える。空欄のまま blur / プリセット保存すると「`<項目名>`に数値を入力してください」ダイアログ。**ダイアログを閉じると空欄はすべて保存済みの値へ戻す** — 空欄のまま残すと次の blur でまたダイアログが出て、ユーザーが nav に到達できない罠になるため
- **セクション遷移そのものは止めていない**（意図的）: router が無く `setSection` の呼び出し口が app shell 全体に散るため、ガードを通すと `shared-fix` 級になり他レーンと衝突する。実際には nav をクリックする動作が先にフィールドを blur させるので警告は出る。PR 本文に明記した
- **RED チェック済み**: 修正を外すと新規 4 テストが落ち、1 本は `expected '150' to be '50'` とユーザー報告そのままの値を出す。clamp を再現するホストをテスト側に置いたのが要点で、これが無いと「150」は現れない
- **#607 / #608 の計画書を archive**（PR #621 / #622 とも merged 2026-08-10 10:05 UTC）: 乖離レビュー 3 行を記入 — スコープ逸脱 1 件（`useNotesUnifiedAPI.ts` = D-20260810-main-4）/ AC 免除ゼロだが diff 行数超過を明示 / 判断の行き先は全て埋まり「行き先なし」ゼロ
- **実機確認で 4 点すべて OK**（2026-08-10・**iPhone の Chrome**）: ① Note の本文タップで入力パネルが閉じない ② キーボードでタブバーが消え、閉じると戻る ③ タブバー非表示中もホームインジケータ帯に本文が乗らない（QA の NIT 1 件目）④ 「その他」シートがキーボードで消えるのは許容（NIT 2 件目）。#607 / #608 とも CLOSED。**計画書 Step 5 の未達はこれで解消**したので、archive 時点の乖離レビューから「未達」の記述を落とした
- **「iOS 未検証」が解消**: iOS のブラウザは全て WebKit（WKWebView）なので、Chrome で見ても `visualViewport` の挙動は Safari と同じ経路を通る。`useSoftKeyboard` の「同じ幅で観測した最大可視高との差」判定が iOS でも成立することを実機で確認できた（Safari の UI そのものは未確認）
- **副産物 = #512 が測れる状態になった**: 「コマンドパレットの上余白が safe-area を踏む」は iPhone のノッチ前提の指摘で、Android 実測（上端 inset ≈ 0）では反証にならず宙に浮いていた。**ユーザーが iPhone を実機として使えると分かった**ので 👀 節へ回す
- **追加起票 3 本**（同日・実機確認の最中にユーザーが見つけたスマホ固有の崩れ。いずれもコード実測で原因の当たりまで書いた）: **#631** ドキュメント自体がスクロールしてボトムタブバーの下まで行ける + pull-to-refresh 誤爆（`body { min-height: 100vh }` と `h-[100svh]` の単位不一致 / `overscroll-behavior` が内側 div にしか無い）/ **#632** 追加用 FAB の位置が画面ごとに揃わない（Schedule = `fixed bottom-6 right-6` vs Notes = `absolute bottom-5 right-5` で基準もオフセットも別）/ **#633** Schedule 編集シートの上端がブラウザ UI に隠れ内部スクロールが無い（同じ `BottomSheet` を使う他 2 面だけが `max-h-[92vh] min-h-[70vh] overflow-hidden` を渡している）。**3 本は #631 → #632 / #633 の順**（`fixed` の見かけがドキュメントスクロールに引きずられるため、#631 を直さないと後続を実測できない）

#### 次セッションへの引き継ぎプロンプト（貼り付け用）

```text
life-editor の chat-main セッションを開始する。

まず `.claude/memory/chat-main.md` と `.claude/comm/decisions/ANSWERS.md` を読み、
`gh issue list -R sunbreak-pro/life-editor --state open` で自分宛の open Issue を確認すること。
未 merge の PR #630（tracker）が残っていたら、merge はユーザーの手番なので状態だけ確認して先へ進む。

今回の目標 = スマホ実機で見つかった崩れ 3 本（#631 / #632 / #633）を片付け、その後で「保存ボタン統一」の
段階 1（#628）へ進む。#624 は実装 + iPhone 実機確認まで完了して CLOSED 済み。

0. **#631 から着手する**（触るのは `web/src/index.css` と `shared/src/components/AppShell.tsx` の 2 ファイル）。
   ボトムタブバーの下までスクロールでき、上に引っ張ると Chrome が再読み込みする件。原因は Issue 本文に
   実測付きで書いた = `body { min-height: 100vh }`（index.css:32）と `h-[100svh]`（AppShell.tsx:212）の
   単位不一致で、モバイル Chrome では body だけ URL バー分高くなる。`overscroll-behavior: none` も
   AppShell 内側の div にしかなく、viewport のスクローラ（html / body）に無いので効いていない。
   **これが #632 / #633 の実測前提**（`fixed` の見かけがドキュメントスクロールに引きずられる）。

   続けて #632（FAB の位置が画面ごとに揃わない → 共通部品へ寄せる。#509 の「最終行に重なる」を再発させない）
   → #633（Schedule 編集シートに max-height + 内部スクロールを与える）。#633 は #628 と同じ
   `web/src/schedule/CalendarTab.tsx` を触るので、片方ずつ順に進めること。
   3 本とも DoD に 👀 実機（iPhone Chrome）目視が入るので、実装が終わったらユーザーに見てもらう。

1. #628（Schedule 詳細編集パネルに保存ボタン）へ進む。これが Epic #627 の雛形になり、
   ここで決めた流儀が Work / Tasks / Settings へ波及する。着手前に Issue 本文の「先に決めること」を
   ユーザーへ確認すること:
     (a) 保存ボタンでのみ確定し、blur は draft 保持のみ（未保存で閉じるときは確認ダイアログ）
     (b) blur 保存は据え置き、ボタンは「今すぐ確定 + 保存済み表示」
   P-005 により UX が分岐する判断はキュー必須。回答が来るまで実装に入らない。

2. 流儀が決まったら実装する。`EventEditorPane` は Desktop のオーバーレイと Mobile の BottomSheet の
   両方を backing しているので、片方だけ見て終わらせない。routine アイテムの scope ダイアログ（#279）が
   1 回しか出ないこと（1 ジェスチャ 1 コミット = #553）と、日付の unmount flush と二重書き込みしないことを守る。

3. #628 が close したら Epic #627 の対象面の棚卸しを grep で実測して本文を更新し、子 Issue を
   1 面 1 本で起票する（`[all]` は Epic 専用。子は宛先 slug を 1 つに決める）。

余力があれば #626（Todo の詳細からタグ付け外し）→ #623（朝刊の + 追加導線）の順。どちらも既存部品の
流用が前提で、新しい生成 UI やタグ操作経路を作らない。#625（Event⇄Todo 変換）は items_meta +
<role>_payload の 2 行分割モデルに触るので最後に回し、判断 3 件が未回答のうちは着手しない。

小粒だが 1 つ: #512（コマンドパレットの上余白）は iPhone で測れる状態になった。キーボード表示中に
パレットを開いて上端が safe-area へ潜らないかユーザーに見てもらい、踏まないなら NOT_PLANNED で close する。

工程は lead-pipeline に従う（中ティア = 実装 → session-verifier → task-tracker）。
tracker は実装ブランチに載せない（D-20260801-main-1）。merge は常にユーザー（P-001）。
```

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
