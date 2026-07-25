---
Status: IN PROGRESS
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
2. **Event 編集（繰り返し由来の occurrence 選択時）**: EventEditorPane の read-only「元 Routine」表示を「繰り返し設定」編集セクションに置き換える。編集は**系列全体に適用**（裏で Routine を patch）。「この回のみ」編集は Non-goal（dismiss = この回を消す、は現行機能で既に可能）
   - **補遺（2026-07-19 #279 で SUPERSEDE）**: 「編集は常に系列全体・この回のみは Non-goal」を改め、タイトル / 時刻の編集と削除は**範囲選択ダイアログ（この予定のみ / 今後 / すべて）**を経由する方式へ移行した（頻度変更のみ従来どおり系列全体）。意味論の正本 = `tier-1-core.md` §Schedule 競合解決ルール 5
   - **伝播の実挙動（2026-07-12 実測訂正）**: 本文が当初参照していた `syncScheduleItemsWithRoutines` / `reconcileRoutineScheduleItems` は **web host に未配線（dead code）**。実際の反映経路は「表示中日付の `ensureRoutineItemsForDate` の diff 更新 + 未来分は materialise 時に最新 Routine から生成」で、materialise 済み未来行への即時一括伝播・掃除（例: daily→weekdays で週末行の除去）は起きない。これは pre-existing で RoutinesTab の頻度編集とも対称（本実装によるリグレッションではない）。reconcile を配線するか AC を現状に合わせるかは **Step 5 の目視ゲートで判断**
   - **追補（2026-07-19 #279）**: 上記のうち「`ensureRoutineItemsForDate` の diff 更新」は停止した（done / 手動編集済み行まで巻き戻す競合ルール違反のため creation-only 化）。以後、materialise 済み行への伝播は範囲選択ダイアログの「今後 / すべて」（`updateFutureScheduleItemsByRoutine` — 競合解決ルール 1・2 準拠フィルタ付き）だけが行う
3. **繰り返しの解除**: 繰り返し設定を「なし」に変更 = **過去の occurrence（完了/未完了とも）を残し、今日以降の未完了分だけを消す**（カレンダーアプリの「以降の繰り返しを削除」と同じ意味論・生活記録としての過去実績を保全）。**既存メソッドの組合せでは実現できないため、新規メソッド `detachRoutine`（仮称）を `SupabaseDataService` に追加する**:
   - 手順: (1) `events_payload` から `routine_item_id = id AND is_deleted_cache = false AND start_at >= today AND done = false` の occurrence を soft-delete → (2) Routine 本体の items_meta を cascade なしで soft-delete（両方 `updated_at` bump = LWW 維持）
   - 既存 `softDeleteRoutine` は**日付・完了フィルタなしで全 live occurrence を消す**（実測: `SupabaseDataService.ts:885-928`）ため「解除」には使えない（Trash からの Routine 削除用として現行のまま残す）。また `ensureRoutineItemsForDateRange` の cleanup は live routine リストに無い routine 由来の行を skip する（実測: `if (!routine) continue;`）ため、orphan 掃除もあてにできない — 未来分の削除は上記 (1) で明示的に行う
4. **Routines タブ**: 「繰り返しのある予定の一覧」として再定義（名称を「繰り返し / Repeats」へ変更・i18n 両 catalog）。編集フォームは Event 側の繰り返しセクションと同一部品に寄せる。タブ廃止はしない（v2 レイアウト標準の adoption と独立に保つ）
   - **補遺（2026-07-14 改訂 — Schedule 再設計 決定 1）**: 「タブ廃止はしない」を改め、Repeats 独立タブは**廃止**して単一 Calendar タブ + ツールバー「繰り返しのみ表示」フィルタ + overflow の管理シートへ畳む。案 B の「Routine = 実装詳細」を UI 構成まで貫徹するため（実装 = 再設計 Step 5・正本 = `2026-07-14-schedule-redesign.md` §4.5 / §5 決定 1）。本項のみ SUPERSEDE で、案 B のデータモデル維持・detachRoutine 意味論は不変
5. **表示 variant**: グリッド上の routine variant（藍色 + 左バンド）は「繰り返しアイテム」の意匠として維持

## MCP の扱い（スコープ切り出し提案）

実測の結果、**mcp-server は schedule に限らず全 8 handler が旧単一表 SQLite スキーマのままで、Supabase（items_meta + payload モデル）への接続自体が存在しない**（`mcp-server/src/db.ts` = better-sqlite3・`items_meta` への参照 0 件）。schedule handler 単独の「2 行分割モデル移行」は接続基盤なしには成立しないため、**mcp-server の Supabase 対応は別 Issue（shared-fix）へ切り出す**ことを提案する。#185 の DoD 4 行目はその Issue への参照に差し替える。**これは Issue が明記した DoD の変更にあたるため、Step 1（本計画 PR の merge）をその明示的サインオフとして扱い、merge 前は Issue を編集しない**。

