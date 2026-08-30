# HISTORY (chat-tags-docs)

### 2026-08-30 - #1291 タグアイコンを共通チップへ

#### 概要

タグのアイコンが見出し / 一覧 / Tag hub には届いていてチップで止まっていたのを、共通部品側で埋めた（PR #1318 open）。

#### 変更点

- **`TagPill` を `web/src/wikitag/` → `shared/src/components/` へ移動**。「タグ名が出るところ全部」に出す部品が 1 ホストの中にいるのは筋が通らないため（CLAUDE.md §6）。`web/src/wikitag/index.ts` は shared から再エクスポートして旧パス参照を生かした
- **先頭マークを色ドットから `TagHeadingIcon` のグリフへ**。見出し / hub と同じ 1 本の読み出し経路になり、「アイコンを編集したら全面が追随する」が構造で成立する。グリフ自体がタグ色で着色されるのでドットは重複だった。未設定は汎用 Tag グリフ（master list と同じ fallback）
- **`TagHeadingIcon` に `size` prop を追加**（既定 15 = 従来値）。チップは見出しより小さい字送りのため
- **採用した呼び出し側**: `TagPicker`（付与済みチップ + 候補リスト）/ `TagFilterPanel`（`TagFilterPanelTag` に `icon` 追加）/ `useTagFilterPanel`（`allTags` から流す）
- **境界**: `web/src/notes/` は不可侵（#1288 が同面を再構成中）。保存済みグループの要約行は名前のカンマ列でチップではないため対象外
- **テスト**: `shared/tests/tagChipIcon.test.tsx` 新規 5 件 + `tagFilterPanel.test.tsx` に 2 件追加。lucide が `<svg class="lucide lucide-star">` を刻むのでスナップショット無しでグリフを特定できる

### 2026-08-30 - #1289 タグ編集パネルのアイコンピッカーが崩れる不具合

#### 概要

ピッカーを開くと行が崩れ背景が透けて見えた件。Issue の見立て（未定義 `bg-lumen-*` の透明落ち）は外れで、原因は**幅**だった（PR #1314 open）。

#### 変更点

- **原因**: ポップオーバーが `absolute` なので包含ブロックが 32px のトリガーボタン。そこでの `width: auto` は shrink-to-fit = `min(max(min-content, 32px), max-content)` で、中身の `grid-cols-6` は Tailwind では `repeat(6, minmax(0, 1fr))` = **min-content 0**。下限が gap 5 個分（20px）しかなく、**背景が約 32px 幅で描かれ 28px のアイコンボタンだけが幅 0 のトラックからはみ出して隣の名前入力に散っていた**
- **`ColorPicker` で出なかった理由**: あちらのパネルは通常フローにいて、自分の幅が flex アイテムの幅に反映される
- **修正**: `w-max` 1 つ。#552 が色トークンを 1 段上げて直そうとしたのは対症で、幅には触れていなかった
- **テスト**: `shared/tests/tagIconPickerSurface.test.tsx` 新規 7 件。jsdom にレイアウトが無いので 204px そのものは測れないが、(a) ポップオーバーが自前の幅クラスを持つこと（`w-max` を外すと落ちるのを実測で確認）、(b) 塗っている `lumen-*` クラスが全て `tokens.css` に宣言済みであること、(c) その元値が light / dark 両スコープにあること、は宣言から検査できる
- **申し送り**: 未定義 `bg-lumen-*` の無警告透明落ちを機械で捕まえるゲートは (b) の形で書ける。他の浮遊面にも横展開の余地あり


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

### 2026-07-30 - #474 plans/ の Status 棚卸しと archive 移動

#### 概要

`.claude/docs/vision/plans/` の 12 本を Issue / PR の state とコードに突き合わせ、完了していた 9 本を `archive/` へ移した（PR #485・レビュー待ち）。

#### 変更点

- **判定方法**: 判定の正は `gh issue list` / `gh pr list` の state ＋ コード実測。`git diff` / `git log` / `git cherry` は squash merge を未マージと誤判定するため不使用（CLAUDE.md §7.4）。12 本を並列 fan-out で調査し、COMPLETED 判定は全件メイン側で state を再実測して spot check（docs-consistency §5）
- **archive 移動**: COMPLETED 8 本（design-implementation-fanout / work-implementation / app-integration / layout-unification-fanout / event-routine-unification / layout-standard-v2 / life-tags-unification / open-issue-fanout）+ SUPERSEDED 1 本（link-ux-obsidian-style — 3 軸すべて別方式で着地しており Draft のままでは実態と矛盾）
- **plans/ 残置 3 本**: desktop-daily-driver（残は Mac 実機ゲート）/ schedule-redesign（#466〜#469 open）/ loop-engineering-harness（Phase 1〜3 未消化）の Status 行を実態へ修正
- **archive の enum 化 6 本**: `ARCHIVED` / `DONE` / `COMPLETED（Superseded）` / stale な `IN PROGRESS`（docs-consistency-cleanup・PR #178 merge 済みなのに残っていた）を enum に統一
- **参照の付け替え**: 移動で壊れる相対リンクと Parent 行（schedule-redesign / loop-harness / fanout-r2 / tier-1-core / tier-2-supporting / archive/SUMMARY.md / archive 3 本）を修正。`.claude/` 配下 161 本のリンクを解決して新規の壊れゼロを確認
- **chat-main へ回した判断**: claudedesign fan-out は COMPLETED 相当だが CLAUDE.md §6 が「デザイン追跡正本」と宣言しているため据え置き（D-20260730-tags-1）
- **申し送り**: `grep -n "^Status:"` は `**Status**:` 形式と blockquote 前置を取りこぼす（実際 2 本見落とし）。全数チェックは node で先頭 14 行を両形式で走査した

### 2026-07-30 - #368 WikiTags 一覧の名前フィルタ

#### 概要

アプリで唯一タグマスタ全件を並べるタグ編集パネルに、名前での絞り込み入力を追加した（PR #481 merged）。

#### 変更点

- **共有部品の切り出し**: `SidebarListControls` のフィルタ行を `shared/src/components/materials/SidebarFilterField.tsx` として独立させ、sidebar / modal の 2 プリセット（`size`）を持たせた。`SidebarListControls` は sort props 必須で「ソート無し・フィルタのみ」を表現できなかったため（スコープは D-20260728-main-3 で名前フィルタのみに縮小確定）
- **TagEditModal**: 追加行とリストの間にフィルタ行。大文字小文字を無視した部分一致（item 側 `TagPicker` と同規則）・一致 0 件は専用コピー・タグが 1 件も無いときはフィルタ行を出さない・開き直しでクエリ reset
- **i18n**: `materials.tags.filterPlaceholder` / `filterLabel` / `filterEmpty` を en / ja 両 catalog に追加
- **テスト**: `shared/tests/tagEditModalFilter.test.tsx` を 9 ケース新規追加（既存 `tagEditModalItems.test.tsx` の LABELS も追随）
- **横展開の申し送り**: `Connect/GraphControlPanel.tsx:177-198` のタグ pill 群も絞り込み無しなので outbox から起票依頼
