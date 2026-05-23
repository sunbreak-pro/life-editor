---
Status: IN PROGRESS — Phase 1-4 完了 (4-1 archive 移動 / 4-2 deletion-targets 新規 / 4-3 Phase 参照 / 4-4 DataService 関係図 / 4-5 .mcp.json verify=OK) / Phase 5 (検証 + PR 化) 残
Created: 2026-05-23
Updated: 2026-05-24 (Phase 4 完了反映)
Branch: refactor/cleanup-and-consolidation
Worktree: .claude/worktrees/cleanup-and-consolidation
Base: origin/main (rebased from 4ebaff2 → 最新)
Phase relation: 移行 SSOT (2026-05-04-cross-platform-migration.md) と直交する整理レーン
Depends on: -
Next steps: Phase 5 (検証 + PR 化) 着手判断
---

# Plan: Cleanup & Consolidation — 計画書・要件定義・コードの整合性回復

## Context

Web-first 移行（Tauri → Electron + Capacitor + Web + Supabase）が並立期間に入り、ドキュメント・要件定義・コードの 3 層で **重複 / 矛盾 / 未整理** が累積している。今後の Phase 2-5 を健全に進める前に、整理だけを切り出して 1 PR にまとめる。

実装は今回の worktree (`refactor/cleanup-and-consolidation`) で段階的に行う。本ファイルは**計画書のみ**で、実装作業は別セッション。

### 動機（具体的な問題）

1. **計画書 9 + ルート移行 SSOT 1 = 計 10 ファイル**が `.claude/docs/vision/plans/` と `.claude/` 直下に混在し、完了済み / 進行中 / 未着手の判別が plan ファイルの中身を開かないとできない（Status ヘッダ未統一）。
2. **`vision/core.md` と `vision/db-conventions.md`** に「Tauri 2 + Cloudflare D1 前提で反転済み」と失効警告が冒頭に書かれているが、本文はそのまま残り、新規読者が誤った前提で読む危険がある。
3. **`vision/PointGraphView.jsx` (1233 行)** が docs/ 配下に直置きされており、CLAUDE.md にも理由が書かれていない（`.pen` 系の編集ガードルールと混同しうる）。
4. **`vision/desktop-followup.md` (17 行)** が小さすぎて vision の章として機能していない（MEMORY 吸収候補）。
5. **`requirements/ios-additions.md` (33 KB)** が iOS 限定要件として独立しているが、Status 完成済（2026-04-24）で内容は tier-1/2 に吸収すべき。
6. **`tier-1-core.md` / `tier-2-supporting.md` / `tier-3-experimental.md`** が Tauri SQLite + D1 前提の AC で書かれており、Supabase Postgres + RLS への移行注記がない。
7. **`code-inventory.md` (16 KB, 2026-04-25)** が時点スナップショットで、現在の実態（src-tauri = 2.6M / cloud = 164K / .rs = 90 ファイル / `web/` が `frontend/` と並立中）と数値が食い違う。
8. **`vision/coding-principles.md`** と CLAUDE.md §6 が部分重複（IPC 命名・Pattern A・Mobile Optional Provider）。本ファイルは「過去 ADR の要旨統合」の立場だが既に CLAUDE.md に吸収済の項が複数ある。
9. **完了済 plan 2 本**（`2026-05-17-notes-web-parity.md` / `2026-05-16-frontend-refactor-pre-migration.md` の Phase 0-4 部分）が archive 未移動で plans/ に残置。
10. **`archive/SUMMARY.md`** が 5 本の最新 plan の状態を反映していない。

### 制約（並立期間中は触らないこと）

