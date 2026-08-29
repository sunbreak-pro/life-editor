# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- PR #1221（#1180 テンプレート一覧・編集）の main マージ解決ミスを修復 ✅（2026-08-30 — CI の `typecheck + test + build` が赤で、原因は #1179（PR #1216）が main に着地した後の取り込み。1 回目の解決が**消えた側を残して新しい側を落として**いた: materials barrel が実在しない `./NoteTemplatePanel` を re-export（CI の TS2307）・`TemplateSavedPanel` の export が消失 / `NotesView` が本 PR の hook を import しつつ main の hook を呼び、本 PR の panel を import しつつ main の panel を描く（`templates` 二重宣言）/ code-split allowlist に削除済み `notes/NoteTemplateHost.tsx` が復活。**両方残す**形に直し、register 側 `templates` / library 側 `templateLibrary` に改名。tsc は 1 件目で止まるので CI ログには barrel の 1 件しか出ていなかった。あわせて両立で出た穴も塞いだ — 登録は #1179 の hook が書き一覧は #1180 の hook が読むが、その読み直しは sync カウンタでしか起きずローカル書き込みでは動かないため、登録したテンプレートが一覧に出ない。library に `refresh()` を足し `savedId` の両端で `NotesView` が呼ぶ形にして回帰テスト 1 件追加（`noteTemplateLibrary.test.tsx` = 9 件）。その後 `origin/main` を再取り込み（Connect 復活 / related panel / Daily サイドバー等）— 衝突なし。CI verify 相当をローカル全ステップ実行し shared 2631 / web 908 / desktop 7 / mcp 319 すべて緑・docs-lint OK）
- Materials 6 Issue を 6 ブランチ / 6 PR に（#1179 #1180 #1181 #1172 #1189 #1183）✅（2026-08-29 — **すべて open**。テンプレート 3 本 = 三点メニューを「テンプレートとして登録する」に刷新し現ノート本文ごとテンプレ化 + 受領パネル（**PR #1216**）/ rightSidebar のテンプレート折りたたみ + 中央パネル編集（**PR #1221**）/「テンプレートから反映する」= 選択 → 破棄確認 → 本文置換（**PR #1227**）。ほか LinkPanel の Related 拡張（**PR #1232**）・Daily の今日/昨日タブと DateStrip 撤去（**PR #1236**）・エディタの Todo チェックボックス拡大（**PR #1237**）。全本ローカルで CI verify 14 ステップ + docs-lint を exit 0、GitHub CI も緑。**指示どおり 6 本とも `origin/main` から独立に切ってあるので、テンプレート 3 本は #1179 → #1180 → #1181 の順で merge する前提**（`NotesView.tsx` / `NoteDetailPanel.tsx` / i18n catalog で衝突しうる。i18n は 3 本で挿入位置をずらして自動マージが効くようにした））
- #1139 SupabaseTodosService の items_meta DELETE 2 箇所に role ガード ✅（2026-08-27 — **PR #1150 open**（Closes #1139・merge = こうだいさん）。#1099 の反対側で、#1098 / PR #1113 が schedule 側でやったことの Todos 版。穴の本体は `permanentDeleteTodo`: プールを `role='task'` の 2 本の read から作るので一見自衛できているが、`collectDescendantIds` が**プールを見る前に `id` 自身を結果へ入れる**ため、呼び出し元が渡した id はどちらの read も見ていなくても DELETE まで届く（= Issue の Trash レース。端末 B が Event へ変換 → 端末 A が古い一覧で「完全に削除」）。`createTodo` の R2 孤児回収は同じ呼び出しが直前に insert した行が相手なので理屈上ノーオペで、census を例外なしの規則に保つために付けた。テストは既存 `shared/tests/todoMetaRoleGuard.test.ts` を #1113 と同じ形に育成（16 ケース）— DELETE と insert をモックが実際に行うようにし、生存判定は 捕まえた行オブジェクトではなくテーブルから読み、`beforeFirstMetaDelete` フックで purge 途中の変換を再現。`;` 分割の素朴な census を #1113 のチェーン walker に差し替えて `method → role` を pin。mutation 4 通り実測（ガード剥がし 2 種で 5 件 / 4 件・role を `"todo"` と誤記で 4 件・チェーンを 2 文に割って走査回避で 4 件が赤）。CI verify 14 ステップ + docs-lint すべて exit 0）
## 予定

（なし — 2026-08-29 dispatch 分の 6 件（#1179 #1180 #1181 #1172 #1189 #1183）は PR まで完了。次は chat-main からの新規 dispatch 待ち）

## 申し送り

- **テンプレート 3 本の merge は #1179 だけ完了**（PR #1216 merged = 2026-08-30 実測）。残りは #1180 = PR #1221（main 取り込み済み・修復済み）と #1181 = PR #1227（**未着手の main 取り込みあり**。#1179 が消した `NoteTemplateHost` / `NoteTemplatePanel` を #1227 も参照しているなら、#1221 と同じ壊れ方をする。取り込み時は barrel / `NotesView` / code-split allowlist の 3 点を先に見る）
- **マージ解決の教訓（2026-08-30）**: 独立ブランチ制約で「同じ機能領域を別々に触った 2 本」を合流させると、解決が**片方を消して片方を残す**形になりやすい。`git diff <merged-main> <merge-commit>` で「この PR が main に足す差分」を読むと、消えた export や入れ替わった import が一目で出る。CI ログは tsc が 1 件目で止まるので**全容を写していない**前提で読む
- （旧記述）2026-08-29 の 6 本は merge 順が要る: テンプレート 3 本は #1179 → #1180 → #1181。全部 `origin/main` から独立に切った（ユーザー指示）ので、`web/src/notes/NotesView.tsx` と `shared/src/components/materials/NoteDetailPanel.tsx` は衝突しうる。**#1179 だけが旧テンプレート工房（`NoteTemplateHost` / `NoteTemplatePanel`）を削除**し、#1180 は同じ行を触らずに新 UI を足す形にしてある（2 本で同じ行を消すと衝突するだけなので）。#1179 単体の状態ではテンプレートを読む導線が無いので、3 本続けて入れる前提
- **#1180 と #1181 でテンプレート一覧を読むフックが 2 つ並ぶ**（`useNoteTemplateLibrary` / `useNoteTemplateApply`）。独立ブランチ制約の副産物で、3 本着地後に統合するのが follow-up 向き
- **#1189 は解釈を 1 つ置いた**: Issue の「日付リスト（直近 14 日の DateStrip）」は rightSidebar に無い（DateStrip は狭幅の本文側）。今日/昨日タブと DateStrip は撤去し、**日付ピッカーは残した** — エントリがまだ無い日を開く導線がピッカーしか無いため。PR #1236 本文に明記済みで、ピッカーも不要ならユーザー判断で追加撤去
- **#1183 の before/after スクリーンショットは未添付**。worktree から実ブラウザを起こさない規約なので、目視は merge 後に chat-main 側
- **#1075（ノートテンプレート）は 2026-08-27 時点で merged**。前提だった `supabase db push`（`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加）が適用済みかどうかは未確認 — 未適用のまま merge されているとテンプレート作成が CHECK 違反で落ちるので、初回利用時に確認が要る
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
