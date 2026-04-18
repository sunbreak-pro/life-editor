# ADR-0006: Tauri IPC Naming Policy（ADR Keep / 実装 Drop）

**Status:** Accepted (decision only — no implementation work planned)
**Date:** 2026-04-18
**Context source:** Phase C 保留項目 S-2（`.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 2）
**Related:** CLAUDE.md §10.2 (IPC 3 点同期)

---

## Context

Rust コマンド引数は `snake_case`、TypeScript 側は `camelCase`。Tauri 2.0 の serde 自動変換に依存して通信している。2026-04-18 のコードレビューで **戻り値型の snake_case 不整合 4 件**（TagAssignment 関連）が原因のプロダクションバグを修正した経緯があり、同種の事故予防として「typed input struct 化」を検討する余地があった。

現状の引数側（入力）は自動変換で動作しており、直接のバグは観測されていない。検討した選択肢:

| 選択肢 | 内容                                                                   | コスト | 価値             |
| ------ | ---------------------------------------------------------------------- | ------ | ---------------- |
| A      | 全コマンド（約 150 件）を `struct Input { field_name: String }` に移行 | 中〜高 | 事故予防（将来） |
| B      | ADR だけ書いて実装は現時点で着手しない                                 | 低     | 規約明文化のみ   |
| C      | 何もしない                                                             | 0      | 0                |

## Decision

**B を採用する。** ADR として規約を明文化し、実装は行わない。

### Decision rules（本 ADR が確定する規約）

1. **Rust 側**: 引数 / 戻り値の両方とも `snake_case`（Rust 慣習に従う）
2. **TS 側**: `invoke()` 呼び出し引数は `camelCase`（JS 慣習に従う）
3. **Tauri 自動変換に依存**: serde の自動変換が引数 / 戻り値の両方向で動くことを前提とする
4. **戻り値型は必ず `#[derive(Serialize)]` を付ける**: TagAssignment 事件の再発防止として、Repository 層の rowToModel が snake_case を camelCase に変換することを PR レビューで必ず確認する
5. **複雑な引数構造体**（例: `TaskNode` のような DTO）は例外で struct で受け渡す。フィールド名は Rust 側 snake_case + `#[serde(rename_all = "camelCase")]` 属性で整合させる
6. **3 点同期チェック**: IPC 追加 / 変更時は `src-tauri/src/commands/` + `src-tauri/src/lib.rs` + `frontend/src/services/TauriDataService.ts` の整合を手動確認（CLAUDE.md §10.2）

### 実装を Drop とする理由

- **現状の事故は戻り値側で発生した**。引数側の typed struct 化は戻り値問題の解決にはならない
- **事故予防の価値**は認めるが、150 コマンドの全件移行は中〜高コストで、Life Editor の Value Proposition（§3）を直接支えない
- Tauri 3.0 / 4.0 での破壊的変更リスクは現時点で RFC が出ていない → 将来再評価の余地あり
- CLAUDE.md §10.2 に「IPC 3 点同期」の明文化が既にあり、レビュー時にキャッチできる前提

## Consequences

### Positive

- 本 ADR により命名規約が明文化され、将来の実装判断材料が残る
- 実装を行わないことで、他機能（Phase C の保留 I-1 / S-4 / S-5 / S-6 実装）にリソースを集中できる
- Tauri 2.0 の serde 自動変換を前提として設計を進められる

### Negative

- 引数側の typed struct 化はされないため、将来 Tauri の自動変換仕様が変わった場合に広範な修正が必要
- 新規 IPC 追加時に 3 点同期を人間のレビューに依存する（自動検出の仕組みなし）

### Follow-ups（本 ADR 管轄外）

- Tauri 3.0 リリース時（2026Q4 以降想定）の破壊的変更チェック → 再評価
- ESLint custom rule で「invoke() 引数の camelCase チェック」を導入する提案（別 plan）

## Alternatives considered

- **A (全コマンド typed struct 化)**: コスト高の割に現時点の事故予防価値が低いため不採用
- **C (何もしない)**: 規約が暗黙のまま残るため不採用。ADR だけ書く B 案で明文化
