# Plan: Folder Progress Batch Memoization（S-4、計測前提）

**Status:** DROPPED (2026-04-18 — 計測しきい値未達、Compiler 不要で Drop)
**Created:** 2026-04-18
**Project:** /Users/newlife/dev/apps/life-editor
**Verdict source:** `.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 3 (S-4)
**Related requirements:** [`tier-1-core.md`](../docs/requirements/tier-1-core.md) §Tasks Known Issues

---

## Context

`TaskTreeNode.tsx:141-144` で `computeFolderProgress` を `useMemo` しているが、全ノード走査のため **フォルダ数 × ノード数 = O(n²)** 気味。大規模ツリーで TaskTree の再レンダ時に体感できる遅延が発生する可能性（§Tasks Known Issues の保留 S-4）。React 19 Compiler の自動 memo 化で解決する可能性もあるため、**計測 → しきい値判断** が必要。

## Verdict

**Keep (計測次第で実装)** — React 19 Compiler 有効化後の計測で改善していればそちらを優先、未解消なら一括計算に切替

### 判定根拠

- Tier 1 Tasks のパフォーマンスは Value Proposition（§3 V2「オフライン完全動作」）を支える
- Target User（§2）は生活データ集約を好むパワーユーザー寄り = フォルダ数が増える
- React 19 Compiler（React Compiler）は Vite 19 と組み合わせて Life Editor 現行スタックで利用可能
- 一括 Map 方式はコードの読みにくさが懸念 → Compiler で解決できるならそちらが望ましい

## しきい値（計測ベース）

| フォルダ数 × タスク数 | 再レンダ時間 | 判定                    |
| --------------------- | ------------ | ----------------------- |
| ≤ 50 × 500            | < 50ms       | Drop（実装不要）        |
| 50-100 × 500-2000     | 50-150ms     | Compiler 有効化で再計測 |
| ≥ 100 × 2000          | ≥ 150ms      | Keep（一括計算必須）    |

## Steps

- [ ] S1. React DevTools Profiler で現状の TaskTree 再レンダ時間を計測（フォルダ 50 / 100 / 200 件 × タスク 500 / 2000 件）
- [ ] S2. React 19 Compiler を有効化（vite.config.ts / babel-plugin-react-compiler）して同条件で再計測
- [ ] S3. しきい値に応じて Verdict 確定
- [ ] S4. Keep の場合:
  - `useTaskTreeAPI` で `Map<folderId, progress>` を 1 回計算し全子ノードに配布
  - `TaskTreeNode.tsx` は progress を props から受け取る形に変更（useMemo 削除）
  - `computeFolderProgress` の共通化テスト追加
- [ ] S5. Drop / Compiler 解決の場合: 本ファイルに Status: Dropped マーク → archive/dropped/ へ移動

## 計測結果

**環境**: macOS (Apple Silicon), Node 20, Vitest microbenchmark（`src/utils/folderProgress.bench.test.ts`）。全フォルダを 1 レンダリングサイクル分再計算（最悪ケース）、20 runs/size の avg と max。

| F (folders) | T (tasks/folder) | 総ノード | avg (ms) | max (ms) |
| ----------- | ---------------- | -------- | -------- | -------- |
| 50          | 10               | 550      | 0.27     | 0.85     |
| 100         | 20               | 2100     | 1.87     | 1.94     |
| 200         | 10               | 2200     | 3.33     | 3.35     |
| 100         | 50               | 5100     | 4.31     | 4.58     |
| 50          | 100              | 5050     | 2.08     | 2.12     |

- **ベースライン (React Compiler 未有効)**: F=100, T=50 で max 4.58ms — しきい値 50ms の 1/10 未満
- **Compiler 有効化後**: 未測定（ベースラインが既にしきい値大幅下回りのため不要）

**判定**: Drop (baseline で十分高速、React Compiler も不要)

### 再計測トリガー

以下の条件で再計測推奨:

- 総ノード数が 10,000 を超えた場合
- TaskTreeNode 側で新たな副作用計算が追加され、再レンダが重くなった場合
- Profiler で TaskTree 再レンダが 50ms を超えた場合

### React Compiler 有効化について

本プラン S4-2 / S4-9 で提案された「vite.config.ts への babel-plugin-react-compiler 追加」は、S-4 の Drop 判定により本プランの範疇外に移す。Compiler 有効化は TaskTree 以外のコンポーネントにもメリットがあるが、全体に影響する変更のため別プランで扱うのが適切。

## Verification

- [ ] 計測結果が両条件で記録されている
- [ ] Verdict が Keep / Drop のいずれかで確定
- [ ] Keep の場合、Profiler で再レンダ時間が削減されていることを確認
- [ ] 既存テスト（`computeFolderProgress` 関連）が pass

## Files

| File                                             | Operation | Notes                        |
| ------------------------------------------------ | --------- | ---------------------------- |
| `frontend/vite.config.ts`                        | Update    | React Compiler plugin 有効化 |
| `frontend/src/hooks/useTaskTreeAPI.ts` (or 近傍) | Update    | progress Map 計算            |
| `frontend/src/components/Tasks/TaskTreeNode.tsx` | Update    | useMemo 削除、props 受取     |
| `.claude/docs/requirements/tier-1-core.md`       | Update    | §Tasks Known Issues 更新     |
