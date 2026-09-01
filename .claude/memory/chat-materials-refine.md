# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- **#1407 / #1404 を 2 PR に分けて提出** ✅（2026-09-01 — どちらも `origin/main` から独立に切った。書いた時点の実測で PR #1417（#1407）/ #1425（#1404）とも **open**。**#1404 は 🛑 人手ゲート付き**: `supabase/migrations/0027_attachments_bucket.sql`（非公開バケット + 4 ポリシー）は未適用で、こうだいさんの `supabase db push` 待ち。適用前でもアプリは壊れない設計にしてある（アップロードはトースト、既存ノードは「読み込めませんでした」表示に落ちる）。
  - **#1407 = 「一覧は直したが本文は直っていなかった」**: #1101 の snapshot は list を replay するが、**行は本文を持たない**（M1 = `listNotesUnified` は `content: ""`）。本文の台帳（`useNoteHydrationLedger` の ref）はマウント単位なので、Materials に戻るたび開いていたノートの本文だけ `getNoteUnified` を 1 往復していた。Materials だけで起きるのは**メインの表示物が一覧ではなく「アイテム 1 件の遅延読み込み」である唯一のセクション**だから。`shared/src/state/noteBodyStore.ts`（module-level LRU 12 件・DataService identity + `updatedAt` 一致で検証）を足し、`mergeLoadedList` が**メモリ上に行が無いときだけ**キャッシュを見る形にした（ライブ状態が常に優先 = #607 の own-write カバーを壊さない）。`restoreSelection` に `canHydrate` を追加し、replay は**merge が既に本文を持っていた場合だけ**復元して、そうでなければ one-shot を消費せずに戻る — #1285 のヘッダが書いている危険（layout effect から始めた hydrate が飛行中の read に merge で消される）は、新経路が hydrate を始めないので入り込まない
  - **#1404 = 「本文にはパスを入れる」が全部を決めた**: バケットを非公開にすると URL は署名付き 1 時間で失効するので、本文に URL を焼き込むと「一晩で画像が壊れるノート」か「ずっと公開のバケット」の二択になる。本文はパスだけ持ち、`attachment` ノードが**描画のたびに署名 URL を引き直す**。migration 0027 の 4 ポリシーはどれも**パスの第 1 セグメント = `auth.uid()`** でしか通さないので、`SupabaseAttachmentsService` の `<uid>/<uuid>.<ext>` と**1 つの契約**（片方だけ変えると全アップロードがポリシーエラー）。ファイル名でなく uuid なのは衝突回避 + 「ファイル名は URL パスに入るユーザー入力なので消毒より最初から入れない」。$0 は 1 ファイル 10 MB をクライアントとバケット両方に（無料枠 = 1 GB / 月 5 GB egress / 1 アップロード 50 MB・supabase.com/pricing 2026-09-01 確認）
  - CI verify のステップ列（shared → web → desktop → mcp-server）+ `docs-lint` を各ブランチでローカル全緑）

- **materials 4 件（#1372 / #1363 / #1364 / #1365）を 4 PR に分けて提出** ✅（2026-09-01 — 全部 `origin/main` から独立に切った。書いた時点の実測で PR #1380（#1372）は **merged**、#1384（#1363）/ #1394（#1364）/ #1397（#1365）は **open**。**2 件は「どこを直すか」の特定が本体**だった: (1) #1364 の繰り上げは `NoteTagFilterChips.tsx` の `ordered` メモにあり、**`sort` を呼ばず `filter` 2 回の連結**で並べ替えていたので Issue が試した `selected` + `sort` の grep では出なかった。繰り上げが担保していた #1288 の「選択中チップが `+N` の裏に隠れない」は、折り畳み時に「先頭 6 個 + キャップより下の選択済み」を**元の順のまま**描く形で維持。(2) #1365 の「ここだけアイコンが出ない」は `useNoteListState.tagFilterChips` が**色ドットを手組み**していたためで、`wiki_tags.icon` を一度も読んでいなかった（#1291 の唯一の取りこぼし = リポジトリ内に残っていた最後の手組みタグ表示）。`TagHeadingIcon` に差し替え。残り 2 本 = #1372 空状態中央の追加ボタン撤去（右上 pill が両幅で残るので `isWide=false` のテストを追加）/ #1363 テンプレート編集パネルを Note と同寸に（`Modal` に `reading` サイズを追加 = `max-w-lumen-reading`・本文フロア 320→420px・名前と本文が 1 つのスクローラ / キャンセル・保存はその外）。各 PR で shared → web の CI verify（build / lint / typecheck:tests / vitest）をローカル全緑）

