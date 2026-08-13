---
Status: Draft
Created: 2026-08-10
Branch: docs/refactor-core-plan-20260810
Owner-chat: refactor-core
---

# Plan: コア構造のリファクタリング（調査 1 + 実装 2 セッション）

> 本計画書が **リファクタリング 10 クラスタの詳細の正本**。GitHub Issue 側は「動機 3 行 + 本書の該当節への参照 + DoD」だけを持つ（数値の非複製原則）。
>
> 進め方は 3 セッション: **調査（2026-08-10・完了）→ 実装セッション 1（C1〜C6）→ 実装セッション 2（C7〜C9 + 追加調査）**。C10 は移行完了後。

---

## Context

- **動機**: 実装コードが 68,227 行 / 445 ファイル（2026-08-10 実測）まで育ち、最大ファイルが 2,392 行に達した。機能追加のたびに同じ形のコードを増やす構造になっており、**「直すと将来の変更が確実に楽になる」箇所を一度まとめて片付ける**
- **制約**: Electron + Capacitor + Supabase への移行中（移行 SSOT が優先）／ コスト $0 ／ merge は常にユーザー（P-001）／ 実ブラウザ検証は chat-main のみ
- **Non-goals**: 機能追加・UI 変更・文言変更・DDL・依存追加（**挙動変更ゼロが原則**。例外は各クラスタで明示）／ パッケージ境界の再構成（C10 として移行完了後に分離）／ `noUncheckedIndexedAccess` の導入（別 Issue）

### 調査の方法と信頼性

8 領域を並列調査 → クラスタ化 → 上位 3 クラスタを懐疑的に再検証、の 3 段で 64 件の findings を得た。採用にあたり `rules/docs-consistency.md` §5 の実測必須則に従い、**主要な数値主張をメインが全数 spot check 済み**（結果は下表。誤差はテストファイル数の ±1 のみで、これは `setup.ts` 等を数えるかの差）。

| 主張                        | 実測結果                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| mcp-server が CI に無い     | ✅ `ci.yml` の verify job は shared / web / desktop のみ                                              |
| tests が型検査対象外        | ✅ `shared/tsconfig.json` の include は `["src", "src/**/*.json"]`                                    |
| eslint baseline の残り      | ✅ 3 ファイル・`react-hooks/set-state-in-effect` 1 ルールのみ                                         |
| TypeScript の版が分裂       | ✅ 3 版（web ~6.0.2 / mcp-server ~5.9.3 / shared・desktop・mobile ~5.6.0）                            |
| index チャンクが肥大        | ✅ 1,564,946 バイト（= 1528KB・自前の警告閾値 600KB の 2.5 倍）                                       |
| DataService の死に宣言 5 件 | ✅ `DataService.ts` の宣言のみ。呼び出しゼロ（desktop の同名関数は Electron main の自前実装で無関係） |
| 旧 Mapper の死蔵            | ✅ `_unused_` フィールド 8 箇所が services に実在                                                     |

### #587 は実装着地済み（close 待ち）

調査中に判明。**PR #642 / #647 が 2026-08-10 に merge 済み**で、対象 2 本は `useNotesUnifiedAPI` 967 → 431 行 / `SupabaseNotesUnifiedService` 842 → 303 行に縮み DoD を満たしている。Issue だけが open のまま残っている（担当 = shared-fix レーン）。本計画は #587 と重複しない。

---

## 検討した代替案（必須）

| 案                                                | 採否 | 却下理由                                                                                                 | 復活条件                                                  |
| ------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 検証ゲート優先（C1 → 清算 → 構造 → 巨大ファイル） | ✓    | —                                                                                                        | —                                                         |
| 最大ファイル（CalendarTab 2,392 行）から着手      | ✗    | 最も大きい 3 本にテストが 1 本も無く、壊しても機械が教えてくれない                                       | C6 の純関数 pin が終わったら session 2 で着手（= C8）     |
| 全 10 クラスタを 1 セッションで一気に             | ✗    | C8 だけで 4〜5 PR。混ぜると中間状態が長引き、他レーンの機能実装と衝突し続ける                            | —                                                         |
| 移行（Electron + Capacitor）完了まで全面凍結      | ✗    | 移行はまだ続く一方で神ファイルは毎週育つ。パッケージ境界に触らない範囲なら移行と干渉しない               | 移行作業と実際に衝突したら該当クラスタだけ later へ落とす |
| `noUncheckedIndexedAccess` を C1 に同梱           | ✗    | 設定 1 行の他 3 本と違い、index アクセス 134 箇所を 1 つずつ意味判断する作業。混ぜると PR がレビュー不能 | C1 完了後に独立 Issue として起票                          |

