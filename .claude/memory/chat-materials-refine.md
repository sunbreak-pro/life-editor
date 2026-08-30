# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- **#1334 — リンク先プールが両方の `is_deleted` バケツを読むようにした** ✅（2026-08-31 — PR #1340・書いた時点で open。前日の #1292（PR #1306）が実データで効いていなかった follow-up。プールは「削除済みをフラグ付きで持つ」形になっていたのに、**フラグの元にしていた `fetchTodoTree` / `listNotesUnified` / `listDailiesUnified` が 3 本とも自分のクエリで `is_deleted = false` を固定**していたため、フラグは構造的に常に false で、削除済み Todo へのリンクは相変わらず id 断片で出ていた。各ドメインで Trash 側の既存メソッド（`fetchDeletedTodos` / `fetchDeletedNotesUnified` / `fetchDeletedDailiesUnified`）も読み、**live を先に**連結する形へ — 新しいクエリも引数も足していない。**`web/tests/linkPanel.test.tsx` がこのバグを丸ごと隠していた**: 削除済み行が入り済みの pool を panel に直接渡すので、壊れていた手前の工程を一度も通らない。新規 `web/tests/useItemLinkTargets.test.tsx` は結果ではなく**分割の方を模す**（ドメインごとに 1 枚の行テーブル + 各読み取りが自分のバケツだけを返す）ので live だけの pool では通らない。4 ケースとも修正前のソースで落ちることを実測。CI verify のステップ列をローカル全緑）

- **materials 5 件（#1292 / #1285 / #1286 / #1287 / #1288）を 5 PR に分けて提出** ✅（2026-08-30 — 2026-08-30 dispatch 分。全部 `origin/main` から独立に切った。PR #1306（#1292）/ #1313（#1285）/ #1316（#1286）/ #1319（#1287）/ #1322（#1288）。**#1292 と #1285 はどちらも「新機能の不在」ではなく既存機能の故障**だった: (1) #1292 = 削除済みアイテムへのリンクが `…56123478` の id 断片で出ていた。候補プール `useItemLinkTargets` が soft-deleted 行を**捨てて**いたため、id を握っている LinkPanel が名前を引けず最後の手段の id 短縮に落ちていた → プールが deleted を**フラグ付きで持つ**形に変え、新しいリンク先を出す面（`[[` メニュー・picker・関連リスト）だけが各自の境界でフラグを落とす。(2) #1285 = セクション往復で選択が消えるのは #282 の故障で、原因は **#1101 のスナップショット**。スナップショットが当たったマウントは 1 レンダー目から `isLoading` false になり、復元 effect がそのレンダーの**まだ空の `notes` クロージャ**を読んで「ノートが消えた」と判断し `clearNotesSelection()` で記憶ごと消して one-shot も使い切っていた → 復元を effect から外し `apply` が適用した配列を引数で受け取る形（隣の `useTodoTreeAPI` と同じ）にし、さらに**スナップショット replay では復元しない**（`fetchLandedRef`）— replay は layout effect なので、そこで hydrate を始めると裏で走る再読み込みの `mergeLoadedList` が passive effect 更新の `notesRef` を読んで**取ってきたばかりの body を merge で消す**。残り 3 本 = #1286 サイドバーのごみ箱撤去（162 行の純減・死にキー 3 本も en/ja で削除）/ #1287 行頭の共通ドキュメントアイコン → ピン留めピン（未ピン行も同幅スロットで桁揃え）/ #1288 タグフィルタの複数選択（**OR**）+ 未フィルタ時のチップ行 8 個上限・グループ 5 行上限。各 PR で CI verify 14 ステップをローカル実行して全緑）

