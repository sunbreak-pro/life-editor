# Plan: 保留項目 5 件の再評価（定義確定後の判断用）

**Status:** Consumed (Phase C 完了, 2026-04-18) — 全 5 件の Verdict 確定済、実装は後続 Plan / ADR に移管
**Created:** 2026-04-18
**Task:** `2026-04-18-app-redefinition-roadmap.md` Step 3 の問いリスト
**Project:** /Users/newlife/dev/apps/life-editor

---

## Phase C Verdicts（2026-04-18 確定）

| Item | Verdict                        | 後続アクション                                                                                                         |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| I-1  | **Keep (measurement-first)**   | `.claude/feature_plans/2026-04-18-tasks-fetch-by-range.md`（iOS 計測 → しきい値判断）                                  |
| S-2  | **Modify (ADR-only)**          | `.claude/docs/adr/ADR-0006-tauri-ipc-naming-policy.md`（実装は Drop、規約明文化のみ）                                  |
| S-4  | **Keep (measurement-first)**   | `.claude/feature_plans/2026-04-18-folder-progress-batch-memo.md`（Profiler + React Compiler 再計測 → しきい値判断）    |
| S-5  | **Keep (immediate)**           | `.claude/feature_plans/2026-04-18-service-error-handler-hook.md`（`useServiceErrorHandler` 導入、silent failure 解消） |
| S-6  | **Keep Option A (ADR + plan)** | `.claude/docs/adr/ADR-0007-mobile-provider-strategy.md` + `.claude/feature_plans/2026-04-18-context-hook-optional.md`  |

本ファイル以降の「問い」セクションは各後続 Plan / ADR で解決済。

---

## Context

2026-04-18 のコードレビュー（`~/.claude/plans/electron-tauri-snoopy-avalanche.md`）で Blocking 3 / Important 5 / Suggestion 6 件を抽出し、Blocking 3 + Important 5 + Suggestion 2 を実装済み。**残り Suggestion 4 件 + Important 1 件の部分** が保留中だが、これらは「定義書（Step 1）と要件（Step 2）が確定してから Keep / Modify / Drop を判断する」方針とした（ロードマップ参照）。

このファイルはその 5 件を **実装 TODO ではなく判断すべき問い** として整理する。次セッション（Step 3）でこのファイルの各「問い」に回答し、必要なものだけ `NNN-<slug>.md` として切り出す。

**決定フレームワーク**:

```
問い → 定義書の該当セクション参照 → Keep / Modify / Drop 判定 → 根拠記述
  ↓ Keep の場合
  → 通常の feature_plan として切り出し（例: 026-tauri-ipc-typed-inputs.md）
  ↓ Drop の場合
  → .claude/docs/adr/ に「不採用理由」ADR を記録
```

---

## Deferred Items（5 件の問い）

### Item 1: I-1 完全版 — Rust `db_tasks_fetch_by_scheduled_range` 新コマンド

**背景**: 2026-04-18 に `MobileCalendarView` の useEffect 分離で日付変更時の全件フェッチは解消済み。ただし **sync 完了時には今でも `fetchTaskTree()` 全件取得が走る**。タスク数が数百を超えると iOS で遅延する想定。

**現状の暫定対応**:

- `useEffect` 分離で日付切替時の再フェッチ排除 ✅（実装済み）
- sync 完了時のみ全件取得 ⚠️（残課題）

**問い**:

- Q1: Life Editor の想定タスク数は何件か（Target User がパワーユーザーなら数千件、ライトなら数十件）
- Q2: sync 完了時の全件取得は実測で何 ms 掛かるか（計測必要）
- Q3: iOS での許容遅延は？（500ms？ 2 秒？）
- Q4: Range 指定フェッチに切替えた場合、検索や DnD など「全ツリー参照」する機能は別途キャッシュする必要があるか

**判断材料**:

- Tier (Step 2): Tasks は Tier 1 → 遅延は許容されない
- Platform Strategy (Step 1 セクション 5): Mobile は "Consumption + Quick capture" なら重い機能削減 OK

**判定フォーマット**（Step 3 で記入）:

- Verdict: Keep / Modify / Drop
- Reasoning: <!-- 記入 -->
- 実装 plan 切り出し: `NNN-tauri-tasks-by-range.md` (Keep なら) / なし (Drop なら)

---

### Item 2: S-2 — Tauri IPC naming 方針（ADR + typed input struct 移行）

**背景**: Rust コマンド引数が `snake_case`、TS 側が `camelCase`。Tauri 2.0 の自動変換に依存している。2026-04-18 に 4 件の戻り値型 snake_case 不整合（プロダクションバグ）を修正したが、**引数側の自動変換依存は残っている**。

**問い**:

