# Decisions Index

> **生成物 — 手編集禁止。** 再生成: `node .claude/scripts/records.mjs index`。正本 = 本ディレクトリの `D-*.md`（未決 = `comm/decisions/chat-*.md` キュー）。merge で衝突したら中身を読まず再生成で上書きする（→ [`README.md`](./README.md)）。

## Open（キュー — 回答待ち）

| ID | 問い | chat |
| --- | --- | --- |
| D-20260730-sched-1 | 編集パネルで日付を変えたとき、カレンダーを移動先の日へ飛ばすか | schedule-refine |
| D-20260731-sched-2 | #468 の台帳フィルタに「予定へタグを付ける導線」を同梱するか | schedule-refine |
| D-20260731-sched-3 | 台帳フィルタをタスクチップにも効かせるか | schedule-refine |
| D-20260801-sched-2 | Connect グラフのダブルクリックを「開く」に返すか、d3 の拡大のまま残すか | schedule-refine |
| D-20260802-sched-1 | outbox エントリを実装 PR に同梱するか、tracker と同様に merge 後へ回すか | schedule-refine |
| D-20260802-settings-1 | briefing の見出し serif を Settings のフォント設定にどこまで追従させるか（#556） | settings-refine |
| D-20260804-main-1 | Phase 1 定期実行（朝 digest / 夜間安全レーン）の実行基盤をどれにするか | main |
| D-20260809-main-2 | `archive/` の索引をどう再建するか | main |
| D-20260810-main-3 | STALE な旧アーキ由来スキル 5 本を書き直すか retire するか | main |
| D-20260810-mobile-1 | narrow から書き換えられる「タグの色」を残すか塞ぐか | mobile-refine |
| D-20260810-mobile-2 | 「Consumption = 編集不可」の語を実態に寄せるか、実装を絞るか | mobile-refine |
| D-20260810-mobile-3 | Notes の FAB を本当に画面へ貼り付けるために、Materials のスクロール所有権を動かすか | mobile-refine |
| D-20260811-refactor-1 | Analytics の「今週」が 2 つの意味で併存しているが、揃えるか？ | refactor-core |
| D-20260811-refactor-2 | `window.confirm` を自前ダイアログに置き換えるか（計画書 §C3 PR 4 の 1 項目） | refactor-core |
| D-20260811-sched-1 | #625 Event → Todo で日付・時間帯を Todo のチップスロットへ引き継ぐか（D-20260810-sched-3 の緩和提案） | schedule-refine |
| D-20260811-sched-2 | #692 Mobile 月ビューの入口をどの形にするか（#467 が消した切替の部分復活） | schedule-refine |

## Active（現在有効な裁定 — superseded-by なし）

