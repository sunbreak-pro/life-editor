---
Status: Draft
Created: 2026-07-11
Branch: claude/schedule-refine
Owner-chat: schedule-refine
Parent: 2026-07-11-schedule-refine-orders.md
---

# Plan: Event / Routine 統合 — UI 単一アイテム型化（#185）

> Issue #185 の「着手前に詳細計画化」に対応する計画書。**統合方針の決定（案 B 採用）と実装ステップの正本**。
> 要件の一次情報 = Issue #185 本文。現行実装の実測マップは 2026-07-11 に Explore agent + spot check で取得（本文に反映済み）。

---

## Context

- **動機**: Event（単発予定）と Routine（繰り返しテンプレート）が別アイテム種別として二重管理になっており、ユーザーから見て「アイテムは 1 種類 + 繰り返し設定」に統合したい（2026-07-10 ユーザー要件）
- **制約**: コスト $0 / Active Migration 中の安定性優先 / Cloud Sync の LWW 前提（`items_meta.updated_at`）を壊さない / shell 部品は編集禁止（単一書込者 = layout-standard）
- **Non-goals**: iCal RRULE 互換の本格的な繰り返しエンジン / 繰り返しの「この回のみ編集」（occurrence 例外管理）/ mobile 専用 UI の新設 / v2 レイアウト標準の先取り

---

## 方針決定: 案 B（データモデル維持・UI 統合）を採用

### 決定内容

**DB スキーマ・Mapper・生成ロジックは現行のまま維持し、UI 層で「1 アイテム種別 + 繰り返し設定」に見せる**。作成・編集 UI で「繰り返し」を設定すると裏で Routine レコードを作成・更新する。

### 根拠（実測に基づく）

1. **per-occurrence 状態が既に materialise 前提**: 完了（`done`）・dismiss（`is_dismissed`）は日ごとの Event 行に持つ設計で、案 A の「繰り返し Event の仮想展開」には occurrence 例外テーブルの新設（= iCal EXDATE の再発明）が必要になる。materialise を維持したまま案 A にすると、得るものは「テーブル 1 つ削減」だけ
2. **案 A の DDL 代償が大きい**: `routine_item_role generated always as ('routine')`（0011）・composite FK・partial UNIQUE `uq_events_payload_routine_date`（0008）・RLS owner guard（0016）が全て「role=routine の親」を前提にしており、親を Event 化すると 4 つとも作り直し + 既存データの role 書き換え移行が必要（🛑 DDL ゲート複数回）
3. **ユーザー要件の実体は UX**: 「二重管理に見える」ことが問題であり、ストレージが 2 テーブルであることではない。案 B は DDL ゼロ・データ移行ゼロで要件を満たす
4. 将来 occurrence 例外編集（「この回だけ時間変更」）が要件化したら、その時点で案 A 相当を再検討する（本計画の UI 統合はその際もそのまま活きる）

### 用語の整理（docs 追随の方針）

- CLAUDE.md §4「Routine = Event の生成テンプレート」は**引き続き真**。追記するのは「UI 上は単一アイテム型 + 繰り返し設定として提示し、Routine は実装詳細（2026-07-11 #185 決定)」の 1 行のみ
- `db-conventions.md` §10 は変更なし（スキーマ不変のため）

---

## UX 仕様（統合後の見え方）

1. **Event 作成**: 作成 UI に「繰り返し」フィールドを追加（なし / 毎日 / 曜日指定 / N 日ごと）。「なし」= 現行どおり単発 Event。設定あり = 裏で Routine を作成し、当日以降を既存 generator が materialise する（`ensureRoutineItemsForDate` / Week 系は現行のまま）
2. **Event 編集（繰り返し由来の occurrence 選択時）**: EventEditorPane の read-only「元 Routine」表示を「繰り返し設定」編集セクションに置き換える。編集は**系列全体に適用**（裏で Routine を patch → 既存の `syncScheduleItemsWithRoutines` が title/time を伝播）。「この回のみ」編集は Non-goal（dismiss = この回を消す、は現行機能で既に可能）
3. **繰り返しの解除**: 繰り返し設定を「なし」に変更 = Routine を soft-delete。過去の完了済み occurrence は残り、未来の未完了分は既存 cleanup（`ensureRoutineItemsForDateRange` の削除パス）で消える
4. **Routines タブ**: 「繰り返しのある予定の一覧」として再定義（名称を「繰り返し / Repeats」へ変更・i18n 両 catalog）。編集フォームは Event 側の繰り返しセクションと同一部品に寄せる。タブ廃止はしない（v2 レイアウト標準の adoption と独立に保つ）
5. **表示 variant**: グリッド上の routine variant（藍色 + 左バンド）は「繰り返しアイテム」の意匠として維持

## MCP の扱い（スコープ切り出し提案）

実測の結果、**mcp-server は schedule に限らず全 8 handler が旧単一表 SQLite スキーマのままで、Supabase（items_meta + payload モデル）への接続自体が存在しない**（`mcp-server/src/db.ts` = better-sqlite3・`items_meta` への参照 0 件）。schedule handler 単独の「2 行分割モデル移行」は接続基盤なしには成立しないため、**mcp-server の Supabase 対応は別 Issue（shared-fix）へ切り出す**ことを提案する。#185 の DoD 4 行目はその Issue への参照に差し替える（ユーザー承認後に Issue 編集）。

