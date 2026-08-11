# Outbox — chat-refactor-core

リファクタリング専任レーン（worktree `.claude/worktrees/refactor-core`）。挙動変更ゼロの構造改善のみを担当。

## 2026-07-29 chat-main 宛: DataService 分割リファクタの起票依頼（ユーザー直接指示・実装は着手済み）

ユーザーから当レーンへ直接指示があり、CLAUDE.md §9 に従い起票依頼だけこちらに残します（実装は指示どおり即着手済み）。

- **内容**: `shared/src/services/SupabaseDataService.ts`（約 2400 行）を 1 ドメイン = 1 PR で専用サービスへ分割し薄い facade 化 → その後 web 画面（BriefingScreen / NotesView / MainScreen）の hooks 切り出し。**挙動変更ゼロ・DataService インターフェースと getDataService() 境界は不変・DDL ゼロ**
- **計画書（分割の全体設計・切り出し順・facade 最終形）**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`（PR #457 に同梱）
- **進捗**: PR #457（Step 1: 計画書 + `supabaseServiceHelpers.ts` + `SupabaseTasksService.ts` 切り出し）open・3 ゲート緑（shared test 1273 pass / shared build / web build）。以降 routine 系 → event・schedule 系 → calendar 系 → link・connection 系 stub + facade 最終化 → web hooks の順で 1 PR ずつ出します
- **起票の提案**: セクション横断のため `shared-fix` ラベル + タイトル prefix `[refactor-core]` を想定。粒度（全体で 1 Issue か Phase A/B で 2 Issue か）はお任せします
- **スコープ境界の申し送り**: `web/src/schedule/CalendarTab.tsx` は schedule-refine レーンの Epic #290 残ステップと衝突するため当レーンでは触りません

（軽微な観察: `.claude/comm/outbox/refactor-core/` という空ディレクトリの残骸があります。単一書き込み者ルール上こちらでは消していません — 掃除はお任せします）

## 2026-08-01 chat-refactor-core

- **#465 merge 済み**: PR #479（MainScreen shell hooks 切り出し・Fixes #465）が 2026-07-30 に merge されました。#472/#473 の解禁条件を満たしています。実ブラウザ確認（計画 Step 10）は chat-main 側でお願いします

## 2026-08-10 chat-refactor-core: リファクタ計画の起票報告 + 2 件の申し送り

**1. リファクタ 10 クラスタを起票しました（#668〜#677）** — ユーザーから当レーンへ直接指示があり、**「Issue の起票は今回のみ例外としてここで行う」と明示的な許可を得た**ため、CLAUDE.md §9 の chat-main 一元化ルールの例外として当レーンで起票しています（次回以降は従来どおり outbox 経由に戻します）。

- 詳細の正本 = `.claude/docs/vision/plans/2026-08-10-core-refactor.md`。Issue 側は動機 3 行 + 計画書参照 + DoD だけを持たせています
- 全件 `shared-fix` + タイトル prefix `[refactor-core]`。実装セッション 1 = #668〜#673 / セッション 2 = #674〜#676 / #677 は移行完了まで凍結（`status:frozen`）

**2. chat-main 宛: Issue #587 が close 漏れしています** — PR #642 / #647 が 2026-08-10 に merge 済みで、対象 2 本は `useNotesUnifiedAPI` 967 → 431 行 / `SupabaseNotesUnifiedService` 842 → 303 行（当レーンで実測）。DoD の行数条件・分割条件とも満たしています。担当は shared-fix レーンなので当レーンでは close せず、報告に留めます。

**3. schedule-refine レーン宛: #673 / #675 が Schedule のファイルを触ります** — `web/src/schedule/CalendarTab.tsx` と `useScheduleMutations.ts` が対象です。二重着手を避けるため **`section:schedule` ラベルはあえて付けていません**（宛先は refactor-core 1 本 = D-20260731-main-2）。ただし #290 / #625 / #628 と同じファイルなので、以下でお願いします:

- #673（純関数の切り出し・セッション 1）は挙動変更ゼロ・切り出しのみ。着手前に当レーンが open PR の state を確認します
- #675（巨大ホストの分割・セッション 2）は差分が大きいため、着手時期を調整させてください。schedule-refine 側で CalendarTab に大きな変更が入る予定があれば outbox でお知らせいただけると助かります

## 2026-08-12 chat-main 宛: #671 C4 S8（i18n の型拡張）の実測結果と follow-up 起票依頼

#671 の S8（i18next `CustomTypeOptions` でキーを型に載せる）を実際に配線して計測しました。**計画書が挙げていた 3 段の障害は 3 つとも越えられます**が、越えた先の後始末が独立した作業量なので、S7（ランタイムガード）までで PR を締め、S8 は follow-up の起票をお願いしたいです。

**実測（probe は revert 済み・コードには残していません）**

- `shared/src/i18n/resources.ts` に `declare module "i18next"` を置き、`shared/src/i18n/index.ts` から side-effect import する形にすると、**web 側の `useTranslation()` の `t` までちゃんと型が届きました**。「i18next が二重に入っている（shared / web の node_modules 両方に 25.10.10）」は障害になりませんでした
- 存在しないキー `t("definitely.not.a.real.key")` を web の画面に入れると `cd web && npm run build` が落ちます。**狙いどおり機能します**
- 同時に、動的キーの呼び出しが **12 箇所**エラーになります（probe の仕込み 1 件を除いた実数）:
  - `web/src/AuthScreen.tsx:76` / `web/src/hooks/useShellChrome.tsx:115,185` / `web/src/MainScreen.tsx:306,349` / `web/src/schedule/CalendarTab.tsx:406,890,2186` / `web/src/settings/SettingsScreen.tsx:103,114` / `web/src/tasks/KanbanView.tsx:542` / `web/src/work/WorkScreen.tsx:91`

**なぜ今回入れなかったか**

12 箇所を直すには、キーを保持している定数側（section registry の `labelKey`、ショートカット定義の `descriptionKey` など）を `TranslationKey` のリテラル union に型付けし直す必要があります。これは `shared/src/sections.ts` など**他レーンも触るファイル**に波及するため、P-008（実装中スコープ凍結）に従い今回は広げませんでした。

**起票のお願い**: `shared-fix` + `[refactor-core]` prefix で「i18n キーを型に載せる（#671 S8 の続き）」。DoD 案 = 上記 12 箇所の動的キーを型付き定数に寄せる / `CustomTypeOptions` を入れて `cd web && npm run build` が未知キーで落ちる / S7 のランタイムテストは残す（動的キーは型でしか見えず、リテラルは型とテストの二重で見る）。
