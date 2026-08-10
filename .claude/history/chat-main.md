# HISTORY (chat-main)

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

### 2026-08-10 - スマホ ソフトキーボード起因バグ 2 件（#607 / #608・PR #621 merged）

#### 概要

公開 Web URL をスマホの主導線に据えた直後（D-20260807-main-1）に出た `sev:important` 2 件を 1 本の計画で片付けた。#607（Note に書き込めない）は「自分の書き込みが自分の hydrate を無効化する」、#608（タブバーがせり上がる）はキーボード表示中の非描画で対処。どちらも実装 + 回帰テストまで着地し、実機での見た目確認は deploy 後に残る。

#### 変更点

- **#607 の原因確定と修正**（`shared/src/hooks/useNotesUnifiedAPI.ts`）: `updateNote` はローカル行に**クライアント時計**の `updatedAt` を載せるが、own-write のエコーで走るリロードが返すのは**サーバ時計**。#301 の限定無効化マージ（`prev.updatedAt === row.updatedAt` の行だけ本文キャッシュを維持）は、**いま編集中のノートだけが必ず外れる**構造だった → `isContentLoaded` false → mobile シートがエディタを skeleton に差し替え → フォーカスが外れてキーボードが閉じる。Desktop はエディタが note id で keyed され remount しないため無傷。マージ判定に「**開いている行 かつ 自分が書いた行**」を OR で追加
- **マークの寿命を「リロード 1 回」に**（QA の BLOCKING 指摘）: 初版は「選択が外れるまで」だったが、mobile シートの `closeSheet` は shared の選択を落とさないため実質セッション中ずっと生き、その間に他デバイス / MCP が同じノートに書くと**こちらの古い本文で無言上書き**する筋があった。保持した行はサーバの `updatedAt` を取り込むので使い捨てで足り、in-flight の書き込みがある間だけ保留する（`unackedWritesRef`）
- **#608 = `shared/src/hooks/useSoftKeyboard.ts` 新設 + `AppShell.tsx`**: narrow でキーボード表示中は `BottomTabBar` を描画しない。判定は「**同じ幅で観測した最大可視高との差**」で、レイアウトごと縮む UA でも visual だけ縮む UA でも成立する（実機での `innerHeight` / `visualViewport.height` 実測待ちを解消）。`documentElement.clientHeight` との差を使う案は QA 指摘で棄却 — モバイルの ICB は大ビューポートを返すため常時 60〜110px 浮き、上下 2 段バーの UA では**キーボード無しでナビが恒久的に消える**危険側の失敗になる。ピンチズームは `vv.scale > 1` で除外
- **回帰テスト 2 本**（`shared/tests/notesOpenNoteOwnEditHydrate.test.tsx` 3 ケース / `appShellSoftKeyboard.test.tsx` 3 ケース）。#607 側 2 件は**修正を戻すと落ちることを実測で確認**。jsdom にレイアウトが無いので固定するのは「判断が下ること」まで（CLAUDE.md §7.1）
- **Scope 例外 = D-20260810-main-4**: `useNotesUnifiedAPI.ts` は #587（分割予定）のため「触らない」宣言だったが、原因確定を受けてユーザー裁定で例外入り（実測 = #587 未着手・open PR ゼロ）。#587 に分割時の申し送りをコメント済み
- **#512 は close せず**: Android 実機で「潜っていない」を実測しコメントしたが、指摘は iPhone の `safe-area-inset-top` 前提で Android は上端 inset ≈ 0 のため反証にならない
- **AC「PR diff ±200 行以内」超過を明示**（免除ではなく PR 本文に内訳記載）: 実装 約 200 行 + テスト 約 380 行 + 記録類

### 2026-08-10 - 確認待ちの摩擦を除去（#618 permissions + tracker 新運用の規約化・PR #619 / dotfiles PR #15 open）

#### 概要

対話セッションが「許可を出してください」「merge したら声をかけてください」で止まる 2 つの摩擦を外した。前者は `permissions.ask` の非破壊ゲート撤去（#618）、後者は END の task-tracker を session-verifier 直後に実行する新運用の台帳化（D-20260810-main-1）。life-editor は PR #619、グローバル資産は dotfiles PR #15 に分けた（どちらも open）。

#### 変更点

