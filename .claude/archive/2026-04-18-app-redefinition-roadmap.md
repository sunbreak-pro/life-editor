# Plan: アプリケーション再定義ロードマップ（3 ステップ戦略）

**Status:** Superseded by `2026-04-18-integrated-design-roadmap.md`
**Created:** 2026-04-18
**Superseded:** 2026-04-18
**Task:** 次セッション以降の作業指針
**Project:** /Users/newlife/dev/apps/life-editor

> **NOTE**: 本プランは `2026-04-18-integrated-design-roadmap.md` に発展統合されました。3 ステップ戦略（定義 → 要件 → 差分評価）の枠組みは継承されています。本ファイルは履歴保存のため残置。

---

## Context

Life Editor は Electron → Tauri 2.0 移行、モバイル対応追加、Cloud Sync 導入、MCP Server 統合などを経て機能が有機的に膨張した。その結果、次の問題が発生している:

- 「このアプリは何か」の定義が **CLAUDE.md / README.md / TODO.md / 各 ADR / 個別 feature_plan** に散在し single source of truth が無い
- 2026-04-17 の `2026-04-17-daily-life-hub-requirements.md` で「AI と一緒に生活を設計する」ビジョンは文書化されたが、**そのビジョンと現状コードの整合性を検証する枠組みがない**
- 直近のコードレビュー（2026-04-18）で抽出された保留項目 5 件（I-1 / S-2 / S-4 / S-5 / S-6）が **実装の優先順位をビジョンに照らして判定できない**
- 過去の機能（例: Paper Boards, WikiTags, ターミナル）が現在のビジョンに対して必須なのか、負債なのかが曖昧

**Why**: ビジョン先行で作業を進めないと、保留項目の実装も「とりあえず直す」レベルに留まる。逆にビジョンを明確にすれば、「そもそも S-5 の ServiceErrorHandler は過剰設計で、ToastContext 統合だけで十分」といった判断も可能になる。

**Non-goals**:

- 既存機能の即時削除（定義確定前に削除判断しない）
- 新機能の追加企画（現状の再定義に集中）
- 大規模リファクタリング（ステップ 3 の判断結果次第）

---

## Steps

### [ ] Step 1: 最上位定義書の作成

**Goal**: 「Life Editor とは何か」を 1 ファイルで答えられる状態にする。

**Deliverable**: `.claude/feature_plans/2026-04-18-application-definition-template.md` を埋めて `.claude/docs/definition.md` （または `README.md` トップ）として確定。

**テンプレート構成**（詳細は `2026-04-18-application-definition-template.md` 参照）:

1. Core Identity — アプリの一行定義と Elevator Pitch
2. Target User — 具体的なユーザー像（作者自身か、広い層か）
3. Core Value Propositions — 既存アプリに対する差別化点
4. Non-Goals — このアプリがやらないこと
5. Platform Strategy — Desktop / Mobile / Cloud の役割分担
6. Data Model Philosophy — Notion 的柔軟性 vs 特化機能のバランス
7. AI Integration Strategy — Claude Code / MCP の位置づけ
8. Feature Tier — Tier 1 (コア) / Tier 2 (補助) / Tier 3 (実験)

**完了条件**:

- テンプレートの全 8 項目が埋まっている
- CLAUDE.md / README.md / TODO.md との矛盾点をチェック済み
- ユーザー（作者）がレビュー承認

---

### [ ] Step 2: 要件定義（機能別 Spec）

**Goal**: Step 1 の定義書に基づき、各機能がどの Tier に属し、どこまで作るかを明文化。

**Deliverable**: `.claude/docs/requirements/` 配下に機能別 Spec ファイル（例: `tasks.md`, `schedule.md`, `audio-playlist.md`, `paper-boards.md`, `cloud-sync.md`, `mcp-integration.md`）。

**各 Spec に含めるもの**:

- 機能の目的（Step 1 のどの Value Proposition を支えるか）
- 機能の境界（何をやる / 何をやらない）
- 現状実装の充足度（◎完成 / ○基本完成 / △基盤のみ / ×未着手）
- 依存関係（他機能 / 外部サービス）
- テスト可能な受け入れ基準（3〜5 個、checkbox 形式）

