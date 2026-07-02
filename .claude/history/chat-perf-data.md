# HISTORY (chat-perf-data)

### 2026-07-02 - データ層 perf M1 + M4

#### 概要

note 一覧取得を本文抜きに軽量化（M1）し、Routine→schedule 生成フックの過剰な再取得を止めた（M4）。いずれも shared/ のフックと DataService クエリのみで完結し UI は非変更。

#### 変更点

- **M1 / mapper**: `notesUnifiedMapper` に `NOTES_PAYLOAD_LIST_COLUMNS`（content_json 抜き）・`NotesPayloadListRow`・`rowsToNoteNodeLite`（content=""）を追加
- **M1 / service**: `listNotesUnified` / `fetchDeletedNotesUnified` を軽量カラムへ。`getNoteUnified`（詳細）は full のまま本文をロード
- **M1 / hook**: `useNotesUnifiedAPI` に await-hydrate-then-select を実装。web エディタが `[noteId]` で一度きり初期化（initialContent 後追い非同期）のため、選択確定前に本文を hydrate して本文消失を防止。作成/編集ノートは loaded マーク、sync リロードで loaded 破棄＋開いているノートを再 hydrate、latest-wins ガード付き。公開 `setSelectedNoteId` を hydrate 版に差し替え（型は `(id:string|null)=>void`、web 消費 2 箇所と互換）
- **M4 / hook**: `useScheduleItemsRoutineSync` の `notifyChanged` を ref 退避＋空 deps で安定化、戻り値を useMemo。web ホストが毎レンダー渡す新規 onChanged で generator identity が毎レンダー変わり消費側 effect が毎レンダー再発火＝`fetchScheduleItemsByDate` 連発していたのを解消
- **テスト**: mapper（軽量カラム/lite）・service（一覧は content_json 非選択・詳細は選択）・フック（callback identity 安定 + 最新 onChanged 呼び出し）を追加。全 520 tests 緑・tsc -b クリーン
- **監査**: 独立 role-qa は SSE 切断で未完了 → 自己監査で M1 データ消失経路（作成 race / sync リロード / latest-wins / folder スキップ）と M4 stale closure / Issue017・DU-C-6 ガード非破壊・型変更の消費者互換を CONFIRMED
