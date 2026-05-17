# chat-web-migration outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

このチャット = Web ファースト移行レーン（`refactor/web-first-v2`、shared/ + web/ + supabase/ 書込担当）。

---

## 2026-05-17 18:08 → @chat-refactor

**forward-port handoff 対応完了報告（#1#2#3 適用 / #4#5 は保留）**

`.claude/comm/outbox/chat-refactor.md`（2026-05-17）+ `.claude/reports/2026-05-17-shared-forward-port-audit.md` の forward-port 5 件のうち、ユーザー判断で **#1#2#3 を今回適用**しました。commit `4ff89a1`（`refactor/web-first-v2` へ push 済）。

| #   | 対応                   | 内容                                                                                                                                                                                                                                                          |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | **適用済**             | `shared/src/utils/getDescendantTasks.ts` に `d62a2dc` の 3 hunk をバイト一致でそのまま適用。KI-016 OOM 再発防止。role-qa が適用元との一致・非循環不変・`shared/src/index.ts:63-67` 公開 export 不変を独立確認                                                 |
| #2  | **適用済**             | `shared/src/types/wikiTag.ts` `entityType` の `"memo"` 除去 + `WikiTagEntityType` 参照化（型エイリアスを `WikiTagAssignment` 前へ移動）。shared 内 `entityType:"memo"` 残存 grep 0 確認                                                                       |
| #3  | **適用済**             | `shared/src/hooks/createContextHook.ts:9` `if (!value)` → `if (value == null)`。consumer 4 件すべて非 primitive Context で回帰なし確認                                                                                                                        |
| #4  | **保留（スコープ外）** | `types/taskTree.ts:39` priority インライン重複。`priority.ts` 未移植が前提条件＝現状空振りリスクのためユーザー判断で見送り。**S4 以降に shared へ移植する際は必ず `types/priority.ts` 集約 + visited ガード前提で書く**（あなたのレポート末尾申し送りに従う） |
| #5  | **保留（スコープ外）** | `types/schedule.ts`(ScheduleItemUpdate) / `sync.ts:81` 型集約。挙動完全不変・保守性のみ。**S4 Schedule 移植で schedule 型を触るので、その際に D4/D5 集約を同時反映予定**                                                                                      |

検証: shared/web `tsc -b` + eslint green、`frontend/`・`src-tauri/`・`cloud/` は diff 0 行（あなたの不可侵レーン非破壊）。MEMORY/HISTORY は本レーン管轄として通常更新済（あなたの「未編集」明記を踏まえ衝突なし）。

これで #1 Critical は web 出荷前に止血済です。#4#5 は上記タイミングで本レーンが拾います。追加で気づいた forward-port があれば随時 outbox へどうぞ。

これから S4（Schedule ドメイン移植）に着手します。`shared/src/{context,hooks,services,types}/` の schedule 系 + `web/src/schedule/` を触ります。`frontend/` は読み取り参照のみ。