---

## Scope (Touchable Paths)

```
shared/src/**            （C3 / C4 / C5 / C7 / C9）
shared/tests/**          （C1 / C4 / C5 / C6）
web/src/**               （C6 / C8 / C9）
web/tests/**             （C6 / C8）
mcp-server/**            （C1 / C2）
.github/workflows/ci.yml （C1）
*/tsconfig*.json, */vitest.config.ts, */package.json （C1）
.claude/docs/vision/plans/2026-08-10-core-refactor.md
```

スコープ外が必要になったら **P-008**（実装せずキューへ・現計画を続行）。特に **`mobile/` と `supabase/migrations/` は触らない**。

---

## クラスタ一覧

| ID  | Issue | 内容                                    | impact | effort | risk   | 安全網   | 割当            |
| --- | ----- | --------------------------------------- | ------ | ------ | ------ | -------- | --------------- |
| C1  | #668  | 検証ゲートの穴を塞ぐ                    | high   | L      | medium | あり     | S1（最初）      |
| C2  | #669  | mcp-server 内の手写しを既存 util へ     | medium | M      | low    | あり     | S1              |
| C3  | #670  | shared の機械的清算バッチ               | medium | L      | low    | あり     | S1              |
| C4  | #671  | 型検査を素通りしている契約を型に載せる  | high   | M      | low    | あり     | S1              |
| C5  | #672  | use\*API の load effect を共通基盤へ    | high   | L      | medium | **なし** | S1              |
| C6  | #673  | Schedule の純関数を切り出して pin       | high   | M      | low    | **なし** | S1（必須）      |
| C7  | #674  | items_meta+payload の読み書き定型を畳む | high   | L      | medium | あり     | S2              |
| C8  | #675  | Schedule の巨大ホスト 3 本を分割        | high   | XL     | high   | **なし** | S2（最後）      |
| C9  | #676  | アプリ骨格の再構成                      | high   | L      | medium | **なし** | S2              |
| C10 | #677  | shared ⇄ mcp-server の DB 契約統合      | medium | L      | high   | なし     | later（移行後） |

全 Issue は `shared-fix` ラベル + タイトル prefix `[refactor-core]`（宛先を 1 レーンに固定する = D-20260731-main-2）。**Schedule 系（#673 / #675）に `section:schedule` を付けていないのは意図的** — 付けると schedule-refine レーンが拾って二重着手になる（#473 の実例）。同レーンへの周知は outbox で行う。

**着手順の要**: C1 を必ず最初に置く（以降 9 クラスタの回帰検知が全部ここに乗る）。C6 は session 2 の最大案件 C8 の明示的な前提なので **session 1 中に必ず終わらせる**。C8 は最も無防備なので最後。

---

## Session 1 のクラスタ詳細

### C1 — 検証ゲートの穴を塞ぐ

**問題**: リファクタの前後で壊れたことを機械が教えてくれない。mcp-server は vitest 6 本を持ちながら CI に 1 行も無く、shared/web の全テストはどの tsconfig にも include されず型検査ゼロ、coverage 未計測。

**⚠️ 前提が 1 つ逆だった（要注意）**: 「web は strict を宣言せず TS6 の既定に暗黙依存」は事実だが、**TS 6.0 の strict 既定は `true`**（`web/node_modules/typescript/lib/typescript.js:41441` で実測。TS 5.6 側は `false`）。つまり web は今 strict で動いている。危険なのは **TS 版を 5.x 側に統一した瞬間に web が無言で non-strict に落ちること**。よって統一の方向は **6.0 への引き上げ一択**で、`"strict": true` の明示は版統一より**先に**入れる安全装置になる。

**副産物**: `web/package.json` の `tsc -b --force` が `../shared` を web の TS 6.0.3 でフルビルドしているため、shared/src は既に TS6 で型検査済み。本当に未検査なのは desktop の main + preload、mcp-server/src、そして全テスト。

**手順**（PR 4 本・stacked にせず各 PR を main から独立に切る）:

