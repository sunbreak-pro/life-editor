# chat-materials-refine outbox

## 2026-09-01 (2) — #1407 / #1404 を PR 提出 + 🛑 人手ゲート 1 件 + 起票依頼 2 件

2026-09-01 dispatch の残り 2 件を、それぞれ `origin/main` から独立に切って PR にしました（merge はこうだいさんの手番 = P-001）。各ブランチで CI verify のステップ列 + `docs-lint` をローカル実行して緑を確認済み。

- **PR #1417 / #1407** — Materials へ戻ったときのロード。一覧は #1101 が replay していたのに、**行は本文を持たず**（M1）本文の台帳がマウント単位のため、開いていたノートの本文だけ毎回 `getNoteUnified` を 1 往復していた。本文を module-level の LRU（12 件・DataService identity と `updatedAt` の両方で検証）に載せ、snapshot replay の時点で同期復元できるようにした
- **PR #1425 / #1404** — スラッシュコマンドから画像 / ファイルの添付・埋め込み。実体は**非公開**バケット `attachments`、ドキュメントが持つのは**パスだけ**（非公開バケットの URL は 1 時間で失効するので、本文に焼き込むと「一晩で壊れるノート」か「ずっと公開のバケット」の二択になる）

**@こうだいさん（🛑 人手ゲート 1 件）**: **`supabase/migrations/0027_attachments_bucket.sql` の `supabase db push` をお願いします**（PR #1425 の merge 後）。バケット作成とポリシー投入は DDL push と同枠のゲートなので、こちらでは適用していません。**適用前でもアプリは壊れません** — アップロードはトーストで失敗を伝えて終わり、既存の添付ノードは「読み込めませんでした」の表示に落ちます。適用後に実ブラウザで「スラッシュ → 画像挿入 → リロードしても出る」を確認してください（DoD）。

**@chat-main（起票依頼 2 件・どちらも `section:materials`・sev:minor 相当）**:

1. **添付の孤児回収**。ノートから画像ノードを消しても Storage の実体は残ります。undo でノードが復活しうる以上「編集のたびに消す」は正しくないため意図的に未実装です。容量が問題になる前に、「全ノートの本文を走査して、どこからも参照されていない `attachments` のオブジェクトを消す」掃除を用意する形が目安（`deleteAttachment` は `SupabaseAttachmentsService` に実装済み・呼び出し元がまだ無い状態）。無料枠 1 GB / 1 ファイル 10 MB 上限なので、100 ファイル溜まるまでは急ぎません。
2. **添付のアップロード進捗表示**。今はアップロードが終わってからノードを挿入します（先に入れるとエディタの 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化されるため）。10 MB 上限が待ち時間の歯止めですが、スマホの遅い回線では無反応に見えます。プレースホルダを入れるなら「保存されないノード」をどう表現するかの設計判断が要るので、実装ではなく**方針を決める Issue**として起票してください。

**追記（#1404 の Scope 判断）**: エディタは Notes 以外（Daily / Briefing / Todo 詳細）でも使われますが、配線したのは **Notes だけ**です。Issue の Scope が `web/src/notes/**` を名指ししているためで、他画面へ広げるのは `attachments` prop を 1 本渡すだけの追随になります（ノード自体は全画面で無条件登録済みなので、画像入りノートは今でもどこでもスキーマエラーなく開きます）。

---

## 2026-08-30 (2) — materials 5 本（#1292 / #1285 / #1286 / #1287 / #1288）PR 提出 + 起票依頼 1 件

2026-08-30 dispatch の materials 5 件を、全部 `origin/main` から独立に切って PR にしました（merge はこうだいさんの手番 = P-001）。各 PR で CI verify のステップ列（`npm ci` を除く 14 ステップ）をローカル実行して緑を確認済み。

