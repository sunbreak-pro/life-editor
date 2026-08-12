# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: **#701 Step 2（PR #800 merged）と C6 = #673（PR #819）を完了**。#675 の必須追加調査（`handleScopeChoose` 約 210 行）も消化し Issue #675 へコメント済み
- 現在: **#675 に着手 — やること 3「`useScheduleItemsAPI` を分割」を PR #833 で open**（書いた時点の実測）。727 → 239 行 + mirror / CRUD / trash の 3 モジュール。挙動変更ゼロ・22 tests 追加
- 次: **#675 やること 4（`useScheduleMutations` の繰り返し / スコープ機構を `useRepeatMutations` へ）** も #819 と非干渉なので着手可。**やること 1（CalendarTab）と 2（WeekTimeGrid）は #819 が merge されるまで不可**（同一ファイル。merge は常にユーザー = P-001）

## 直近の完了

- **C8（#675）やること 3 = `useScheduleItemsAPI` の分割 — PR #833 open** ✅（2026-08-13）: `shared/` 最後の未分割 API hook。727 → 239 行 + `useScheduleItemsViewMirror`（137）/ `useScheduleItemsCRUD`（459）/ `useScheduleItemsTrash`（73）。戻り値は無改造（`ScheduleItemsContextValue` がその `ReturnType`）。新規 22 tests は 3 本ともソースをわざと壊して落ちることを実測
- **C6（#673）Schedule の純関数 pin — PR #819 open・CI 全緑** ✅（2026-08-13）: 4 組の ViewModel 変換 → `scheduleViewModels.ts`（13 tests）/ 日付書式 5 箇所 + `t(...)` バンドル → `scheduleCopy.ts`（18 tests）/ ドラッグの配置解決 → `scheduleGridLayout.resolveDrag`（29 tests）。CalendarTab 2,927 → 2,704 行・WeekTimeGrid 977 → 921 行。挙動変更ゼロ
- **main の赤 2 件を修理 — PR #829 merged** ✅（2026-08-13）: 手書きテーブル 2 本が merge の波で古びた事故。#798 が足した describe を #813 の key 改名が拾えず `kanbanView.test.tsx` が 3 本落ち、#821 と #822 が同じ `VALID_CALLS` を別の base から編集して `covers every published tool` が落ちた。どちらも「各 PR 単独では緑・組み合わせで赤」の型
- **#701 Step 2 画面を操作せずボタンの処理を叩く経路 — PR #800 open** ✅（2026-08-13）: D-20260812-refactor-2 = A+B の道で Trash 1 画面を通した（`web/tests/trashScreenActions.test.tsx` 16 tests）。使い分け基準を `rules/frontend.md` に 1 行明文化
- **C3（#670）死蔵の削除と共有物の寄せ直し — 4 PR 全完了** ✅（2026-08-11）: 単一行 Mapper シム + 孤児型 6 本の削除（#698）/ `ItemsMetaRow`・contentJson・`ShortcutRow`・`TimerState` の置き場所是正（#699）/ ブレークポイント・日付キー・`minutesToTime`・`clamp` の手写し差し替え（#703）/ keydown 3 箇所の IME ガード + Audio 誤コメント訂正（#705）
- **C1（#668）検証ゲートの穴を塞ぐ — 4 PR 全完了** ✅（2026-08-11）: mcp-server を CI へ（#687）/ web の `"strict": true` 明示 + coverage 計測（#689）/ tests を型検査に載せて CI ゲート化（#690）/ TS を 4 パッケージとも ~6.0.x へ統一（#695）
- リファクタ調査（8 領域 → 64 findings → 10 クラスタ）+ 計画書 + Issue #668〜#677 起票 ✅（2026-08-10）
- Issue #586 eslint baseline 解消（PR #638/#644/#649/#653 すべて merged・Issue closed。baseline 残 = schedule 系 3 本のみ = scope 外）✅（2026-08-10）

## 予定

- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了）
- **#675（C8）の残り 3 項目**: やること 4（`useRepeatMutations` 分離）は着手可 / やること 1（taskChips・Todo → `useScheduleTaskChips`）と 2（WeekTimeGrid のドラッグ機構をフック化）は **#819 merge 待ち**（同一ファイル）
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）
