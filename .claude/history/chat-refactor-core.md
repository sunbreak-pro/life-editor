# HISTORY (chat-refactor-core)

### 2026-08-11 - ルーチン Undo/Redo の配線（PR #686）+ 実装セッション 1 着手（C1 PR 1 = PR #687）

#### 概要

裁定 D-20260810-refactor-1（= A）を実装し、5 ドメインで唯一 UndoRedo に未接続だった `RoutineProvider` を繋いだ。続けてコアリファクタの実装セッション 1 を C1 から開始し、CI が一度も見ていなかった `mcp-server`（src 19 ファイル / vitest 6 本）をゲートに載せた。どちらも両テストを**負のテストで実証**してから出している（配線を外す / TZ pin を外すと落ちることを確認）。merge はユーザーゲート（P-001）で、両 PR とも書いた時点で open。

#### 変更点

- **PR #686（feat）**: `RoutineContext` を `ScheduleItemsProvider` と同形に（ambient stack + 明示 prop 優先 + ref 経由の unmount clear）。`undoRedo.labels` に createRoutine / updateRoutine / deleteRoutine を en・ja へ追加 — 無いと「Undid: createRoutine」の生キー toast が出る。`web/` 変更ゼロ（RoutineProvider は既に UndoRedoHost の内側）
- **PR #686 のテスト**: 既存 domain-wiring スイートに routine ケース追加 / i18n は `t()` ではなく `getResource` で読む（`fallbackLng: en` が ja の欠落を埋めてしまい、検出したい穴がちょうど隠れるため）
- **PR #687（ci）**: `ci.yml` に mcp-server の install / build / test を追加（lint は eslint 設定が無いため足さない）。`mcp-server/vitest.config.ts` で TZ を Asia/Tokyo に pin し、`tests/localDate.test.ts` が pin 自体と局所日付の契約を固定
- **計画の前提を 1 件訂正**: C1 は mcp-server の型エラー backlog を見込んでいたが、初回 `npm ci && npm run build` は **エラー 0**。既存 45 テストも TZ=UTC で緑 = 現行スイートは TZ 依存経路を踏んでいない。pin が効くのは新テストからで、外すと UTC で 2 件落ちることを実測
- **意図した新結合**: `tests/briefingSection.test.ts` が `../../shared/src` を直 import しているため、shared を壊すと mcp-server も CI で落ちるようになった（C10 が統合するまで shared/mcp のドリフトを見張る唯一の場所）

### 2026-08-10 - コア構造リファクタの調査 + 計画書 + Issue 10 件起票（PR #678 open）

#### 概要

実装コード 68,227 行 / 445 ファイルを 8 領域に分けて並列調査し、64 findings を 10 クラスタへ統合。上位 3 クラスタは実際にコードを読ませて懐疑的に再検証し、**計画の前提の誤りを 3 件訂正**した。実装は 2 セッションに分割（S1 = #668〜#673 / S2 = #674〜#676 / #677 は移行完了まで凍結）。数値主張は `rules/docs-consistency.md` §5 に従いメインが全数 spot check 済み（誤差はテスト本数の ±1 のみ）。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`（詳細の正本。Issue 側は動機 + 参照 + DoD のみ）
- **Issue 起票**: #668〜#677 — ユーザーの明示許可による例外（起票は本来 chat-main 一元。次回以降は outbox 経由に戻す）。全件 `shared-fix` + `[refactor-core]` prefix で宛先を 1 レーンに固定
- **前提の訂正 1**: TS 6.0 の `strict` 既定は `true`。版統一は 6.0 への引き上げ一択（5.x へ下げると web が無言で non-strict に落ちる）
- **前提の訂正 2**: DataService の interface 124 と配線 119 の差分 5 件は配線漏れではなく死に宣言（4 ツリー全部で呼び出し 0 件を実測）。消して完全一致ガードにできる
- **前提の訂正 3**: `react-hooks/set-state-in-effect` は `useCallback` を跨ぐと検出しない。effect を共通 hook へ移すだけでは lint が緑になるだけ（lint ロンダリング）。唯一の解は導出 loading
- **判断キュー**: `D-20260810-refactor-1`（ルーチンの Undo/Redo が未接続で約 60 行が空撃ち — 繋ぐ + i18n 追加 / 消す / 現状維持の 3 択）
- **申し送り（outbox）**: #587 の close 漏れ（PR #642/#647 merged・967→431 行 / 842→303 行を実測）/ Schedule 系 #673・#675 は `section:schedule` を意図的に付けず schedule-refine へ周知

### 2026-08-10 - Issue #586 eslint baseline 解消（テスト先行・PR #638/#644/#649/#653 open）

#### 概要

