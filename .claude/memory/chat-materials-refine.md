# MEMORY (chat-materials-refine)

## 進行中

### ⏸️ life-tags 統一（folder 廃止 → WikiTag 一本化）Materials 領分（着手日: 2026-07-11）

**対象**: `shared/src/types/taskTree.ts` `shared/src/components/Kanban/**` Notes/Daily フォルダツリー UI `supabase/migrations/*.sql`（folder→tag 変換）
**計画書**: `.claude/docs/vision/plans/2026-07-11-life-tags-unification.md`（方向の正本・共有コアは materials-refine が単一書込者）

- 前回: PR #244 提出 → CI green 化（origin/main merge + legacyFolderFilter.test モック追随 457237c8）
- 現在: **PR #244 は 2026-07-11 merge 済み・#225 close 済み**（2026-07-18 確認）。実ブラウザ確認 = chat-main
- 次: 🛑 残ゲート = 実データ変換のみ（ユーザー `supabase db push` 0020 + 0021 + `scripts/life_tags_verify.sql`・plan Step 5）→ 完了時に plan COMPLETED + archive。chat-main へ起票依頼済み: analytics tag 後継集計 / Notes folder 退役 + Connect グラフ後継

## 直近の完了

- #776 inline `[[` リンク配線の 3 つ写しを 1 実装へ ✅（2026-08-13 — **PR #808 open**（Closes #776・merge = こうだいさん）。新規 `web/src/hooks/useInlineItemLinks.ts` に重複ガード / inline エッジ作成 / 保存後 delete-sync を集約し、Notes / Tasks / Daily の 3 面がそこを通る。Daily の park / flush は Daily 固有として残し flush の内側だけ差し替え。console タグはホスト名を引数化（`useTaskLinking` に焼き付いていた `[KanbanView]` の写し痕を解消）。テスト +16 本（共有ガード 8 / Notes 3 / Daily 5 — Daily は park→保存→エッジ と #372 fold のどちらも初カバー）。8 ゲート exit 0）
- #680 Notes の i18n 取りこぼし 3 点（ゴミ箱行 aria-label / 本文 placeholder / en の単複）✅（2026-08-11 — **PR #693 open**（Closes #680・merge = こうだいさん）。catalog に 4 キー追加 + `taskCount` を i18next 複数形へ。ja を実際に描画して読み戻す `web/tests/notesI18n.test.tsx` を新設（既存 notesView.test.tsx は `t` をキーのエコーに差し替えるため、この種のバグに構造的に無反応だった）。en/ja lockstep 検査を shared/tests/i18n.test.ts に追加）
- #588 NotesView 925 行の分割 + materials 3 画面のテスト整備 ✅（2026-08-10 — PR #646 **merge 済み**（2026-08-11 確認・main 7ad31a5e）。テスト 36 本を先に敷いてから 5 ファイルへ分割し、同じテストが前後で緑なのを挙動不変の根拠にした。ホスト 925 → 469 行。実ブラウザ確認は chat-main）

## 予定

- （なし）
