# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: C3（#670）の 4 PR 完了。**C2（#669）は別チャットが PR #694 で先に着地済み**（Issue CLOSED）なので当チャットでは飛ばした
- 現在: **#701 Step 2（PR #800 open）と C6 = #673（PR #819 open）を完了**（どちらも書いた時点の実測 = open）。#675 の必須追加調査（`handleScopeChoose` 約 210 行）も消化し Issue #675 へコメント済み
- 次: **#675 は着手できない** — 前提の #673（PR #819）が未 merge、かつ schedule-refine レーンが `CalendarTab.tsx` に open PR を 2 本持っている（#813 / #804）。3 本が片付いたら着手（merge は常にユーザー = P-001）

## 直近の完了

- **C6（#673）Schedule の純関数 pin — PR #819 open** ✅（2026-08-13）: 4 組の ViewModel 変換 → `scheduleViewModels.ts`（13 tests）/ 日付書式 5 箇所 + `t(...)` バンドル → `scheduleCopy.ts`（18 tests）/ ドラッグの配置解決 → `scheduleGridLayout.resolveDrag`（29 tests）。CalendarTab 2,927 → 2,704 行・WeekTimeGrid 977 → 921 行。挙動変更ゼロ
- **#701 Step 2 画面を操作せずボタンの処理を叩く経路 — PR #800 open** ✅（2026-08-13）: D-20260812-refactor-2 = A+B の道で Trash 1 画面を通した（`web/tests/trashScreenActions.test.tsx` 16 tests）。使い分け基準を `rules/frontend.md` に 1 行明文化
- **C3（#670）死蔵の削除と共有物の寄せ直し — 4 PR 全完了** ✅（2026-08-11）: 単一行 Mapper シム + 孤児型 6 本の削除（#698）/ `ItemsMetaRow`・contentJson・`ShortcutRow`・`TimerState` の置き場所是正（#699）/ ブレークポイント・日付キー・`minutesToTime`・`clamp` の手写し差し替え（#703）/ keydown 3 箇所の IME ガード + Audio 誤コメント訂正（#705）
- **C1（#668）検証ゲートの穴を塞ぐ — 4 PR 全完了** ✅（2026-08-11）: mcp-server を CI へ（#687）/ web の `"strict": true` 明示 + coverage 計測（#689）/ tests を型検査に載せて CI ゲート化（#690）/ TS を 4 パッケージとも ~6.0.x へ統一（#695）
- リファクタ調査（8 領域 → 64 findings → 10 クラスタ）+ 計画書 + Issue #668〜#677 起票 ✅（2026-08-10）
- Issue #586 eslint baseline 解消（PR #638/#644/#649/#653 すべて merged・Issue closed。baseline 残 = schedule 系 3 本のみ = scope 外）✅（2026-08-10）

## 予定

- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了）
- **#675（C8 = Schedule 巨大ホスト 3 本の分割）**: 追加調査は済（Issue #675 のコメント）。着手は #819 / #813 / #804 の merge 後
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）