1. **PR 1**（mcp-server → CI）: `mcp-server/vitest.config.ts` を新規作成し `TZ: "Asia/Tokyo"` を pin（`localDate.ts` の `toLocaleDateString("sv-SE")` がプロセス TZ 依存。pin 無しで CI に載せると局所日付テストが無意味に緑になる）→ `ci.yml` の cache-dependency-path に `mcp-server/package-lock.json` を追加し、desktop ブロックの後ろに install / build / test の 3 ステップ。**lint は足さない**（mcp-server に eslint 設定が無く別作業）
2. **PR 2**: `web/tsconfig.app.json` と `tsconfig.node.json` に `"strict": true` を明示（挙動は現状と同値）＋ coverage 計測を追加（**閾値は入れない**。まず計測して PR 本文に数値を残す）
3. **PR 3 準備（計測のみ・コード変更なし）**: `tsconfig.test.json` を shared / web に書いて `tsc --noEmit` のエラー数を数える。**数を見てからブロッキングにするかベースラインにするか決める**
4. **PR 3**: エラー 0 なら CI にブロッキングで挿す。非ゼロなら eslint baseline と同じ「縮んでいく除外リスト」形式で入れる
5. **PR 4**: shared / desktop / mobile の TypeScript を `~6.0.2` へ**引き上げ**（下げるのは禁止）

**着手前の準備**:

- `cd mcp-server && npm ci && npm run build` を一度回してエラー数を数える（`mcp-server/node_modules` は現在存在しない。src 19 ファイル / 4,254 行は一度も型検査されていない）
- `shared/package.json` に `@types/node` を追加（現在無い。無いと `tsconfig.test.json` は書いた瞬間に落ちる — tests が `node:fs` / `node:url` / `node:path` / `node:crypto` を import している）
- `@vitest/coverage-v8` は各パッケージの解決済み vitest 版に合わせる（shared 4.1.6 / web 4.1.10 / mcp-server 4.1.10。ずれると vitest 4 が起動時に弾く）

**落とし穴**:

- `shared/tsconfig.json` の composite / declaration / rootDir / outDir は extends で継承される。`tsconfig.test.json` 側で打ち消さないと「composite プロジェクトは emit を止められない」で config 自体が通らない
- mcp-server の tests は `module: Node16` + `rootDir: "src"` のため現行 tsconfig の延長では型検査に載らない（別 tsconfig で `moduleResolution: bundler` が要る）
- web は型が `../shared/dist/index.d.ts`・実行が `../shared/src/index.ts` の二重解決。テストを型検査するとローカルで stale dist による嘘の緑／赤が出る
- `mcp-server/tests/briefingSection.test.ts` が shared をパッケージ跨ぎで直 import している。CI に載せると「shared を壊すと mcp-server も落ちる」新しい結合が入る

**リスクが読めない唯一の箇所**: PR 3（tests → 型検査）。shared/tests 188 本は一度も tsc を通っていない。良い兆候（`as any` ゼロ・`import type` を 76 ファイルが使用）と悪い兆候（`@types/node` 不在で 4 行が確実に落ちる）が混在するので、**計測を独立ステップに切ってある**。「入れれば緑」と見積もると必ず溢れる。

### C2 — mcp-server 内の手写しを既存 util とレジストリへ

**問題**: `mcp-server/src/utils/items.ts` に `insertItem` / `softDeleteItem` / `bumpMeta` という正解があるのに、`scheduleHandlers` と `briefingHandlers` が同じ書き込み儀式を 3 箇所複写している。`tools.ts` は import / TOOLS 配列 / switch の 3 箇所同時編集を強いる手動レジストリで、ツール引数は無検証のまま `as Parameters<...>` でハンドラの型に化けている。

**やること**: (a) 3 箇所を `utils/items.ts` へ置換 (b) `tools.ts` を宣言的レジストリ化 + 引数 validator（**registry 化と validator は同じ PR**。分けると dispatcher を 2 回書き換えることになる）(c) migration 0013 欠番の経緯を `db-conventions.md` に 1 節追記。

**依存**: **C1 の PR 1（mcp-server を CI へ）より前に着手しない**。CI に載った直後にやるのが最も安い（既存 vitest 6 本が回り始め、置換の回帰がその場で出る）。

### C3 — shared の機械的清算バッチ

**問題**: 「共有物が既にあるのに使われていない」「共有物の置き場所が間違っている」の 2 つに集約される 15 件。全件が純減か 1:1 置換で、tsc と既存テストが即座に成否を返す。

**PR 4 本**（この順に）:

1. 死蔵コードの削除 — 旧単一テーブル Mapper（`_unused_` フィールドだけで生きている約 300 行）と孤児型ファイル 6 本
2. 共有型の移設 — `ItemsMetaRow`（Tasks 専用 mapper 内にあり他 4 mapper が Tasks に依存）/ `ShortcutRow`（表示コンポーネント内）/ `TimerState`（2 形で重複）/ contentJson ヘルパ
3. 共有ヘルパへの置換 — ブレークポイント定数 / `parseDateKey` / `minutesToTime` / `clamp` / Analytics の「今日・今週」集計（4 コンポーネントに重複）
4. 規約ドリフト是正 — Notes の `[[` リンク・スラッシュメニューと Connect の keydown に IME ガード追加 / `window.confirm` を既存 `RepeatScopeDialog` の形へ / Audio の「Mobile 省略 Provider」という誤コメント 2 箇所