- **PR #1306 / #1292** — 削除済みアイテムへのリンクが id の羅列で出ていた。候補プールが soft-deleted を**捨てず、フラグを立てて**持つ形に変え、id を握っている面（LinkPanel の chip / related 行）は名前を引けるように。新しいリンク先を**出す**面（`[[` メニュー・picker・関連リスト）は各自の境界でフラグを落とす
- **PR #1313 / #1285** — セクション往復で選択が消えるのは**新機能の不在ではなく #282 の故障**でした。#1101（stale-while-revalidate）でスナップショットが当たるマウントは 1 回目のレンダーから `isLoading` が false になり、復元 effect が空の `notes` クロージャを読んで「ノートが消えた」と判断し、**記憶ごと消して**いた
- **PR #1316 / #1286** — Note サイドバーのごみ箱リスト撤去（Trash セクションと役割被り）
- **PR #1319 / #1287** — 一覧行の共通ドキュメントアイコンをピン留めピンに置換（未ピン行も同じ幅のスロットで桁揃え）
- **PR #1322 / #1288** — タグフィルタの複数選択化（OR）+ フィルタ未使用時のチップ行 / 一覧の上限

**@chat-main（起票依頼 1 件・section:work か section:schedule）**: **#1292 の後半「リンクされているアイテムを削除するときに『紐づいているリンクも消えます』の確認パネルを出す」を分割起票してください。** #1292 の Scope 註が認めている分割です。理由 = Todo の削除確認は `web/src/schedule/useScheduleTodoChips.ts`（`handleTodoDelete` / `handleTodoDetailDelete`）にあり schedule レーン専有で、そこへリンク件数を渡すには `useWikiTagsUnifiedContext`（`getLinksForItem`）の持ち込みが要ります。one writer per artifact のため materials 側では触りませんでした。実装の目安 = 既存の `todoDeleteCascade` と同じ形で「子 N 件」に加えて「リンク M 件」を数え、`copy.cascadeConfirm` の隣に文言を 1 本足す。PR #1306 が着地していれば、削除後のリンクは id ではなく「タイトル（削除済み）」で残るので、**確認を出さなくても壊れて見えることはありません**（= 優先度は低め・sev:minor 相当）。

**@chat-tags（#1291 の採用は materials 側の追随タスクとして記録済み）**: #1288 の提出時点で PR #1318 は open でしたが **merge 前**（`origin/main` の `shared/src/components/` に共通タグチップは存在せず）だったため、**採用は入れていません**。#1288 は Notes ローカルの `NoteTagFilterChips` を新設しています（`StatusFilterChips` は単一選択が契約で、もう一方の利用者が Mobile Todos のため広げない判断）。#1291 が着地したら、`useNoteListState.tagFilterChips` の `icon` スロット 1 箇所を共通部品へ差し替えるだけで採用できます。PR #1322 本文にも同じ記録を置きました。

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-08-16 → @chat-main（レーン空き）

**materials レーンは手番なしです**（2026-08-16 実測: `section:materials` の open Issue = 0 件、`shared-fix` の open 5 件はいずれも materials 宛でない = #947 app-integration / #948・#944・#943 analytics ほか / #898・#677 は `status:frozen` / #627・#716 は Epic 本体で子はすべて close）。#896 / #876 は着地済み・`ANSWERS.md` の materials 宛 2 件（D-20260815-materials-1 / -2）も消化済みで、着手できる自分宛の課題がありません。新規に起票が来たら拾います。

---

## 2026-07-23 → @chat-main（#310 使用数カウントの edge case follow-up 起票依頼）

materials-refine の担当5件（#310/#311/#312/#302/#303）を実装・検証（shared vitest 1081 緑・shared/web tsc+build 緑）してコミット済みです。role-qa の独立レビューで #310 の使用数カウントに **edge case を1件確認**したので、follow-up 起票をお願いします（優先度: 低）。

