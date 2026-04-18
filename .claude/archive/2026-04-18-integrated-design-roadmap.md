# Plan: アプリケーション設計定義の統合 + 全機能要件定義（拡張ロードマップ v2）

**Status:** COMPLETED (2026-04-18, Phase A + B + C 全完遂)
**Created:** 2026-04-18
**Completed:** 2026-04-18
**Project:** /Users/newlife/dev/apps/life-editor
**Extends:** `.claude/feature_plans/2026-04-18-app-redefinition-roadmap.md`（3-step 戦略の上位拡張）

---

## 完了サマリー

- **Phase A**（CLAUDE.md 13 章統合）: 133 行 → 805 行、rules/ + ADR 0001-0004 + life-editor-v2 + TODO archive、README 簡素化（80→35 行）
- **Phase B**（Tier 1-3 要件定義）: 全 26 機能の Purpose / Boundary / AC / Dependencies / Future Enhancements 記入（Tier 1: 8 / Tier 2: 12 / Tier 3: 6）、CLAUDE.md §11 相互リンク化
- **Phase C**（plan 棚卸し + 保留 5 件 Verdict）: feature_plan 9 件 archive（Drop 5 / Merge 4）、保留 5 件の Verdict 確定 → ADR-0006/0007 + 新規 plan 4 件起票

詳細は `.claude/HISTORY.md` 2026-04-18 エントリ 3 件を参照。Phase A 着手時の sub-step checkbox は前セッションで更新漏れだが、Phase A 完了記録（2026-04-18）で実作業完了が確認されている。

---

## Context

### 課題

設計定義が以下に分散しており、SSOT（単一情報源）が存在しない：

- `.claude/CLAUDE.md`（プロジェクト概要 / アーキテクチャ / 規約）
- `.claude/rules/`（3 ファイル: project-debug / project-patterns / project-review-checklist）
- `.claude/docs/adr/`（5 ファイル: ADR-0001 Superseded〜0005 PROPOSED）
- `.claude/docs/code-explanation/`（13 ファイル: 機能別実装解説）
- `.claude/docs/life-editor-v2/`（5 ファイル: ビジョン / Terminal / MCP / Claude setup / UI 調整）
- `README.md` / `TODO.md`

加えて既存ロードマップ（`2026-04-18-app-redefinition-roadmap.md`）の Step 1 は「Core Identity 中心の8セクション」に限定されており、技術スタック・規約・パターンを統合スコープに含んでいない。

### 目標

ユーザーの依頼「アプリケーションの土台、要件定義の最上位ファイルを作成し、CLAUDE.md や rules、ADR などの分散した設計定義を全て一つのファイルとして作成する。これを元にアプリに必要な要件定義を行い、そこから次に進むべきステップなども実装計画書として作成する」を達成する。

### ユーザーが選んだ方針（質問への回答）

1. **既存ロードマップとの関係**: 既存 3 プランを **土台に拡張**
2. **統合スコープ**: ビジョン + アーキテクチャ + 規約 + 機能マップ（4 つすべて）
3. **要件定義粒度**: **全機能網羅（Tier 1-3）**
4. **既存ファイルの扱い**: **ADR のみ archive**。それ以外（CLAUDE.md / rules / docs/life-editor-v2 / README / TODO）は統合ファイルに吸収

### 主要な設計判断（決め打ち）

| #   | 論点                               | 推奨判断                                                                    | 根拠                                                                                                                     |
| --- | ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | 統合最上位ファイルの配置           | **`.claude/CLAUDE.md` 自体を 13 章に拡張**                                  | Claude Code が起動時に auto-load する唯一のファイル。別ファイルを作っても auto-load されないため SSOT として機能しない   |
| 2   | Tier 1-3 要件のファイル分割        | **Tier ごと 1 ファイル、計 3 ファイル**（`requirements/tier-1-core.md` 等） | 機能別 30+ ファイルは管理過大、全部 1 ファイルは肥大化（4000+ 行）。Tier 単位なら各 1500-2000 行で優先度別レビューが自然 |
| 3   | ADR 扱い                           | **0001-0004 は archive、0005 (PROPOSED) は残す**                            | PROPOSED は意思決定途上。0001 は Superseded、0002-0004 は CLAUDE.md 章 9 で全文吸収済みになる                            |
| 4   | rules/ ディレクトリ                | **CLAUDE.md に全文吸収後、ディレクトリごと削除**                            | 合計 7KB 程度。Claude Code の auto-load 対象を CLAUDE.md 一本に絞る方が探索コスト減                                      |
| 5   | TODO.md                            | **CLAUDE.md 章 13 に吸収後、ファイル削除**                                  | 15 行のみ。重複管理を避ける                                                                                              |
| 6   | README.md                          | **80 行 → 30-40 行に簡素化**、機能リストは CLAUDE.md 章 11 へリンク         | 公開窓口としての役割は維持しつつ重複排除                                                                                 |
| 7   | docs/life-editor-v2/ 5 ファイル    | **要点を CLAUDE.md 章 6.5/8.1 に吸収後、archive 移動**                      | Phase A 計画書として完了済み。歴史的価値はあるが現役参照不要                                                             |
| 8   | docs/code-explanation/ 13 ファイル | **保持**。CLAUDE.md 章 12 からリンクのみ                                    | 実装フロー解説は学習教材として性質が異なる                                                                               |
| 9   | 既存 3 プラン                      | **Superseded/Consumed マーク**で履歴保持                                    | 完全削除すると意思決定の経緯が失われる                                                                                   |

