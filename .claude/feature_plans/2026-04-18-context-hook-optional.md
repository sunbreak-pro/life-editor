# Plan: createOptionalContextHook Introduction（S-6 実装、ADR-0007 準拠）

**Status:** PLANNED
**Created:** 2026-04-18
**Project:** /Users/newlife/dev/apps/life-editor
**Verdict source:** `.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 5 (S-6)
**ADR:** [`ADR-0007-mobile-provider-strategy.md`](../docs/adr/ADR-0007-mobile-provider-strategy.md)
**Related requirements:** CLAUDE.md §5 Platform Strategy / §9.2 Pattern A

---

## Context

ADR-0007 で **Option A（Optional hook バリアント）** が採用された。Mobile で省略されている 6 Provider（AudioProvider / ScreenLockProvider / FileExplorerProvider / CalendarTagsProvider / WikiTagProvider / ShortcutConfigProvider）に対応する hook を `createOptionalContextHook` 経由に切替え、共有コンポーネントが Mobile で Provider 外から呼んでもクラッシュしない状態にする。

## Verdict

**Keep (実装)** — ADR-0007 で Option A 確定。バンドル軽量化 + 型レベル明示を実現する。

## Steps

- [ ] S1. `frontend/src/context/createOptionalContextHook.ts` を新設
  - シグネチャ: `createOptionalContextHook<T>(ctx: Context<T | null>, name: string): () => T | null`
  - Provider 外では null、内では T を返す
- [ ] S2. 既存 `createContextHook` との命名規約統一（テスト含む）
- [ ] S3. 以下 6 hook を `createOptionalContextHook` + `*Optional` 接尾辞に置換:
  - `useAudioContext` → `useAudioContextOptional`
  - `useScreenLockContext` → `useScreenLockContextOptional`
  - `useFileExplorerContext` → `useFileExplorerContextOptional`
  - `useCalendarTagsContext` → `useCalendarTagsContextOptional`
  - `useWikiTagContext` → `useWikiTagContextOptional`
  - `useShortcutConfigContext` → `useShortcutConfigContextOptional`
- [ ] S4. **Desktop 側使用箇所は既存の必須 hook 名を残す**（Desktop では必ず Provider があるため throw のままでよい）→ 共存設計
  - 具体案: 内部実装は同じ Context を参照し、Optional 版は null を返す別 hook を export
- [ ] S5. 共有コンポーネント（Desktop / Mobile 両対応）で使われている上記 6 hook の呼び出しを Optional 版に切替え + null ガード追加
- [ ] S6. Mobile `.mobile.tsx` / `MobileLayout.tsx` で Desktop 専用 hook を import している箇所の audit（grep で確認）
- [ ] S7. Verification:
  - Mobile ビルドでクラッシュせず TrashView / Settings / Tips 等の共有コンポーネントが表示される
  - Desktop ビルドで既存動作（必須 hook の throw）が維持される

## 設計詳細（S4 の共存設計）

```ts
// context/WikiTagContext.tsx
export const WikiTagContext = createContext<WikiTagContextValue | null>(null);

// hooks/useWikiTagContext.ts（Desktop 前提、必須）
export const useWikiTagContext = createContextHook(
  WikiTagContext,
  "useWikiTagContext",
);

// hooks/useWikiTagContextOptional.ts（Mobile でも使える）
export const useWikiTagContextOptional = createOptionalContextHook(
  WikiTagContext,
  "useWikiTagContextOptional",
);
```

共有コンポーネント側:

```tsx
const wiki = useWikiTagContextOptional();
if (!wiki) return null; // Mobile では何も表示しない
// wiki.xxx を使用
```

## Non-goals（本 Plan 対象外）

- ❌ ESLint custom rule での「Desktop 専用 hook を .mobile.tsx から import 禁止」（別 Plan）
- ❌ Mobile 省略 Provider の機能 Mobile 対応（恒久省略、§5 Platform Strategy）
- ❌ Stub Provider アプローチ（Option B、ADR-0007 で不採用）

## Verification

- [ ] `createOptionalContextHook` が単体テスト pass
- [ ] 6 Provider の Optional hook が export 済み
- [ ] 共有コンポーネントで Optional hook 経由の null ガードが実装済
- [ ] Mobile ビルドが通り、該当画面で crash しない
- [ ] Desktop ビルドで既存の必須 hook 動作が維持される（throw on missing Provider）
- [ ] CLAUDE.md §9.2 Pattern A に「Mobile 省略 Provider には Optional バリアントを用意する」ルール追記
- [ ] §Toast / §WikiTags 等の Known Issues（該当あれば）を更新

## Files

| File                                                     | Operation | Notes                            |
| -------------------------------------------------------- | --------- | -------------------------------- |
| `frontend/src/context/createOptionalContextHook.ts`      | Create    | 本 Plan の核                     |
| `frontend/src/context/createOptionalContextHook.test.ts` | Create    | 単体テスト                       |
| `frontend/src/hooks/useAudioContextOptional.ts`          | Create    | 6 Optional hook                  |
| `frontend/src/hooks/useScreenLockContextOptional.ts`     | Create    |                                  |
| `frontend/src/hooks/useFileExplorerContextOptional.ts`   | Create    |                                  |
| `frontend/src/hooks/useCalendarTagsContextOptional.ts`   | Create    |                                  |
| `frontend/src/hooks/useWikiTagContextOptional.ts`        | Create    |                                  |
| `frontend/src/hooks/useShortcutConfigContextOptional.ts` | Create    |                                  |
| 共有コンポーネント各所                                   | Update    | Optional hook 経由 + null ガード |
| `.claude/CLAUDE.md` §9.2                                 | Update    | Optional バリアント規約追記      |