`shared/eslint.config.js` の per-file baseline から schedule 系 3 本を除く 10 ファイルを解消する PR を 4 本作成した。全ファイルで先にテストを書いて現行挙動を固定してから effect 内 setState / props 変異を修正し、baseline 行を削除。shared lint/test/build + web lint/build/test すべて緑。merge はユーザーゲート（P-001）で、merge のたびに残 PR の eslint.config.js 衝突をこのレーンが解消する。

#### 変更点

- **PR #638**: ColorPicker / TaskAddDialog / QuickAddSheet / ShortcutEditModal — open 遷移リセットの effect を render 調整パターンへ（新規テスト 2 本 + 既存 2 本拡張・27 テストで固定）
- **PR #644**: CommandPalette / TagEditModal — 同パターン + カーソル clamp を render 時境界へ（既存 exhaustive-deps warning も 1 件解消）
- **PR #649**: TimerContext（冗長な tickNow 再アンカー削除）/ useTaggedItemIndex（loading を導出値化）/ useTaskTreeAPI（#282 復元を load の async 継続へ移設）。TimerProvider に初のテストスイート追加
- **PR #653**: useGraphSimulation — clone の責務を hook 内部へ移設し immutability override ブロックごと削除。GraphCanvas の二重 clone も撤去。snapshot 非変異の契約テスト付き
- **運用**: Issue #586 に進捗コメント（merge 順は任意・衝突はこのレーンが解消 / schedule 系 3 本は scope 外で残置）

### 2026-08-02 - desktop Windows ビルド整備（Issue #529・PR #534 merged）

#### 概要

Windows 向け NSIS ビルドを整備した。win アイコンは electron-builder の PNG→ICO 自動変換で `resources/icon.png` 単一ソースのまま配線し、`npm run build:win` のローカル実測（インストーラ生成 + アイコン抽出照合）と CI への desktop ジョブ追加（typecheck + electron-vite build。NSIS パッケージングは ubuntu runner 不可のため除外）まで完了。

#### 変更点

- **desktop**: `electron-builder.yml` に `win.icon: ../resources/icon.png` 追加 / `package.json` に author 追加 / README に Windows build 手順 + SmartScreen 注意を追記
- **CI**: `.github/workflows/ci.yml` に desktop install/typecheck/build ステップ追加・cache-dependency-path に desktop/package-lock.json 追加
- **docs**: 移行 SSOT Phase 3 に Windows NSIS ローカルビルド緑の日付入りメモ追記（実機起動は #530 = chat-main 担当）

### 2026-08-02 - MobileDrawer フォーカストラップ（Issue #517・PR #535 merged）

#### 概要

#508 で切り出した `useDialogA11y` を MobileDrawer に配線し、独自の Escape リスナーを撤去してダイアログ系の焦点管理（初期フォーカス・Tab トラップ・復帰・レイヤー積み）を共通 hook に統一した。

#### 変更点

- **shared/components**: `MobileDrawer.tsx` — 独自 document keydown リスナー撤去 → `useDialogA11y({ open, onClose })` の ref をパネルに接続（`tabIndex={-1}` 付与）
- **shared/tests**: `mobileDrawer.test.tsx` に配線テスト 2 件追加（open 時フォーカス移動 + close 時復帰 / Modal 積層時の「1 Esc = 1 レイヤー」）
- **備考**: パネルの `onMouseDown` stopPropagation は #470 アンチパターン候補として PR 本文で chat-main へ申し送り（スコープ外）

### 2026-07-30 - Phase B Step 9（MainScreen hooks 切り出し・Issue #465・計画最終実装ステップ）

#### 概要

Phase B（web 画面 hooks 切り出し）の最終弾。MainScreen（951 行）をナビゲーション側 `useShellNavigation`・表示定義側 `useShellChrome` + 表示組み立て専念の画面（約 690 行）に分割した（挙動変更ゼロ・shared/src 無改変）。DataService 分割計画の実装ステップは全完了（残り Step 10 = merge 後の実ブラウザ確認は chat-main 担当）。

#### 変更点

- **web/hooks**: `useShellNavigation.ts` 新設（section switch + Materials/Schedule/Analytics/Briefing タブ state + persistLastSection + nav ショートカット/new-task/「[[」item-nav の pending intent）/ `useShellChrome.tsx` 新設（コマンドパレット項目・registry 派生 nav リスト・タブ帯 defs・shell ラベル・Materials カウントバッジ）。コードは配管以外 verbatim 移動、`MaterialsTab` 型と関連定数も hooks 側へ移設
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 件・session-verifier PASS
- **計画書**: `2026-07-28-refactor-dataservice-split.md` を Status COMPLETED にして `archive/` へ移動