- Q1: 今回発覚したプロダクションバグ（TagAssignment 4 件）の原因は戻り値型の不整合。引数側は現状動いている。**明示化（typed struct 化）の価値は「将来の事故予防」だけか、他にあるか？**
- Q2: Tauri 3.0 / 4.0 で自動変換仕様が変わるリスクはどの程度現実的か（Tauri のリリースノート・RFC を確認）
- Q3: typed input struct 移行のコストは？（全コマンド数 = 約 150、機械的変換可能）
- Q4: ADR だけ書いて実装は後回しにするか、ADR + 実装まで一気に行くか

**判断材料**:

- Tier (Step 2): 内部実装の整合性なので Tier 自体ではない → 価値は「保守性」
- AI Integration (Step 1 セクション 7): Claude Code が新規コマンド追加するとき迷わない → 間接的に AI 連携の価値

**判定フォーマット**（Step 3 で記入）:

- Verdict: Keep / Modify / Drop
- Reasoning: <!-- 記入 -->
- 実装 plan 切り出し:
  - `NNN-tauri-ipc-naming-adr.md` (ADR のみ、低コスト)
  - `NNN-tauri-ipc-typed-inputs.md` (全コマンド移行、中〜高コスト)
  - 両方を別 plan で切る / 統合する

---

### Item 3: S-4 — `computeFolderProgress` 一括計算（TaskTreeNode パフォーマンス）

**背景**: `TaskTreeNode.tsx:141-144` で `useMemo` を使っているが、`nodes` が変わるたびに全フォルダで再計算。`computeFolderProgress` は内部で走査するため **フォルダ数 × ノード数 = O(n²)** 気味。

**問い**:

- Q1: 実際にパフォーマンス劣化が体感できるタスク数・フォルダ数は？（計測必要）
- Q2: Target User（Step 1 セクション 2）の典型的なツリーサイズは？
- Q3: 一括計算（Map<folderId, progress> を `useTaskTreeAPI` 側で 1 回計算）にするとコードは読みにくくならないか
- Q4: React 19 の自動 memo 化（Compiler）で解決する可能性はあるか

**判断材料**:

- Tier (Step 2): Tasks は Tier 1 → パフォーマンスは重要
- Target User (Step 1): ツリーサイズが小さい（~100 件以下）ユーザーなら対応不要

**判定フォーマット**（Step 3 で記入）:

- Verdict: Keep / Modify / Drop
- Reasoning: <!-- 記入 -->
- 実装 plan 切り出し: `NNN-folder-progress-batch-memo.md` (Keep なら)

---

### Item 4: S-5 — `useServiceErrorHandler` 共通ヘルパ

**背景**: `catch (e) { console.warn(...) }` が `TimerContext` 10 箇所以上、`SyncContext`、`MobileCalendarView` など分散。`ToastProvider` は両プラットフォームで存在するのに活用されていない。

**現状の暫定対応**:

- `SyncContext` のみ 2026-04-18 に toast 統合済み ✅
- 他はまだ console.warn のまま ⚠️

**問い**:

- Q1: ユーザーに見せるべきエラーと、見せなくて良いエラー（バックグラウンド失敗等）の境界は？
- Q2: 共通ヘルパにした場合、i18n 化が前提になるか（`t("errors.timerStartFailed")` 等）
- Q3: Toast が多発すると UX を損なう。rate limit や dedup が必要か
- Q4: ヘルパ化 vs 各 catch で直接 `useToast()` を呼ぶ、どちらが読みやすいか

**判断材料**:

- Tier (Step 2): 全 Tier 横断の UX 品質
- Core Value Propositions (Step 1 セクション 3): 「信頼できるデータ」が Value の一部なら、silent failure は許されない

**判定フォーマット**（Step 3 で記入）:

- Verdict: Keep / Modify / Drop
- Reasoning: <!-- 記入 -->
- 実装 plan 切り出し: `NNN-service-error-handler-hook.md` (Keep なら)

---

### Item 5: S-6 — `createContextHook` optional バリアント（Mobile 省略 Provider 対応）

**背景**: Mobile で AudioProvider / ScreenLockProvider / FileExplorerProvider / CalendarTagsProvider / WikiTagProvider / ShortcutConfigProvider が省略されている。`createContextHook` は Provider 外で呼ぶと throw する設計。**現時点では Mobile\* で直接 import されていない**が、共有コンポーネント経由で呼ばれたら即クラッシュ。

**問い**:

- Q1: Mobile 省略 Provider は「恒久的に省略」か「いずれ対応」か（Platform Strategy Step 1 セクション 5 で決定）
- Q2: Option A (optional hook) と Option B (Mobile でも Stub Provider をマウント) のどちらを採用するか
  - A の利点: モバイルバンドルサイズが軽い
  - B の利点: 呼び出し側が分岐不要、コードが単純