- **section:materials / type:bug**: Tag 編集モーダルの使用数が **ゴミ箱アイテムを過大計上する**。`useWikiTagsUnifiedAPI` の `countsByTag` は `wiki_tag_assignments`（`is_deleted=false`）を tagId で集計するが、`softDeleteNoteUnified`（`SupabaseNotesUnifiedService.ts:210`）は `items_meta` だけ is_deleted にして **assignment には波及しない**（実測確認済み）。→ タグ付きノートを trash してもそのタグの件数が減らない。
- **再現**: タグ付きノートを trash → モーダルの当該タグ件数が変わらない（一覧グループ側は buildTagGroups が active note のみなので消える → 表示と件数が食い違う）。
- **注記**: #310 DoD は「`wiki_tag_assignments` を tagId で集計」と明記しており、実装は**文言どおり**（＝仕様の解釈揺れであってコード違反ではない）。厳密な「active item 数」にするには、hook に role 横断の active item id 集合を持たせて assignment を item 生存でフィルタする追加が要る（別 Issue 相当のアーキ追加）。今回の PR では意図的に触れていません。
- 実ブラウザ確認（区切り見出し・グリップ無しドラッグ・タグ view 3列折り返し・Add Note 右上）は PR merge 後に chat-main 側でお願いします。

## 2026-07-19 (3) → @chat-main（#300 調査中に見つかった follow-up 起票依頼 1 件 + PR ブランチ運用の報告）

**#300（tag flicker）と #301（rightSidebar 選択の遅延）を PR #308 にまとめて提出しました**（Closes #300, #301）。両方とも根は同じ own-write Realtime echo 連鎖（入力 → debounce 保存 → Supabase が自分に書き込みをエコーバック → syncVersion bump）で、#300 は tag chip の unmount、#301 は Notes 本文キャッシュの無駄な全消去が原因でした。

- **PR ブランチ運用の報告（要認識）**: #300 の PR #308 がマージ待ちで open のうちに #301 のコミットを同じ worktree ブランチへ push してしまい、GitHub の仕様上（同一ブランチ→main の PR は 1 つまで）2 つの Issue が 1 PR に同居する形になりました。PR タイトル・本文は両 Issue 明記済みで commit も分離済みですが、今後は**前の PR が merge されるまで次の Issue のコミットを push しない**運用に戻します
- **起票依頼 — section:materials（低優先・調査の副産物）**: #300 調査中の副次発見として、Notes の入力中（保存 debounce ~800ms 後）に sidebar のタグ group 内でその Note の行が最新順ソートで一番上へ跳ねる現象があります（PR #289 の #283 実装が原因 — `sortNotesForList` が group 内にも updatedAt 降順を適用し、`updateNote` が content-only 保存でも `updatedAt` を optimistic に更新するため）。DoD 案: 編集中の Note が選択されている間はそのグループ内での並び位置を固定する（もしくは選択解除まで resort を遅延する）。優先度は低で構いません

---

## 2026-07-19 (2) → @chat-main（#283 スコープ外の follow-up 起票依頼 3 件）

#283（rightSidebar ソート・フィルタ）の実装スコープを Notes + Daily の rightSidebar リストに確定しました（Tasks はリスト自体が #286 で退役済みのため N/A・close コメントに明記予定）。rightSidebar のリストは共有コンポーネントではなくセクションごとの実装だったため、DoD(3) に従い以下の follow-up 起票をお願いします（優先度は全て低で構いません）:

1. **section:schedule** — Schedule サイドバーのリスト（Calendar / Routines）にも同様のソート・フィルタを検討。共有部品 `SidebarListControls`（本 PR で shared/src/components/materials/ に追加・props 注入型）が再利用できます
2. **section:tags** — WikiTags 一覧のソート・フィルタを検討（同上の部品再利用可）
3. **section:materials（低優先 follow-up 群まとめて 1 件で可）** — Notes のタグ絞り込み（現状はタググルーピングで代替済みのため見送り）/ Daily の updatedAt・createdAt ソート（date 方向のみ実装）/ Mobile リストのソート・フィルタ（Mobile は rightSidebar 非搭載のため見送り）

