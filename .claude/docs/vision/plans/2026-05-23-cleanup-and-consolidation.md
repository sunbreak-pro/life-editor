---
Status: DRAFT
Created: 2026-05-23
Updated: 2026-05-23
Branch: refactor/cleanup-and-consolidation
Worktree: .claude/worktrees/cleanup-and-consolidation
Base: main @ 4ebaff2
Phase relation: 移行 SSOT (2026-05-04-cross-platform-migration.md) と直交する整理レーン
Depends on: -
Next steps: ユーザー承認 → Phase 1 (ドキュメント整理) から着手
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

- [ ] 1-1. `.claude/docs/vision/plans/2026-05-17-notes-web-parity.md` を `.claude/archive/plans/` に移動。ファイル冒頭の Status を `COMPLETED` に更新、`Archived: 2026-05-23` を追記。
- [ ] 1-2. `.claude/docs/vision/plans/2026-05-16-frontend-refactor-pre-migration.md` を archive へ移動。Phase 5 部分はすでに `2026-05-16-phase5-giant-component-decomposition.md` に分離済みのため、本ファイルは Phase 0-4 完結扱い。
- [ ] 1-3. 残る plan 全 7 本に **Status ヘッダ 6 行を統一適用**（Status / Created / Updated / Branch / Phase relation / Depends on / Next steps）。既存ヘッダがある場合は欠落フィールドを追記。
- [ ] 1-4. `.claude/archive/SUMMARY.md` を更新し、1-1 / 1-2 で archive した 2 本を追加。最新の plan 状態スナップショット（2026-05-23 時点）を末尾に追記。
- [ ] 1-5. `.claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md` と `02_実装計画書_プロトタイプ環境.md` に「prototype/mobile-ui worktree 専用 / 完成後は `prototype/README.md` 統合予定」の注記を冒頭に追加（現状は plans/ に置くがスコープが他と異なる）。

### Phase 2: vision/ ディレクトリの構造整理（リスク: 低〜中）

- [ ] 2-1. `vision/PointGraphView.jsx` (1233 行) を `vision/point-view-implementation-plan.md` 内に「§A: 確定済デモコード」セクションとしてコードブロックで埋め込み、`.jsx` ファイル自体は削除。あるいは `docs/code-examples/PointGraphView.demo.jsx` へ移動。決定は実装時。
- [ ] 2-2. `vision/desktop-followup.md` (17 行) の内容を MEMORY.md の該当 entry にマージし、ファイル削除。
- [ ] 2-3. `vision/point-view-implementation-plan.md` を `vision/plans/2026-XX-XX-point-view.md` に rename（feature 計画書としての位置付けを明示）。vision/ には残さない。具体的な日付は git 履歴から推定。
- [ ] 2-4. `vision/core.md` の冒頭失効警告セクション (§0) を残しつつ、本文 §1 Elevator Pitch などは「(凍結: Tauri 2 時代の記述。新スタック版は Phase 5 で確定)」と各章先頭にマーク。Phase 5 で本格書き換え。
- [ ] 2-5. `vision/db-conventions.md` の §1-9（SQLite + D1 + versioned tables 規約）を `archive/db-conventions-tauri-era.md` に丸ごと移動。`vision/db-conventions.md` には §10 (Supabase 規約 draft) を残し「Phase 5 で完成」と明記。
- [ ] 2-6. `vision/coding-principles.md` のうち CLAUDE.md §6 と完全重複する項（Pattern A / Mobile Optional Provider / IPC 命名 5 件中 ADR 吸収済 4 件）を本文から削除。残った項目は「設計判断の背景」セクションに集約。

### Phase 3: requirements/ と移行 SSOT の整合（リスク: 中）

- [ ] 3-1. `requirements/tier-1-core.md` の各機能 AC に「Stack」行を追加（例: `Tasks` → `Stack: Tauri SQLite (current) → Supabase Postgres (Phase 2 移行中)`）。Phase 2 進行中の Tasks / Daily / Notes / Schedule はとくに明示。
- [ ] 3-2. `requirements/tier-2-supporting.md` の Database 系（properties / rows / cells）に「実装遅延中（Phase 1 で延期）」注記を追加。MCP カバレッジ表は維持。
- [ ] 3-3. `requirements/tier-3-experimental.md` に Cognitive Architecture を **追加せず**（ADR 不使用ルールのまま）、`docs/vision/cognitive-architecture.md` 等の独立ファイル化を Phase C で再評価する旨を末尾に注記。
- [ ] 3-4. `requirements/ios-additions.md` (33 KB) の内容を tier-1-core.md / tier-2-supporting.md の各機能の「Mobile Support」サブセクションに統合（G-1 / G-2 / G-3 を各 Tier の該当機能に振り分け）。統合完了後、`ios-additions.md` を `archive/requirements-ios-additions-2026-04-24.md` に移動。
- [ ] 3-5. `requirements/README.md` の Tier 定義ルールに「Tier ファイルは Stack 並立期間中、`Stack: <current> → <target>` 行を AC ごとに持つ」を追加。

### Phase 4: code-inventory と コード残骸リスト化（削除はしない）