- **`src-tauri/` / `cloud/` / `frontend/` の本体ロジックは触らない**。CLAUDE.md §7（移行 SSOT 参照）と移行 SSOT §7 で「Phase 5 まで並立維持」と明文化されているため、本計画でも削除は禁止。**特定とリスト化までに留める**。
- **`root/package.json` の `dev` / `build` script は Tauri のまま維持**。移行 SSOT の Phase 完了時に一括変更。
- **`.mcp.json`（git 追跡対象）のトークン参照は `${...}` プレースホルダのまま**。CLAUDE.md §9 と MEMORY の既知問題（2026-05-17 GitHub Push Protection ブロック）に従う。確認のみ。
- **`2026-05-21-data-unification-items-meta.md`（54 KB の DU 計画）は改変しない**。別軸レーンとして並走。
- **`.claude/CLAUDE.md` は 400 行以下を目標**。本計画で `vision/` から CLAUDE.md へ統合する際は分量に注意し、超過しそうなら別ファイルへ。

### Non-Goals

- Phase 5 の最終削除作業（`src-tauri/` / `cloud/` / `@tauri-apps/*` の物理削除）→ 移行 SSOT 側
- 新機能追加 / Data Unification の設計変更
- 新スタック向け Identity / DB 規約の確定（Phase 5 で実施。本計画は archive 整理まで）
- MEMORY.md / HISTORY.md の整理（task-tracker 経由でしか触らない既定ルール）

---

## Phases & Steps

### Phase 1: 完了済み計画書の archive 移動と Status 統一（リスク: 低）

- [x] 1-1. `.claude/docs/vision/plans/2026-05-17-notes-web-parity.md` を `.claude/archive/` に移動（archive/plans/ ではなく直下が慣習）。Status は既存 PR1 COMPLETE 文言を維持しつつ `ARCHIVED` を先頭に付加、`Archived: 2026-05-23` を追記。
- [x] 1-2. **対象変更**: 元計画の `frontend-refactor-pre-migration.md` は実態が Phase 3-1/3-2 進行中で archive 不可。代わりに `2026-05-17-s4-schedule-migration.md`（Status: COMPLETE 明記済）を archive へ移動。S8 delta 申し送り 6 項は archive ファイル本体に保持。
- [x] 1-3. **スコープ縮小**: 機械的なヘッダ統一は次の整理レーンで扱う。Phase 1 では「Status 行が無い plan の Status 追加」に限定。具体的には `01_要件定義書_プロトタイプ環境.md` に `Status: SPECIFICATION` を追加（Phase 1-5 と合わせて実施）。`02_実装計画書_プロトタイプ環境.md` は既存 `**Status**: NOT_STARTED` を保持。残り 12 plan は現状 Status 表現を尊重。
- [x] 1-4. `.claude/archive/SUMMARY.md` を更新し、1-1 / 1-2 で archive した 2 本を追加。`計画書状況スナップショット (2026-05-23 時点)` セクションを末尾に追記し、現役 plan 13 + 本計画書 1 = 14 件の Status / Branch / 種別を表形式で記載。
- [x] 1-5. `.claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md` と `02_実装計画書_プロトタイプ環境.md` の冒頭に「`prototype/mobile-ui` worktree 専用 / 完成後は `prototype/README.md` 統合予定」の注記を追加。01* には Status 行を新規追加（Phase 1-3 と統合）、02* は既存 Status を維持しつつ説明を補強。

### Phase 2: vision/ ディレクトリの構造整理（リスク: 低〜中）

