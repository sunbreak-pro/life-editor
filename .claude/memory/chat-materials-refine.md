# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 現在: **0020 / 0021 はリモート適用済みを実測**（2026-08-18 `supabase migration list` — remote 側に 0020・0021 が並んでいる。memory の「push 未実施」記述はここで解消）
- 次: 🛑 残ゲート = `scripts/life_tags_verify.sql` の実行と結果確認のみ（plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- RLS ゲートの誤検知で `db push` が全面ブロックされていた件を修正 ✅（2026-08-18 — **PR #1083 open**（merge = こうだいさん）。`npm run db:push` が Step 1 で `RLS LEAK DETECTED` を出し `supabase@2.115.0` / `Ok to proceed? (y)` を「無防備なテーブル」として列挙していた。**実際の RLS 漏れはゼロ** — `supabase/node_modules` が無いため `npx` が CLI を取得しに行き、確認プロンプトを **stdout**（ゲートが CSV として読む側）へ書いていた。プロンプトに改行が無いので本物の CSV ヘッダがその行末に連結され、`tail -n +2` の位置決め打ちがズレて npx の文言が offender 行に化けた。修正 = (1) `check-rls.sh:113` に `--yes`（`db-push.sh:75` は元から付いていた・付いていない唯一の呼び出しだった）(2) 本体スライスを CSV ヘッダ位置に ancher し直し、ヘッダ不在時は exit 2 = INCONCLUSIVE（従来は空 body → PASS と誤報告しうる穴）。self-test に A7 / A8 / A9 を追加し A1〜A9 緑。**main clone で実 DB に対し `db:check-rls` = PASS を実測**。残る 2 失敗（B* = sqlite3 未導入 / C3 = CRLF チェックアウトに `^from \($` を grep）は変更前後で同一の環境要因）
- known-issues の参照実績を実測し Issue 2 本を起票 ✅（2026-08-18 — #1086（計測スクリプト）/ #1087（採否条件の見直し）。トランスクリプト 784 ファイル走査で (セッション, slug) 重複排除 679 件。うち **1 セッションで 15〜30 slug が出る 16 セッションが 6 割超**を占める `ls` 由来の一括ヒット。targeted（1 セッション 3 件以下）に絞ると 031 = 51 / 027 = 31 / **他は全部 1 桁**で、その上位 2 件も `CLAUDE.md:68` と `memory/chat-main.md` からの自動注入。30 本中 **7 本（004 / 006 / 007 / 010 / 023 / 030 / 033）は参照 0**。今回 023 を読んだが真因は別で 1 回ミスリードされた = 実例として #1087 に記載）
- section:materials の 5 件を全て PR 化 ✅（2026-08-18 — #1041 / #1042 / #1040 / #1043 は **merged**、#1047 は **PR #1075 merged**（2026-08-18 確認）。1 ブランチ 1 Issue で `origin/main` から切り、各本で CI verify（docs-lint / shared / web / desktop / mcp-server）をローカル全通し。#1041 = ja `section.materials` を「資料」→「素材」（PR #1052）。#1042 = ノート詳細のタグ行から `ItemRoleBadge` 撤去（PR #1055）。#1040 = `TodoDetailPanel` の日時行を disclosure 化・`scheduleSet` で日時ありは開いた状態（PR #1064）。#1043 = **Note ⇄ Todo/Event の変換は実在せず撤去対象ゼロ**だったので tier-1-core の「やらない」に記録する docs PR に切替（PR #1067）。#1047 = ノートテンプレート新規実装 — 専用テーブルではなく `notes_payload.note_type='template'`（migration 0024）・3 点メニュー「テンプレートを作成する」→ `ResponsiveDetailFrame`（Mobile は全画面 = 画面遷移）・タグ / リンクは UI ごと不在（`[[` loader を渡さない）・一覧 / 検索 / 件数 / ゴミ箱から `isNoteTemplateRow` で除外・`listNoteTemplatesUnified` だけが返す。**🛑 #1075 は merge 前に `supabase db push` が要る**）

## 予定

（なし — section:materials の open Issue を消化。次は判断キュー D-20260816-materials-1 の回答待ち、および chat-main からの新規 dispatch 待ち）

## 申し送り

- 🛑 **0024 が未適用のまま #1075 が merge されている**（2026-08-18 `supabase migration list` で実測 — local に 0024、remote は空）。`supabase/migrations/0024_notes_template_type.sql` = `note_type` CHECK に `'template'` を追加するもので、**未適用の今はテンプレート作成が CHECK 違反で落ちる状態**。`cd C:/Users/user/orca/life-editor/supabase && npm run db:push`（RLS ゲートは実 DB に対し PASS 実測済み・push 自体はこうだいさんの手番）で解消する。push が通っていたはずの想定は誤りだったので、次セッションはここを最初に確認する
- **`supabase/` は各 clone で `npm install` が要る**（2026-08-18）。未実施だと `npx` が CLI を毎回取得しに行き、そのプロンプトが RLS ゲートの CSV パースを壊す（PR #1083 で頑健化したが、install しておく方が速い）。orca の main clone と materials-refine worktree では実施済み
- **#1040 は解釈を 1 つ置いた**: Issue の「日時の**設定** UI」を Scope + DoD に合わせて Todo 詳細の**読み取り専用の日時行**と読んだ。Todo に日時を実際に書くフォームは `shared/src/components/schedule/ItemCreatePanel.tsx`（schedule レーンの持ち物・#940 で日付と終日スイッチが入ったばかり）だけなので、そちらも畳むなら別 Issue が要る
- `web/tests/briefingNarrowTray.test.tsx` が全 61 suite 同時実行で 1 回だけ落ちた（単独・再実行は緑）。既存のフレーク疑い