### Non-goals

- code-explanation 13 ファイルの統合（性質が異なるため保持）
- iOS Safe Area 対応（独立 IN_PROGRESS タスク）
- 即時の機能削除（要件確定後に Phase C で判断）

---

## 全体構成（3 Phase）

```
Phase A: 統合最上位 CLAUDE.md の作成 (2-3 セッション)
  ↓
Phase B: 全機能 Tier 1-3 要件定義 3 ファイル作成 (3-4 セッション)
  ↓
Phase C: 実装プラン群の整理 + 保留 5 件再評価 (1-2 セッション)
```

**合計目安**: 6-9 セッション（1 セッション = 集中 2-3 時間）

---

## Phase A: 統合最上位 CLAUDE.md の作成

**Goal**: `.claude/CLAUDE.md` を「Life Editor の唯一の最上位定義書」に拡張し、CLAUDE.md / rules / docs/life-editor-v2 / README / TODO の散在情報を SSOT 化する。

**目標サイズ**: 2000-3000 行（90-120KB）— 5000+ 行はスクロール疲労、検索性低下

### 章立て（13 章）

```
.claude/CLAUDE.md（統合後）
─────────────────────────────────
0. Meta — このファイルの位置づけ・更新ルール・Claude Code auto-load 前提
1. Core Identity — 1-line definition / Elevator pitch / 意図的に外したもの
2. Target User — Primary user / Key characteristics / Non-users
3. Core Value Propositions — 3 点 + 技術的根拠 + 比較対象
4. Non-Goals — 5 点以上の境界線
5. Platform Strategy — Desktop / Mobile / Cloud の機能差分マトリクス
6. Architecture（旧 CLAUDE.md より大幅拡張）
   6.1 全体構成図（Renderer / IPC / Rust / SQLite / MCP / Cloud）
   6.2 Provider ツリー（Desktop 18 段 / Mobile 12 段、依存グラフ）
   6.3 DataService 抽象化
   6.4 Section Routing（6 SectionId）
   6.5 Terminal / Audio / Sync / Theme サブシステム
7. Data Model
   7.1 SQLite v59 ~45 テーブル一覧（特化 vs 汎用 DB の境界線）
   7.2 ID 戦略（TaskNode 形式 / generateId 形式）
   7.3 ソフトデリート対象一覧
   7.4 PropertyType 拡張方針
8. AI Integration Strategy
   8.1 現状の MCP（30 ツール一覧 + 役割）
   8.2 アプリ内ターミナル + Claude Code 起動
   8.3 ADR-0005 Cognitive Architecture の要約 + リンク
   8.4 シナリオ 3 つ + AI 不使用時の機能割合
9. Coding Standards & Patterns
   9.1 命名規則（旧 CLAUDE.md テーブル）
   9.2 Pattern A（3 ファイル構成）— 旧 ADR-0002 / rules/project-patterns 統合
   9.3 共有コンポーネント配置規約
   9.4 Schedule 3 分割 + shared/ 規約 — 旧 ADR-0003/0004 統合
   9.5 i18n / ID 生成 / IME 対応
10. Development Workflows
    10.1 開発コマンド
    10.2 IPC 追加時の 3 点同期
    10.3 DB マイグレーション手順
    10.4 コミット規約
    10.5 デバッグガイド — 旧 rules/project-debug 統合
    10.6 Review Checklist — 旧 rules/project-review-checklist 統合
11. Feature Tier Map（Phase B 要件定義への入口）
    Tier 1 / Tier 2 / Tier 3 の機能名一覧 + Tier ごとの方針 + requirements/ へのリンク
12. Document System
    .claude/ 内全ファイルの一覧 + 役割 + ライフサイクル
13. Roadmap & Status
    現在進行中（IN_PROGRESS）/ 直近完了 / 保留中の要点 — TODO.md 廃止
```

### Phase A-1: 既存資産の抽出 + 章立て骨格作成

**Steps**:

- [ ] A-1-1. 上記 13 章の見出しのみ先に CLAUDE.md に記述（空セクション）
- [ ] A-1-2. 既存 CLAUDE.md 全 133 行を該当章へ機械的にコピー（章 6 / 7 / 9 / 10 / 12）
- [ ] A-1-3. `.claude/rules/project-debug.md` → 章 10.5 に全文吸収
- [ ] A-1-4. `.claude/rules/project-patterns.md` → 章 9.2 / 9.3 + 章 6.2 に分割吸収
- [ ] A-1-5. `.claude/rules/project-review-checklist.md` → 章 10.2 / 10.6 に分割吸収
- [ ] A-1-6. `README.md` の「主な機能」セクション → 章 11 の Feature Tier 草案として転記
- [ ] A-1-7. `TODO.md` 全 15 行 → 章 13 に吸収