- **`permissions.ask` を 1 件へ縮小**（#618）: `Bash(git push*)` / `Bash(gh pr create*)` を除去し `Bash(gh pr merge*)` のみ残した（P-001 の機械担保）。**`deny` は 27 件のまま無変更**（diff の deny 行の増減ゼロを機械確認）。プロンプトが増えた原因は PR #594（夜間レーンの柵）と PR #596（P-001 の担保）の 2 つで、それ以前はグローバル `Bash(*)` allow で素通りしていた
- **無人レーンの担保を runner 側へ分離**: 夜のレーンが commit 止まりである根拠が「repo の `permissions.ask` が止めてくれる」だったため、外した時点で**プロンプトの禁止文しか残らない**状態になる。`automation/routine-night.md` §停止条件 と `automation/README.md`（動作モデル + 安全則の 2 箇所）を「**runner 側 settings で担保する**（`claude -p --settings <無人用>` / `--disallowedTools`）」に書き換えた。対話セッションの柵と無人レーンの柵を同じ settings.json で兼用しない
- **D-20260810-main-1 を台帳化**: END の tracker は **session-verifier が緑になった直後**に実行し、ユーザー確認も実装 PR の merge も待たない。**`D-20260801-main-1`（tracker を実装ブランチに載せない）は維持**で、置き換えたのは実行タイミングだけ。`supersedes` は D-ID ではなく「CLAUDE.md §7.4 の該当行」「worktree-policy SKILL.md の該当節」という**文書位置の文字列**で宣言している（`records.mjs check` は D-ID 形式のみ双方向検証するため、旧決定を Active から落とさずに済む）
- **反映は 2 文書を行単位で**: CLAUDE.md §7.4 の「merge 後に 1 commit でまとめ」と `skills/worktree-policy/SKILL.md` の同文。§7.4 は「正本は worktree-policy スキル」と宣言しているので、CLAUDE.md だけ直すと SSOT と矛盾する
- **dotfiles PR #15**: `skills/task-tracker/SKILL.md`（作業終了フロー冒頭に実行タイミング）・`skills/lead-pipeline/SKILL.md`（中ティア連鎖の 3）・`agents/role-engineer.md`（引き継ぎの「セルフ検証結果」を session-verifier と同じ 5 ゲート表 + 総合 PASS/FAIL へ）。role-engineer は **G7/G14 の対の残件** — PR #14 で lead-pipeline Step 4 と role-qa Step 2 が「role-engineer の Verdict を検分」に変わったのに、出す側が `session-verifier 出力: <要約>` のままで受け手が検分できなかった
- **PR #14 との衝突回避**: dotfiles の 2 スキルは PR #14 も触っているため、編集行が重ならない位置（#14 = 中ティア Step 0 追加 / END フロー Step 5、こちら = Step 3 の行末 / END フロー冒頭）を選んだ。どちらを先に merge しても自動マージできる想定
- **DoD の 4 つ目は持ち越し**: 「確認プロンプトなしで push / PR 作成が通る」の実測は、**このセッションが読んでいる settings が main 側の旧 `ask`**（worktree の settings.json はロードされない）なので確定できない。merge + セッション再起動後に 1 回測る
- **本セッションが新運用の初適用**: verifier 緑（Types〜Coverage は ⏭️ / Project Rules ✅ = records check + docs-lint）の直後に、merge を待たず本 tracker を実行した

### 2026-08-10 - ハーネス統合とループ再設計 Phase A+B+C（PR #616 merged・dotfiles PR #14 open）

#### 概要

「計画 → 実装 → 検証 → 改善」のループを長期運用できるよう、ハーネスの穴 5 件と重複 8 系統を life-editor（19 ファイル）+ claude-dotfiles（26 ファイル）の 2 レーンで一括改修した。P-008（実装中スコープ凍結）を POLICY に追加し、計画テンプレートへ「検討した代替案」節と完了時の乖離レビュー 3 行を義務化。life-editor 側は PR #616 が merge 済み、dotfiles 側は PR #14 が open（中身は symlink 経由で `~/.claude` に実効済み・merge はユーザー手番）。（計画書: archive/2026-08-10-harness-loop-consolidation.md）

#### 変更点

- **P-008 実装中スコープ凍結**（ユーザー承認 2026-08-10・POLICY.md）: 実装中に計画外の追加・変更・削除が浮上したら実装せずキュー or Issue 依頼へ積み、現計画を続行。Scope / AC の変更・逸脱の自己免除はユーザー回答まで禁止。`_TEMPLATE.md`・`rules/decision-queue.md`・dotfiles の lead-pipeline（中ティアのミニスコープ宣言）へ配線
- **計画テンプレの強化**: 「検討した代替案（案 / 採否 / 却下理由 / 復活条件・最低 2 案）」節を必須化（ask-user の選択肢と回答も転記）。完了時の乖離レビュー 3 行（スコープ逸脱 / AC 免除 / 途中判断の行き先）を Worklog 必須に（実行者 = task-tracker END フロー）
- **重複のポインタ化（Lane L）**: comm/README の「タスク分配の正本」宣言を撤回し docs-workflow へ／ decisions 昇格手順・分担表・loop-\* の環境事実・frontend.md の jsdom 段落を各正本への ID 参照へ／ records.md に「インライン注記には D-ID を添える」を追加
- **Mac 専用 symlink 10 本 = known-issues/031**: skills 8 + agents 2 は Mac 絶対パスで Windows では解決不能。削除・stub 化は Mac を壊すため禁止。実体化は Mac セッションの手番（skill-lib / agents-lib に git remote があれば Windows clone でも可 — remote の有無は Mac で確認）
- **dotfiles 側（Lane G・PR #14）**: tone 3 ファイルの正本を tone-persona へ一本化（呼び名はサブエージェント向け複写 1 行だけ tone.md に残す — QA Blocking の回収）／ role-qa の判定ラベルを Blocking / Important / Suggestion に統一／ git-workflow §0.1.1 に「プロジェクト側 POLICY override が優先」を明記／ `MANDATORY FIRST ACTION` 行を rule + hook の 2 系統へ集約（G19）
- **QA / 検証**: role-qa 監査 NEEDS REVISION（Blocking 1 / Important 6）→ 同日全件回収。docs-lint（LC_ALL=C）+ `records.mjs check` 緑。乖離レビュー = G19 の Scope 逸脱 4 ファイルを Scope 追記で正規化 / AC 免除なし / role-engineer Verdict 形式は次 PR へ
- **残件**: dotfiles PR #14 merge（ユーザー）/ role-engineer Verdict 形式（次 PR）/ Phase D = Scope 照合 hook（#173 系）/ symlink 実体化（Mac — known-issues 031）

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