- **#1345 — ノート削除を確認ダイアログ越しにした** ✅（2026-08-31 — PR #1347・書いた時点で open。同じ `NotesView.tsx` の中でテンプレート削除（#1248）は聞くのにノート削除だけワンクリックで消えていた割れを解消。削除経路 2 本（サイドリスト行の `onDeleteNote` / 詳細ケバブ「その他の操作」→「ノートを削除」の `onDelete`）を `handleDeleteNote` 1 本に寄せ、既存の `useConfirmDialog()` を通す。**幅ごとの分岐は書いていない** — #876 以降 wide / narrow が同じリストと同じ詳細サーフェスを描くので、一本化しただけで両幅が揃う。ダイアログは #1248 が view 直下に置いた `<ConfirmDialog>` の再利用で、ケバブが閉じても質問が残る。文言は Todo 削除に寄せて「ゴミ箱に入るので、あとから元に戻せます」— テンプレート削除の「戻せません」とは性質が逆なので書き分け。追加キー `materials.notes.deleteConfirmBody` / `deleteConfirmAction` を en / ja 両方へ。テストは既存 1 本を「押下＝質問」に書き換え + 拒否ケース + ケバブ経路を `it.each([true, false])` で両幅。CI verify のステップ列 + docs-lint をローカル全緑）

- **#1334 — リンク先プールが両方の `is_deleted` バケツを読むようにした** ✅（2026-08-31 — PR #1340・書いた時点で open。前日の #1292（PR #1306）が実データで効いていなかった follow-up。プールは「削除済みをフラグ付きで持つ」形になっていたのに、**フラグの元にしていた `fetchTodoTree` / `listNotesUnified` / `listDailiesUnified` が 3 本とも自分のクエリで `is_deleted = false` を固定**していたため、フラグは構造的に常に false で、削除済み Todo へのリンクは相変わらず id 断片で出ていた。各ドメインで Trash 側の既存メソッド（`fetchDeletedTodos` / `fetchDeletedNotesUnified` / `fetchDeletedDailiesUnified`）も読み、**live を先に**連結する形へ — 新しいクエリも引数も足していない。**`web/tests/linkPanel.test.tsx` がこのバグを丸ごと隠していた**: 削除済み行が入り済みの pool を panel に直接渡すので、壊れていた手前の工程を一度も通らない。新規 `web/tests/useItemLinkTargets.test.tsx` は結果ではなく**分割の方を模す**（ドメインごとに 1 枚の行テーブル + 各読み取りが自分のバケツだけを返す）ので live だけの pool では通らない。4 ケースとも修正前のソースで落ちることを実測。CI verify のステップ列をローカル全緑）

## 予定

（なし — 2026-09-01 dispatch の 4 件まで完了。次は chat-main からの新規 dispatch 待ち）

## 申し送り

