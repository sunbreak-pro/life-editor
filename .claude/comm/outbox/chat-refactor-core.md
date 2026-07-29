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