- #1248 / #1255 をテンプレート 1 PR にまとめて提出（PR #1260・open）✅（2026-08-30 — どちらも 2026-08-30 の merge 後実ブラウザ検証で出た、Notes テンプレートの同じ一角の不具合。#1248 = サイドバーのゴミ箱がワンクリック即時削除で、しかも消えたテンプレートは Trash に出ない（trash の読み取りがテンプレートを除外する）ので復元不能だった → 共有 `ConfirmDialog`（#707 / #781）越しに変え、テンプレート名入りの文言 + `danger`、確定したときだけ `softDeleteNoteUnified` が走る形に。Trash 復元は Issue のスコープ外なので「ゴミ箱に入らないため元に戻せません」と文言で明示した。ダイアログは view 最上位にマウント（narrow ではサイドバーが MobileDrawer なので中に置くと親ごと消える = `TemplateEditHost` と同じ理由）。#1255 = 適用の確認が無条件表示で、本文が空でも「破棄されます」と出ていた → 確認ステップは残し `isBlankNoteBody` で文言だけ出し分け。この述語は**意図的に片側だけ**（空だと証明できたときだけ `true`）— TipTap 以前のノートは生 HTML を持ち、`isEmptyDocJson` はパースできない文字列を「空」と答えるため、警告を落とす判断にはちょうど裏返しになる。テストは既存 2 スイートに追記（削除の確認 / 拒否・空本文 3 件・述語の単体 3 件）。CI verify 15 ステップ + docs-lint をローカルで全緑）

## 予定

（なし — #1334 まで完了。次は chat-main からの新規 dispatch 待ち）

## 申し送り

