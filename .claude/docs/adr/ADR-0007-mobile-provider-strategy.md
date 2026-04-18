# ADR-0007: Mobile Provider Strategy — Option A (Optional Hook Variant)

**Status:** Accepted
**Date:** 2026-04-18
**Context source:** Phase C 保留項目 S-6（`.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 5）
**Related:** CLAUDE.md §5 Platform Strategy / §9.2 Pattern A

---

## Context

Mobile（iOS）ビルドで `AudioProvider` / `ScreenLockProvider` / `FileExplorerProvider` / `CalendarTagsProvider` / `WikiTagProvider` / `ShortcutConfigProvider` の **6 Provider が省略** されている（§5 Platform Strategy）。現在の `createContextHook` は Provider 外で呼ぶと throw する設計のため、共有コンポーネントが Desktop 専用 hook を Mobile から呼ぶと即クラッシュする構造的リスクがある。

Mobile の省略決定は **恒久的**（CLAUDE.md §5 の「Mobile 省略」マトリクス）で確定済み。選択肢は 2 つ:

| Option | 内容                                                          | バンドルサイズ | 呼び出し側コード |
| ------ | ------------------------------------------------------------- | -------------- | ---------------- |
| A      | `createContextHook` に optional バリアント追加（null を返す） | 軽い           | 分岐あり         |
| B      | Mobile でも Stub Provider をマウント                          | やや重い       | 分岐不要         |

## Decision

**Option A — optional hook バリアントを採用する。**

### 実装方針

- `createContextHook<T>(ctx, name)` はそのまま（Provider 必須、throw）
- 新規: `createOptionalContextHook<T>(ctx, name)` を追加
  - Provider 外で呼ばれた場合は `null` を返す（throw しない）
- Mobile 省略 Provider（6 個）に対応する hook のみ `createOptionalContextHook` を使用
- 共有コンポーネントは `const wiki = useWikiTagContextOptional()` で受けて `if (!wiki) return null;` 等の分岐でガード
- ESLint custom rule で「Desktop 専用 hook を `.mobile.tsx` から import 禁止」を検討（別 plan、本 ADR 対象外）

### 決定根拠（Option A 採用理由）

1. **Mobile バンドルサイズ軽量化**（§5 Mobile の "Consumption + Quick capture" 用途）— Audio / WikiTag / FileExplorer などのコードは Mobile で完全に dead code として除去可能
2. **意図の明示性**: hook 名（`*Optional`）で Provider 省略可能性が型レベルで明示される
3. **Stub Provider 案 (Option B) の欠点**: 無駄な state hydrate コード / 6 Provider 分の Stub メンテコスト / mobile バンドル膨張
4. Platform Strategy §5 で「恒久省略」が確定済みのため、Stub 維持の意義なし

## Consequences

### Positive

- 共有コンポーネントが Desktop / Mobile 両対応になる（null チェックで分岐）
- Mobile バンドルが軽量化される（6 Provider + 関連 hook のコードが tree-shake される）
- 型レベルで「Provider 省略可能」が明示される

### Negative

- 呼び出し側で `if (!ctx) return null;` 等のガードが必要（コードが若干冗長化）
- Optional hook と通常 hook を混同すると静的に検出できない → PR レビューで命名規約（`*Optional` 接尾辞）を徹底

## Follow-up plans

- **実装 Plan**: `.claude/feature_plans/2026-04-18-context-hook-optional.md`（本 ADR と対になる）

## Alternatives considered

- **Option B (Stub Provider)**: 上記の欠点により不採用
- **変更なし**: Desktop 専用 hook が Mobile にリークした場合のクラッシュリスクを放置することになるため不採用
