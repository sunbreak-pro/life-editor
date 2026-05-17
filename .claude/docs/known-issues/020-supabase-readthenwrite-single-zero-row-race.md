# 020: Notes 保存で 406 "Cannot coerce the result to a single JSON object"

**Status**: Fixed
**Category**: Bug
**Severity**: Important
**Discovered**: 2026-05-17
**Resolved**: 2026-05-17

## Symptom

新規ノート作成直後（特に初期コンテンツ付き、または RichTextEditor を開いてすぐ閉じた／別ノートへ切替えた場合）に、コンソールへ次のエラーが出る:

```
Notes update failed: Cannot coerce the result to a single JSON object
```

HTTP は PostgREST の **406 Not Acceptable**。データは消えない（ローカル state は保持され、続く flush で保存される）が、エラーログが出てユーザー操作の一部が一時的に DB へ届かない。

## Root Cause

楽観 create と read-then-write LWW のレース。

1. `useNotesAPI.createNote`（`shared/src/hooks/useNotesAPI.ts:266-274`）は新ノードを **ローカル state へ即追加**し、`ds.createNote()` の DB INSERT は **fire-and-forget**（`.then().catch()` で待たない）。
2. INSERT 完了前に RichTextEditor が unmount → flush → `ds.updateNote(id, { content })` が走る。
3. `SupabaseDataService.ts` の notes `updateNote` は version を相対式（`version + 1`）で書けないため **read-then-write**。その version read が `.single()`:

   ```ts
   const { data: cur, error: readErr } = await this.client
     .from("notes")
     .select("version")
     .eq("id", id)
     .single(); // ← まだ存在しない行 → 0 rows
   ```

4. INSERT 未完了なので 0 行 → PostgREST が `.single()` で **406「Cannot coerce the result to a single JSON object」** を返し throw。

データ破壊はない（ローカル state が正、INSERT 完了後の次回 flush で保存される）。MEMORY の S3/S4 申し送り⑥「upsert read-then-write LWW（S8 で整理予定）」が、エディタの即 unmount フローで前倒しに顕在化したもの。

同型の `.single()` read-then-write が `SupabaseDataService.ts` に複数潜在（`upsertDaily` / `toggleBoolean` / `nextVersion` ヘルパ）。

## Impact

- **誰が**: Notes を使う本人（N=1 だが日常操作で踏みやすい）
- **何が**: 新規ノート作成直後の編集 1 回が DB へ届かずエラーログ。次の flush で救済されるので最終的なデータロスはないが、保存が 1 サイクル遅延し、エラーが UX を濁す
- **頻度**: 「ノート作成 → すぐ書いて閉じる／切替える」は高頻度操作。回線が遅いほど INSERT 未完了の窓が広がり再現率が上がる

## Fix / Workaround

**案 A-1（version read の 0 行耐性化）を実装**（コミット未実施 = 修正実装済・未 commit）。

- 変更: `shared/src/services/SupabaseDataService.ts` notes `updateNote` の version read を `.single()` → **`.maybeSingle()`**。行が `null`（INSERT 未着 / 不在）なら **throw せず DB write を skip し正常 return**（ローカル state は呼び出し側で既に正、INSERT 完了後の次回 flush で保存される）。`readErr`（権限 / ネットワーク等の本物のエラー）は従来どおり throw を維持し、**真エラーと 0 行を区別**。
- 0 行時の return は `Promise<NoteNode>` 契約を満たすため、patch + カラム明示デフォルトから `rowToNoteNode` 経由で**型嘘（`as`）なし**の well-formed node を合成（呼び出し側 `useNotesAPI.updateNote` は戻り値を消費せず `.catch()` のみなので副作用なし）。
- 横展開（同根スイープ）の判断:
  - `upsertDaily`（~L218-247）: **変更不要**。既に `.maybeSingle()` 使用済みで、0 行 → `existingRow=null` → `version=1` / `created_at=now` で upsert を**継続**（INSERT 経路として既に正しい）。`.single()` ではない。
  - `toggleBoolean`（~L282-307）/ `nextVersion` ヘルパ（~L684-692）: **現状維持（要追加調査）**。どちらも戻り値契約が「行が存在する」前提（`DailyNode` / `number` を返す）で、0 行時に返すべき妥当な値が無い。誤った no-op が UI に誤フィードバックを与える回帰リスクがあるため、誤修正で回帰させるより現状維持を優先。toggle / set/remove password は楽観 create 直後レースの直接の通り道ではない（明示的ユーザー操作で、エディタ unmount flush ではない）ため A-1 のスコープ外。

応急処置ではなく恒久対応（update-only 経路の 0 行耐性化）。ただし**根本策ではない**（下記）。

### 残課題（将来候補、今回スコープ外）

- **案 B（根本策・S8 LWW 整理タスク）**: `createNote` の INSERT 確定までを await/ガードし、確定前の `updateNote` を待たせる。read-then-write LWW 全体の整理（MEMORY S8 申し送り）と合わせて実施。
- **案 C（補強）**: `RichTextEditor` の flush を「内容差分ありの時のみ」発火させ、空 unmount での無駄 flush を抑止。
- `toggleBoolean` / `nextVersion` の 0 行セマンティクス確定（要追加調査）。

## References

- 関連ファイル:
  - `shared/src/services/SupabaseDataService.ts`（notes `updateNote` の version read、~L504）
  - `shared/src/hooks/useNotesAPI.ts:266-274`（楽観 createNote: ローカル即追加 + fire-and-forget INSERT）
  - `shared/src/services/noteMapper.ts`（`NoteRow` / `rowToNoteNode` の NOT-NULL 前提）
- 関連 HISTORY: 2026-05-17 セッション
- 関連知見: MEMORY S3/S4 申し送り⑥「upsert read-then-write LWW（S8）」

## Lessons Learned

- **read-then-write の「存在前提読み」は `.single()` を使わない**。`.single()` は 0 行で PostgREST 406（"Cannot coerce the result to a single JSON object"）を throw する。楽観 create（ローカル即追加 + fire-and-forget INSERT）と組み合わさると、INSERT 未着の行への update flush で必ず踏む。`.maybeSingle()` + 明示的な 0 行ハンドリングを必須にする。
- **0 行ハンドリングは経路のセマンティクスで分岐する**:
  - update-only 経路（行が存在する前提の更新）→ 0 行は skip / no-op。
  - **upsert 経路（行が無くてもよい＝本来 INSERT すべき。例 `upsertDaily`）→ 0 行で skip してはいけない。INSERT/upsert を継続**（version=1 起点）。ここを取り違えると Daily 等が保存されなくなる回帰を生む。
  - 戻り値契約が「行が存在する」前提のヘルパ（`nextVersion` 等）は、0 行時に返す妥当な値が無いなら誤修正で回帰させるより現状維持を選ぶ。
- 同型の `.single()` read-then-write を **新規追加するときも同じ判断**を要する。grep キーワード: `406` / `Cannot coerce` / `single` / `maybeSingle` / `read-then-write` / `optimistic create`。
- 真の read エラー（権限 / ネットワーク）と 0 行（レース）は別物。0 行を握りつぶしても **`readErr` の throw は維持**すること。
