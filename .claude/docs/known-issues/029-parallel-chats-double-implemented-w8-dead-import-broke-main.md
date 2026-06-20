# 029: 並行チャットが同一機能(W8 Schedule 週グリッド)を二重実装 → merge で dead import が main を破壊

**Status**: Fixed
**Category**: Structural / Tooling
**Severity**: Blocking
**Discovered**: 2026-06-20
**Resolved**: 2026-06-20

## Symptom

origin/main の web ビルドが失敗:

```
src/MainScreen.tsx(50,1): error TS6133: 'WeekGrid' is declared but its value is never read.
```

さらにユーザーから「5173 と 5174 で画面が違う / 両方 merge したのに反映が食い違う」という混乱報告。Schedule セクションに週グリッド実装が 2 系統（`WeekGrid` と `ScheduleCalendarView`）共存していた。

## Root Cause

**同一機能の二重実装が、互いを知らない 2 つの並行チャットから別々に main へ merge された。**

タイムライン:

1. main = `bda164ec`（#94 W8 plan のみ）。この時点で両チャットが同じ base から W8 着手。
2. 別チャットが **#95 `c9c93690`「W8-1 Schedule 週グリッド」** を先に merge — `web/src/schedule/WeekGrid.tsx` + `shared/src/utils/weekGridLayout.ts` を新設し `MainScreen` に `<WeekGrid />` を配線。
3. main チャットが **#96 `228ddd8b`「Schedule カレンダー 週/日タイムグリッド」** を後で merge — `ScheduleCalendarView.tsx` + `WeekTimeGrid.tsx` + `scheduleGridLayout.ts` を新設し `MainScreen` に `<ScheduleCalendarView />` を配線。#96 は `bda164ec` ベース（#95 を含まない）で作られた。
4. GitHub の 3-way merge が `MainScreen.tsx` の schedule セクションを #96 側で解決 → **#95 の `<WeekGrid />` JSX 配線は消え、`import { WeekGrid }` 行だけが残った**。
5. `web/tsconfig.app.json` の `noUnusedLocals: true` が未使用 import を `TS6133` で弾く → **main の web ビルドが恒常的に破綻**。

根因は技術ではなく**並行作業の境界調整不足**: 着手時点の origin/main に #95 がまだ無く、`.claude/comm/` でも #95 の進行を捕捉できないまま、同じ「W8 Schedule 週グリッド」を二重に作った。

## Impact

- **main が壊れる**: web ビルドが通らず、CI が無いため誰かが手元でビルドするまで気づけない。`desktop`/`mobile` 包装も web ビルド前提なので連鎖的に止まる。
- **重複コードの保守コスト**: 同じ機能の 2 実装が共存し、どちらが正か不明。
- **混乱**: ローカルツリーが pull 遅れ + 未コミット作業を抱えると「どの画面が最新か」が判別不能になる（5173=main 2-behind+未コミット / 5174=feature branch の食い違い）。

## Fix / Workaround

- **恒久対応**（branch `fix/w8-schedule-dedup` / PR #\_\_）: 機能が広い #96(`ScheduleCalendarView`/`WeekTimeGrid`/`scheduleGridLayout`・編集+日ビュー+i18n)を Schedule の正とし、#95 の dead な一式を撤去:
  - 削除: `web/src/schedule/WeekGrid.tsx` / `shared/src/utils/weekGridLayout.ts` / `shared/tests/weekGridLayout.test.ts`
  - `web/src/MainScreen.tsx` の `import { WeekGrid }` 撤去
  - `shared/src/index.ts` の `weekGridLayout` export ブロック撤去（`timeToMinutes`/`layoutDayEvents`/`addDays`/`startOfWeek`/`weekDates`/`todayLocal`/型2 — 全て WeekGrid.tsx のみが使用、撤去安全を grep 実証）
- #95 同梱の **Desktop 常駐(STEP1)** は別機能のため温存。
- 検証: shared build 0 / shared test 463 passed / web build 0(TS6133 解消) / web eslint 0err / frontend build 0。

## References

- 関連コミット: `c9c93690`(#95) / `228ddd8b`(#96) / 修復 `fix/w8-schedule-dedup`
- 関連ファイル: `web/src/MainScreen.tsx:50`(dead import) / `web/tsconfig.app.json`(noUnusedLocals)
- 関連 plan: `.claude/docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md` / `2026-06-07-web-desktop-parity-roadmap.md`
- 関連 memory: `feedback_subagent_orchestration` / 親 SSOT の「並行チャット境界」節

## Lessons Learned

- **着手直前に「同名機能の進行中 PR / ブランチ」を必ず確認**する。`gh pr list --state all --search "<feature>"` + `git branch -a` + `.claude/comm/` outbox を見てから子計画の Owner を確定する。origin/main が自分の base のとき、**他チャットが同じ子計画(W番号)を走らせていないか**をロードマップの Owner-chat 欄と突き合わせる（W8 は子計画書の Owner が `web-w6-master-detail` だった＝自分以外が走っている兆候だった）。
- **`noUnusedLocals: true` 環境では、3-way merge が import だけ残すと即ビルド破綻**する。複数 PR が同じ host ファイル(MainScreen 等)の同じ領域を触る場合、merge 後に必ず `cd web && npm run build` を回す。
- **CI（最低限 `tsc -b`）が無いと壊れた main が放置される**。GitHub Actions で web/shared/frontend の build gate を入れる価値が高い（再発の最有力対策）。
- 検索キーワード: 二重実装 / double implementation / dead import / TS6133 / noUnusedLocals / WeekGrid / ScheduleCalendarView / 並行チャット 衝突 / parallel chat collision / merge dropped JSX
