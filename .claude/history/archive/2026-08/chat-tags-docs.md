# HISTORY ARCHIVE (chat-tags-docs, 2026-08)

ローリングアーカイブ: `history/chat-tags-docs.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-13 - #777 テストの DataService スタブ / fixture を共有ヘルパへ集約

#### 概要

30 スイートが手写ししていたテストの足場（DataService スタブとノード fixture）の土台を 1 箇所に置き、名前が 3 通りに割れていた分を寄せた（PR #812 open）。プロダクションコードは無変更。

#### 変更点

- **新設 3 本**: `shared/tests/helpers/dataServiceStub.ts`（`stubDataService` — `as unknown as DataService` のキャストを集約）/ `shared/tests/helpers/nodeFixtures.ts`（完全一致の `makeNote` 5 本・`makeTask` 2 本）/ `web/tests/helpers/index.ts`（`@life-editor/shared` エイリアスは `../shared/src` を指していて `shared/tests` に届かないため、4 段の相対パスをこの 1 本が持つ）
- **引数型の設計**: `Partial<Record<keyof DataService, unknown>>` — メソッド名だけ型チェックし値は緩いまま。多くのスイートは「本当は TaskNode を返すメソッド」に三つ組を返す（呼ぶ側がそこしか読まない）ため、真の返り値型を要求すると消したかった重複が増える
- **名前統一**: 18 本のファクトリを `makeDS` に（`makeDataService` 7 + `makeDs` 3 を改名）。うち 16 本が `stubDataService` 経由。残り 2 本（paletteItemSearch / workScreenLayout）は絞り込んだローカル型を返すので改名のみ
- **挙動不変の根拠**: diff を assertion 系トークンで絞って**増減 0 行**。テスト本数も前後同一（shared 217/1980・web 32/269）
- **意図的に残した**: 13 スイートのインラインスタブ（Issue の「1 PR で 30 ファイルを書き換えない」）/ Schedule 系の `makeItem`・`makeRoutine`（`frequencyType` と `frequencyDays` が各スイートの試したいケースを決める値で、共有既定を選ぶと他 2 本が何を試しているか黙って変わる）
- **申し送り**: `shared/tests` と `web/tests` は**どの CI ゲートでも型検査されていない**（両 tsconfig とも `include: ["src"]`・eslint は type-aware でない）。`stubDataService` の名前チェックは型検査を走らせた瞬間から効くもので今日の CI では効かない。検証用に一時 tsconfig で `tsc` を回してテスト木エラー 0 件を実測した（Scope 外なのでファイルは削除）。恒久ゲート化は別 Issue の判断

### 2026-08-13 - #674 services 層の PostgREST 定型畳み込み（残作業）

#### 概要

#674 の DoD 4 つを実測し、未達だった 1 点（`itemLockGate.ts` に残っていた single-row 読み 3 箇所）を共有ヘルパへ委譲した（PR #799 open）。

#### 変更点

- **畳んだ 3 経路**: `nextItemVersion` → `requireSingleRow` / `verifyPassword` → `fetchMaybeSingleRow` / `toggleEditLock` → `requireSingleRow`。PR #772 が「直前の PR #747 で着地したファイルなので最小限しか触らない」として見送っていた分
- **挙動不変の根拠**: 3 箇所ともエラーラベルが元から `: <message>` で終わっており、ヘルパが付ける形と一致。**テストファイルを 1 行も変更せず** `itemLockGate.test.ts:164/366/465` と service 側 3 箇所の assertion がそのまま緑
- **残した判断**: `bumpMeta` / `patchPayload` は `.select()` を伴わない UPDATE で行を返さないためヘルパの対象外。`SupabaseItemConversionService` の `Promise.all` 2 組は `postgrestSingle.ts` ヘッダに理由付きで記録済みの意図的除外
- **DoD の実測**: 3 段ジョインは `fetchMetaFirstJoin` に統一済（Tasks×2 / Routines×2 / NotesReads / Dailies）/ ロック 6 メソッドは `ItemLockGate` に集約済 / `DataService.ts` の最終変更は #722 で #747・#772・本 PR のいずれも未接触（公開 IF diff ゼロ）/ 畳んだ経路 4 本すべてに vitest あり
- **前提の確認**: 着手時に `gh pr list --state open` が空だったため係争ファイルなしと判断。PR 提出後に他レーンの 9 本が open になったが、触ったテストファイルとの重複はゼロを実測
