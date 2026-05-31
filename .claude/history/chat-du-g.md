# HISTORY (chat-du-g)

### 2026-05-31 - Notes/Tasks Tree DnD を Desktop TaskTree パターンに統一（PR #38）

#### 概要

Notes の Folder DnD 改善が「末尾にフォルダがあるとその下に項目を置けない」で行き詰まり、自作 `sibling-below`（最後の子の下端で縦ゾーン分割）を撤去して Desktop(frontend) TaskTree の素直なモデル（フォルダ下端 = `moveNode below` = 兄弟化、expanded 特殊ケース無し）へ統一。Web Notes と Web Tasks を同一 DnD ロジック + UI に揃えた。PR #38 merged（計画書: archive/2026-05-30-notes-folder-dnd-ux.md）。

#### 変更点

- **根本修正**: `shared/src/utils/noteDropIntent.ts` を above/below/inside に統一（sibling-below 撤去）。フォルダ `below` = フォルダの兄弟。両ツリーから「expanded folder below → inside（first child）」特殊ケースを削除 → 末尾フォルダ下への兄弟配置が可能に
- **共有化**: `web/src/components/{TreeNodeIndent, treeCollision, TreeDragGhost}` 新設し Notes/Tasks で共有（depth ガイドライン / pointerWithin+rectIntersection / 薄 ghost）
- **統一**: 静止リスト（reflow 無し）/ 薄 ghost カーソル追尾 / Rule 1（展開フォルダ掴み→畳む・cancel 復元）/ グリップ hover / Folder↔chevron hover / accent 線 + inside wash。`web/src/tasks/useTaskTreeDnd.ts`（新規, useNoteTreeDnd ミラー）+ TaskTreeView 全面改修
- **段階**: 薄青ハイライト + 判定緩和 → reflow 撤去 + ghost（「かなり良くなった」）→ sibling-below 試行（脆く失敗）→ TaskTree 統一（最終解）。途中 port 取り違え（メイン worktree 5174=main を見ていた）を lsof cwd 実測で解消
- **品質**: role-engineer 実装 → session-verifier PASS → role-qa 独立監査 APPROVE WITH NITS（要件7件全達成・回帰なし）。QA nit 2件（stale test コメント / `TreeNodeIndent` の `-my-1`→`-my-1.5`）を修正コミット。shared tsc 0 / vitest 235 / web build 0 / eslint 0
- **運用**: feature `feat/notes-folder-dnd-ux` で 2 commit（feat `ba5745a` + nit `3a6cca0`）→ PR #38 → ユーザー merge。本 tracking は merge 後に origin/main 起点の `chore/du-g-tracker-dnd` で記録（squash-merge 済 feature ブランチ再利用＝全 commit 再表示を回避）

### 2026-05-30 - DU-G G4: legacy Notes/Daily 死削除（A-2 Bridge dispatch 撤去）

#### 概要

DU-G の最終フェーズ G4 を実装。ユーザー選択の A-2（Bridge dispatch 層まで撤去）で legacy Notes/Daily の hook / mapper / Context / Bridge を完全削除し Unified 経路へ一本化。新 Multi-chat Worktree Policy proactive 化（PR #33）後の初 worktree セットアップ（4 ステップ 1 セット）の追従い検証も兼ねた。

#### 変更点

- **Worktree**: `.claude/worktrees/du-g/` / branch `feat/du-g-notes-daily-unified` を 4 ステップ 1 セット（`git worktree add` → `cd` → `.session-name` → `.session-branch`）で作成。SessionStart hook 緑（検査 A-F 警告なし）。proactive 規約が機能することを確認
- **A-2 実装**: legacy hook（`useNotesAPI` 718L / `useDailyAPI` 310L）を Unified 名 hook（`useNotesUnifiedAPI` / `useDailiesUnifiedAPI`）へ移設し DataService 呼び出しを `*Unified` 直呼びへ全書換。logic-bearing アダプタ（createNote / createNoteFolder / deleteDaily / toggleDailyPin / syncNoteTree）は hook 層へ helper 化（`buildNoteNode` / `softDeleteDailyByDate` / `toggleDailyPinByDate`）して Bridge から逐語移植
- **Bridge 撤去**: `SupabaseDataService.ts` の Bridge クラス 2（SupabaseDailyService / SupabaseNotesService）+ `PHASE2_DAILY_METHODS` / `PHASE2_NOTES_METHODS` dispatch + route/生成/legacy mapper import を削除（−260 行）。`DataService` interface から legacy 署名 26 個削除
- **削除**: noteMapper / dailyMapper + roundtrip テスト + legacy Context/hook 計 12 ファイル。`useNoteTreeMovement` は Notes 専用ヘルパで保持（grep gate 対象外）
- **検証**: shared `tsc -b` exit 0 / shared vitest 228 pass（password スマグル negative regression test を `notesUnifiedMapper.test.ts` に復活込み）/ web build exit 0 / `git grep -P` legacy シンボル 真の 0（コメント含む）。34 ファイル +1316 −2347、frontend/mcp-server/supabase への越境なし
- **QA**: role-qa 独立監査 NEEDS DISCUSSION → 全件解消（① security regression test 復活 / ② コメント legacy 名を真の 0 へ掃除 / ③ 計画書 Acceptance の grep を `-E "\b"` 偽陰性 → `-P` 修正）
- **計画書**: DU-G 親計画書（`2026-05-25-data-unification-g-notes-daily-unified.md`）に `## G4 Scope` 追記。G1/G2/G3 = PR #29/#30/#31 merged で DU-G 完遂（PR は未作成、本セッション後段で git-orchestrator）
- **知見（known-issue 化候補）**: `git grep -E "\b"` は POSIX ERE が `\b` をバックスペース文字と解釈する偽陰性トラップ。本セッションで 2 回踏んだ（per-symbol カウント / G4 gate）。`-P`（Perl）か `-w`（単語境界）か `([^A-Za-z]|$)` を使う