**完了条件**:

- 全 Tier 1 機能に Spec が存在
- Tier 2 は主要なもののみ Spec 化、残りは簡易記述
- Tier 3 は「実験中」タグのみで Spec 省略可

---

### [ ] Step 3: 差分・矛盾・不要機能の洗い出し + 保留 5 件の再評価

**Goal**: Step 1/2 の定義と現状コードの乖離を検出し、以下を判断:

1. 保留中の 5 件（I-1 / S-2 / S-4 / S-5 / S-6）の実装是非・優先度
2. 現状コードの矛盾点（例: ビジョンでは AI 中心なのに UI に Claude 起動導線が弱い）
3. 不要コードの候補（例: Paper Boards が Tier 3 実験扱いなら凍結 / 削除）

**Deliverable**: `.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md` の「問い」セクションに回答を書き込み、必要な実装を番号付き plan ファイルとして切り出し（例: `026-tauri-ipc-typed-inputs.md`）。

**手順**:

1. 保留 5 件を Step 1/2 の定義に照らして Keep / Modify / Drop 判定
2. 現状コード walk-through（1〜2 時間、主要 30 ファイル程度を読む）
3. 矛盾・不要リストを作成（ADR 化または即時削除 PR）
4. 残った実装タスクを通常の `NNN-<slug>.md` 形式で切り出し

**完了条件**:

- 保留 5 件すべてに Keep / Modify / Drop 判定と根拠が付与
- 不要コード候補リストが 5 件以上 or「なし」と明記
- 実装タスクが通常の feature_plan 形式で起票済み

---

## Files（このロードマップで作成・参照するもの）

| File                                                                  | Operation | Notes                                  |
| --------------------------------------------------------------------- | --------- | -------------------------------------- |
| `.claude/feature_plans/2026-04-18-app-redefinition-roadmap.md`        | Create    | 本ファイル（戦略ドキュメント）         |
| `.claude/feature_plans/2026-04-18-application-definition-template.md` | Create    | Step 1 の雛形                          |
| `.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md`     | Create    | Step 3 の問いリスト                    |
| `.claude/docs/definition.md` （または `README.md` top）               | Create    | Step 1 の成果物                        |
| `.claude/docs/requirements/*.md`                                      | Create    | Step 2 の成果物（機能別 Spec）         |
| `.claude/feature_plans/NNN-*.md`                                      | Create    | Step 3 の結果として起票される実装 plan |
| `.claude/feature_plans/2026-04-17-daily-life-hub-requirements.md`     | Reference | Step 1 のインプット（既存ビジョン）    |
| `CLAUDE.md`                                                           | Reference | 矛盾検出のソース                       |
| `README.md`                                                           | Reference | 矛盾検出のソース                       |
| `TODO.md`                                                             | Reference | 矛盾検出のソース                       |

---

## Verification

次セッションでこのロードマップが「ちゃんと使われている」ことの検証:

- [ ] Step 1 着手時、作業 plan に「Step 1 of `2026-04-18-app-redefinition-roadmap.md`」と明記されている
- [ ] Step 1 成果物が CLAUDE.md / README.md / TODO.md の既存記述と突き合わされている（矛盾 3 点以上検出 or「矛盾なし」を明示）
- [ ] Step 2 の各 Spec が Step 1 の Value Proposition / Feature Tier に紐付いている
- [ ] Step 3 で保留 5 件すべてに判定が付いている（「保留継続」も可、ただし根拠必須）
- [ ] 各ステップ終了時に `.claude/MEMORY.md` 「直近の完了」に記録されている

---

## Summary

**3 ステップ順序**:

1. **定義** (`definition.md`) — What / Why / For Whom
2. **要件** (`requirements/*.md`) — How much of each, with acceptance criteria
3. **評価** — 保留項目と既存コードをこの定義に照らして Keep / Modify / Drop

**原則**: ビジョンが明文化されるまで、保留 5 件 (I-1 / S-2 / S-4 / S-5 / S-6) の実装着手は凍結。急ぎのバグ修正（Blocking 級）だけは例外的に直接対応可。