**Verification**:

- [ ] CLAUDE.md が 13 章すべて見出し付き
- [ ] rules/ 3 ファイル分の内容が CLAUDE.md 内で全文検索可能
- [ ] README.md と TODO.md の情報が章 11 / 13 に欠損なく転記済み

### Phase A-2: ビジョン系の埋め込み + Core Identity 確定

**Steps**:

- [ ] A-2-1. `2026-04-17-daily-life-hub-requirements.md` を読み、章 1（Core Identity）/ 章 3（Value Props）/ 章 8（AI Strategy）の素案作成
- [ ] A-2-2. `.claude/docs/life-editor-v2/00-vision.md` との整合性確認 → 矛盾あればユーザー判定
- [ ] A-2-3. `2026-04-18-application-definition-template.md` の 8 項目テンプレを章 1-5 / 8 に逐次埋める（ユーザー対話必須）
- [ ] A-2-4. 章 4 Non-Goals を 5 点以上明記
- [ ] A-2-5. 章 5 Platform Strategy で Desktop/Mobile/Cloud の Provider 差分表を記入
- [ ] A-2-6. ADR-0005（Cognitive Architecture, PROPOSED）の要約を章 8.3 に埋め込み

**Verification**:

- [ ] 章 1 の 1-line definition が一貫した理解を生む
- [ ] 章 4 Non-Goals が 5 点以上
- [ ] 章 5 で Mobile 省略 Provider 一覧が現状コードと一致
- [ ] 章 8.3 が ADR-0005 の Phase 1-4 を要約

### Phase A-3: ADR archive + life-editor-v2 archive + クリーンアップ

**Steps**:

- [ ] A-3-1. `.claude/docs/adr/0001-tech-stack.md`（Superseded）→ archive 移動
- [ ] A-3-2. `.claude/docs/adr/0002-context-provider-pattern.md` → archive 移動
- [ ] A-3-3. `.claude/docs/adr/0003-schedule-provider-decomposition.md` → archive 移動
- [ ] A-3-4. `.claude/docs/adr/0004-schedule-shared-components.md` → archive 移動
- [ ] A-3-5. ADR-0005 は `.claude/docs/adr/` に残し、CLAUDE.md 章 8.3 から本文へリンク
- [ ] A-3-6. `.claude/docs/life-editor-v2/` 5 ファイルの要点を CLAUDE.md 章 6.5 / 8.1 に吸収後、archive 移動
- [ ] A-3-7. `.claude/rules/` ディレクトリ削除
- [ ] A-3-8. `TODO.md` 削除
- [ ] A-3-9. `README.md` を 30-40 行に簡素化
- [ ] A-3-10. `.claude/feature_plans/2026-04-18-app-redefinition-roadmap.md` に Status: Superseded by integrated-design-roadmap マーク
- [ ] A-3-11. `.claude/feature_plans/2026-04-18-application-definition-template.md` に Status: Consumed (Phase A 完了) マーク
- [ ] A-3-12. `.claude/feature_plans/2026-04-17-daily-life-hub-requirements.md` に Status: Consumed (CLAUDE.md に吸収) マーク

**Verification**:

- [ ] `.claude/docs/adr/` には ADR-0005 のみ残る
- [ ] `.claude/rules/` ディレクトリが存在しない
- [ ] `.claude/docs/life-editor-v2/` ディレクトリが存在しない
- [ ] CLAUDE.md から rules / life-editor-v2 への参照が 0 件
- [ ] README.md / TODO.md（または不在）が CLAUDE.md と矛盾しない

---

## Phase B: 全機能 Tier 1-3 要件定義

**Goal**: CLAUDE.md 章 11 で分類した全機能（推定 30+ 件）を 3 ファイルに分けて要件定義する。Phase C の差分評価のための SSOT。

**ファイル構成**:

```
.claude/docs/requirements/
├── README.md            — Tier 分類基準 + ファイル構成 + 共通テンプレ
├── tier-1-core.md       — Tier 1 機能（推定 8-10 機能、~2000 行）
├── tier-2-supporting.md — Tier 2 機能（推定 10-12 機能、~1500 行）
└── tier-3-experimental.md — Tier 3 機能（推定 5-8 機能、~800 行）
```

### Tier 分類の判定基準

| Tier | 定義                                                                 | 判定者                 | 判定タイミング           |
| ---- | -------------------------------------------------------------------- | ---------------------- | ------------------------ |
| 1    | Value Proposition を直接支える / 無いと Life Editor として成立しない | ユーザー（作者）       | Phase A-2                |
| 2    | 補助機能 / あると価値が大幅増 / Tier 1 機能の補完                    | ユーザー + Claude 提案 | Phase A-2                |
| 3    | 実験 / 凍結候補 / 半年以上未利用ならドロップ判断対象                 | Phase C で再評価       | Phase A-2 暫定、C で確定 |

