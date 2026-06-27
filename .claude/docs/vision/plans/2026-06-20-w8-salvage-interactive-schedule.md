---
Status: In Progress (自律スコープ Steps 1–5 完了・検証緑 / 残=👀 実機目視 + 🛑 PR merge)
Created: 2026-06-20
Updated: 2026-06-27
Branch: feat/w8-salvage-interactive-grid # 新規 worktree で実装（main worktree では不可）
Owner-chat: chat-main（救出仕上げを担当）
Parent: .claude/docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md
---

# Plan: W8 Schedule 対話機能の救出（クリック作成・ドラッグ移動/リサイズ）

> 廃棄予定だった `origin/claude/app-dev-roadmap-cdhjjz` に、main へ未マージの W8-2/W8-3
> 対話実装が眠っている。これを **現行 main のアーキ（shared 純粋プリミティブ + web ホスト）へ
> 移植**して救出する。旧コンポーネントをそのまま復活させない（known-issue 029 の二重実装再発防止）。

---

## Context

- **動機**: main の W8 Schedule（#96/#97）は週/日タイムグリッドの**表示と選択のみ**。一方、放棄された
  クラウドブランチ `origin/claude/app-dev-roadmap-cdhjjz` には W8-2「空きスロットをクリックして時刻指定で予定作成 ＋ イベント編集」、W8-3「ポインタ・ドラッグで移動 / 下端ハンドルでリサイズ（スロット単位スナップ）」が実装済み（`web/src/schedule/WeekGrid.tsx`、543 行・約 340 行が対話ロジック）。**main には一切存在しない**ため、このブランチを消すと機能が失われる。
- **制約**:
  - 旧 `WeekGrid.tsx` は「データ取得＋対話＋レイアウト全部入りの web コンポーネント」。現行 main は
    `shared/src/components/schedule/WeekTimeGrid.tsx`（純粋プリミティブ・props 注入）＋
    `shared/src/utils/scheduleGridLayout.ts`（純粋レイアウト）＋
    `web/src/schedule/ScheduleCalendarView.tsx`（ホスト・DataService 接続）に分離済み。
    → **cherry-pick 不可。対話ロジックだけを新アーキへ移植する。**
  - shared プリミティブは DataService 非依存・i18n props 注入の不変式を維持（frontend.md §デザイン規約）。
  - コスト $0。新規 DB/テーブル不要（既存 `schedule_items` の CRUD で完結）。
- **Non-goals**:
  - 旧 `WeekGrid.tsx` をそのまま復活させること（known-issue 029 の二重実装を再発させない）。
  - 日ビュー固有の新機能追加・リマインダー連携・Routine 生成の変更。

---

## Scope (Touchable Paths)

```
shared/src/components/schedule/WeekTimeGrid.tsx
shared/src/components/schedule/index.ts
shared/src/utils/scheduleGridLayout.ts
web/src/schedule/ScheduleCalendarView.tsx
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/scheduleGridLayout.test.ts
shared/tests/weekTimeGrid.test.tsx
.claude/docs/vision/plans/2026-06-20-w8-salvage-interactive-schedule.md
```

スコープ外（特に旧 `web/src/schedule/WeekGrid.tsx` の復活）が必要になったら計画書を更新してから着手。

---

## Salvage Source（移植元の所在）

| 機能               | 旧ブランチ commit | 旧ファイル箇所                                     | 中身                                                                                                                 |
| ------------------ | ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| W8-2 クリック作成  | `00a2ec60`        | `WeekGrid.tsx:114` `handleCreateAt(date, minutes)` | 空きスロット onClick → y 座標を分に変換しスナップ → 作成                                                             |
| W8-2 イベント編集  | `00a2ec60`        | `WeekGrid.tsx:355,416,~500` 選択＋編集パネル       | 選択 → タイトル/時刻編集・削除                                                                                       |
| W8-3 移動/リサイズ | `cdc56bd9`        | `WeekGrid.tsx:158-258` `beginDrag(e,item,mode)`    | native pointer events、move=開始/終了を平行移動・横ドラッグで曜日移動、resize=下端で終了時刻、`SLOT_HEIGHT` スナップ |