| ID | 問い | 回答 | 日付 | topics |
| --- | --- | --- | --- | --- |
| [D-20260607-main-1](./D-20260607-main-1.md) | UI 部品の集約先を `shared/` にするか配布形態ごとに持つか | 案 A（shared/ 集約） | 2026-06-07 | architecture, shared-ui, cross-platform |
| [D-20260704-main-1](./D-20260704-main-1.md) | Phase 5-A で汎用 Database と File Explorer をどうするか | 汎用 DB は凍結・File Explorer は退役 | 2026-07-04 | scope-cut, database, file-explorer, migration |
| [D-20260705-main-1](./D-20260705-main-1.md) | アプリ内 Terminal を存続させるか機能ごと退役するか | 機能ごと退役 | 2026-07-05 | scope-cut, terminal, mcp, retire |
| [D-20260708-main-1](./D-20260708-main-1.md) | `life-editor-ipc-validator` エージェントを retire するか作り替えるか | retire | 2026-07-08 | agents, retire, migration |
| [D-20260711-main-1](./D-20260711-main-1.md) | Routine を UI 上の独立アイテム型にするか実装詳細に隠すか | 実装詳細に隠す | 2026-07-11 | data-model, routine, schedule, ux |
| [D-20260723-main-1](./D-20260723-main-1.md) | 画面別 Mobile スコープの正本をどこに置くか（#319） | mobile-scope.md を正本にする | 2026-07-25 | mobile, requirements, ssot |
| [D-20260728-main-2](./D-20260728-main-2.md) | `noteDropIntent.ts` を退役するか残置するか | A | 2026-07-28 | dead-code, refactor |
| [D-20260728-main-3](./D-20260728-main-3.md) | #368 のスコープをどうするか | A | 2026-07-28 | scope-cut, tasks |
| [D-20260730-mobile-1](./D-20260730-mobile-1.md) | モバイルの 3 択タッチ行を維持するか | A | 2026-08-01 | mobile, ux, touch |
| [D-20260730-mobile-2](./D-20260730-mobile-2.md) | `BottomSheet` の閉じ方をどうするか | B | 2026-08-01 | mobile, ux, bottom-sheet |
| [D-20260730-mobile-3](./D-20260730-mobile-3.md) | モバイルのパスワード付きノートのロック範囲をどうするか | B | 2026-08-01 | mobile, notes, lock, ux |
| [D-20260730-tags-1](./D-20260730-tags-1.md) | ClaudeDesign fan-out 計画書を完了扱いにして UI 設計の追跡正本を付け替えるか | A | 2026-08-01 | docs, design-tracking, plans-lifecycle |
| [D-20260731-main-2](./D-20260731-main-2.md) | `[all]` shared-fix Issue の二重着手をどう防ぐか | A | 2026-08-01 | issue-dispatch, shared-fix, worktree, routing |
| [D-20260731-tags-2](./D-20260731-tags-2.md) | #499（materials の全件 GET 削減）をどこまでやって着地とするか | A | 2026-07-31 | sync, performance, materials |
| [D-20260731-tags-3](./D-20260731-tags-3.md) | MaterialsCountsBridge の件数クエリ化を #499 に含めるか | B | 2026-07-31 | sync, performance, materials |
| [D-20260801-main-1](./D-20260801-main-1.md) | 1 レーンが多ブランチを並行させたときの tracker ファイル衝突をどうするか | A | 2026-08-01 | tracker, merge-conflict, worktree, branch |
| [D-20260801-main-2](./D-20260801-main-2.md) | `archive/` の Status 表記に plans/ の enum を適用するか | A | 2026-08-01 | docs, status-enum, archive |
| [D-20260801-sched-1](./D-20260801-sched-1.md) | パレットから予定へ移動したとき、掛かっているカレンダーレンズをどうするか（#520） | A | 2026-08-01 | schedule, calendar-lens, palette, ux |
| [D-20260804-main-2](./D-20260804-main-2.md) | P-001 を機械側でどう担保するか（`git-workflow` スキルの自動マージ規定との衝突解消） | A+C | 2026-08-06 | merge-gate, policy, permissions, harness |
| [D-20260806-main-1](./D-20260806-main-1.md) | 自律運転の到達点で P-001（merge は常にユーザー）をどこまで緩めるか | B | 2026-08-06 | autonomy, merge-gate, policy, loop |
| [D-20260806-main-2](./D-20260806-main-2.md) | コンテキスト固定費の削減 Scope にグローバル資産（`~/.claude/`）を含めるか | A | 2026-08-06 | context-cost, global-assets, scope |
| [D-20260806-main-3](./D-20260806-main-3.md) | CLAUDE.md 移送（layering Phase 3）の「移行完了後」ゲートを維持するか | A | 2026-08-06 | context-cost, migration-gate, global-assets |
| [D-20260807-main-1](./D-20260807-main-1.md) | スマホからの主導線をネイティブ殻にするか公開 Web URL にするか（#600） | 公開 Web URL を主導線にする | 2026-08-07 | mobile, distribution, web-url |
| [D-20260809-main-1](./D-20260809-main-1.md) | 決定台帳（decisions/）を新設し「ADR は作らない」方針を SUPERSEDE するか | A | 2026-08-09 | docs, decision-ledger, adr, graph-layer |
| [D-20260810-main-1](./D-20260810-main-1.md) | END の task-tracker をいつ実行するか（verifier 直後 / 実装 PR の merge 後） | A | 2026-08-10 | harness, task-tracker, workflow, autonomy |
| [D-20260810-main-2](./D-20260810-main-2.md) | プロジェクト固有スキル / エージェントの実体をどこに置くか | A | 2026-08-10 | harness, skills, agents, portability, windows |
| [D-20260810-main-4](./D-20260810-main-4.md) | #607 の修正を「触らない」宣言済みの `useNotesUnifiedAPI.ts` に入れるか | A | 2026-08-10 | notes, sync, mobile, scope, shared-fix |
| [D-20260810-refactor-1](./D-20260810-refactor-1.md) | ルーチンの Undo/Redo を繋ぐか、コードを消すか | A | 2026-08-11 | undo-redo, routine, hooks, i18n, refactor |
| [D-20260810-sched-1](./D-20260810-sched-1.md) | #628 保存ボタンの確定モデル — ボタンのみで確定するか、blur 保存を残すか | A | 2026-08-10 | schedule, editor-pane, save-model |
| [D-20260810-sched-2](./D-20260810-sched-2.md) | #625 変換で id を維持するか、新規作成するか | A | 2026-08-10 | schedule, role-conversion, data-model |
| [D-20260810-sched-3](./D-20260810-sched-3.md) | #625 Event → Todo で落ちるフィールド（時刻・終日・繰り返し）の扱い | A | 2026-08-10 | schedule, role-conversion, data-loss |
| [D-20260810-sched-4](./D-20260810-sched-4.md) | #625 Todo → Event のステータスと親子関係の扱い | A | 2026-08-10 | schedule, role-conversion, task-tree |
| [D-20260810-sched-5](./D-20260810-sched-5.md) | #625 routine 由来アイテムの変換可否 | A | 2026-08-10 | schedule, role-conversion, routine |

## Superseded / Withdrawn