- [ ] 4-1. `docs/code-inventory.md` を一旦廃止（archive へ移動）。理由: 時点スナップショットは git で十分。代わりに「死コード特定の自動化」を移行 SSOT Phase 5 のチェックリストに追加。
- [ ] 4-2. 新規ファイル `.claude/docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md` を作成し、Phase 5 で削除予定の対象をリスト化:
  - `src-tauri/` (2.6 MB, .rs × 90)
  - `cloud/` (164 KB, migration × 7)
  - `frontend/src/services/TauriDataService.ts`
  - `frontend/src/services/bridge.ts` (tauriInvoke)
  - `frontend/src/services/events.ts` (動的 import `@tauri-apps/api/event`)
  - `frontend/src/services/terminalBridge.ts`
  - `tauri.conf.json` (src-tauri 配下)
  - root `package.json` の `@tauri-apps/cli`, `dev`/`build` scripts
  - frontend `package.json` の `@tauri-apps/api`
- [ ] 4-3. 上記リストの各項目に「移行 SSOT Phase X 参照」リンクを併記。実削除は移行 SSOT 側で行う。
- [ ] 4-4. `frontend/src/services/data/` 配下の 19 domain ファイル（calendars / daily / databases / files / misc / notes / paper / playlists / routines / scheduleItems / sidebar / sound / sync / system / tasks / templates / timeMemos / timer / wikiTags）と TauriDataService.ts / SupabaseDataService（移行先）の関係を 1 図にまとめ、削除対象リストに添付（コード変更なし、ドキュメントのみ）。
- [ ] 4-5. `.mcp.json` を読み取り、`SUPABASE_ACCESS_TOKEN` 等の Supabase 系参照が存在するか確認（現時点では life-editor MCP のみ）。存在する場合は `${...}` 形式であることを verify。逸脱があれば即座に修正提案を記載。

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

| File                                                                                 | Operation                                                 | Notes                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------- |
| `.claude/docs/vision/plans/2026-05-17-notes-web-parity.md`                           | Move → `archive/plans/`                                   | Status を COMPLETED に                       |
| `.claude/docs/vision/plans/2026-05-16-frontend-refactor-pre-migration.md`            | Move → `archive/plans/`                                   | Phase 5 は別計画書に分離済み                 |
| `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md`                      | Edit (header only)                                        | Status ヘッダ統一                            |
| `.claude/docs/vision/plans/2026-05-16-phase5-giant-component-decomposition.md`       | Edit (header only)                                        | Status ヘッダ統一                            |
| `.claude/docs/vision/plans/2026-05-17-s4-schedule-migration.md`                      | Edit (header only)                                        | Status ヘッダ統一 (COMPLETE)                 |
| `.claude/docs/vision/plans/2026-05-17-ui-ux-quality-remediation.md`                  | Edit (header only)                                        | Status ヘッダ統一                            |
| `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`                | Edit (header only)                                        | Status ヘッダ統一 (PLANNING)                 |
| `.claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md`                        | Edit                                                      | 冒頭に prototype worktree 専用注記           |
| `.claude/docs/vision/plans/02_実装計画書_プロトタイプ環境.md`                        | Edit                                                      | 冒頭に prototype worktree 専用注記           |
| `.claude/docs/vision/PointGraphView.jsx`                                             | Delete (内容は plan に埋め込み)                           | docs/ 直下に .jsx を残さない                 |
| `.claude/docs/vision/desktop-followup.md`                                            | Delete (内容は MEMORY に吸収)                             | 17 行のためファイル不要                      |
| `.claude/docs/vision/point-view-implementation-plan.md`                              | Move → `plans/YYYY-MM-DD-point-view.md`                   | feature 計画書として再分類                   |
| `.claude/docs/vision/core.md`                                                        | Edit                                                      | 各章に「凍結: Tauri 2 時代の記述」マーク     |
| `.claude/docs/vision/db-conventions.md`                                              | Split                                                     | §1-9 を archive へ、§10 のみ残す             |
| `.claude/docs/vision/coding-principles.md`                                           | Edit                                                      | CLAUDE.md §6 と重複する 4 件削除             |
| `.claude/docs/requirements/tier-1-core.md`                                           | Edit                                                      | 各 AC に `Stack:` 行追加 + Mobile Support 節 |
| `.claude/docs/requirements/tier-2-supporting.md`                                     | Edit                                                      | Database 系に遅延注記 + Mobile Support 節    |
| `.claude/docs/requirements/tier-3-experimental.md`                                   | Edit                                                      | Cognitive Architecture 末尾注記のみ          |
| `.claude/docs/requirements/ios-additions.md`                                         | Move → `archive/requirements-ios-additions-2026-04-24.md` | 内容は tier-1/2 に統合済                     |
| `.claude/docs/requirements/README.md`                                                | Edit                                                      | Stack 並立期の AC ルール追加                 |
| `.claude/docs/code-inventory.md`                                                     | Move → `archive/code-inventory-2026-04-25.md`             | 時点スナップショット                         |
| `.claude/archive/SUMMARY.md`                                                         | Edit                                                      | 2026-05-23 セクション追加                    |
| `.claude/docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md` | Create                                                    | Phase 5 削除予定の生リスト                   |

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
