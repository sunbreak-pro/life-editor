---
Status: IN PROGRESS
Created: 2026-07-28
Branch: claude/refactor-01-tasks-service # PR ごとに claude/refactor-<連番>-<短slug> を origin/main から切り直す
Owner-chat: refactor-core
---

# Plan: SupabaseDataService 分割 + web 画面 hooks 切り出し（挙動変更ゼロ）

> リファクタリング専任レーン。**挙動変更ゼロの構造改善のみ**。機能追加・UI 変更・DDL・依存追加は禁止。
> PR merge はすべてユーザーゲート（1 PR = 1 ステップの小さい単位）。

---

## Context

- **動機**: `shared/src/services/SupabaseDataService.ts` が約 2400 行の神ファイル化しており、1 ドメインの修正で全ドメインの diff コンテキストを引きずる。既に Notes / Dailies / WikiTags / Timer / Audio は `Supabase*Service` として別ファイル化済みで、残りのドメインだけが本体に同居している。web 画面側も Briefing / Notes / MainScreen が編集ステートと保存ロジックを画面コンポーネントに抱え込んでいる
- **制約**: DataService インターフェース（`shared/src/services/DataService.ts`）と `getDataService()` 境界は不変。フロント側の呼び出しコードは無改変が原則。mapper は既にドメイン別に分割済みのため移動せず import 付け替えのみ。DDL ゼロ・依存追加ゼロ
- **Non-goals**: 機能追加 / UI 変更 / 文言変更 / テスト期待値の書き換え / `web/src/schedule/CalendarTab.tsx`（schedule-refine レーンが Epic #290 で触る予定 — 衝突回避のため対象外）

---

## Scope (Touchable Paths)

```
shared/src/services/**
web/src/**            （CalendarTab.tsx を除く）
.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md
```

DDL ゼロ（`cloud/` 配下に触らない）。スコープ外の変更が必要になった場合は本計画書を更新してから手を付ける。

---

## 全体設計

### Phase A — SupabaseDataService.ts の分割（1 ドメイン = 1 PR）

2026-07-29 時点の同居ドメイン（一覧・行数はコードが正。以下は着手時 snapshot）:

| ドメイン            | 現クラス（ファイル内）                                                            | 切り出し先                        |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| 共有ヘルパ          | `pgrstQuoteValue` / `getAuthedUserId`                                             | `supabaseServiceHelpers.ts`       |
| task 系             | `SupabaseTasksService`                                                            | `SupabaseTasksService.ts`         |
| routine 系          | `SupabaseRoutinesService`                                                         | `SupabaseRoutinesService.ts`      |
| event・schedule 系  | `SupabaseScheduleItemsService`                                                    | `SupabaseScheduleItemsService.ts` |
| calendar 系         | `SupabaseCalendarsService`                                                        | `SupabaseCalendarsService.ts`     |
| link・connection 系 | `SupabaseNoteLinkService` + `SupabaseNoteConnectionService`（DU-C/D 待ちの stub） | `SupabaseNoteLinksService.ts`     |

切り出しの型は既存の分割済みサービス（`SupabaseTimerService.ts` 等）を踏襲する:

- 1 ファイル = `export class Supabase<Domain>Service` + `export const PHASE2_<DOMAIN>_METHODS`（メソッド名 Set）
- コード本体は**移動のみ**（コメント含め verbatim）。変更は import 文と export 修飾子だけ
- `SupabaseDataService.ts` 側は import + route() 登録に置き換える

### 互換 export の維持（テスト・facade 消費側を無改変にするため）

`SupabaseDataService.ts` からの既存 export はすべて維持する（re-export に変える）:

- `pgrstQuoteValue`（`shared/tests/pgrstQuoteValue.test.ts` が参照）
- `SupabaseRoutinesService` / `SupabaseScheduleItemsService`（`shared/tests/convertEventToRoutine.test.ts` / `detachRoutine.test.ts` / `updateFutureScheduleItemsByRoutine.test.ts` が参照）
- 末尾の mapper 再 export 群（taskMapper / routineMapper / scheduleItemMapper / calendarMapper）

### facade の最終形

Phase A 完了後の `SupabaseDataService.ts` に残るのは:

1. 各 `Supabase*Service` + `PHASE2_*_METHODS` の import
2. `createSupabaseDataService()`: サービス生成 + `route()` dispatch table + Proxy
3. 互換 re-export 群（上記）

= 「ドメインロジックを一切持たない薄い facade」。route() の dispatch 方式・Proxy の throwing fallback は現状のまま変えない。

### Phase B — web 画面の hooks 切り出し（挙動不変）

