# 016: タスクツリー走査が循環 parentId で無限ループ → V8 OOM クラッシュ

**Status**: Fixed
**Category**: Bug / Structural
**Severity**: Blocking（発生時はワーカー / アプリがクラッシュ）
**Discovered**: 2026-05-16
**Resolved**: 2026-05-16

## Symptom

`parentId` が循環（`parentId === id` の自己参照、または `a → b → a` の相互参照）したタスクツリーを以下のいずれかの関数に渡すと、関数が永久に返らず JS ヒープを食い尽くして V8 が fatal クラッシュする（`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`）。Phase 0 の characterization テストで `it.skip` として再現を確認済み（実行するとスイートワーカーが OOM するため skip で記録）。

ユーザー視点では「DnD でフォルダを自分自身（またはその子孫）に移動した直後にアプリ全体がフリーズ → クラッシュ」という形で顕在化しうる。

## Root Cause

走査スタック（または再帰）に push する**前に** visited チェックをしていないのが共通の根本原因。循環があると同じノードを無限に push し続ける。

- `frontend/src/utils/getDescendantTasks.ts`
  - `getDescendantTasks`（L23-33、`stack.push(child.id)` は L31）: visited Set なし。`while` ループで子フォルダ id を無条件 push。
  - `collectDescendantIds`（L57-69、`stack.push(childId)` は L66）: `ids` Set は持つが **push 前に `ids.has(childId)` を確認していない**ため、循環で無限 push。
  - `isDescendantOf`（L96-106、`stack.push(id)` は L103）: visited Set なし。子 id を無条件 push（探索対象 id が見つからない循環サブツリーで無限ループ）。
- `frontend/src/utils/folderProgress.ts`
  - `computeFolderProgress` 内の `countDescendantTasks`（L15-25、自己再帰呼び出しは L23 `countDescendantTasks(n.id)`）: visited なしの再帰。フォルダ循環で無限再帰。**上記 3 関数と同一 root cause。**

### 皮肉な構造

`isDescendantOf` は本来「DnD でフォルダを自分の子孫へ移動させない」ための**循環移動ガード**として呼ばれる関数である。その循環ガード自身が循環入力でクラッシュするという自己矛盾構造になっている（ガードが守るべき状況でガードが落ちる）。

## Impact

- 影響を受けるのは Tasks（TaskTree）の DnD・フォルダ進捗表示・循環移動ガード経路。
- 一度循環が DB に入ると、その後の通常操作（フォルダ展開・進捗計算・移動可否判定）でアプリが再現性高くクラッシュし、復旧が困難（クラッシュするため UI 上で循環を解消できない悪循環）。
- 通常運用では UI 操作で循環は作りにくいが、Sync 競合・データ不整合・将来の Supabase 移行時のデータ移送ミスで混入する可能性があり、混入時の被害は Blocking。

## Fix / Workaround

- **修正済み（Fixed, 2026-05-16）**: 本リファクタ計画 [`.claude/archive/2026-05-16-frontend-refactor-pre-migration.md`](../../archive/2026-05-16-frontend-refactor-pre-migration.md) Phase 2-6 にて、4 関数すべてに visited Set ガードを最小追加。`frontend/src/utils/buildCompletedTree.ts` の既存 cycle-safe 実装をモデルとした。
  - `getDescendantTasks`: 新規 `visited` Set。子フォルダ id を `stack.push` する直前に `visited.has` チェック。
  - `collectDescendantIds`: 既存 `ids` Set を visited ガードとして流用。`stack.push(childId)` 前に `if (ids.has(childId)) continue`。
  - `isDescendantOf`: 新規 `visited` Set。target 一致判定（`id === childId`）は guard より**前**に置き、2 ノード循環で直接到達可能な子は即 `true` を返す既存挙動を保持。
  - `computeFolderProgress` 内 `countDescendantTasks`: 新規 `visited` Set。再帰呼び出し前に `!visited.has(n.id)` チェック。
- **挙動保証**: 非循環入力では visited は各ノードを 1 回だけ訪問する単調増加のため結果は従来と完全に同一（visited ガードは循環時のみ作用）。循環入力時は無限ループ／OOM せず「それまでに収集した分を返して有限終了」。
- **回帰テスト化完了**: Phase 0 / 0+4 で記録した `it.skip` 計 6 件を `it` に戻し、循環入力でクラッシュせず有限結果（`getDescendantTasks("loop")` → `["loop"]` / `collectDescendantIds` 自己参照 → `["self"]` / a→b→a → `["a","b"]` / `isDescendantOf` absent → `false` / `computeFolderProgress` 循環 → `{0,0}`）を assert する回帰テストに書き換え。全 32 テスト pass（getDescendantTasks 21 / folderProgress 11）、循環ケースは約 5ms で終了。

## References

- 関連ファイル:
  - `frontend/src/utils/getDescendantTasks.ts:23` / `:57` / `:96`（3 関数の走査ループ）
  - `frontend/src/utils/folderProgress.ts:15`（`countDescendantTasks` 再帰）
  - `frontend/src/utils/buildCompletedTree.ts`（cycle-safe な参照実装）
- 関連テスト: `frontend/src/utils/getDescendantTasks.test.ts` / `frontend/src/utils/folderProgress.test.ts`（`it.skip` で再現記録）
- 関連 plan: `.claude/archive/2026-05-16-frontend-refactor-pre-migration.md`（Phase 0+ / Phase 2-6）

## Lessons Learned

- グラフ / ツリー走査ユーティリティを書くときは、**`stack.push` / 再帰呼び出しの直前に visited チェック**を入れる（push 後・処理時のチェックでは無限 push を止められない）。`collectDescendantIds` のように accumulator Set があっても、push ガードに使っていなければ無意味。
- 「循環を防ぐためのガード関数」自体が循環入力で安全でなければ意味がない（`isDescendantOf` の自己矛盾）。ガード系関数は最初に堅牢化する。
- `buildCompletedTree.ts` は同種走査を visited Set で安全に処理できているので、新規 / 既存の traversal はこれをモデルにする。
- visited ガード追加時は「ガードが循環時のみ作用し、非循環パスに副作用ゼロ」であることを設計時に証明しておく（本件では accumulator Set を流用した `collectDescendantIds` も `add` が冪等なため結果不変、`isDescendantOf` は target 一致判定を guard より前に置くことで 2 ノード循環の即時 `true` を保持）。characterization テスト（Phase 0）を先に整備していたため、修復が非循環挙動を壊していないことを 521 pass の維持で機械的に確認できた = テストファースト安全網の有効事例。
- 検索キーワード: cycle, circular parentId, infinite loop, OOM, heap out of memory, visited set, getDescendantTasks, collectDescendantIds, isDescendantOf, computeFolderProgress, countDescendantTasks, DnD circular move guard.
