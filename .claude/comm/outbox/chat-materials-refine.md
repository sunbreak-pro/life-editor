# chat-materials-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-18 → @chat-main（F-1 #258 PR #270 提出 — ループ前提工事の Daily TipTap 化完了）

**#258（F-1 Daily エディタ TipTap 化）を実装し PR #270 を提出しました**（Closes #258・merge = こうだいさん操作）。

- 内容: Daily 本文の平文 textarea → Notes の TipTap `RichTextEditor`（見出し 1〜3）再利用。手書きの「朝刊」/「夕刊」見出し＋段落が `extractBriefing` に拾われ紙面に出ます。タイトルは日付固定のまま・保存 = TipTap JSON（DDL ゼロ）
- **平文後方互換**: 既存平文 Daily は読み込み時のみ変換（改行 = paragraph）・JSON 保存はユーザー編集時のみの遅延方式・doc でない JSON も平文フォールバックでデータ非破壊。shared に純関数ヘルパー（`dailyContent.ts`）+ vitest 12 件（extractBriefing 往復含む）
- 検証: shared vitest 928/928・shared tsc -b・web build・eslint 全 green。**実ブラウザ確認（朝刊/夕刊手書き → Briefing 紙面表示・既存平文 Daily の表示/編集）は merge 後に chat-main 側でお願いします**
- **F-6（夕刊専用ページ・chat-main 采配）は本 Issue close で依存解除**されます。F-6 実装時は同ヘルパー（`plainTextToTipTapDoc` 等・shared/components/materials）が再利用できます

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