編集ステート・保存ロジック・タブ切替等を custom hooks（`web/src/<section>/hooks/`）へ抽出し、画面コンポーネントは表示の組み立てに専念させる。対象順（着手時 snapshot の行数）:

1. `web/src/briefing/BriefingScreen.tsx`（約 850 行）
2. `web/src/notes/NotesView.tsx`（約 1313 行）
3. `web/src/MainScreen.tsx`（約 951 行）

`web/src/schedule/CalendarTab.tsx` は対象外（Non-goals 参照。着手したくなったら停止して chat-main に確認）。

---

## Steps

| #   | Step                                                       | Gate    | Acceptance                     |
| --- | ---------------------------------------------------------- | ------- | ------------------------------ |
| 1   | 計画書 + helpers + task 系切り出し（PR #1）                | 🤖 自律 | 下記 AC 全通過                 |
| 2   | PR #1 merge                                                | 🛑 人手 | merge ボタン                   |
| 3   | routine 系切り出し（PR #2）                                | 🤖 自律 | 下記 AC 全通過                 |
| 4   | event・schedule 系切り出し（PR #3）                        | 🤖 自律 | 下記 AC 全通過                 |
| 5   | calendar 系切り出し（PR #4）                               | 🤖 自律 | 下記 AC 全通過                 |
| 6   | link・connection 系 stub 切り出し + facade 最終化（PR #5） | 🤖 自律 | 下記 AC 全通過 + facade 最終形 |
| 7   | BriefingScreen hooks 切り出し（PR #6〜）                   | 🤖 自律 | 下記 AC 全通過                 |
| 8   | NotesView hooks 切り出し                                   | 🤖 自律 | 下記 AC 全通過                 |
| 9   | MainScreen hooks 切り出し                                  | 🤖 自律 | 下記 AC 全通過                 |
| 10  | merge 後の実ブラウザ確認                                   | 👀 目視 | chat-main が dev server で実測 |

各実装ステップの PR merge（🛑 人手）は表から省略（全 PR 共通）。ステップ 3 以降は前 PR の merge を待たず、直前 PR の HEAD を base に積んでもよいが、**push 前に必ず origin/main へ rebase し、stacked のまま PR を出さない**（`stacked-pr-base-retarget-race` の実測知見 — base が main 以外の PR は着地事故のもと）。

---

## Acceptance Criteria (機械検証可能・全 PR 共通)

- [ ] `cd shared && npm run test` exit 0（既存テストの期待値を書き換えない）
- [ ] `cd shared && npm run build` exit 0
- [ ] `cd web && npm run build` exit 0
- [ ] public API シグネチャ不変（DataService インターフェース 無改変・`getDataService()` 境界不変）
- [ ] Phase A: フロント（`web/src/**`）の diff ゼロ / Phase B: `shared/src/**` の diff ゼロ（原則）
- [ ] 文言・i18n catalog・`lumen-*` トークンに変更なし
- [ ] 完了時: 本計画書の Status を COMPLETED にして `archive/` へ移動

---

## Risks / Known Issues 参照

- squash merge 後のブランチ使い回し禁止（CLAUDE.md §7.4 — PR ごとに origin/main から切り直し、`.claude/comm/.session-branch` を都度更新）
- 移動時の暗黙差分（import 順による副作用等）: 本体は side-effect free なクラス定義のみなので想定リスク低。verbatim 移動 + 3 ゲートで担保
- `SupabaseNotesUnifiedService.ts` に `pgrstQuoteValueLocal` という重複コピーが現存する。統合は挙動変更ゼロだが diff ノイズを避けるため PR #5（facade 最終化）でまとめて helpers 参照に付け替える

---

## References

- vision: `.claude/docs/vision/coding-principles.md`
- 既存分割の先行例: `shared/src/services/SupabaseTimerService.ts` ほか Notes / Dailies / WikiTags / Audio
- related skills: `session-verifier`, `task-tracker`, `git-workflow`

---

## Worklog

- 2026-07-29: ベースライン確認（shared test 1273 pass / shared build / web build すべて exit 0）。PR #1 着手
- 2026-07-29: Phase A 全 5 PR 提出完了 — #457（helpers + tasks）/ #458（routines）/ #459（schedule）/ #460（calendars）は merged、#461（note-link stubs + facade 最終化 + pgrstQuoteValueLocal 統合）は merge 待ち。facade は最終形（202 行・ドメインロジックゼロ・互換 re-export 全維持）に到達。残り = Phase B（web hooks 切り出し・Steps 7-9）と merge 後の実ブラウザ確認（Step 10）