- [x] 2-1. `vision/PointGraphView.jsx` を **`docs/code-examples/PointGraphView.demo.jsx` へ移動**（md 埋め込みは 1233 行で可読性低下のため不採用）。`point-view-implementation-plan.md` 内の参照 4 箇所を新パスに更新。
- [x] 2-2. `vision/desktop-followup.md` (17 行) を **`archive/desktop-followup-2026-04.md` へ移動**（MEMORY 吸収はルール違反のため archive へ変更）。残課題 3 件（Materials / Notes (Node) / Board）は移行後にあらためて plan 化される想定。
- [x] 2-3. `vision/point-view-implementation-plan.md` を `vision/plans/2026-04-25-point-view.md` に rename（feature 計画書としての位置付けを明示）。冒頭メタに Status 行を追加し、jsx 参照を新パスに更新。
- [x] 2-4. `vision/core.md` の §1 / §3 V2 / §4 / §5 に **章先頭の反転点マーク**を追加。冒頭警告 (§0 相当) との二重化で「新規読者が誤った前提で読む」リスクを低減。本格的な書き換えは Phase 5。
- [x] 2-5. **スコープ変更**: `vision/db-conventions.md` (290 行) に §10 (Supabase 規約 draft) は実在しなかったため、**全体を `archive/db-conventions-tauri-era.md` に移動**。Supabase 規約は Phase 5 で新規作成する。並立期間中、現行 Tauri/D1 コードに対しては archive 版を参照する旨を `coding-principles.md` のリンクに明記。
- [x] 2-6. **スコープ縮小**: `vision/coding-principles.md` は既に各章で「詳細規約は CLAUDE.md §X.X」と明示しており、役割分担は機能している（重複ではなく「なぜ」の保存）。よって機械的な節削除は不要。**§1 Tauri IPC 命名のみ「Phase 5 で全削除予定」マークを追加**。§2-6 は保持。

### Phase 3: requirements/ と移行 SSOT の整合（リスク: 中）

- [x] 3-1. **スコープ縮小（AC 単位 → Feature 単位）**: `requirements/tier-1-core.md` の主要 6 Feature (Tasks / Schedule / Notes / Memo / Database / Cloud Sync) の冒頭メタブロック (`**Supports Value Prop**` 直後) に `**Stack** (2026-05-24 並立期): <current> → <target> (<移行 Phase>)` を追加。MCP Server / Terminal は次フェーズで扱う。AC 単位は過剰のため Feature 単位に縮小。Database 遅延注記もここで併記（Phase 1 で延期、Phase 5 後再開予定）。
- [x] 3-2. **スコープ縮小（12 Feature 個別 → 冒頭一括注記）**: `requirements/tier-2-supporting.md` の冒頭 (`**Tier 2 機能数**` 直後) に **Stack 一括注記**を追加。Frontend 完結機能の移行方針 + Desktop 専用例外 (Audio Mixer / File Explorer / Shortcuts) + DU 吸収予定 (WikiTags) + Tier 1 連動移植 (Templates / UndoRedo / Trash) を 1 ブロックで記載。
- [x] 3-3. `requirements/tier-3-experimental.md` の Cognitive Architecture (ADR-0005) セクション末尾に「ADR を作らない方針への移行を反映、Phase C で実装着手 vs 永続 Frozen を判定」注記を追加。
- [x] 3-4. **方針変更（統合 archive → 保持 + リンク参照）**: `requirements/ios-additions.md` (33 KB) は archive せず保持。冒頭に `**Status: ALL DONE** (G-1 / G-2 / G-3 全要件 2026-04-24 実装完了)` マークと「Capacitor 移行 (Phase 4) で再評価」注記を追加。各 Tier への統合リンクを冒頭に併記（G-1 = UndoRedo / G-2 = Cloud Sync / G-3 = Schedule / Layout）。
- [x] 3-5. `requirements/README.md` の `CLAUDE.md §11 との同期`セクション直後に「**Stack 並立期間中の追加ルール**」を新節追加。書式: `Stack: <現行> → <移行先> (<移行 Phase>)`。AC 単位ではなく Feature 単位（3-1 のスコープ縮小と整合）。

### Phase 4: code-inventory と コード残骸リスト化（削除はしない）