**先に死蔵を消す理由**: 後続クラスタ（特に C7）の置換対象が約 300 行減る。

**スコープの線引き**: `window.confirm` の差し替え先の**見た目は Schedule redesign Epic #290 の管轄**。既存ダイアログの形を流用する範囲に限定し、新規デザインはしない。`analyticsAggregation` の集計結果型 12 件は「公開 API として残すか」の判断が要るので export を外さない。

### C4 — 型検査を素通りしている契約を型に載せる

**問題**: `SupabaseDataService` は Proxy を `as unknown as DataService` で返すため `implements` が 1 件も無く、11 本の `PHASE2_*_METHODS` に手書きした 119 個の**文字列だけ**がルーティングの実体。interface 側 124 個との差分 5 件をコンパイルもテストも検出できない。

**⚠️ 前提の訂正 2 点**:

1. 差分 5 件は配線漏れではなく**完全な死に宣言**（`fetchWikiTags` / `setWikiTagsForEntity` / `openExternal` / `getAutoLaunch` / `setAutoLaunch` — 4 ツリー全部で呼び出し 0 件をメインが実測済み）。よって allowlist 付きの緩いガードではなく、**5 本を消して 119 == 119 の完全一致**にできる
2. 「lockstep テスト 1 本」は成立しない。interface は実行時に消えるので vitest だけでは見られず、しかも `shared/tsconfig.json` が tests を program に入れないため **型 assertion をテストに置くと完全に無効**。正解は「**src に型 assertion**（interface ⟷ セット）」+「**tests に実行時テスト**（セット ⟷ クラス実体・重複・Proxy）」の 2 本立て

**手順**（S1〜S5 で 1 PR、S6 を別 PR、S7〜S8 を別 PR）:

- **S1**: 死に宣言 5 本を `DataService.ts` から削除（124 → 119）
- **S2**: 11 ファイルのセット定義を `as const` 配列 + 型 + `ReadonlySet<string>` の 3 行構成へ。**Set の型引数は必ず `string` のまま**（literal union にすると `route(prop: string)` の `.has()` が弾かれて壊れる）
- **S3**: `shared/src/services/dataServiceRouting.ts` を新規作成（**tests ではなく src**）。`Exclude` + `AssertNever` で双方向の差分を tsc に落とさせる
- **S4**: `shared/tests/dataServiceRouting.test.ts` — 和集合サイズ / pairwise 重複ゼロ（`route()` は上から順に返すので重複は無言の shadow になる）/ 各メンバーが prototype 上で解決できる / 未知 prop で throw
- **S5**: interface を 11 個のドメイン別 interface + `extends` 集約へ分割。長い JSDoc は逐語で移す（消すと #279 / #296 / #407 の判断根拠が失われる）
- **S6**（別 PR）: 11 クラスに `implements` を付ける。**ここだけ想定外の修正が出うる**（ScheduleItems 19 / Dailies 14 / Routines 10 メソッドの署名は未読）。ズレたら実装を interface に合わせる（interface を緩めない）
- **S7**: i18n は型より先にランタイムガード。`shared/tests/i18nKeys.test.ts` で en/ja パリティ（現状 688 == 688 で緑）+ `t("...")` の literal キー実在チェック
- **S8**（条件付き・**駄目なら即撤退**）: `CustomTypeOptions` の型拡張。手書き `.d.ts` は dist に出ないので必ず `.ts` に置く。効かなければ S7 の状態で確定

**i18n を S / low と見積もらないこと**: 型拡張は「dist emit されない」「型は dist・実行は src」「i18next が二重に入っている」の 3 段を越える必要があり、越えた先に動的キー 13 箇所の後始末が待つ。**S7 だけで実際の障害モード（画面にキー文字列が出る）は塞げる**ので、投資対効果はそこで頭打ち。

**着手前**: interface から 5 メソッド削除が公開型の破壊的変更にあたるか `POLICY.md` で判定（呼び出し 0 件なので実質無害だが、判断が割れるならキューへ）。

### C5 — use\*API の load effect を共通基盤へ