- **#1334 の PR #1340 は open**（2026-08-31 書いた時点の実測。base = `origin/main` の f7179efc）。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認（ノート「プライベートでやりたいこと」のリンクチップが「todo（削除済み）」相当になる）は merge 後に chat-main 側**で回す — worktree からは実ブラウザを起こさない規約
- **「テストが緑」を「経路が通っている」と読まない**（#1334 で 2 度目）: `linkPanel.test.tsx` は削除済み行入りの pool を panel に直接渡すので、#1292 で壊れていた**手前の工程（pool 生成）を一度も通らない**まま緑だった。#1285 の `materialsSelectionPersistence.test.tsx`（別 DataService インスタンスを渡して常にコールドマウント相当になっていた）と同じ形。**修正時は「入力を手で作っている場所」がバグの現場でないか**を先に見る
- （旧記述）materials 5 PR（#1306 / #1313 / #1316 / #1319 / #1322）は 2026-08-31 時点で**全部 merged**
- **5 本は同じファイルの別の場所を触るので merge 順に注意**: `NotesSidebarList.tsx` を #1286（ゴミ箱ブロック撤去 = ファイル末尾側）と #1288（チップ行 + 行上限 = 前半と中程）が、`NotesView.tsx` を #1286 と #1288 が、`shared/src/i18n/locales/*.json` を #1292 / #1286 / #1288 が触る。**行が重ならないので auto-merge するはず**だが、1 本入るたびに次の base が動くので、2 本目以降で衝突したら「両方残す」で解決する（2026-08-30 のテンプレート 3 本と同じ形）
- **#1292 の後半（削除時の「紐づくリンクも消えます」確認）は分割起票を依頼済み**（outbox 経由・@chat-main）。Todo の削除確認は `web/src/schedule/useScheduleTodoChips.ts` にあり schedule レーン専有で、リンク件数を渡すには `useWikiTagsUnifiedContext` の持ち込みが要るため materials では触っていない。#1292 の Scope 註が認めている分割で、DoD も「確認パネル **または分割起票の記録**」
- **#1288 は #1291（共通タグチップのアイコン）を採用していない**: tags レーンの PR #1318 がほぼ同時に open になったが merge 前で、`origin/main` の `shared/src/components/` に共通タグチップは存在しなかった。#1318 着地後の追随は `useNoteListState.tagFilterChips` の `icon` スロット 1 箇所を `TagHeadingIcon` に差し替えるだけ（`NoteTagGroup` は `tagIcon` を既に持っている）
- **`StatusFilterChips` は広げずに Notes ローカルの `NoteTagFilterChips` を新設した**: 共有チップは `value: string | null` の単一選択が契約で、もう一方の利用者は Mobile Todos のステータスフィルタ（あちらは単一選択が正しい）。他レーンの部品にモードフラグを足さない判断（one writer per artifact）
- **既存テストが 2 Issue ぶんバグを隠していた実例**（#1285）: `materialsSelectionPersistence.test.tsx` の再マウント検証は**別の DataService インスタンス**を渡していた。#1101 のスナップショットは DataService の identity で引くので、別インスタンス = 常に miss = 常にコールドマウント相当になり、実アプリの経路（同じ ds を使い回す）を一度も通っていなかった。**「再マウントを検証している」と読めるテストでも、実アプリと同じ依存を渡しているかを見る**
- （旧記述）PR #1260（#1248 / #1255）は 2026-08-30 に merged
- **テンプレートの Trash 復元は未着手のまま**: #1248 は「確認を挟む」だけで閉じており、削除したテンプレートが Trash に出ない構造（trash の読み取りがテンプレートを除外する）はそのまま。復元可能にするなら別 Issue が要る — 今回は文言で「戻せません」と断る形にした
- **空本文の適用でも Apply ボタンは赤（danger）のまま**: #1255 の Scope が hook と i18n catalog だけを名指ししているので、`TemplateApplyPanel` の `bg-lumen-danger` 固定には手を付けなかった。「破棄するものが無いのに赤い」を直すなら panel に prop を足す小さな follow-up になる
- **テンプレート 3 本（#1179 / #1180 / #1181）は 3 本とも merged**（PR #1227 = 5f562c35 で main へ）。#1180 と #1181 でテンプレート一覧を読むフックが 2 つ並んだままなのは下の項のとおり
- **「CI が緑」は「取り込み済み」を意味しない**（2026-08-30 の実測）: #1227 は CI 緑のまま放置されていたが、それは main を取り込んでいなかったからで、取り込んだ瞬間に 4 ファイルが衝突した。独立ブランチで並行している間は、**緑かどうかではなく base がいつの main かを見る**
- **マージ解決の教訓（2026-08-30）**: 独立ブランチ制約で「同じ機能領域を別々に触った 2 本」を合流させると、解決が**片方を消して片方を残す**形になりやすい。`git diff <merged-main> <merge-commit>` で「この PR が main に足す差分」を読むと、消えた export や入れ替わった import が一目で出る。CI ログは tsc が 1 件目で止まるので**全容を写していない**前提で読む
- （旧記述）2026-08-29 の 6 本は merge 順が要る: テンプレート 3 本は #1179 → #1180 → #1181。全部 `origin/main` から独立に切った（ユーザー指示）ので、`web/src/notes/NotesView.tsx` と `shared/src/components/materials/NoteDetailPanel.tsx` は衝突しうる。**#1179 だけが旧テンプレート工房（`NoteTemplateHost` / `NoteTemplatePanel`）を削除**し、#1180 は同じ行を触らずに新 UI を足す形にしてある（2 本で同じ行を消すと衝突するだけなので）。#1179 単体の状態ではテンプレートを読む導線が無いので、3 本続けて入れる前提
- **#1180 と #1181 でテンプレート一覧を読むフックが 2 つ並ぶ**（`useNoteTemplateLibrary` / `useNoteTemplateApply`）。独立ブランチ制約の副産物で、3 本着地後に統合するのが follow-up 向き
- **#1189 は解釈を 1 つ置いた**: Issue の「日付リスト（直近 14 日の DateStrip）」は rightSidebar に無い（DateStrip は狭幅の本文側）。今日/昨日タブと DateStrip は撤去し、**日付ピッカーは残した** — エントリがまだ無い日を開く導線がピッカーしか無いため。PR #1236 本文に明記済みで、ピッカーも不要ならユーザー判断で追加撤去
- **#1183 の before/after スクリーンショットは未添付**。worktree から実ブラウザを起こさない規約なので、目視は merge 後に chat-main 側
- **#1075（ノートテンプレート）は 2026-08-27 時点で merged**。前提だった `supabase db push`（`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加）が適用済みかどうかは未確認 — 未適用のまま merge されているとテンプレート作成が CHECK 違反で落ちるので、初回利用時に確認が要る
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