### 1 機能あたりの要件テンプレート

```markdown
## Feature: <機能名>

**Tier**: 1 | 2 | 3
**Status**: ◎完成 / ○基本完成 / △基盤のみ / ×未着手
**Owner Provider/Module**: 例 `TaskTreeProvider` / `src-tauri/src/commands/task.rs`
**MCP Coverage**: 対応ツール名一覧 / —
**Supports Value Prop**: V1 / V2 / V3（CLAUDE.md 章 3 参照）

### Purpose

### Boundary（やる / やらない）

### Acceptance Criteria（5 件以上、Tier 2 は 3-5 件）

### Dependencies（他機能 / 外部サービス / DB Tables / IPC Commands）

### Known Issues / Tech Debt

### Future Enhancements（短期 / 中期）

### Related Plans
```

### Tier 配分予測（暫定、Phase A-2 で確定）

- **Tier 1（コア）**: Tasks (TaskTree) / Schedule (Routine + ScheduleItems + CalendarTags) / Notes / Memo / MCP Server / Cloud Sync / Database (Notion 風 DB) / Terminal + Claude Code 起動
- **Tier 2（補助）**: Audio Mixer / Playlist / Pomodoro Timer / WikiTags / File Explorer / Templates / UndoRedo / Theme / i18n / Shortcuts / Toast / Trash
- **Tier 3（実験/凍結）**: Paper Boards / Analytics / NotebookLM 連携 / Google Calendar / Google Drive / Claude Cognitive Architecture (ADR-0005)

### Phase B-1: Tier 1 要件定義

**Steps**:

- [x] B-1-1. `.claude/docs/requirements/README.md` 作成（テンプレ + 判定基準）
- [x] B-1-2. `tier-1-core.md` 骨格作成
- [x] B-1-3. Tasks 機能要件記入（AC 10 件、事前骨格を拡張）
- [x] B-1-4. Schedule 系 3 機能（Routine / ScheduleItems / CalendarTags）の要件を統合（AC 10 件）
- [x] B-1-5. Notes / Memo / Database / MCP Server / Cloud Sync / Terminal の要件記入（各 AC 7-8 件）
- [x] B-1-6. 各機能の Owner Provider/Module をコードで実在確認（Explore agent + grep で IPC コマンド名照合済）

**Verification**:

- [x] Tier 1 全機能 8 件にテンプレ全項目記入（`<!-- 記入予定 -->` / `<!-- AC -->` 残存ゼロ）
- [x] 各機能の AC が 5 件以上（最小 Notes 8 件、最大 Schedule / Tasks 10 件）
- [x] DB Tables / IPC Commands が実在する（task_commands.rs / sync_commands.rs / terminal_commands.rs 等で grep 確認済）

### Phase B-2: Tier 2 要件定義

**Steps**:

- [x] B-2-1. `tier-2-supporting.md` 骨格作成（Phase A-3 で事前展開済）
- [x] B-2-2. Audio Mixer / Playlist / Pomodoro Timer / WikiTags / File Explorer の要件記入
- [x] B-2-3. UI 横断機能（UndoRedo / Theme / i18n / Shortcuts / Toast / Templates / Trash）の要件記入

**Verification**:

- [x] Tier 2 全機能 12 件にテンプレ記入（`<!-- 記入予定 -->` / `<!-- AC -->` 残存ゼロ）
- [x] Mobile で省略される機能（Audio Mixer / WikiTags / File Explorer / Shortcuts）に `**Platform**: Desktop only` 明記
- [x] `task_templates` レガシー残留を Templates の Known Issues に記録（実コード調査で発見、将来 DB クリーンアップ対象）

### Phase B-3: Tier 3 要件定義 + 全体レビュー

**Steps**:

- [x] B-3-1. `tier-3-experimental.md` 作成（Phase A-3 で骨格済、Phase B-3 で Verdict 記入）
- [x] B-3-2. Paper Boards / Analytics の現状利用状況を Git log で確認（Paper 13 commits / Analytics 17 commits、両方とも 2026-02-25 / 2026-04-12 以降は機能追加停止）
- [x] B-3-3. NotebookLM / Google Calendar / Google Drive 連携を「未着手」Verdict 付きで記入
- [x] B-3-4. ADR-0005 を Tier 3 に Reference として追加（Verdict: PROPOSED 維持）
- [x] B-3-5. 全 Tier 横断レビュー：CLAUDE.md §11 と requirements/ の機能名整合確認（Tier 1: 8 / Tier 2: 12 / Tier 3: 6 = 計 26、差分ゼロ）
- [x] B-3-6. CLAUDE.md §11 から requirements/ 各ファイルへの相互リンク追加（markdown link 化）+ Verdict 反映

**Verification**:

- [x] Tier 3 全機能 6 件に Verdict ラベル付与（凍結継続 2 / 未着手 3 / PROPOSED 1）
- [x] CLAUDE.md §11 機能数 = requirements/ 機能数（差分ゼロ、計 26）

---