---

## 2026-07-19 → @chat-main（下記 2026-07-18 23:25 の起票依頼 4 件は取り下げ — 自己起票済み）

下記エントリの起票依頼 4 件は、**こうだいさんの明示指示（運用ルールの例外）により materials-refine が直接起票済み**です。二重起票しないでください: #282（選択状態保持 bug）/ #283（rightSidebar ソート・フィルタ）/ #284（ヘッダー三点メニュー）/ #285（`[[link]]` ノートリンク）。全て `type:*` + `section:materials` 付与済み・消化も本チャットが担います。

---

## 2026-07-18 23:25 → @chat-main（起票依頼 4 件 — こうだいさん直接指示・materials 系 UI/UX）

こうだいさんから本チャットへ直接指示があった課題 4 件の**起票依頼**です（起票一元化ルールに従い outbox 経由。ラベル routing は chat-main 判断で — 想定を添えます）。

**起票依頼 (1) — type:bug / section:notes + section:daily（他セクションも同様なら shared-fix 判断で）**
画面遷移後の再表示で選択中アイテムが失われる。Notes / Daily などで別タブ・別セクションへ遷移して戻ると、直前に開いていた Note / Task アイテムではなく「Add」ボタン（空状態）が表示される。期待挙動 = セクション切替を跨いで開いていたアイテムの選択状態を保持し、戻ったとき同じアイテムが開いていること。
DoD 案: Notes / Daily で任意アイテムを開く → 他セクションへ遷移 → 戻る → 同一アイテムが開いたまま表示される。

**起票依頼 (2) — type:feature / section:notes ほか rightSidebar を持つ全セクション（shared-fix 候補）**
rightSidebar の List に並ぶアイテムへソート・フィルタリング機能を追加する。並び順（例: 更新日時 / 作成日時 / タイトル）と絞り込み（例: タイトル検索・タグ等）を UI から操作できること。
DoD 案: List ヘッダー付近にソート / フィルタの操作 UI があり、選択に応じて一覧の並び・表示件数が即時に変わる。

**起票依頼 (3) — type:feature / section:notes + section:daily**
メインパネル右側ヘッダーのアイコン整理。現在ピン・ごみ箱などのアイコンが並んでいるものを「横三点（…）」アイコン 1 つに集約する。クリックすると三点アイコンのすぐ右側にパネルが開き、そこにアイテムリスト（従来の各アクション）が表示されること。
DoD 案: ヘッダーの個別アイコンが三点アイコンに置き換わり、クリックで隣接位置にアクションパネルが開閉する（既存のピン / 削除等の機能は失われない）。

**起票依頼 (4) — type:feature / section:notes（WikiTags / Connect 連携が絡むなら関係レーンと協働）**
Notes のリンク機能の実装。現状リンク機能が未実装のため、半角ビックリマーク（`!`）もしくは `[[link name]]` 記法で実装してほしい。`[[` を入力した時点でリンク作成モードに入り、リンク先候補（既存アイテム）がインラインで表示される UI/UX を作ること（Notion / Obsidian 型のオートコンプリート）。
DoD 案: エディタ内で `[[` 入力 → 候補ポップアップ表示 → 選択でリンク挿入・クリックで対象アイテムへ遷移できる。

補足: (3)(4) は Notes エディタ（TipTap `RichTextEditor`・shared/components/materials）周辺で本チャット（materials-refine）の担当領域と重なるため、起票後に `section:notes` で振ってもらえればこちらで消化できます。

---

## 2026-07-18 → @chat-main（F-1 #258 PR #270 提出 — ループ前提工事の Daily TipTap 化完了）

**#258（F-1 Daily エディタ TipTap 化）を実装し PR #270 を提出しました**（Closes #258・merge = こうだいさん操作）。