**問題**: 同じ形の hook が並んでいるのに修正が 1 本にしか行き渡っていない。#296 の error un-latch は `useScheduleItemsAPI` にしかなく、他の hook はエラーカードが永久に残る。eslint baseline に残る 3 ファイルは全部「effect 冒頭の `setIsLoading(true)`」1 行が原因。

**⚠️ 対象を絞ること**: 「use\*API 6 本を 1 つに括る」と言うと失敗する。実際に 7 本読むと形がかなり違う（TaskTree は `Promise.all` + 選択復元、Notes は本文ハイドレート副作用、Dailies は isLoading も error も無し、WikiTags は 3 本 `Promise.all` を外へ出している）。**対象は baseline の 3 本（schedule / routines / calendars）に絞る**。この 3 本だけは形が本当に揃っている。Notes / TaskTree / Dailies / WikiTags は違反しておらず #300 / #301 / #282 の繊細な意味論を持つので触らない。

**⚠️ 最大の落とし穴 — lint ロンダリング**: `react-hooks/set-state-in-effect` は `useCallback` や別 hook を跨ぐと検出しない（`useWikiTagsUnifiedAPI` の `setLoading(true)` が現に検出されていない）。**effect を共通 hook へ移すだけで lint は緑になり baseline も消せてしまうが、実行タイミングは 1 ミリも変わらない**。逆に共通 hook の effect 本体に `setIsLoading(true)` を残すと違反が新ファイルへ引っ越し、`eslint.config.js` が「新ファイルを baseline に足すな」と禁じているので詰む。**唯一の誠実な解は導出 loading**（`useTaggedItemIndex` が #586 で採用済みの前例）。`async` IIFE で包む逃げ道も禁止（最初の await までは同期実行でタイミングが変わらない）。

**手順**:

- **PR-A**（テスト先行）: `shared/tests/helpers/bumpableSync.tsx` を新設して既存 2 本の手写しを付け替え（3 本目を作らない）→ `useRoutinesAPI` / `useCalendarsAPI` の renderHook テストを新規作成。最低 6 ケース（初回 loading の遷移 / 該当ドメイン bump で再 fetch / 他ドメイン bump では再 fetch しない / reject で error / **成功後も error が latch する現在のバグを明示的に固定**（後段で反転させる）/ trash fetch が失敗しても active list は入る）
- **PR-B**: `useDomainLoad.ts` を新設（`settledKey` state + 導出 loading、成功・失敗どちらも finally で進める、成功時のみ `setError(null)`、`{ isLoading, error, setError }` を返して命令的リロード経路から使えるようにする）→ `useCalendarsAPI` / `useRoutinesAPI` を載せ替え、baseline から 1 行ずつ削除
- **PR-C**: `useScheduleItemsAPI` を載せ替え、**BASELINE ブロックをコメントごと全削除**
- **PR-D**（任意）: `useLatestRef.ts` を新設して 7 箇所の手写しを置換 + `createNoopUndoRedo` をモジュールレベルの凍結シングルトンへ。**コールバックの identity が安定化するので deps 漏れが stale closure として顕在化しうる** — この PR だけは playwright を必須にする

