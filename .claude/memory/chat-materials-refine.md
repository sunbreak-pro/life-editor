# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #1099 SupabaseTodosService の items_meta UPDATE 4 箇所に role ガード ✅（2026-08-19 — **PR #1105 open**（Closes #1099・merge = こうだいさん）。#996 / PR #1080 の反対側。#625 の変換が id を保ったまま role を動かす（D-20260810-sched-2）ため、Todo → Event 後に古い Todo 操作が Event 行に当たっていた。`bumpItemsMetaUpdatedAt` / `updateTodo` / `softDeleteTodo` / `restoreTodo` に `.eq("role", "task")`（値は `"todo"` ではない = #831）。void 系は 0 行ヒットで静かに消え、`updateTodo` は読み返しで reject。新規 `shared/tests/todoMetaRoleGuard.test.ts` 10 ケース（振る舞い 7 + ソースを読む数え上げ 3 — private で呼び出し元の無い bump は振る舞いから到達できないため）。ガードを剥がすと 5 件落ちることを実測。CI verify 全ステップ + docs-lint exit 0）
- section:materials の 5 件を全て PR 化 ✅（2026-08-18 — #1041 / #1042 / #1040 / #1043 は **merged**、#1047 は **PR #1075 open**。1 ブランチ 1 Issue で `origin/main` から切り、各本で CI verify（docs-lint / shared / web / desktop / mcp-server）をローカル全通し。#1041 = ja `section.materials` を「資料」→「素材」（PR #1052）。#1042 = ノート詳細のタグ行から `ItemRoleBadge` 撤去（PR #1055）。#1040 = `TodoDetailPanel` の日時行を disclosure 化・`scheduleSet` で日時ありは開いた状態（PR #1064）。#1043 = **Note ⇄ Todo/Event の変換は実在せず撤去対象ゼロ**だったので tier-1-core の「やらない」に記録する docs PR に切替（PR #1067）。#1047 = ノートテンプレート新規実装 — 専用テーブルではなく `notes_payload.note_type='template'`（migration 0024）・3 点メニュー「テンプレートを作成する」→ `ResponsiveDetailFrame`（Mobile は全画面 = 画面遷移）・タグ / リンクは UI ごと不在（`[[` loader を渡さない）・一覧 / 検索 / 件数 / ゴミ箱から `isNoteTemplateRow` で除外・`listNoteTemplatesUnified` だけが返す。**🛑 #1075 は merge 前に `supabase db push` が要る**）
- #876 Mobile の Note / Daily を「一覧はサイドバー・メインは本文」へ ✅（2026-08-16 — **PR #962 open**（Closes #876・merge = こうだいさん）。裁定 D-20260815-materials-2 = A。`RightSidebarPortal` の `isWide` ゲートを外し、一覧を両幅とも詳細パネル（narrow = ハンバーガーの `MobileDrawer`）へ。Notes は detail sheet（#471）と `NotesMobileList` を退役し、**シート固有のノート識別 `useNoteSheetTarget` と `onPendingSelected` seam も消えた**（`selectNote` が id 切替前に hydrate するため #475 の穴が構造的に無い）。Daily は過去エントリのパネルをドロワーへ移し 2 件テーザーを退役（40 日前のエントリがスマホから到達不能だった）。`DateStrip` は本文側に残置。narrow 固有は詰まった `variant` と QuickAddSheet の 2 点のみ。孤児 i18n キー 2 件を両 catalog から撤去・`mobile-scope.md` #7 / #8 を更新。shared 2232 / web 472 + 両 lint / build + docs-lint すべて exit 0。実機の狭幅目視 = こうだいさんの手番）

## 予定

（なし — section:materials の open Issue を消化。次は判断キュー D-20260816-materials-1 の回答待ち、および chat-main からの新規 dispatch 待ち）

## 申し送り

- **#1075（ノートテンプレート）は merge 前に `supabase db push` が必須**（`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加）。適用前に merge するとテンプレート作成が CHECK 違反で落ちる
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
