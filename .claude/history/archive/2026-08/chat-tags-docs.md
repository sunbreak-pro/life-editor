# HISTORY ARCHIVE (chat-tags-docs, 2026-08)

ローリングアーカイブ: `history/chat-tags-docs.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-13 - #674 services 層の PostgREST 定型畳み込み（残作業）

#### 概要

#674 の DoD 4 つを実測し、未達だった 1 点（`itemLockGate.ts` に残っていた single-row 読み 3 箇所）を共有ヘルパへ委譲した（PR #799 open）。

#### 変更点

- **畳んだ 3 経路**: `nextItemVersion` → `requireSingleRow` / `verifyPassword` → `fetchMaybeSingleRow` / `toggleEditLock` → `requireSingleRow`。PR #772 が「直前の PR #747 で着地したファイルなので最小限しか触らない」として見送っていた分
- **挙動不変の根拠**: 3 箇所ともエラーラベルが元から `: <message>` で終わっており、ヘルパが付ける形と一致。**テストファイルを 1 行も変更せず** `itemLockGate.test.ts:164/366/465` と service 側 3 箇所の assertion がそのまま緑
- **残した判断**: `bumpMeta` / `patchPayload` は `.select()` を伴わない UPDATE で行を返さないためヘルパの対象外。`SupabaseItemConversionService` の `Promise.all` 2 組は `postgrestSingle.ts` ヘッダに理由付きで記録済みの意図的除外
- **DoD の実測**: 3 段ジョインは `fetchMetaFirstJoin` に統一済（Tasks×2 / Routines×2 / NotesReads / Dailies）/ ロック 6 メソッドは `ItemLockGate` に集約済 / `DataService.ts` の最終変更は #722 で #747・#772・本 PR のいずれも未接触（公開 IF diff ゼロ）/ 畳んだ経路 4 本すべてに vitest あり
- **前提の確認**: 着手時に `gh pr list --state open` が空だったため係争ファイルなしと判断。PR 提出後に他レーンの 9 本が open になったが、触ったテストファイルとの重複はゼロを実測