**着地状況（2026-08-13）**: PR-A + PR-B = [#769](https://github.com/sunbreak-pro/life-editor/pull/769)（`useDomainLoad` 新設・calendars / routines 載せ替え・baseline 3 → 1）／ PR-C = [#801](https://github.com/sunbreak-pro/life-editor/pull/801)（`useScheduleItemsAPI` 載せ替え・BASELINE ブロック全削除）／ PR-E = [#686](https://github.com/sunbreak-pro/life-editor/pull/686)（`RoutineContext` の UndoRedo 配線 + i18n ラベル 3 件）。**DoD は全項目達成**（残りは merge 後の playwright のみ = chat-main）。**PR-D は未着手**で、任意かつ playwright 必須のため #672 の close 条件からは外す — やるなら独立 Issue として起こす。

**追い風**（実測）: 導出パターンの実装モデルがリポ内にある / schedule の消費側は既に「データが空の時だけスケルトン」なので loading 意味論の変更がほぼ不可視 / **routines の isLoading・error は消費者ゼロ** / 型が `ReturnType` 経由なので返り値変更は必ずコンパイルで捕まる。

**ルーチンの Undo/Redo は繋ぐ（裁定済み = [D-20260810-refactor-1](../../../decisions/D-20260810-refactor-1.md) の A・2026-08-11）**: `RoutineProvider` だけ UndoRedo に未接続で undo コード約 60 行が空撃ちになっている。`RoutineContext` に `useUndoRedoOptional()` を配線し、**同じ PR で `undoRedo.labels` に `createRoutine` / `updateRoutine` / `deleteRoutine` を en・ja 両方へ追加する**（ラベルが無いと「Undid: createRoutine」という生キーの toast が出る）。

これは本クラスタ唯一の**挙動追加**（他は挙動変更ゼロ）。PR は分ける（PR-E とする）。ルーチンの undo は生成済み Event との整合に触れるため、**merge 後の playwright を必須**にする — ルーチンの作成・更新・削除をそれぞれ Ctrl+Z で戻し、生成済み Event が孤児にならないことを確認する。整合が保てないと判明したら B（削除）へ倒し、新しい D を作って supersede 連鎖で表現する。

**merge 後**: chat-main で playwright（Schedule 初回描画 / 日付切替 / Realtime bump 後にスケルトンが出っぱなしにならない / Calendar 管理ビューが refetch で真っ白にならない）。

### C6 — Schedule の純関数を切り出して pin（分割の足場）

**問題**: `CalendarTab.tsx` と `useScheduleMutations.ts`（計 3,412 行）に直接のテストが 1 本も無い。リポジトリ最大の 2 本が最も無防備。

**やること**: チームが既に確立した手口（`taskChipUndoWiring` / `taskChipPanel` / `inFlightGuard` = **純粋部分を外へ出してから vitest で pin する**）を横展開する。対象は React 状態に触らない 3 つ:

1. 4 組重複している ViewModel マッパー → `scheduleViewModels.ts` + テスト
2. 約 220 行の i18n 文言・日付書式の組み立て → `useScheduleCopy`
3. ドラッグの「ポインタ差分 + ジオメトリ → final」解決 → `scheduleGridLayout.ts` へ

**やらないこと**: jsdom にレイアウトが無い（要素の座標がすべて 0）ので「CalendarTab をレンダリングするテスト」は目標にしない。

**位置づけ**: **C8 の明示的な前提**。ここまで終わってから session 2 の分割に進む。

---

## Session 2 のクラスタ詳細（概要 — 着手前に追加調査が要る）

### C7 — items_meta+payload の読み書き定型を共有基盤へ畳む

畳んだ実例が 3 つ（`postgrestFetchAll` / `softDeleteMapper` / `fetchByPayloadFilter`）あるのに展開が止まっている。meta+payload の 3 段ジョインが 8 箇所、PostgREST のエラー判定が 126 箇所、Notes と Dailies のロック 6 メソッドが行単位クローン約 200 行。

**依存**: C3（ItemsMeta 型の移設・死蔵削除）と C4（lockstep ガード）の後。**着手時にまず `SupabaseDailiesUnifiedService` の password / lock 経路にテストがあるかを実測する**（未確認）。

### C8 — Schedule の巨大ホスト 3 本を分割

`CalendarTab` 2,392 行 / `useScheduleMutations` 1,020 行 / `useScheduleItemsAPI` 729 行 + WeekTimeGrid のドラッグ機構。3 領域の調査が揃って「分割線は既に見えている」と報告（TaskTree チップ・Todo は `rangeItems` や繰り返し系に一切触れず綺麗に剥がれる。`useScheduleMutations` は 28 引数のうち 12 個が繰り返し系専用）。

**着手順**: taskChips 抽出 → WeekTimeGrid のドラッグをフック化（既存テストが守る）→ `useScheduleItemsAPI` 分割（手本が 2 本ある）→ 繰り返し分離。

**着手前に必須の追加調査**: `useScheduleMutations.ts` の `handleScopeChoose` 本文 約 210 行が未読。`handleChangeRepeat` との重複有無が未確認で、繰り返し分離の設計はここを読まないと確定できない。

**他レーンとの衝突注意**: schedule-refine レーンが #290 / #625 / #628 で同じファイルを触る。着手前に open PR の state を確認する。

### C9 — アプリ骨格の再構成

section を 1 つ足すのに `MainScreen` 内 5 箇所 + hook 2 本 + registry を触る状態、Timer に依存していない Audio が内側に置かれ `chimeRef` で橋渡しされている歪み、TimerContext が毎秒 27 フィールドの value を作り直す構造、SyncContext が無関係ドメインの変更でも購読者全員を起こす構造 — どれも「MainScreen が配線の唯一の場所」から出ている。

**低リスクな順に**: (a) `AppProviders` 切り出し + Analytics(recharts) / Connect(d3) の lazy 化（**効果が dist のチャンクサイズで機械検証できる**唯一の性能案件）→ (b) section 記述子テーブル + nav 語彙統一 → (c) Audio / Timer の順序入れ替えと `chimeRef` 撤去 → (d) Timer / Sync の value 分割。**(a) だけ risk low なので session 2 の最初**に置き、merge 後 chat-main で実ブラウザ確認。

### C10 — shared ⇄ mcp-server の DB 契約統合（later）

mcp-server が shared に一切依存せず DB 行型 8 種・書き込み儀式・列リスト・pagination を手写しで維持している。**既にズレが顕在化**（朝刊の `parseDoc` はレガシー平文 daily を shared は読めて mcp は throw / タグ再付与は mcp が既存行を復活させ shared は毎回 INSERT）。

**なぜ later か**: パッケージ境界とビルド構成（workspaces 化 or project reference）を動かす作業で、移行のビルド・配布経路と正面から干渉する。移行完了後に独立した計画書を立てる。

**session 2 に前倒しするもの**: 朝刊 `parseDoc` の受理条件合わせと、タグ再付与の挙動統一（どちらもパッケージ内で完結する）。

---

## Steps

| #   | Step                                   | Gate    | Acceptance                                           |
| --- | -------------------------------------- | ------- | ---------------------------------------------------- |
| 1   | 本計画書 + Issue 起票                  | 🤖 自律 | 計画書が `plans/` にあり、Issue に本書への参照がある |
| 2   | S1: C1（4 PR）                         | 🤖 自律 | 下記 AC の C1 節                                     |
| 3   | S1: C2 / C3 / C4 / C5 / C6             | 🤖 自律 | 各 Issue の DoD                                      |
| 4   | S1 の PR merge                         | 🛑 人手 | ユーザーが merge ボタン（P-001）                     |
| 5   | merge 後の実ブラウザ確認（C5 / C9(a)） | 👀 目視 | chat-main で playwright                              |
| 6   | S2 着手前の追加調査                    | 🤖 自律 | 下記「次セッションの調査計画」を消化                 |
| 7   | S2: C7 → C9(a) → C9(b-d) → C8          | 🤖 自律 | 各 Issue の DoD                                      |
| 8   | S2 の PR merge                         | 🛑 人手 | ユーザーが merge ボタン                              |

---

## Acceptance Criteria (機械検証可能)

全クラスタ共通（各 PR で必須）:

- [ ] `cd shared && npm run lint && npm run build && npm run test` が exit 0
- [ ] `cd web && npm run lint && npm run build && npm run test` が exit 0
- [ ] `cd desktop && npm run typecheck` が exit 0（desktop に触れた PR のみ）
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` が exit 0
- [ ] 挙動変更ゼロのクラスタ（C2 / C3 / C6 / C7）は**公開インターフェースの diff がゼロ**

セッション 1 の完了条件:

- [ ] `grep -c 'working-directory: mcp-server' .github/workflows/ci.yml` が 3 以上（C1）
- [ ] `grep -q 'Asia/Tokyo' mcp-server/vitest.config.ts` が真（C1）
- [ ] `cd shared && npx tsc -p tsconfig.test.json --noEmit` と web 側の同等コマンドが exit 0、またはベースライン形式で CI に入っている（C1）
- [ ] TypeScript の版が 4 パッケージすべて `~6.0.x` で一致（C1・5.x が 1 つも残っていない）
- [ ] `grep -rn '_unused_' shared/src/services/` が 0 件（C3）
- [ ] DataService の宣言数 == `PHASE2_*` 和集合サイズ（C4・一致しない限り build が通らない状態）
- [ ] 負のテスト: セット / interface のどちらかに架空のメソッドを足すと `cd shared && npm run build` が名指しで落ちる（C4・確認後 revert）
- [x] `grep -c 'set-state-in-effect' shared/eslint.config.js` が 0（C5・BASELINE ブロックごと削除）
- [x] `grep -rn 'setIsLoading(true)' shared/src/hooks/` が 0 件（C5）
- [x] `shared/eslint.config.js` の diff が**削除のみ**（C5・新ファイルの baseline 追記が無い）
- [ ] C6 で切り出した 3 モジュールに対応する vitest がある

---

## Risks / Known Issues 参照

- **他レーンとの衝突**: C6 / C8 は schedule-refine（#290 / #625 / #628）、C3 の一部は mobile-refine と同じファイル群に触りうる。着手前に `gh pr list --json number,state,headRefName` で state を確認する（`git diff` は squash merge を誤判定する）
- **stacked PR にしない**: memory の `stacked-PR-base-retarget-race` のとおり、base が main 以外の MERGED は main に届かないことがある。各 PR を main から独立に切る
- **lint ロンダリング**（C5）: 上記 C5 節の「唯一の誠実な解は導出 loading」を守る。緑になったが何も直っていない状態で終わらせない
- **サブエージェント報告の実測則**: 本書の数値は spot check 済みだが、session 2 の追加調査で得た数値も同様に実測してから採用する（`rules/docs-consistency.md` §5）

---

## 次セッションの調査計画（未調査領域）

session 2 の着手前に消化する。**優先度順**:

**A. session 2 のクラスタが直接依存するもの（必須）**

1. `web/src/schedule/useScheduleMutations.ts` の `handleScopeChoose` 本文 約 210 行 — C8 の繰り返し分離の設計がここで決まる
2. `SupabaseDailiesUnifiedService` の password / lock 経路のテスト有無 — C7 のリスク評価に直結
3. `shared/tests/` 188 本の中身（今回は import 名の grep で有無だけを判定・中身はゼロ読み）。特に `components.test.tsx` / `appShell.test.tsx` / `weekTimeGrid.test.tsx` が実際に何を固定しているか — C6 / C8 の可否を左右する
4. `web/src/schedule/CalendarTab.tsx` の JSX フラグメント群（editorPane / flowBody / repeatsBody / todoBody / sidebarPortal ほか）と Desktop / Mobile 2 本の return の依存関係 — コンポーネント分割の是非がここ次第
5. `shared/src/context/timerReducer.ts` — C9 の TimerContext 分割の実現性はここの状態設計に依存
6. `MainScreen` が配線する headless 群（GlobalShortcuts / UndoRedoHost / MobileShellActions / MaterialsCountsBridge）— C9 の影響範囲の確定に必要

**B. 未調査で問題が眠っていそうな領域（今回まったく手を付けていない）** 7. `shared/src/services` の未読 4 本 — `SupabaseScheduleItemsService` の bulkCreate + updateFutureScheduleItemsByRoutine 約 270 行 / `SupabaseRoutinesService` の detach・convert・softDelete のカスケード / `SupabaseTimerService` + timerMapper（`as unknown as` が 7 箇所）/ `SupabaseAudioService` + audioMapper（3 エンティティ同居）8. `web/src/` の未読画面 — KanbanView / WorkScreen / briefing の `useBriefingData` + `useDailySections`（**Tier 1 コアなのにテスト参照ゼロ**）/ BriefingView と EveningView の重複有無 / AppShell と MainScreen の mobile 分岐の責務重複 9. `shared/src/components/schedule/` の未読 3 本 — EventEditorPane / ItemCreatePanel の props ドリル / MonthGrid・AgendaList・TodayTodoTray と WeekTimeGrid の描画ロジック重複 10. `shared/src/hooks` の未読 — `useWikiTagsUnifiedAPI` の assignment / connection bucket 化 / `useNotesUnifiedCRUD` と `useNoteHydrationLedger` の #587 後の責務境界 / `useLazyStalePool` と syncVersion 再取得の二重管理 11. `supabase/` の未読 — `0008_data_unification_schema.sql`（1,033 行）の RLS ポリシーと trigger 全体 / `check-rls.sql` が db-push の gate で実際に何を検査しているか 12. `desktop/src/main/index.ts` と `preload/index.ts` の IPC 契約 — web 側 `window.api` 型定義との整合が未確認（テストゼロ・CI は tsc と build のみ）13. `mobile/` 配下 — 「web/dist を包む殻」という CLAUDE.md §2 の記述の裏取りが未実施

---

## References

- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`
- 規約: `.claude/rules/frontend.md` / `.claude/docs/vision/coding-principles.md` / `.claude/docs/vision/db-conventions.md`
- 関連 Issue: #587（Notes 神ファイル分割 — 実装着地済み・close 待ち）/ #290（Schedule redesign Epic）/ #321（Mobile UI Epic）
- 関連決定: D-20260810-main-4（`useNotesUnifiedAPI` への例外的な先行修正）/ D-20260607-main-1（UI は shared 集約）/ D-20260801-main-1（tracker を実装ブランチに載せない）

---

## Worklog

- **2026-08-10（調査セッション）**: 8 領域を並列調査し 64 findings → 10 クラスタへ統合、上位 3 クラスタを懐疑的に再検証。主要数値をメインが全数 spot check（誤差はテスト本数の ±1 のみ）。調査中に **#587 の実装着地（PR #642 / #647 merged）と Issue の close 漏れ**を検出。feasibility で**前提の誤りを 2 件訂正**（TS 6.0 の strict 既定は true / DataService の差分 5 件は配線漏れではなく死に宣言）。
