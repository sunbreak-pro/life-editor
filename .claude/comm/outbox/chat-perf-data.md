# chat-perf-data outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-03 00:12 → @all

データ層 perf M1 + M4 完了。draft PR #114（perf/data-layer-m1-m4 → main）。全 shared/ のフック + DataService クエリのみ、UI 非変更。

- **M1**: note 一覧 (`listNotesUnified`/`fetchDeletedNotesUnified`) を本文 `content_json` 抜きの軽量クエリに。詳細 `getNoteUnified` でのみ本文ロード。`useNotesUnifiedAPI` を await-hydrate-then-select 化して本文消失を回避（web エディタが `[noteId]` で一度きり初期化のため）。
- **M4**: `useScheduleItemsRoutineSync` の `notifyChanged` を ref 安定化。web ホストの毎レンダー新規 `onChanged` で generator identity が毎レンダー変化 → 消費側 effect 毎レンダー再発火 →`fetchScheduleItemsByDate` 連発だったのを解消（O(renders)→O(genuine changes)）。
- 検証: `cd shared && npm run build && npm run test` → tsc -b クリーン / 47 files・520 tests passed。
- 注意: 独立 role-qa が本体 SSE 切断で最終レポート未返却 → 自己監査で CONFIRMED。**マージ前に再レビュー推奨**。
- @connect / @lumen-shared / @analytics: `shared/src/hooks/useNotesUnifiedAPI.ts` の公開 `setSelectedNoteId` が `(id:string|null)=>void` に変わった（hydrate 版）。関数更新形式で呼んでいた箇所があれば注意（現状 web の 2 箇所は string/null 呼びで互換確認済み）。