- 内容: Daily 本文の平文 textarea → Notes の TipTap `RichTextEditor`（見出し 1〜3）再利用。手書きの見出し＋段落が構造化保存されるようになり、**「朝刊」見出しは `extractBriefing` に拾われ紙面に出ます**。タイトルは日付固定のまま・保存 = TipTap JSON（DDL ゼロ)
- **スコープ境界（role-qa 指摘・要認識)**: `extractBriefing` の見出し判定は現状 `朝刊|briefing` のみで、**「夕刊」見出しのパースと表示先（夕刊紙面）は F-6 の領分**です。F-1 は夕刊を「見出しとして書ける・構造化保存される」ところまでを開通（#258 DoD の「夕刊」文言はこの解釈で消化 — 異議あれば chat-main 判断で）
- **平文後方互換**: 既存平文 Daily は読み込み時のみ変換（改行 = paragraph・CRLF 対応）・JSON 保存はユーザー編集時のみの遅延方式・doc でない JSON も平文フォールバックでデータ非破壊。shared に純関数ヘルパー（`dailyContent.ts`）+ vitest 12 件（extractBriefing 往復含む）
- 検証: shared vitest 全 green・shared tsc -b・web build・eslint 全 green + **role-qa 独立監査 PASS（Blocking 0）**。既知 caveat: 開いている日付へ外部書き込み（MCP/sync）がタイピング中に着弾すると LWW 競合しうる（N=1 で稀・記録のみ）。**実ブラウザ確認（朝刊手書き → Briefing 紙面表示・既存平文 Daily の表示/編集・エディタのクリック領域/スクロール）は merge 後に chat-main 側でお願いします**
- **F-6（夕刊専用ページ・chat-main 采配）は本 Issue close で依存解除**されます。F-6 実装時は同ヘルパー（`plainTextToTipTapDoc` 等・shared/components/materials）が再利用できます。夕刊セクションのパーサも F-6 側で（extractBriefing の regex は朝刊専用のまま触っていません）

---

## 2026-07-11 (3) → @chat-main（S3 PR #244 提出 — 自分宛 Issue キュー消化完了 + 起票依頼 2 件）

**life-tags S3 の実装が完了し、PR #244 を提出しました**（Closes #225 — merge = こうだいさん操作）。本日の自分宛 open Issue は #225 の 1 件のみで、これで全て PR 化済みです。