---

## Scope (Touchable Paths)

```
web/src/schedule/**
shared/src/components/schedule/**        ← EventEditorPane / RoutineEditorForm の統合部品化
shared/src/hooks/useScheduleItems*.ts    ← 生成ロジックは原則触らない（呼び出し追加のみ）
shared/src/hooks/useRoutines*.ts
shared/src/i18n/locales/{en,ja}.json     ← 繰り返しセクション・タブ名変更の文言
shared/tests/**                          ← 追加テスト
.claude/docs/vision/plans/2026-07-11-event-routine-unification.md
.claude/CLAUDE.md §4 / docs/requirements/tier-1-core.md   ← 実装 PR と同時の 1 行追記
```

DDL なし（`supabase/migrations/` に触らない）。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系）編集禁止。

---

## Steps

| #   | Step                                                                                                   | Gate    | Acceptance                                          |
| --- | ------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------- |
| 1   | 本計画 PR merge（案 B 承認 + MCP 切り出し承認）                                                        | 🛑 人手 | PR merge                                            |
| 2   | 繰り返し編集部品の共通化（RoutineEditorForm の frequency 部を Event 側でも使える部品に切り出し）       | 🤖 自律 | shared build/test pass・既存 RoutinesTab の挙動不変 |
| 3   | Event 作成/編集フローへ繰り返しセクション組込（作成時 Routine 自動生成・系列編集・解除 = soft-delete） | 🤖 自律 | 追加 vitest 緑 + build pass                         |
| 4   | Routines タブの再定義（名称「繰り返し」化・同一部品化）                                                | 🤖 自律 | build/test pass                                     |
| 5   | playwright runtime 検証（作成→翌日分 materialise→系列編集伝播→解除、console error 0）                  | 👀 目視 | 検証レポート + スクリーンショット                   |
| 6   | docs 追随（CLAUDE.md §4 1 行・tier-1-core）+ MCP 切り出し Issue 起票 + #185 DoD 更新                   | 🤖 自律 | docs diff が実装 PR に同梱・Issue URL               |
| 7   | 実装 PR merge → #185 close                                                                             | 🛑 人手 | merge + close                                       |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 新規 Event 作成 UI に繰り返し設定があり、設定時に routines_payload へ 1 行 + 当日分 events_payload が materialise される（playwright + MCP `list_schedule` 相当の実測）
- [ ] 繰り返し設定の編集が系列（未来の未完了 occurrence）へ伝播する
- [ ] 繰り返し解除で Routine が soft-delete され未来の未完了分が消える（完了済みは残る）
- [ ] DDL 変更 0（`git diff --stat` に supabase/migrations が現れない）
- [ ] #185 の DoD 全行が close 可能な状態（MCP 行は切り出し Issue 参照へ更新済み）
- [ ] 完了時: 本計画 Status → COMPLETED + archive 移動 + per-chat memory 更新（DoD）

---

## Risks / Known Issues 参照

- **RoutineScheduleSync の無限ループ既往**（DU-C-6 hardening 済・`useScheduleItemsRoutineSync.ts` の notifyChanged ガード）: 生成ロジック本体には触らず、呼び出し追加のみに留める
- **dismiss と partial UNIQUE の関係**: dismiss 済み行は live 扱いで再生成をブロックする現行仕様を変えない（変えると `uq_events_payload_routine_date` の意味論が崩れる）
- **並走する v2 レイアウト標準**: Routines タブの名称変更は HeaderTabs の「中身」だけで shell 部品に触れないため競合しない。v2 部品 merge 後の adoption は orders 台帳の別項で対応
- **`frequencyType: "group"` の扱い**: Event 側の繰り返し UI では group を新規設定不可とし、既存 group Routine の編集は Routines タブに残す（UI 簡素化。group 概念の将来整理は別議論）

---

## References

- Issue: #185（要件の一次情報）/ 台帳: [`2026-07-11-schedule-refine-orders.md`](./2026-07-11-schedule-refine-orders.md)
- 実装マップの根拠: `shared/src/types/{schedule,routine}.ts` / `supabase/migrations/{0008,0011,0016}*.sql` / `shared/src/hooks/useScheduleItemsRoutineSync.ts` / `shared/src/services/{scheduleItemMapper,routineMapper}.ts` / `SupabaseDataService.ts` / `mcp-server/src/handlers/scheduleHandlers.ts`
- 規約: `docs/vision/db-conventions.md` §10 / CLAUDE.md §3.3・§4

---

## Worklog

- 2026-07-11: 計画作成（chat-schedule-refine）。Explore agent の実装マップを spot check（0008 partial UNIQUE / 0011 generated column / MCP legacy 単一表 / EventEditorPane isRoutine — 全一致）した上で案 B を採択。mcp-server が全 handler 未移行（Supabase 接続自体なし）と判明したため MCP 移行の切り出しを Step 6 に組込