---

## Scope (Touchable Paths)

```
web/src/schedule/**
shared/src/components/schedule/**        ← EventEditorPane / RoutineEditorForm の統合部品化
shared/src/hooks/useScheduleItems*.ts    ← 生成ロジックは原則触らない（呼び出し追加のみ）
shared/src/hooks/useRoutines*.ts
shared/src/services/SupabaseDataService.ts   ← detachRoutine 新規追加のみ（既存メソッドの挙動変更禁止）
shared/src/i18n/locales/{en,ja}.json     ← 繰り返しセクション・タブ名変更の文言
shared/tests/**                          ← 追加テスト
.claude/docs/vision/plans/2026-07-11-event-routine-unification.md
.claude/CLAUDE.md §4 / docs/requirements/tier-1-core.md   ← 実装 PR と同時の 1 行追記
```

DDL なし（`supabase/migrations/` に触らない）。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系）編集禁止。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                                                                     | Gate    | Acceptance                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------- |
| 1   | 本計画 PR merge（案 B 承認 + MCP 切り出し承認）                                                                                                                                                                                                                                                                          | 🛑 人手 | PR merge                                                            |
| 2   | 繰り返し編集部品の共通化（RoutineEditorForm の frequency 部を Event 側でも使える部品に切り出し）                                                                                                                                                                                                                         | 🤖 自律 | shared build/test pass・既存 RoutinesTab の挙動不変                 |
| 3   | Event 作成/編集フローへ繰り返しセクション組込（作成時 Routine 自動生成・系列編集・解除 = `detachRoutine` 新規実装 — UX 仕様 3 参照）                                                                                                                                                                                     | 🤖 自律 | 追加 vitest 緑（detachRoutine の日付/完了フィルタ含む）+ build pass |
| 4   | Routines タブの再定義（名称「繰り返し」化・同一部品化）                                                                                                                                                                                                                                                                  | 🤖 自律 | build/test pass                                                     |
| 5   | playwright runtime 検証（作成→翌日分 materialise→系列編集伝播→解除、console error 0）。追加観察項目（2026-07-12 監査由来）: (a) 未来日の手動 Event を繰り返し化して一時非表示にならないか (b) 頻度変更後の materialise 済み未来行の実挙動 → AC「系列伝播」の扱い判断 (c) 解除後に過去実績が残り variant 表示が外れること | 👀 目視 | 検証レポート + スクリーンショット                                   |
| 6   | docs 追随（CLAUDE.md §4 1 行・tier-1-core）+ MCP 切り出し Issue 起票 + #185 DoD 更新                                                                                                                                                                                                                                     | 🤖 自律 | docs diff が実装 PR に同梱・Issue URL                               |
| 7   | 実装 PR merge → #185 close                                                                                                                                                                                                                                                                                               | 🛑 人手 | merge + close                                                       |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 新規 Event 作成 UI に繰り返し設定があり、設定時に routines_payload へ 1 行 + 当日分 events_payload が materialise される（playwright + MCP `list_schedule` 相当の実測）
- [ ] 繰り返し設定の編集が系列（未来の未完了 occurrence）へ伝播する
- [ ] 繰り返し解除（`detachRoutine`）で今日以降の未完了 occurrence だけが soft-delete され、過去の occurrence（完了/未完了とも）は残る
- [ ] 既存データの移行パス = **不要**（スキーマ不変のため既存 Routine / 生成済み Event はそのまま有効 — Issue #185 DoD 3 行目をこの行で close する）
- [ ] DDL 変更 0（`git diff --stat` に supabase/migrations が現れない）
- [ ] #185 の DoD 全行が close 可能な状態（MCP 行は切り出し Issue 参照へ更新済み）
- [ ] 完了時: 本計画 Status → COMPLETED + archive 移動 + per-chat memory 更新（DoD）

---

## Risks / Known Issues 参照

- **RoutineScheduleSync の無限ループ既往**（DU-C-6 hardening 済・`useScheduleItemsRoutineSync.ts` の notifyChanged ガード）: 生成ロジック本体には触らず、呼び出し追加のみに留める（`detachRoutine` は Service 層の新規メソッドで generator 非接触）
- **soft-delete cascade × LWW の絡み**: `detachRoutine` は items_meta の `updated_at` bump を全対象行で行うこと（DB-Q2）。実装 PR では **life-editor-sync-auditor の起動を必須**とする（role-qa 2026-07-11 推奨）
- **dismiss と partial UNIQUE の関係**: dismiss 済み行は live 扱いで再生成をブロックする現行仕様を変えない（変えると `uq_events_payload_routine_date` の意味論が崩れる）
- **並走する v2 レイアウト標準**: Routines タブの名称変更は HeaderTabs の「中身」だけで shell 部品に触れないため競合しない。v2 部品 merge 後の adoption は orders 台帳の別項で対応
- **`frequencyType: "group"` の扱い**: Event 側の繰り返し UI では group を新規設定不可とし、既存 group Routine の編集は Routines タブに残す（UI 簡素化。group 概念の将来整理は別議論）→ **2026-07-14 決定: RoutineGroup は削除**（グループ管理 UI が存在せず実質機能していないため。コード撤去 = 再設計 Step 4・DB テーブルは DDL ルールに従い当面残置 — `2026-07-14-schedule-redesign.md` §5 決定 3）