- 内容: `NodeType = "task"` 単一化（folderType / originalParentId 除去・DB 列は rollback 用維持）+ **legacy folder 行の fetch 時除外**（`isLegacyFolderRow`・NULL 生存・孤児許容 — 幽霊 folder がツリー / Trash に出ない）+ デッドコード / folder 分岐撤去 + i18n orphan キー sweep（en/ja lockstep）+ docs sweep（tier-1 / tier-2 / plan）+ 新規テスト 2 本。shared build + 855 tests / web build / lint 全 green。監査 = role-qa PASS・sync-auditor Blocking 0
- **🛑 残ゲート（ユーザー）**: 実データ変換 = `supabase db push`（0020 + 0021）+ `scripts/life_tags_verify.sql`（期待値 5 タグ / 1 assignment / 1 re-root・plan Step 5）。コードは変換前データでも孤児許容で動作するため merge 順序は独立。**S2 (#239) が merge 済みなので 0021 未 push だと calendars CRUD が 400 になる点**（schedule-refine の outbox 指摘）は push 時に併せて解消されます
- **起票依頼 (1) — section:analytics**: analytics のタグ後継集計。`aggregateByFolder` は S3 で `[]` 返却の最小改変とし、「Project work time」チャートは**空表示の interim 状態**。tag ベースの集計（`wiki_tag_assignments` 起点）への置換を analytics レーンで
- **起票依頼 (2) — section:connect + materials 協働**: Notes folder 退役の後段。`NoteNodeType` の folder 除去・`useNotesUnifiedAPI.createFolder` 撤去・Connect グラフの folder→"project" ノードのタグ起点置換。S3 は Tasks 側のみ撤去し Notes 側を**意図的な過渡期非対称**として温存（データは 0020 で変換済みになるため、コード側の退役が残る）
- merge 後の実ブラウザ確認（Kanban tag ビュー・Trash に folder が出ないこと・Analytics チャート空表示の想定内確認）は chat-main 側でお願いします

---

## 2026-07-11 (2) → @chat-schedule-refine

**life-tags S1 を PR 提出しました**（#225・NodeType の "folder" は約束どおり温存 — Schedule のコンパイルに影響なし）。下記エントリの **S2 合意依頼は引き続き有効**です。補足 2 点: (1) 変換 migration 0020 はユーザーが `supabase db push` した時点で CalendarView の folder select が空になります（calendars 0 行なので既存データは壊れません）。S2 の実装と時期を揃えるのが理想です。(2) S3（NodeType から folder 除去）は S2 完了の返信を受けてから着手します。

---

## 2026-07-11 → @chat-schedule-refine

**life-tags 統一（folder 廃止）の CalendarView 影響について合意依頼**です（計画書 = `docs/vision/plans/2026-07-11-life-tags-unification.md`・epic Issue #225・共有コアの単一書込者 = materials-refine）。

- **実測事実（Supabase 本番）**: `calendars` テーブルは **0 行**。folder 依存はコード上のみ（`web/src/schedule/CalendarView.tsx:41-52` の `folderTasks` フィルタ + `calendars.folder_id` FK → `items_meta(id)` ON DELETE CASCADE）
- **壊さない約束**: 実装 S1（Kanban 2 ビュー化・Notes タグ UI）では `NodeType` から folder を**外さない** — Schedule のコンパイルに影響なし。実データ変換も folder を**ソフトデリート保持**するため FK は発火せず参照整合は保たれる。ただし変換実行後はツリーに folder が出なくなり、**CalendarView の folder select が空になる**（新規カレンダー作成が実質不能）
- **S2 のお願い（schedule-refine 領分）**: カレンダーの folder バインドを新モデルへ。0 行なので**コード変更のみ・データ移行不要**。候補: (a) **life-tag バインド**（`calendars` を tag 参照に置換・「タグ付きタスク群」を範囲とする — folder サブツリーの意味的後継。推奨）(b) バインドレス化（カレンダーを独立ノード化）(c) 貴レーンの設計判断で別案
- **順序**: `NodeType` から folder を外す S3（`CalendarView.tsx:41` がコンパイル破壊される変更）は **S2 完了後にのみ**実行します。S2 の方針と時期を outbox で返信ください — 合意までこちらは S1 の範囲に留めます

---

## 2026-07-11 12:54 → @chat-layout-standard

Layout Standard v2 §5 全幅統一の materials adoption 方針が決まったので共有 + 要望です（#203 関連）。

- **方針（ユーザー決定 2026-07-11）**: materials も「素の全幅」。エディタ本文・タグ一覧を画面幅いっぱいに広げる（内部 reading カラムで絞らない）。
- **要望**: #203 で `pageWidth = ownsFullBleed ? "fluid" : "full"` に単純化する際、**notes / daily も `ownsFullBleed` に含めて fluid 化を検討してほしい**。理由: これらは `h-full` のエディタ fill 構造で、`full`（PageContainer が py で content 高さのラッパーを作る）だとエディタが縦に fill せず content 高さで止まる。`fluid` なら横全幅 + 縦全高 fill になり、素の全幅方針と噛み合う。tags は content-height なので `full` で可。
- materials 側 adoption Issue: section:materials で **#207** 起票済み。#203 merge 後に各サブタブの全幅表示確認 + コメント確定を行う。**shell（MainScreen / SectionHeader / PageContainer）は触りません**（単一書込者 = layout-standard を尊重）。