- [x] 4-1. `docs/code-inventory.md` を `archive/code-inventory-2026-04-25.md` へ移動。冒頭に ARCHIVED マーク + Web 移行による実態変化注記 + deletion-targets への参照リンク追加。死コード探索は git + 自動ツール (knip / ts-prune) に委譲する旨を明記。
- [x] 4-2. 新規ファイル [`2026-05-23-cleanup-and-consolidation-deletion-targets.md`](./2026-05-23-cleanup-and-consolidation-deletion-targets.md) を作成。削除対象を Tier A (Backend 全体) / Tier B (Frontend Tauri 依存層) / Tier C (依存パッケージ + scripts) の 3 階層で整理。
- [x] 4-3. deletion-targets.md の各項目に「移行 SSOT Phase X 参照」列を追加。実削除は本ファイルではなく移行 SSOT 側で行う旨を冒頭で明示。Phase 5 実削除時のチェックリストも併記。
- [x] 4-4. deletion-targets.md 内に **DataService 層の関係図** を ASCII art で記載。`frontend/src/services/data/` 19 domain ファイル ↔ TauriDataService ↔ SupabaseDataService の対応を可視化。DataService interface は CLAUDE.md §3.1 の恒久境界として維持する旨を併記。
- [x] 4-5. `.mcp.json` を verify。`life-editor` MCP (DB_PATH / FILES_ROOT_PATH 絶対パスのみ、トークン無し) + `supabase` MCP (`SUPABASE_ACCESS_TOKEN: "${SUPABASE_ACCESS_TOKEN}"` プレースホルダ形式 + `--read-only` フラグ) ともに **CLAUDE.md §9 ルール準拠**。変更不要、現状維持。verify 結果を deletion-targets.md に記録。

### Phase 5: 検証と PR 化

- [ ] 5-1. 全 plan ファイルの Status ヘッダが統一されている (Phase 1-3 で `grep "^Status:" .claude/docs/vision/plans/*.md` ですべて hit)。
- [ ] 5-2. `vision/` 配下にコード本体 (`.jsx` / `.tsx` / `.ts`) が存在しない (`find .claude/docs/vision -type f \! -name '*.md'` で 0 件)。
- [ ] 5-3. `requirements/ios-additions.md` が消え、`tier-*.md` 内に Mobile Support 節が追加されている。
- [ ] 5-4. `archive/SUMMARY.md` が最新 plan 状態を反映 (2026-05-23 セクションあり)。
- [ ] 5-5. `code-inventory.md` が archive に移動済。
- [ ] 5-6. CLAUDE.md / 移行 SSOT の本文には変更がない（並立期間中は変更しないため）。
- [ ] 5-7. `frontend/` / `src-tauri/` / `cloud/` のコードに変更がない（コードは Phase 5 = 移行 SSOT で対応）。
- [ ] 5-8. 全変更を `refactor/cleanup-and-consolidation` ブランチに commit。1 PR でまとめる（task-tracker → git-orchestrator）。

---

## Files