## Phase C: 実装プラン群の整理 + 保留 5 件再評価

**Goal**: Phase A/B で SSOT が確立した後、現存 feature_plan 群を「Keep / Merge / Drop」判定し、保留 5 件 + 古い 019-022 + Mobile Phase 計画を整理する。

### 事前データ — Git log 集計（Phase A-3 後に取得済み、2026-04-18）

| ファイル                                         | 起案日     | 最終 commit               | コミット数    | 推奨判定（事前）                               |
| ------------------------------------------------ | ---------- | ------------------------- | ------------- | ---------------------------------------------- |
| `019-phase1-security-critical-fixes.md`          | 2026-02-26 | 2026-02-26                | 1（起案のみ） | **Drop**（3 ヶ月放置）                         |
| `020-phase2-data-integrity.md`                   | 2026-02-26 | 2026-02-26                | 1             | **Drop**                                       |
| `021-phase3-architecture-improvement.md`         | 2026-02-26 | 2026-02-26                | 1             | **Drop**                                       |
| `022-phase4-quality-optimization.md`             | 2026-02-26 | 2026-02-26                | 1             | **Drop**                                       |
| `023-cmux-terminal-features.md`                  | 2026-03-08 | 2026-04-15（rename のみ） | 2             | **Merge** → Tier 1 Terminal Future Enhancement |
| `025-life-editor-ui-ux-refactor.md`              | 2026-03-09 | 2026-03-09                | 1             | **Merge** → Tier 2 UI 横断要件                 |
| `2026-03-16-mobile-phase2-realtime-sync.md`      | 2026-03-16 | 2026-04-15（rename のみ） | 2             | **Merge** → Tier 1 Cloud Sync                  |
| `2026-03-16-mobile-phase3-offline-standalone.md` | 2026-03-16 | 2026-04-15（rename のみ） | 3             | **Merge** → Tier 1 Cloud Sync                  |
| `2026-04-14-capacitor-ios-standalone.md`         | 2026-04-14 | 2026-04-15（rename のみ） | 2             | **Drop**（Tauri Mobile 採用済み、旧案）        |
| `2026-04-17-ios-safe-area.md`                    | 2026-04-17 | 2026-04-17                | 1             | **Keep**（IN_PROGRESS、触らない）              |

> 注: Phase C-1 セッション開始時にこの表を起点に Verdict を確定する。3 ヶ月放置の 019-022 はサイレント Drop が妥当だが、内容を確認してから最終判定すること（一部は CLAUDE.md §11 / requirements/ に Tech Debt として吸収する余地あり）。

### Phase A-3 完了済み（Status マーク）

- `2026-04-17-daily-life-hub-requirements.md` → Status: Consumed
- `2026-04-18-app-redefinition-roadmap.md` → Status: Superseded
- `2026-04-18-application-definition-template.md` → Status: Consumed

### Phase C-1: 既存 feature_plan 群の棚卸し

**Steps**:

- [x] C-1-1. 各プランを Git log で着手有無確認（Phase C-2 事前データ表 + 実コード確認）
- [x] C-1-2. Keep / Merge / Drop 判定を各ファイル冒頭に記入（事前データ表の推奨判定を採用）
- [x] C-1-3. Merge 判定 4 件（023 / 025 / mobile-phase2 / mobile-phase3）を要件側 Related Plans 更新 → `.claude/archive/` へ移動
- [x] C-1-4. Drop 判定 5 件（019 / 020 / 021 / 022 / capacitor）を `.claude/archive/dropped/` へ移動 + 各ファイル冒頭に Drop reason 追記
- [x] C-1-5. Keep 1 件（ios-safe-area, IN_PROGRESS）は Status 変更なし

**Verification**:

- [x] `.claude/feature_plans/` の PLANNED が 5 件以下（4 件: tasks-fetch-by-range / folder-progress-batch-memo / service-error-handler-hook / context-hook-optional。他は Consumed/Superseded/IN_PROGRESS）
- [x] `.claude/archive/` に Merge/Drop プラン 9 件移動済み（Merge 4 / Drop 5）
- [x] 各 archive ファイル冒頭に判定根拠明記（MERGED = Merge target + reason、DROPPED = Drop reason）

### Phase C-2: 保留 5 件 (I-1 / S-2 / S-4 / S-5 / S-6) 再評価 + 新規実装プラン起票

#### 事前要旨（deferred-items-reevaluation.md より抽出、参照リファレンス）

