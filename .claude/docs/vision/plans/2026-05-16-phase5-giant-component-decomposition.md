# Plan: Phase 5 — 巨大コンポーネント整理（次回チャット持ち越し / 要承認）

- **Status**: Carry-over（未着手・次セッションで実施）
- **Created**: 2026-05-16
- **親プラン**: [`2026-05-16-frontend-refactor-pre-migration.md`](./2026-05-16-frontend-refactor-pre-migration.md)（Phase 0-4 完了済の続き）
- **Project path**: /Users/newlife/dev/apps/life-editor
- **Branch**: refactor/web-first-v2（並行チャットが migration Phase 2 を同時進行中）

---

## Context（次回チャットはここだけ読めば着手可）

### 経緯

6 並列エージェント監査で `frontend/src/` の脆弱性を洗い出し、Phase 0-4 を完了・コミット済み（安全網テスト確立 → デッドコード削除 → 重複統合 → 型単一ソース化 → Optional バリアント規約準拠）。本 Phase 5 は最後に残った「巨大・複雑で壊れやすいコンポーネント」の整理。親プランから分離し持ち越し。

### 完了済みの前提（流用可能な資産）

- **安全網**: `cd frontend && npm run test` = **527 pass / 0 skip / 0 fail** が baseline。Phase 5 の各変更後にこれを維持＝回帰検知の網。特に `dateKey`/`timeGridUtils`/`getDescendantTasks`/`buildCompletedTree`/`folderProgress`/`useScheduleItemsCore` は characterization 済。
- 重複ロジックは既存ヘルパに集約済（`timeGridUtils.formatTime`/`generateTaskId`/`generateId`/`getTodayKey`）。Phase 5 でも新規ヘルパを作らず既存へ寄せる。

### 制約（親プランから継承・厳守）

- **テスト追加が唯一許可された新規要素**。それ以外は「削除 / 統合 / 既存への抽出」= 行数が減る方向のみ。
- **5-1 共有 ModalShell 新設は本制約のグレーゾーン**（1ファイル増 vs 28箇所手書き削除＝正味大幅減だが「新抽象レイヤー追加」の側面あり）。**着手前にユーザー個別承認を必須ゲートとする**（承認なく実装に入らない）。
- `src-tauri/` `cloud/` `mcp-server/` は移行で削除予定＝対象外。`Terminal/*`（PTY 依存）は移行で再設計＝対象外・優先度最低。
- `getDataService()` 直呼びは移行で DataService 抽象に吸収される。Phase 5 では「コールバック注入」方向のみ可、再実装しない。

### Non-goals

- 新ライブラリ・新デザインシステム・新機能の追加。
- 責務分割による新ファイル純増（純粋関数の既存ファイルへの切り出し・既存フックへの集約のみ。5-1 のみ承認制で例外）。
- 凍結機能（`PaperCanvasView.tsx` C12 等 Tier 3）の改修。

### 並行チャット競合の注意

migration Phase 2 が `shared/`・`supabase/`・`.claude/`（本計画書除く）を同時変更中。Phase 5 着手時は (1) `git status` で並行チャットの作業範囲を確認 (2) コミットは必ずパス指定（`git add -A` 禁止、`git commit -- <pathspec>`）(3) 着手前に最新 `git log` で migration がどのドメインまで進んだか確認し、Phase 5 対象コンポーネントと衝突しないか点検。

---

## Steps

> 推奨着手順: 5-2 → 5-5 → 5-4 → 5-3 →（承認後）5-1。費用対効果と独立性で並べた。各ステップ独立検証可能・1セッションで実行可能。

- [ ] **5-2. `shared/RichTextEditor.tsx`(607行) のイベント購読集約** — 11 個の `useEffect`（addEventListener/cleanup 散在＝依存漏れ・cleanup 漏れの温床）を `useEditorDomEvents` カスタムフックに集約。共有部品で全エディタ画面に波及するため bug 密度高・効果大。フックは同ディレクトリ内の純粋抽出（新抽象でなく既存責務の移設）。安全網: RichTextEditor の既存テスト＋必要なら DOM イベント発火の回帰テスト追加。
- [ ] **5-5. `ScheduleTimeGrid.tsx`(943行) の状態統合** — contextMenu/preview の 4 `useState` を discriminated union 1 state へ統合（不整合状態を型で排除）。レイアウト計算を**既存** `scheduleTimeGridLayout.ts` へ寄せ切る（新規ファイルなし）。ドラッグ操作の壊れやすさ軽減。安全網: `timeGridUtils`/`scheduleTimeGridLayout` の characterization 済テスト。
- [ ] **5-4. `OneDaySchedule.tsx`(1194行 / props 23) のオーケストレータ整理** — ダイアログ群を**既存** `useDayFlowDialogs` へ完全集約、フィルタ表示を既存 `useDayFlowFilters` へ。`getDataService()` 直呼びはコールバック注入化（移行整合）。**行数純増させない**（既存フックへ移すだけ）。日常変更頻度が高く回収が早い。
- [ ] **5-3. Calendar 計算ロジックの Desktop/Mobile 一本化** — `CalendarView.tsx`(1163行) と `MobileCalendarView.tsx`(791行) の日付/週計算（二重実装＝ドリフトバグ源）を純粋関数 `calendarViewModel.ts`（`Tasks/Schedule/shared/` か `utils/`、CLAUDE.md §6.4 配置規約に従う）に一本化。これは「2実装→1関数」の集約＝行数減方向。純粋関数なのでテストを厚く（許可された追加）。**配置先1ファイルは集約のため許容（純増でなく重複統合）**。
- [ ] **5-1.（要ユーザー承認・承認まで着手禁止）共有 `ModalShell` 集約** — `shared/` に backdrop + Escape + `role="dialog"` + focus trap を持つ `ModalShell` を1つ作り、**28 ファイルの手書き `fixed inset-0` backdrop / 53 箇所の Escape キー個別実装**を置換。a11y ほぼ全滅（`role="dialog"` 全体2箇所のみ）・透明落ち・cleanup 漏れを一掃。正味行数は大幅減だが「新抽象1ファイル追加」のトレードオフがあるため**承認ゲート**。承認時は `frontend-react-designer` スキルで a11y/モーション設計を確認。段階置換（一度に28箇所やらず数件ずつ + 各回 build/test green）。