- **main が赤い間は自分の PR の赤を自分のせいだと読まない**（2026-09-01・PR #1431 で修理）: #1425 の CI 失敗は 1 件だけで、しかも `Analytics/TagUsageCard.tsx` — 自分が一度も触っていないファイルだった。**#1419 / #1422 / #1426 が「書いた時点では全部緑」のまま順に入って壊れた**形で、このチャットの申し送りに既にある「CI が緑 ≠ 取り込み済み」の 3 本版。**赤を見たら最初に「落ちているファイルは自分の Scope か」を見る**
- **取り込み順は #1431 → #1425**。#1431（main の修理）が入るまで #1425 の CI は緑にならない
- **2026-09-01 (2) の実測**（書いた時点）: PR #1417（#1407）/ #1425（#1404）とも **open**。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認は merge 後に chat-main 側**で、#1404 は**さらにバケット適用後**
- **#1404 の添付は孤児回収も進捗表示も無い**（どちらも意図的・outbox で起票依頼済み）。孤児回収 = ノードを消しても実体を残す（undo で復活しうるので編集のたびに消すのは正しくない）。進捗 = 挿入がアップロード完了後（先に入れると 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化される）
- **#1404 を配線したのは Notes だけ**。エディタは Daily / Briefing / Todo 詳細でも使うが、Issue の Scope が `web/src/notes/**` を名指ししているため。他画面は `attachments` prop を 1 本渡すだけで足りる（`attachment` ノード自体は全画面で**無条件登録**済みなので、画像入りノートは今でもどこでもスキーマエラーなく開き、リゾルバが無い面では読める文言に落ちる）
- **「Issue に書かれた当たりが既に実装済み」のことがある**（#1407）: Issue の当たりは lazy チャンク + 本文再フェッチの重なりだったが、チャンク側は #1158 の idle warm-up で既に潰れていて、残っていたのは本文の 1 往復だけだった。**先に「もう直っている部分」を切り分ける**と、直す場所が 1 箇所に絞れる
- **#1417 と #1425 はファイルが重ならない**（#1407 = `shared/src/hooks/useNote*` + `state/noteBodyStore.ts` / #1404 = services + `web/src/notes/` の新規 3 本 + `slashCommand.ts` / `RichTextEditor.tsx`）。`shared/src/index.ts` だけ両方が触るが、追記位置が別（前者 = domainSnapshotStore の隣・後者 = その直後の constants ブロック）なので順序はどちらでもよい
- **2026-09-01 の 4 本の実測**（書いた時点）: PR #1380（#1372）= merged / #1384（#1363）・#1394（#1364）・#1397（#1365）= open で CI は #1384 / #1394 が緑、#1397 は実行中。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認は merge 後に chat-main 側**で回す — worktree からは実ブラウザを起こさない規約
- **#1394 と #1397 は同じ `NoteTagFilterChips.tsx` を触る**（#1364 = 並び替えメモとトグル条件 / #1365 = interface のコメント・`VISIBLE_LIMIT`・チップの className）。行が離れているので auto-merge する見込みだが、**2 本目で衝突したら「両方残す」**（#1365 側が `VISIBLE_LIMIT` を 8 → 6 にしている点だけ注意）。`web/tests/notesView.test.tsx` も #1372（中程）と #1365（末尾追記）で重なる
- **grep で見つからない並び替えは `sort` を使っていないことを疑う**（#1364）: 実体は `filter` 2 回（picked / rest）の連結だった。Issue 側も「`selected` + `sort` の grep では未特定」と書いていたとおりで、**「並べ替え」を動詞ではなく結果（配列の再構築）で探す**方が早い
- **手組みの表示は「全 UI に反映」の穴になる**（#1365）: #1291 が `TagHeadingIcon` を唯一の読み取り経路にしたのに、Notes のチップ行だけ 6px の色ドットを自前で描いていたので `wiki_tags.icon` を一度も読んでいなかった。**色は出るがアイコンは出ない、という症状は「その面が共通部品を通っていない」サイン**
- **`Modal` に `reading` サイズを足した**（#1363・`max-w-lumen-reading` = `PageContainer width="reading"` と同じトークン）。テキスト面を載せるパネルは今後これを使う。`shared/tests/modalWidth.test.tsx` の「全サイズに幅が 1 つ」ループにも追加済み
- **#1345 の PR #1347 は open**（2026-08-31 書いた時点の実測。base = `origin/main`）。merge はこうだいさんの手番（P-001）。**実ブラウザでの DoD 確認**（wide / narrow 両方でダイアログが出る・キャンセルで残る・実行後に Settings → ゴミ箱から復元できる）は merge 後に chat-main 側で回す
- **同じファイルの中で作法が割れていたら、揃える側の経路を数え直す**（#1345）: Issue は「ノート削除に確認が無い」1 件だが、実体は `onDeleteNote`（行のゴミ箱）と `onDelete`（ケバブ）の 2 経路だった。片方だけ直すと割れ方が変わるだけで残る
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