| 項目 | 一行サマリー                                                                         | 関連 CLAUDE.md / requirements 章                  | 暫定推奨                                            |
| ---- | ------------------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------- |
| I-1  | Rust `db_tasks_fetch_by_scheduled_range` 新コマンド（sync 完了時の全件取得遅延対策） | tier-1 Tasks "Known Issues" / CLAUDE.md §5 Mobile | **計測次第 Keep**（数百件超なら必須）               |
| S-2  | Tauri IPC naming 方針（typed input struct 移行 + ADR）                               | CLAUDE.md §10.2 (3 点同期)                        | **ADR Keep / 実装は Drop**（事故予防価値のみ）      |
| S-4  | `computeFolderProgress` 一括計算（O(n²) 改善）                                       | tier-1 Tasks "Known Issues"                       | **計測次第 Keep**（React 19 Compiler で解決可能性） |
| S-5  | `useServiceErrorHandler` 共通ヘルパ（catch → toast の統一）                          | tier-2 Toast "Known Issues"                       | **Keep**（V2 価値「信頼できるデータ」を支える）     |
| S-6  | `createContextHook` optional バリアント（Mobile 省略 Provider 対応）                 | CLAUDE.md §5 Platform Strategy                    | **Keep A 案（optional hook）**（モバイル軽量維持）  |

> 詳細な「問い」「判断材料」「フォーマット」は `2026-04-18-deferred-items-reevaluation.md` を参照。Phase C-2-1 でこの表を起点に Verdict を確定する。

**Steps**:

- [x] C-2-1. 5 件を CLAUDE.md（§5 / §11）と requirements/ に照らして判定（事前要旨を起点に確定）
- [x] C-2-2. 各項目に Verdict + Reasoning を deferred-items-reevaluation.md の冒頭表に集約（I-1: Keep / S-2: Modify ADR-only / S-4: Keep / S-5: Keep / S-6: Keep Option A）
- [x] C-2-3. Keep 判定 4 件の新規 plan 起票: `2026-04-18-tasks-fetch-by-range.md`（I-1）/ `2026-04-18-folder-progress-batch-memo.md`（S-4）/ `2026-04-18-service-error-handler-hook.md`（S-5）/ `2026-04-18-context-hook-optional.md`（S-6）
- [x] C-2-4. ADR 化: `ADR-0006-tauri-ipc-naming-policy.md`（S-2、Accepted 実装なし）/ `ADR-0007-mobile-provider-strategy.md`（S-6、Accepted Option A）
- [x] C-2-5. ADR 採番ルールは CLAUDE.md §12 に既存（「連続採番、archive 後も再利用しない」）→ 0006 / 0007 が次番号として確定
- [x] C-2-6. requirements/ 更新: §Tasks Related Plans に I-1 / S-4 plan リンク、§Toast Known Issues に S-5 plan リンク、§Cloud Sync Related Plans を MERGED に更新、§Terminal Related Plans を MERGED に更新

**Verification**:

- [x] 5 件すべてに Verdict + 後続アクション記入（archive/2026-04-18-deferred-items-reevaluation.md 冒頭表）
- [x] Keep 判定 4 件の新規 plan ファイル存在（feature_plans/ 配下）
- [x] Modify / Keep Option A の ADR ファイル存在（docs/adr/ 配下 2 件）
- [x] `2026-04-18-deferred-items-reevaluation.md` に Status: Consumed (Phase C 完了) マーク + archive 移動済

---

## Files

### Create / Update

| File                                                     | Operation                           | Notes                                 |
| -------------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `.claude/CLAUDE.md`                                      | Update（13 章へ大幅拡張、~2500 行） | Phase A 全体の中心成果物              |
| `.claude/docs/requirements/README.md`                    | Create                              | Tier 判定基準 + テンプレ              |
| `.claude/docs/requirements/tier-1-core.md`               | Create                              | Tier 1 全機能要件、~2000 行           |
| `.claude/docs/requirements/tier-2-supporting.md`         | Create                              | Tier 2 全機能要件、~1500 行           |
| `.claude/docs/requirements/tier-3-experimental.md`       | Create                              | Tier 3 全機能要件、~800 行            |
| `README.md`                                              | Update（80 → 30-40 行に簡素化）     | 機能リストは CLAUDE.md 章 11 へリンク |
| `.claude/feature_plans/README.md`                        | Update                              | 命名規則 `YYYY-MM-DD-<slug>.md` 追記  |
| `.claude/feature_plans/<keep 判定の保留5件由来 plan>.md` | Create（最大 5 件）                 | Phase C-2-3                           |
| `.claude/docs/adr/0006-<rejected-topic>.md`              | Create（必要に応じ）                | Phase C-2-4                           |

### Move / Archive

| File                                                       | From → To                                |
| ---------------------------------------------------------- | ---------------------------------------- |
| `.claude/docs/adr/0001-tech-stack.md`                      | → `.claude/archive/adr/`                 |
| `.claude/docs/adr/0002-context-provider-pattern.md`        | → `.claude/archive/adr/`                 |
| `.claude/docs/adr/0003-schedule-provider-decomposition.md` | → `.claude/archive/adr/`                 |
| `.claude/docs/adr/0004-schedule-shared-components.md`      | → `.claude/archive/adr/`                 |
| `.claude/docs/life-editor-v2/` (5 ファイル)                | → `.claude/archive/docs/life-editor-v2/` |
| `019-022-*.md`（4 ファイル）                               | → `.claude/archive/`（Merge or Drop）    |
| `023-cmux-terminal-features.md`                            | Phase C-1-2 で判定                       |
| `025-life-editor-ui-ux-refactor.md`                        | 同上                                     |
| `2026-03-16-mobile-phase*.md`（2 ファイル）                | 同上                                     |
| `2026-04-14-capacitor-ios-standalone.md`                   | 同上                                     |