---

## References

- Issue: #185（要件の一次情報）/ 台帳: [`2026-07-11-schedule-refine-orders.md`](./2026-07-11-schedule-refine-orders.md)
- 実装マップの根拠: `shared/src/types/{schedule,routine}.ts` / `supabase/migrations/{0008,0011,0016}*.sql` / `shared/src/hooks/useScheduleItemsRoutineSync.ts` / `shared/src/services/{scheduleItemMapper,routineMapper}.ts` / `SupabaseDataService.ts` / `mcp-server/src/handlers/scheduleHandlers.ts`
- 規約: `docs/vision/db-conventions.md` §10 / CLAUDE.md §3.3・§4

---

## Worklog

- 2026-07-11: 計画作成（chat-schedule-refine）。Explore agent の実装マップを spot check（0008 partial UNIQUE / 0011 generated column / MCP legacy 単一表 / EventEditorPane isRoutine — 全一致）した上で案 B を採択。mcp-server が全 handler 未移行（Supabase 接続自体なし）と判明したため MCP 移行の切り出しを Step 6 に組込
- 2026-07-11: Step 1 完了（本計画 PR #191 merge = 案 B + MCP 切り出しのサインオフ）。Step 2 実装 — RoutineEditorForm の頻度部を `FrequencyEditor`（`shared/src/components/schedule/`）へ切り出し。Event 側（Step 3）用に「なし」選択肢（`onSelectNone`）と group 新規設定不可（`allowGroup: false`・現在値が group の場合のみ表示継続）を props で先行実装。既存 routineEditorForm.test 無修正で緑 = RoutinesTab 挙動不変。shared 802/802 + web build pass
- 2026-07-11: role-qa 監査（Major 1 件）を反映。「繰り返し解除」の仕様が実コードと矛盾していた — `softDeleteRoutine` は日付/完了フィルタなしの全 cascade（`SupabaseDataService.ts:885-928` 実測）・`ensureRoutineItemsForDateRange` cleanup は soft-delete 済み routine 由来の行を skip（`if (!routine) continue;` 実測）。過去実績の保全を優先し、新規メソッド `detachRoutine`（今日以降・未完了のみ soft-delete → routine 本体を cascade なしで soft-delete）を Step 3 に追加。あわせて移行パス不要の明示（DoD 3 対応）と MCP DoD 変更のサインオフ手順を明記
- 2026-07-12: **Step 3 + Step 4 実装（chat-schedule-event-routine が Step 3+ を引き継ぎ — ユーザー指示・outbox 宣言済み）**。EventEditorPane に繰り返しセクション（FrequencyEditor）組込・CalendarTab 配線・`detachRoutine` 実装（`todayDateKey()` 既定・`fetchAllPages` ページング）・Routines タブ「繰り返し / Repeats」化（i18n 値のみ・shell 非接触）。role-qa + sync 監査（LWW × soft-delete 特化・sync-auditor 代行）とも **PASS with Should / Blocking 0**。Should 対応: (S-1) detach 時に生存 occurrence（過去分・完了済み分）の `routine_item_id` を NULL 化して真に切り離し — `permanentDeleteRoutine`（全参照 event を hard-delete）経由で「detach → ゴミ箱を空にする」が過去実績を巻き込む事故経路を封鎖。トレードオフ（detach 後は過去分の routine variant 表示が外れる / detach 後に Routine を restore すると閲覧日で重複記録が生じ得る）は受容 (S-2) 解除ハンドラの fire-and-forget を廃し返却 id で reconcile・失敗時は再読込 (S-3) optimistic filter の today 二重ソース解消。UX 仕様 2 の伝播記述を実測に合わせて訂正（未配線 dead code 参照だった）+ Step 5 観察項目を追加
- 2026-07-14: Schedule 再設計（`2026-07-14-schedule-redesign.md`）の決定を補遺として反映 — UX 仕様 4 の「タブ廃止はしない」を改訂（Repeats 独立タブ → 単一 Calendar タブ + フィルタ = 案 B の貫徹・再設計 Step 5）、RoutineGroup 削除決定（再設計 Step 4）、系列伝播は reconcile 配線で解消する方針を確定（Step 5 目視ゲート保留だった判断 → 再設計 決定 5 で「配線する」に確定）
