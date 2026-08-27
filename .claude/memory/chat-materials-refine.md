# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #1139 SupabaseTodosService の items_meta DELETE 2 箇所に role ガード ✅（2026-08-27 — **PR #1150 open**（Closes #1139・merge = こうだいさん）。#1099 の反対側で、#1098 / PR #1113 が schedule 側でやったことの Todos 版。穴の本体は `permanentDeleteTodo`: プールを `role='task'` の 2 本の read から作るので一見自衛できているが、`collectDescendantIds` が**プールを見る前に `id` 自身を結果へ入れる**ため、呼び出し元が渡した id はどちらの read も見ていなくても DELETE まで届く（= Issue の Trash レース。端末 B が Event へ変換 → 端末 A が古い一覧で「完全に削除」）。`createTodo` の R2 孤児回収は同じ呼び出しが直前に insert した行が相手なので理屈上ノーオペで、census を例外なしの規則に保つために付けた。テストは既存 `shared/tests/todoMetaRoleGuard.test.ts` を #1113 と同じ形に育成（16 ケース）— DELETE と insert をモックが実際に行うようにし、生存判定は 捕まえた行オブジェクトではなくテーブルから読み、`beforeFirstMetaDelete` フックで purge 途中の変換を再現。`;` 分割の素朴な census を #1113 のチェーン walker に差し替えて `method → role` を pin。mutation 4 通り実測（ガード剥がし 2 種で 5 件 / 4 件・role を `"todo"` と誤記で 4 件・チェーンを 2 文に割って走査回避で 4 件が赤）。CI verify 14 ステップ + docs-lint すべて exit 0）
- #1099 SupabaseTodosService の items_meta UPDATE 4 箇所に role ガード ✅（2026-08-19 — **PR #1105 merged**（Closes #1099・2026-08-27 実測）。#996 / PR #1080 の反対側。#625 の変換が id を保ったまま role を動かす（D-20260810-sched-2）ため、Todo → Event 後に古い Todo 操作が Event 行に当たっていた。`bumpItemsMetaUpdatedAt` / `updateTodo` / `softDeleteTodo` / `restoreTodo` に `.eq("role", "task")`（値は `"todo"` ではない = #831）。void 系は 0 行ヒットで静かに消え、`updateTodo` は読み返しで reject。新規 `shared/tests/todoMetaRoleGuard.test.ts` 10 ケース（振る舞い 7 + ソースを読む数え上げ 3 — private で呼び出し元の無い bump は振る舞いから到達できないため）。ガードを剥がすと 5 件落ちることを実測。CI verify 全ステップ + docs-lint exit 0）
- section:materials の 5 件を全て PR 化 ✅（2026-08-18 — #1041 / #1042 / #1040 / #1043 は **merged**、#1047 は **PR #1075 open**。1 ブランチ 1 Issue で `origin/main` から切り、各本で CI verify（docs-lint / shared / web / desktop / mcp-server）をローカル全通し。#1041 = ja `section.materials` を「資料」→「素材」（PR #1052）。#1042 = ノート詳細のタグ行から `ItemRoleBadge` 撤去（PR #1055）。#1040 = `TodoDetailPanel` の日時行を disclosure 化・`scheduleSet` で日時ありは開いた状態（PR #1064）。#1043 = **Note ⇄ Todo/Event の変換は実在せず撤去対象ゼロ**だったので tier-1-core の「やらない」に記録する docs PR に切替（PR #1067）。#1047 = ノートテンプレート新規実装 — 専用テーブルではなく `notes_payload.note_type='template'`（migration 0024）・3 点メニュー「テンプレートを作成する」→ `ResponsiveDetailFrame`（Mobile は全画面 = 画面遷移）・タグ / リンクは UI ごと不在（`[[` loader を渡さない）・一覧 / 検索 / 件数 / ゴミ箱から `isNoteTemplateRow` で除外・`listNoteTemplatesUnified` だけが返す。**🛑 #1075 は merge 前に `supabase db push` が要る**）

## 予定

（なし — section:materials の open Issue を消化。次は判断キュー D-20260816-materials-1 の回答待ち、および chat-main からの新規 dispatch 待ち）

## 申し送り

- **#1075（ノートテンプレート）は 2026-08-27 時点で merged**。前提だった `supabase db push`（`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加）が適用済みかどうかは未確認 — 未適用のまま merge されているとテンプレート作成が CHECK 違反で落ちるので、初回利用時に確認が要る
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