### Delete

| File                                            | Reason                                    |
| ----------------------------------------------- | ----------------------------------------- |
| `.claude/rules/` ディレクトリ全体（3 ファイル） | Phase A-1 で CLAUDE.md に全文吸収済み     |
| `TODO.md`                                       | Phase A-1-7 で CLAUDE.md 章 13 に吸収済み |

### Mark as Superseded / Consumed

| File                                                                  | Mark                                            |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| `.claude/feature_plans/2026-04-18-app-redefinition-roadmap.md`        | Status: Superseded by integrated-design-roadmap |
| `.claude/feature_plans/2026-04-18-application-definition-template.md` | Status: Consumed (Phase A 完了)                 |
| `.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md`     | Status: Consumed (Phase C 完了)                 |
| `.claude/feature_plans/2026-04-17-daily-life-hub-requirements.md`     | Status: Consumed (CLAUDE.md に吸収)             |

### Keep（変更なし）

- `.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md`（PROPOSED のまま）
- `.claude/docs/code-explanation/`（13 ファイル全て、実装解説として保持）
- `.claude/MEMORY.md` / `.claude/HISTORY.md`
- `.claude/feature_plans/2026-04-17-ios-safe-area.md`（IN_PROGRESS、独立タスク）

---

## サイズ・トークン量見積もり

| 成果物                                | 行数目安       | KB 目安      | トークン目安      |
| ------------------------------------- | -------------- | ------------ | ----------------- |
| `.claude/CLAUDE.md`（統合後）         | 2000-3000      | 90-120KB     | 25,000-35,000     |
| `requirements/tier-1-core.md`         | 1500-2000      | 60-80KB      | 18,000-22,000     |
| `requirements/tier-2-supporting.md`   | 1000-1500      | 40-60KB      | 12,000-17,000     |
| `requirements/tier-3-experimental.md` | 500-800        | 20-30KB      | 6,000-9,000       |
| `requirements/README.md`              | 200            | 8KB          | 2,500             |
| **合計**                              | **約 6000 行** | **約 250KB** | **約 70,000 tok** |

---

## Verification（全 Phase 完了の検証）

- [ ] `.claude/CLAUDE.md` が 13 章すべて埋まり、grep で「TODO」「<!-- 記入 -->」がゼロ
- [ ] `.claude/rules/` ディレクトリが存在しない
- [ ] `.claude/docs/adr/` に ADR-0005 のみ残る
- [ ] `.claude/docs/life-editor-v2/` ディレクトリが存在しない
- [ ] `.claude/docs/requirements/` に 4 ファイル存在
- [ ] `requirements/` 全機能数 = CLAUDE.md 章 11 機能数
- [ ] `TODO.md` が存在しない
- [ ] `README.md` が 40 行以下
- [ ] `.claude/feature_plans/` の PLANNED が 5 件以下
- [ ] 旧ロードマップ 3 プランに Superseded/Consumed マーク
- [ ] 保留 5 件すべてに Verdict + 新規 plan or ADR が紐付く
- [ ] CLAUDE.md 内の全外部リンクがリンク切れゼロ
- [ ] `.claude/MEMORY.md` の「直近の完了」に Phase A/B/C 完了が記録

---

## Critical Files

実装時に必読（Phase A-3 で archive 移動を反映）：

- `/Users/newlife/dev/apps/life-editor/.claude/CLAUDE.md` — **SSOT、最初に必ず読む**
- `/Users/newlife/dev/apps/life-editor/.claude/docs/requirements/README.md` — Phase B 着手時の起点
- `/Users/newlife/dev/apps/life-editor/.claude/docs/requirements/tier-1-core.md` — Phase B-1 対象
- `/Users/newlife/dev/apps/life-editor/.claude/docs/requirements/tier-2-supporting.md` — Phase B-2 対象
- `/Users/newlife/dev/apps/life-editor/.claude/docs/requirements/tier-3-experimental.md` — Phase B-3 対象
- `/Users/newlife/dev/apps/life-editor/.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md` — Phase C-2 起点（保留 5 件）
- `/Users/newlife/dev/apps/life-editor/.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md` — Cognitive Architecture（PROPOSED）

参考（archive、参照のみ）：

- `/Users/newlife/dev/apps/life-editor/.claude/archive/rules/project-debug.md` — CLAUDE.md §10.5 に統合済み
- `/Users/newlife/dev/apps/life-editor/.claude/archive/rules/project-patterns.md` — CLAUDE.md §9.2-3 / §6.2 に統合済み
- `/Users/newlife/dev/apps/life-editor/.claude/archive/rules/project-review-checklist.md` — CLAUDE.md §10.2 / §10.6 に統合済み
- `/Users/newlife/dev/apps/life-editor/.claude/archive/docs/life-editor-v2/00-vision.md` — CLAUDE.md §6.5 / §8 に要点吸収
- `/Users/newlife/dev/apps/life-editor/.claude/archive/TODO.md` — CLAUDE.md §13 に統合済み
- `/Users/newlife/dev/apps/life-editor/.claude/feature_plans/2026-04-17-daily-life-hub-requirements.md` — Status: Consumed（CLAUDE.md §1-5/8 に吸収）

