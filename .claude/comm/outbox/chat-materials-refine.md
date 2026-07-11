# chat-materials-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

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