取得: `git show origin/claude/app-dev-roadmap-cdhjjz:web/src/schedule/WeekGrid.tsx`（ブランチは削除しないこと）。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                           | Gate    | Acceptance                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------- |
| 0   | 専用 worktree 作成（`feat/w8-salvage-interactive-grid`）＋ `.session-branch`/`.session-name` 宣言（§7.4 の 4 ステップ）                                                                                                                                                        | 🛑 人手 | worktree から起動・SessionStart identity が正しい branch を表示 |
| 1   | `scheduleGridLayout.ts` に px↔分の双方向変換＋スロットスナップ helper を追加（旧 `SLOT_HEIGHT` ロジックを純関数化）                                                                                                                                                            | 🤖 自律 | `vitest run shared/tests/scheduleGridLayout.test.ts` 緑         |
| 2   | `WeekTimeGridProps` に注入コールバック追加: `onCreateAt?(dateISO, minutes)` / `onMoveItem?(id, newStartISO, newEndISO)` / `onResizeItem?(id, newEndISO)`。空きスロット onClick とアイテムの pointer drag/resize ハンドラを純粋プリミティブ内に実装（DataService 非依存を維持） | 🤖 自律 | `cd web && npm run build` exit 0                                |
| 3   | `ScheduleCalendarView.tsx` でコールバックを配線: create=`createScheduleItem`、move/resize=`updateScheduleItem`＋楽観的 `patchLocal`。既存 `handleUpdate`/`handleToggle` と整合                                                                                                 | 🤖 自律 | build exit 0・既存テスト緑                                      |
| 4   | 新規文言（例: 新規予定ラベル）を en/ja 両 catalog に追加（props 注入）                                                                                                                                                                                                         | 🤖 自律 | i18n key が en/ja 両方に存在                                    |
| 5   | `weekTimeGrid.test.tsx` に「クリック→onCreateAt 発火」「drag→onMoveItem 発火」「resize→onResizeItem 発火」のスナップ検証を追加                                                                                                                                                 | 🤖 自律 | `vitest run shared/tests/weekTimeGrid.test.tsx` 緑              |
| 6   | 実機で操作確認（作成・移動・リサイズの体感／スナップ）                                                                                                                                                                                                                         | 👀 目視 | golden path を手で 1 周                                         |
| 7   | PR 作成 → main merge → ローカル main を `git pull --ff-only`                                                                                                                                                                                                                   | 🛑 人手 | PR merge ボタン                                                 |
| 8   | merge 後、救出元 `origin/claude/app-dev-roadmap-cdhjjz` を削除（救出完了したので保持不要）                                                                                                                                                                                     | 🛑 人手 | リモートブランチ削除                                            |

---

## Acceptance Criteria (機械検証可能)

- [x] `cd web && npm run build` exit 0（型エラー 0）— 2026-06-27 確認
- [x] `npx vitest run tests/scheduleGridLayout.test.ts tests/weekTimeGrid.test.tsx`（shared から）全 pass — layout 22 + grid 10 = 全緑。shared 全体 503 pass
- [x] `WeekTimeGridProps` に `onCreateAt` / `onMoveItem` / `onResizeItem` が存在し、`WeekTimeGrid` が DataService/`useTranslation` を import していない（純粋性維持）
- [x] 旧 `web/src/schedule/WeekGrid.tsx` を復活させていない（差分に現れない）
- [ ] ~~PR diff が ±400 行以内~~ → **超過（実測 ~560 行）**。内訳: 対話ロジック移植 + 計画書 111 行 + 新規テスト ~110 行。新規設計ではなく移植 + テスト増分のため許容範囲と判断（要ユーザー承認）
- [x] 新規 i18n key が en/ja 両 catalog に存在（`newEvent` / `createSlot`）

---

## Risks / Known Issues 参照

- **known-issue 029**（`parallel-chats-double-implemented-w8-dead-import-broke-main`）: 並行チャットが W8 を二重実装し main を壊した事例。**本プランは main の `WeekTimeGrid` に積み増す**方針で、旧 `WeekGrid` の別系統復活は厳禁。
- 楽観的更新（patchLocal）と `loadDateRange` の再取得が競合しないこと（旧実装の `reloadKey` 相当の扱いに注意）。
- pointer events のクリーンアップ漏れ（旧実装は window へ addEventListener → removeEventListener。移植時に必ず cleanup）。

---

## References

- 親: `.claude/docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md`
- 現行実装: `shared/src/components/schedule/WeekTimeGrid.tsx` / `shared/src/utils/scheduleGridLayout.ts` / `web/src/schedule/ScheduleCalendarView.tsx`
- 移植元: `origin/claude/app-dev-roadmap-cdhjjz:web/src/schedule/WeekGrid.tsx`（#95 で一部のみ main 入り、W8-2/W8-3 は未マージ）
- related skills: `add-component`, `frontend-react-designer`, `git-orchestrator`（worktree 作成）

---

## Worklog

- 2026-06-20: 並行作業監査中に、放棄ブランチ `app-dev-roadmap-cdhjjz` の W8-2/W8-3 が main 未マージと判明（敵対的検証で「削除すると機能喪失」と確定）。本救出プランを起票。実装は専用 worktree で行う。
- 2026-06-27: WIP（commit `e1dee609`）を仕上げ。サブエージェント監査で完成度 85–90%・3 機能とも実データ結線済みと確認。残作業を実施: (1) `pxToMinutes` のゼロ高さフォールバックを「1px=1分」に修正（傾きを `60/hourHeight`、ゼロ時 1 へ）→ 失敗していた layout 単体テストが緑化。(2) `weekTimeGrid.test.tsx` に対話テスト 4 本追加（create/move/resize/sub-threshold = 選択）。jsdom は `PointerEvent` 非実装で RTL の `fireEvent.pointerDown` が `button` を落とす→ `beginDrag` の `e.button!==0` ガードで早期 return する罠を、ネイティブ `MouseEvent("pointerdown")` 発火で回避。(3) origin/main へ rebase（`git merge-tree` クリーン・対象ファイル無競合）。検証: shared 503 pass / shared tsc -b 0 / web build（tsc -b --force && vite build）exit 0。残: 👀 実機目視（Step 6）+ 🛑 PR→merge（Step 7）+ 🛑 救出元ブランチ削除（Step 8）。