---

## 残課題（Phase A 完了時点での状態）

1. ✅ **CLAUDE.md 統合方針**: `.claude/CLAUDE.md` 自体を 13 章に拡張で確定（Phase A-1/A-2 完了）
2. ✅ **README.md 簡素化**: 80 → 35 行に簡素化済み（Phase A-3）
3. ✅ **TODO.md 廃止**: archive 移動 + CLAUDE.md §13 に統合済み（Phase A-3）
4. ✅ **ADR-0005 の扱い**: PROPOSED のまま `.claude/docs/adr/` に残置（Phase A-3）
5. ⏸ **CLAUDE.md §1-5/8 の素案レビュー**: ユーザーレビュー待ち（Phase A-2 で素案完成、本人による Core Identity / Value Props / Non-Goals の最終確認）
6. ⏸ **019-022 古期プラン群**: 事前データ取得済み（commit 1 件のみで 3 ヶ月放置 → Drop 推奨）。Phase C-1 で確定
7. ⏸ **Tier 1 機能数の妥当性**: 暫定 8 件確定（CLAUDE.md §11 / requirements/tier-1-core.md）。Phase B-1 で各機能 AC 記入時にユーザーが判断
8. ⏸ **Phase 並走の可否**: Phase A 完了 → Phase B/C は順次推奨（並走は混乱の元）

---

## 次セッション開始ガイド（/clear 後の起動性確保）

### Step 1: コンテキスト読み込み（必読 3 ファイル）

```
1. .claude/MEMORY.md          — 進行中タスク + 予定 + 直近完了
2. .claude/CLAUDE.md          — SSOT（13 章、~810 行）
3. 本ファイル（integrated-design-roadmap.md）— Phase A/B/C 全体ロードマップ
```

### Step 2: 着手 Phase の判定

MEMORY.md の「予定」欄を見て、優先順位の高いものから着手：

- **Phase B 着手の場合** → 以下の Phase B キックオフへ
- **Phase C 着手の場合** → 以下の Phase C キックオフへ
- **CLAUDE.md レビュー先行の場合** → 本ファイル「残課題 5」を参照、CLAUDE.md §1-5/8 を読み、素案にコメント記入

### Step 3-A: Phase B キックオフ（推定 3-4 セッション）

#### 最初に開くファイル

```
- .claude/docs/requirements/README.md (テンプレ + Tier 判定基準)
- .claude/docs/requirements/tier-1-core.md (8 機能の H2 骨格、Phase A-3 完了)
```

#### 最初の 3 アクション

1. `tier-1-core.md` の **Tasks** から記入開始（Owner Provider / DB Tables / IPC Commands は実コードで grep 確認）
2. Acceptance Criteria は「ユーザーが UI で観察できる挙動」レベルに具体化（5 件以上）
3. Tasks → Schedule → Notes → Memo → Database → MCP → Cloud Sync → Terminal の順に記入

#### Tier 2/3 は Tier 1 完了後

- `tier-2-supporting.md`: AC を 3-5 件に簡略化可
- `tier-3-experimental.md`: Verdict（凍結 / 削除候補 / 未着手）を確定。`paper_boards` / `analytics` は git log で利用度確認

### Step 3-B: Phase C キックオフ（推定 1-2 セッション）

#### 最初に開くファイル

```
- 本ファイル §「Phase C」セクション（事前データ表 + 5 件事前要旨を確認）
- .claude/feature_plans/2026-04-18-deferred-items-reevaluation.md（保留 5 件詳細）
```

#### 最初の 5 アクション

1. **C-1 棚卸し**: 上記事前データ表をベースに 11 件の Verdict (Keep / Merge / Drop) を確定
2. **019-022 を archive へ移動**: `.claude/archive/dropped/` に移動 + 各ファイル冒頭に Drop 根拠追記
3. **Merge 候補を要件に統合**: `023-cmux-terminal-features` → tier-1 Terminal、`025-life-editor-ui-ux-refactor` → tier-2 UI、Mobile Phase 2/3 → tier-1 Cloud Sync
4. **C-2 保留 5 件**: 上記事前要旨表をベースに各 Verdict 確定 → Keep のみ新規 plan 起票（`2026-MM-DD-<slug>.md`）/ Drop は ADR-0006-... に記録（Status: Rejected）
5. **deferred-items-reevaluation.md** に Status: Consumed (Phase C 完了) マーク

### Step 4: セッション終了時

- `/session-verifier` でドキュメント整合性チェック
- `/task-tracker` で MEMORY.md / HISTORY.md 更新 + コミット
- ※ 別セッションのコード変更（27 ファイル、未コミット）と混ざらないよう、明示ファイル指定で git add すること