---

## Files

| File                                                                                     | Operation                    | Step        | Notes                                                |
| ---------------------------------------------------------------------------------------- | ---------------------------- | ----------- | ---------------------------------------------------- |
| `frontend/src/components/shared/RichTextEditor.tsx`                                      | Edit（集約）                 | 5-2         | 11 useEffect を抽出フックへ                          |
| `frontend/src/hooks/useEditorDomEvents.ts`（or RichTextEditor 同階層）                   | Create（責務移設・純増せず） | 5-2         | 既存 effect の移設先。新抽象でなく分離               |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleTimeGrid.tsx`                    | Edit                         | 5-5         | 4 useState → 1 union、計算を既存 layout util へ      |
| `frontend/src/components/Tasks/Schedule/DayFlow/OneDaySchedule.tsx`                      | Edit（縮小）                 | 5-4         | ダイアログ/データ取得を既存フックへ集約              |
| `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`                       | Edit                         | 5-3         | 計算を calendarViewModel へ委譲                      |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`                                  | Edit                         | 5-3         | 同上（二重実装解消）                                 |
| `frontend/src/components/Tasks/Schedule/shared/calendarViewModel.ts`（配置は §6.4 確認） | Create（2実装→1集約）        | 5-3         | 重複統合のため許容                                   |
| `frontend/src/components/shared/ModalShell.tsx`                                          | Create（**要承認**）         | 5-1         | backdrop+Escape+role=dialog+focus trap               |
| 手書き backdrop 28 ファイル / Escape 53 箇所                                             | Edit（置換・大幅減）         | 5-1         | 段階置換。対象は監査の C5/C11/C14 等 + grep で全特定 |
| 各 step の `*.test.ts(x)`                                                                | Add（テストのみ許可）        | 5-2/5-3/5-5 | 抽出純粋関数の回帰テスト                             |

---

## Verification

- [ ] 各 step 後: `cd frontend && npm run test` で **527 pass 維持**（+ 追加テスト分）、`npm run build`（`tsc -b` 相当、`--noEmit` 不可）型エラー0
- [ ] 5-2: RichTextEditor のイベント（beforeunload/draghandle 等）が抽出後も発火・cleanup されること。エディタ手動確認 or DOM イベント回帰テスト
- [ ] 5-3: `CalendarView` と `MobileCalendarView` が同一 `calendarViewModel` を参照し、日付/週計算の出力が両者で一致（ドリフト消滅）。純粋関数テスト green
- [ ] 5-4: `OneDaySchedule` の props 数・行数が**減少**（`git diff --stat` で純減）。挙動不変
- [ ] 5-5: contextMenu/preview の不正状態組合せが型で表現不能になっていること。ドラッグ/リサイズ手動確認
- [ ] 5-1（承認後）: 置換した全ファイルで `role="dialog"` 付与・手書き `fixed inset-0` backdrop がゼロ・Escape 重複実装が `ModalShell` 1箇所に集約。`git diff --stat` で正味行数大幅減。段階置換の各回で build/test green
- [ ] 全体: `git diff --stat` 正味行数減少（テスト追加分除く）= 制約「コンパクト化」の客観信号
- [ ] orchestration: 各 step は role-engineer 実装 → 別コンテキスト role-qa 監査。コミットはパス指定（並行チャット分を巻き込まない）

---

## 次回チャットでの開始手順（推奨）

1. 本ファイルと親プラン `2026-05-16-frontend-refactor-pre-migration.md` を読む
2. `git log --oneline -10` で migration の進捗確認（Phase 5 対象と衝突しないか）
3. `cd frontend && npm run test` で安全網 baseline（527 pass）を再確認
4. 5-2 から着手（5-1 はユーザー承認を取ってから）
5. 各 step: role-engineer → session-verifier → 別コンテキスト role-qa → パス指定コミット
