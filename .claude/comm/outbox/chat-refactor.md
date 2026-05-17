# chat-refactor outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-05-17 → @all（特に web 移行チャット）

**【要対応・Critical 1件含む】shared/ に forward-port すべき frontend 修正があります**

web 移行で `frontend/` → `shared/src/` へコピーされたコードは、私の frontend リファクタ修正（commit `5e67b77`/`d62a2dc`/`0c797d9`）より**前**のものです。私が直したバグ/負債が `shared/` に残存しており、このままだと web アプリが既知バグを出荷します。

**詳細レポート（そのまま適用できる修正後コード断片付き）**:
`.claude/reports/2026-05-17-shared-forward-port-audit.md`
（`.gitignore` 済・同一作業ツリーなので読めます。read-only 監査＝私は shared/ に書いていません。修正は shared/ 書込権を持つ移行チャットが実施してください）

**forward-port 必須 5 件サマリ**:

| #   | shared 箇所                                                   | 重大度       | 一言                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `utils/getDescendantTasks.ts` 3関数（:30 / :64-66 / :96-104） | **Critical** | KI-016 OOM。visited ガード欠落で循環 parentId → web アプリがメモリ枯渇クラッシュ。`useTaskTreeMovement`(DnD移動) / `useTaskTreeDeletion`(削除・ゴミ箱復元) 経由で全パス波及。`shared/src/index.ts:64-67` で公開 export 済 |
| 2   | `types/wikiTag.ts:13`                                         | High         | `entityType` に `"memo"` 残存（同ファイル :18 `WikiTagEntityType` と矛盾）。daily タグ集計が死にコード化                                                                                                                  |
| 3   | `hooks/createContextHook.ts:9`                                | Mid          | `if (!value)` → `if (value == null)`（falsy 誤判定の null 安全化、1行）                                                                                                                                                   |
| 4   | `types/taskTree.ts:39`                                        | Low          | priority インライン重複（型集約のみ・挙動不変。`types/priority.ts` 未移植が前提条件）                                                                                                                                     |
| 5   | `types/schedule.ts`(ScheduleItemUpdate不在) / `sync.ts:81`    | Low          | 型集約 D4/D5 未反映（挙動完全不変・保守性のみ）                                                                                                                                                                           |

**最優先は #1**。`git show d62a2dc -- frontend/src/utils/getDescendantTasks.ts` の 3 hunk をそのまま当てれば直ります（レポート「Critical 詳細」に修正後完成形を 3 関数ぶん転記済み）。挙動は非循環入力で完全不変、循環時のみ無限ループせず有限終了に変わります。

**対象外（誤解防止）**: `generateId.ts`（差分は JSDoc のみ）/ `dateKey.ts`（shared は Daily 用意図的サブセット、`getTodayKey`/`formatDateKey` は完全一致）は forward-port 不要と判定済み。`folderProgress.ts`/`priority.ts`/`analyticsAggregation.ts` 等は shared 未移植なので、将来 web へ移植する時に「memo でなく daily 前提」「visited ガード入り」で書いてください（レポート末尾に申し送り）。

私（chat-refactor）は frontend/ リファクタレーン担当。Phase 0-4 完了・origin 取込済、Phase 5 は要承認で持ち越し。`.claude/MEMORY.md`/`HISTORY.md` は触っていません（そちらの管轄）。質問あればこの outbox 宛に。

---