- Q3: 現状の "共有コンポーネントが Desktop 専用 hook を呼ぶ" バグを静的検出する仕組みは必要か（ESLint custom rule、Mobile build 時の import 禁止リスト等）
- Q4: これは「設計 ADR」か「実装 plan」か（A/B 選択時点で ADR、実装は別 plan）

**判断材料**:

- Platform Strategy (Step 1 セクション 5): Mobile で "恒久省略" と決まれば、B の Stub 案は否定される
- Feature Tier (Step 1 セクション 8): 省略 Provider の機能が Tier 3 なら Mobile 対応は不要

**判定フォーマット**（Step 3 で記入）:

- Verdict: Keep (A) / Keep (B) / Modify / Drop
- Reasoning: <!-- 記入 -->
- ADR 切り出し: `.claude/docs/adr/NNNN-mobile-provider-strategy.md`
- 実装 plan 切り出し: `NNN-context-hook-optional.md` (A 採用時) / `NNN-mobile-stub-providers.md` (B 採用時)

---

## Code Contradictions / Unnecessary Features（Step 3 で埋める空欄）

Step 3 では上記 5 件の再評価に加え、以下の観点でコード walk-through を行い記録する:

### 矛盾点（ビジョン ↔ 実装）

**記入ガイド**: 定義書（Step 1）のビジョン・Value Proposition と現状コードの乖離を列挙。

<!-- 例:
- **「AI と一緒に生活を設計」ビジョン vs UI**: Desktop の Sidebar に "Launch Claude" があるだけで、AI との対話導線が薄い。ターミナル起動 → Claude Code は技術者以外には高いハードル
- **「Notion 的な汎用 DB」ビジョン vs 実装**: Database (frontend/src/components/Database/) の UX が Tasks / Schedule に比べて未成熟（relation/formula 未対応）
-->

### 不要機能候補（Tier 3 の中から）

**記入ガイド**: Tier 3 に分類された機能のうち、**半年以上バグ修正されていない / ユーザー（作者）が使っていない** ものをリスト。

<!-- 例:
- **Paper Boards**: 2026-01 以降のコミットに登場しない。実利用ゼロの疑い。削除候補
- **Analytics**: 基盤のみで具体的なダッシュボードなし。ロードマップと要件が不明確
-->

### 負債（Keep だが技術負債として記録）

**記入ガイド**: 削除はしないが、将来の拡張を阻害している部分。

<!-- 例:
- **Provider ツリーのネスト深度**: Desktop で 14 階層。新規 Provider 追加のたびに main.tsx が肥大
- **DataService インターフェース肥大**: 150+ メソッド。機能別ファイルに分割すべき
-->

---

## Files

| File                                                                  | Operation | Notes                                            |
| --------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| `.claude/feature_plans/2026-04-18-deferred-items-reevaluation.md`     | Create    | 本ファイル                                       |
| `~/.claude/plans/electron-tauri-snoopy-avalanche.md`                  | Reference | 元のコードレビュー plan（保留項目の詳細記述）    |
| `.claude/feature_plans/2026-04-18-application-definition-template.md` | Reference | 判定の根拠となる定義書（Step 1 の成果）          |
| `.claude/docs/adr/*.md`                                               | Create    | Drop 判定の ADR（不採用理由の記録）              |
| `.claude/feature_plans/NNN-*.md`                                      | Create    | Keep 判定の実装 plan（通常の連番形式で切り出し） |

---

## Verification

- [ ] 5 件すべてに Verdict (Keep / Modify / Drop) と Reasoning が記入されている
- [ ] Keep 判定のものは `NNN-<slug>.md` として実装 plan が切り出されている
- [ ] Drop 判定のものは `.claude/docs/adr/NNNN-*.md` に不採用理由が記録されている
- [ ] Step 1 定義書 のどのセクションを根拠にしたか、各 Reasoning 中で参照されている
- [ ] Code Contradictions セクションに最低 3 項目記入（または「矛盾なし」と明示）
- [ ] Unnecessary Features 候補が列挙されている（削除実行は別判断）
- [ ] 負債リストが記録されている（対応は別スプリント）

---

## Notes for Next Session

- **順序**: Step 1（定義書）→ Step 2（要件）を完了してから本ファイルを開く。逆順で来ても判断基準が欠けるので質が落ちる
- **判断に迷ったら**: 「このアプリを半年後に捨てる人が困るか」で考える。困らないなら Drop 候補
- **コードレビュー元**: `~/.claude/plans/electron-tauri-snoopy-avalanche.md` に各保留項目の file:line 付き詳細あり
- **実装済み項目と混同しない**: Blocking 3 + Important 5 + Suggestion 2 は既に 2026-04-18 に実装済み。この 5 件は純粋に保留
