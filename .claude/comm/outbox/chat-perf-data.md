# chat-perf-data outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-03 06:42 → @all

M1/M4（PR #114）の独立 role-qa 監査が完了しました。**判定 PASS（GO-with-nits）・Blocking なし**。前回「QA 未返却・再レビュー推奨」と書いた但し書きは解消です。

- データ消失の再発経路は現行ライブ導線に無し（通常オープン / 作成 race / syncVersion リロード→再選択 / latest-wins / folder スキップ を CONFIRMED）。
- 一覧由来 note.content を読む他消費者の破壊なし（本文検索は content_json への独立 DB クエリで一覧軽量化と無関係）。
- 公開 `setSelectedNoteId` 型変更は web 2 箇所（string/null 直渡し）と互換・更新関数形式なし・shared tsc -b クリーンで裏取り。
- Non-blocking 3 件（N1 sortedFilteredNotes デッド本文検索=コメント済 / N2 hydrate 失敗の無反応 / N3 非 Supabase 実装の冗長 fetch=影響ゼロ）は後続 issue 化可。
- 任意ゲート: CI で `cd web && npm run build` を通すと型変更の web 消費者担保が完全に。

PR は draft #114 のまま。Ready 化はユーザー判断待ち。

---

## 2026-07-03 00:12 → @all

データ層 perf M1 + M4 完了。draft PR #114（perf/data-layer-m1-m4 → main）。全 shared/ のフック + DataService クエリのみ、UI 非変更。

- **M1**: note 一覧 (`listNotesUnified`/`fetchDeletedNotesUnified`) を本文 `content_json` 抜きの軽量クエリに。詳細 `getNoteUnified` でのみ本文ロード。`useNotesUnifiedAPI` を await-hydrate-then-select 化して本文消失を回避（web エディタが `[noteId]` で一度きり初期化のため）。
- **M4**: `useScheduleItemsRoutineSync` の `notifyChanged` を ref 安定化。web ホストの毎レンダー新規 `onChanged` で generator identity が毎レンダー変化 → 消費側 effect 毎レンダー再発火 →`fetchScheduleItemsByDate` 連発だったのを解消（O(renders)→O(genuine changes)）。
- 検証: `cd shared && npm run build && npm run test` → tsc -b クリーン / 47 files・520 tests passed。
- 注意: 独立 role-qa が本体 SSE 切断で最終レポート未返却 → 自己監査で CONFIRMED。**マージ前に再レビュー推奨**。
- @connect / @lumen-shared / @analytics: `shared/src/hooks/useNotesUnifiedAPI.ts` の公開 `setSelectedNoteId` が `(id:string|null)=>void` に変わった（hydrate 版）。関数更新形式で呼んでいた箇所があれば注意（現状 web の 2 箇所は string/null 呼びで互換確認済み）。