| ID | status | 後継 |
| --- | --- | --- |
| [D-20260731-main-1](./D-20260731-main-1.md) | withdrawn | — |

## Topic 逆引き

- adr: D-20260809-main-1
- agents: D-20260708-main-1 / D-20260810-main-2
- architecture: D-20260607-main-1
- archive: D-20260801-main-2
- autonomy: D-20260806-main-1 / D-20260810-main-1
- bottom-sheet: D-20260730-mobile-2
- branch: D-20260801-main-1
- calendar-lens: D-20260801-sched-1
- context-cost: D-20260806-main-2 / D-20260806-main-3
- cross-platform: D-20260607-main-1
- data-loss: D-20260810-sched-3
- data-model: D-20260711-main-1 / D-20260810-sched-2
- database: D-20260704-main-1
- dead-code: D-20260728-main-2
- decision-ledger: D-20260809-main-1
- design-tracking: D-20260730-tags-1
- distribution: D-20260807-main-1
- docs: D-20260730-tags-1 / D-20260801-main-2 / D-20260809-main-1
- editor-pane: D-20260810-sched-1
- file-explorer: D-20260704-main-1
- global-assets: D-20260806-main-2 / D-20260806-main-3
- graph-layer: D-20260809-main-1
- harness: D-20260804-main-2 / D-20260810-main-1 / D-20260810-main-2
- hooks: D-20260810-refactor-1
- i18n: D-20260810-refactor-1
- issue-dispatch: D-20260731-main-1 / D-20260731-main-2
- lock: D-20260730-mobile-3
- loop: D-20260806-main-1
- materials: D-20260731-tags-2 / D-20260731-tags-3
- mcp: D-20260705-main-1
- merge-conflict: D-20260801-main-1
- merge-gate: D-20260804-main-2 / D-20260806-main-1
- migration: D-20260704-main-1 / D-20260708-main-1
- migration-gate: D-20260806-main-3
- mobile: D-20260723-main-1 / D-20260730-mobile-1 / D-20260730-mobile-2 / D-20260730-mobile-3 / D-20260807-main-1 / D-20260810-main-4
- notes: D-20260730-mobile-3 / D-20260810-main-4
- palette: D-20260801-sched-1
- performance: D-20260731-tags-2 / D-20260731-tags-3
- permissions: D-20260804-main-2
- plans-lifecycle: D-20260730-tags-1
- policy: D-20260804-main-2 / D-20260806-main-1
- portability: D-20260810-main-2
- refactor: D-20260728-main-2 / D-20260810-refactor-1
- requirements: D-20260723-main-1
- retire: D-20260705-main-1 / D-20260708-main-1
- role-conversion: D-20260810-sched-2 / D-20260810-sched-3 / D-20260810-sched-4 / D-20260810-sched-5
- routine: D-20260711-main-1 / D-20260810-refactor-1 / D-20260810-sched-5
- routing: D-20260731-main-1 / D-20260731-main-2
- save-model: D-20260810-sched-1
- schedule: D-20260711-main-1 / D-20260731-main-1 / D-20260801-sched-1 / D-20260810-sched-1 / D-20260810-sched-2 / D-20260810-sched-3 / D-20260810-sched-4 / D-20260810-sched-5
- scope: D-20260806-main-2 / D-20260810-main-4
- scope-cut: D-20260704-main-1 / D-20260705-main-1 / D-20260728-main-3
- shared-fix: D-20260731-main-2 / D-20260810-main-4
- shared-ui: D-20260607-main-1
- skills: D-20260810-main-2
- ssot: D-20260723-main-1
- status-enum: D-20260801-main-2
- sync: D-20260731-tags-2 / D-20260731-tags-3 / D-20260810-main-4
- task-tracker: D-20260810-main-1
- task-tree: D-20260810-sched-4
- tasks: D-20260728-main-3
- terminal: D-20260705-main-1
- touch: D-20260730-mobile-1
- tracker: D-20260801-main-1
- undo-redo: D-20260810-refactor-1
- ux: D-20260711-main-1 / D-20260730-mobile-1 / D-20260730-mobile-2 / D-20260730-mobile-3 / D-20260801-sched-1
- web-url: D-20260807-main-1
- windows: D-20260810-main-2
- workflow: D-20260810-main-1
- worktree: D-20260731-main-1 / D-20260731-main-2 / D-20260801-main-1

## Supersede 連鎖

- CLAUDE.md §9「ADR は作らない」 → D-20260809-main-1
- archive/SUMMARY.md §integrated-design-roadmap Lessons「ADR は時点判断で陳腐化するため vision/ に一元化」 → D-20260809-main-1
- CLAUDE.md §7.4「merge 後に 1 commit でまとめ」 → D-20260810-main-1
- skills/worktree-policy/SKILL.md §tracker の更新は実装ブランチに載せない（実行タイミングの記述） → D-20260810-main-1
- claude-dotfiles rules/skill-management.md「スキル実体は全て skill-lib で一元管理・リンクのみ配置」（life-editor スコープに限る） → D-20260810-main-2