| File                                                                                 | Operation                                              | Notes                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `.claude/docs/vision/plans/2026-05-17-notes-web-parity.md`                           | ✅ Move → `archive/`                                   | Status: ARCHIVED 追記済 (Phase 1-1)                                                        |
| `.claude/docs/vision/plans/2026-05-17-s4-schedule-migration.md`                      | ✅ Move → `archive/`                                   | Status: ARCHIVED 追記済 (Phase 1-2 — frontend-refactor の代替で archive 化)                |
| `.claude/docs/vision/plans/2026-05-16-frontend-refactor-pre-migration.md`            | Keep (Phase 3 進行中)                                  | Phase 5 は別計画書に分離済。本ファイルは Phase 3-1/3-2 を継続中                            |
| `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`                      | Keep (Status: NOT STARTED 明記済)                      | 移行 SSOT Phase 2 詳細展開                                                                 |
| `.claude/docs/vision/plans/2026-05-16-phase5-giant-component-decomposition.md`       | Keep (Status: Carry-over 明記済)                       | 承認待ち                                                                                   |
| `.claude/docs/vision/plans/2026-05-16-reminders-rich-editor-connect.md`              | Keep (Status: IN PROGRESS 明記済)                      | 要件3完了 / UI 系は designer スキル待ち                                                    |
| `.claude/docs/vision/plans/2026-05-17-ui-ux-quality-remediation.md`                  | Keep (Status: In-progress 明記済)                      | M0 完 / M1 進行中                                                                          |
| `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`                | Keep (Status: PLANNING v3 明記済)                      | DU 親計画                                                                                  |
| `.claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md`                   | Keep (Status: DRAFT v3-rev3 明記済)                    | DU-B 子計画 / 再 apply 待ち                                                                |
| `.claude/docs/vision/plans/2026-05-23-data-unification-b3-onwards-impl.md`           | Keep (Status: DRAFT 明記済)                            | DU-B-3〜B-6 詳細実装                                                                       |
| `.claude/docs/vision/plans/2026-05-23-filechanged-comm-watch.md`                     | Keep (Status: DRAFT 明記済)                            | comm FileChanged 監視レイヤー追加                                                          |
| `.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md`              | Keep (Status: DRAFT 明記済)                            | MEMORY/HISTORY per-chat 化                                                                 |
| `.claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md`                        | ✅ Edit                                                | Status: SPECIFICATION 追加 + prototype worktree 専用注記 (Phase 1-3 + 1-5)                 |
| `.claude/docs/vision/plans/02_実装計画書_プロトタイプ環境.md`                        | ✅ Edit                                                | 既存 Status を保持しつつ prototype worktree 専用注記を補強 (Phase 1-5)                     |
| `.claude/docs/vision/PointGraphView.jsx`                                             | ✅ Move → `docs/code-examples/PointGraphView.demo.jsx` | md 埋め込みではなく独立 .jsx として保持 (Phase 2-1)                                        |
| `.claude/docs/vision/desktop-followup.md`                                            | ✅ Move → `archive/desktop-followup-2026-04.md`        | MEMORY 吸収はルール違反のため archive へ (Phase 2-2)                                       |
| `.claude/docs/vision/point-view-implementation-plan.md`                              | ✅ Move → `vision/plans/2026-04-25-point-view.md`      | feature 計画書として再分類 + jsx 参照を新パスに更新 (Phase 2-3)                            |
| `.claude/docs/vision/core.md`                                                        | ✅ Edit                                                | §1 / §3 V2 / §4 / §5 に章先頭マーク追加 (Phase 2-4)                                        |
| `.claude/docs/vision/db-conventions.md`                                              | ✅ Move → `archive/db-conventions-tauri-era.md`        | §10 (Supabase 規約 draft) は実在しなかったため全体移動 (Phase 2-5)                         |
| `.claude/docs/vision/coding-principles.md`                                           | ✅ Edit                                                | §1 Tauri IPC 命名のみ「Phase 5 で全削除予定」マーク追加 (Phase 2-6 縮小版)                 |
| `.claude/docs/requirements/tier-1-core.md`                                           | ✅ Edit                                                | 主要 6 Feature (Tasks/Schedule/Notes/Memo/Database/Cloud Sync) に Stack 行追加 (Phase 3-1) |
| `.claude/docs/requirements/tier-2-supporting.md`                                     | ✅ Edit                                                | 冒頭に Stack 一括注記追加 (Phase 3-2 — 12 Feature × 行ではなく一括化)                      |
| `.claude/docs/requirements/tier-3-experimental.md`                                   | ✅ Edit                                                | Cognitive Architecture 末尾注記追加 (Phase 3-3)                                            |
| `.claude/docs/requirements/ios-additions.md`                                         | ✅ Edit (保持方針)                                     | Status: ALL DONE マーク + 各 Tier への統合リンク追加 (Phase 3-4 方針変更)                  |
| `.claude/docs/requirements/README.md`                                                | ✅ Edit                                                | Stack 並立期 AC ルール追加 (Phase 3-5 — Feature 単位記入)                                  |
| `.claude/docs/code-inventory.md`                                                     | ✅ Move → `archive/code-inventory-2026-04-25.md`       | ARCHIVED マーク + deletion-targets 参照リンク追加 (Phase 4-1)                              |
| `.claude/archive/SUMMARY.md`                                                         | ✅ Edit                                                | 2026-05-23 追加分セクション + 計画書状況スナップショット (Phase 1-4)                       |
| `.claude/docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md` | ✅ Create                                              | Tier A/B/C 削除対象 + DataService 関係図 + .mcp.json verify (Phase 4-2〜5)                 |

**触らないファイル（守るべき境界）**

| File                                                                  | Reason                                    |
| --------------------------------------------------------------------- | ----------------------------------------- |
| `.claude/CLAUDE.md`                                                   | 400 行制約 + 並立期は変更しない           |
| `.claude/2026-05-04-cross-platform-migration.md`                      | 移行 SSOT。本計画と直交                   |
| `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md` | DU 別軸レーン                             |
| `.claude/MEMORY.md` / `.claude/HISTORY.md`                            | task-tracker 経由でしか触らない           |
| `.mcp.json`                                                           | 読み取りのみ。プレースホルダ形式の verify |
| `src-tauri/` / `cloud/` / `frontend/src/services/*.ts` 本体           | 並立期は維持。Phase 5 で削除              |
| `root/package.json` の scripts                                        | 並立期は Tauri 起動のまま                 |

---

## Verification

- [ ] **plan 状態の透明性**: `grep -l "^Status:" .claude/docs/vision/plans/*.md` で全 plan が hit する。
- [ ] **vision のコード直置きなし**: `find .claude/docs/vision -type f \! -name '*.md' -not -path '*/plans/*'` が空。
- [ ] **要件と現実装の整合**: `tier-1-core.md` の Tasks / Daily / Notes / Schedule AC に Supabase 移行注記がある。
- [ ] **iOS 要件の統合**: `requirements/ios-additions.md` が存在しない (`test ! -e .claude/docs/requirements/ios-additions.md`)。
- [ ] **archive の網羅性**: `archive/SUMMARY.md` が 2026-05-23 時点の plan 状態をリストアップ。
- [ ] **コード本体の不変性**: `git diff main -- frontend/ src-tauri/ cloud/ shared/ supabase/ web/` がドキュメント以外で空。
- [ ] **CLAUDE.md 不変**: `git diff main -- .claude/CLAUDE.md` が空、もしくは Document System 章の参照リンク更新のみ。
- [ ] **type check pass**: `cd frontend && npm run build` がコード変更なしで pass（既存 baseline 維持）。
- [ ] **MEMORY 不変**: `git diff main -- .claude/MEMORY.md .claude/HISTORY.md` が空（task-tracker で別途反映）。
- [ ] **PR で 1 つにまとまる**: 全変更が `refactor/cleanup-and-consolidation` 上で 1 PR。Phase 1 / 2 / 3 / 4 は別 commit で分けるが PR は 1 本。

---

## Risk Notes

1. **Phase 2-5 の `db-conventions.md` 分割**: §10 (Supabase) は draft のため、archive 移動後に「現役の Supabase 規約が消えた」と誤解される可能性。**移動前に §10 の自己完結性を確認**し、足りない部分は移行 SSOT へのリンクで補完。
2. **Phase 2-6 の `coding-principles.md` 縮減**: CLAUDE.md と重複する 4 件を削除する際、本ファイルが ADR 代替として機能している側面（「なぜそう書くか」の背景）を保持。**機械的な diff ではなく、各項の保持/削除を 1 件ずつ判断**。
3. **Phase 3-4 の iOS 統合**: 33 KB を tier-1/2 に分散する際、各機能の Mobile Support 節が肥大化する。**1 節 200 行を超える場合は別ファイル化を再検討**。
4. **Phase 1-3 の Status ヘッダ統一**: 既存 plan のヘッダ書式が揃っていないため、機械置換ではなく目視で 7 本確認。
5. **commit 粒度**: Phase ごとに 1 commit、Phase 内のステップを 1 ファイル変更 = 1 commit にする必要は無い（軽い）。レビュー容易性優先で 1 Phase = 1 commit。

## 完了後の遷移

1. PR を作成し、main 取り込み（git-orchestrator）。
2. 本計画書を `archive/plans/2026-05-23-cleanup-and-consolidation.md` に移動。Status を COMPLETED に。
3. `archive/SUMMARY.md` に本計画の総括を追加。
4. 残る課題（Phase 5 = 物理削除）は移行 SSOT 側のチェックリストに移譲。
