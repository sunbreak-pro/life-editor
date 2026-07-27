# HISTORY (chat-briefing-section)

### 2026-07-27 - Issue #413: Briefing rightSidebar に「今日の Todo」トレイ

#### 概要

Briefing は rightSidebar のコンテンツを持たず共有の placeholder が出るだけだったので、残っているタスクを出して今日の候補へ配置できるトレイを載せた（PR #422）。Schedule 側にある `TodayTodoTray`（#298 / Epic #290 Step 3）をそのまま流用し、新規部品はゼロ — 書いたのはホスト配線と i18n だけ。

#### 変更点

- **BriefingScreen (web)**: `RightSidebarPortal` + 共有 `TodayTodoTray` をマウント。selector も Schedule と同一（`tasksToCalendarChips` を `isAllDay` で分割 → 配置済み / 未配置、`pickAddableTasks` → 「タスクから追加」）。完了トグルは紙面の Todo 行と同じ `handleToggleTask` を再利用
- **書き込み経路の差**: Briefing は `TaskTreeProvider` の外（MainScreen が DataService を注入して直マウント）なので `updateNode` / `setTaskStatus` を使えず `ds.updateTask` を通す。`taskUpdatesToPatches` 経由で `items_meta` + `tasks_payload` の同じ列に落ちるため両トレイの表示は一致する。「今日の候補に追加」= `scheduledAt` = 今日 0:00（ローカル）+ `isAllDay: true` は Schedule の `handleTodoAddCandidate` と同一
- **「今日」の基準は Briefing 側に揃えた**: Schedule のトレイは `todayCalendarKey()`（暦日）、Briefing は `todayDateKey()`（#373 の日付変更時刻を反映）。トレイは紙面の「今日の Todo」の真横に出るので後者を採用した。日付変更時刻を 0 時以外にすると深夜〜設定時刻の間だけ Schedule と基準がずれるが、これは #373 が持ち込んだアプリ全体の二重定義。逆にすると「追加した Todo が真上の欄に出ない」ほうが実害が大きい
- **wide 限定**: 768px 未満では詳細パネルは `MobileDrawer` だが、開閉導線は wide の `SectionHeader` トグルか `MOBILE_HAMBURGER_SECTIONS` のハンバーガー行のみで Briefing はどちらも持たない（`MainScreen.tsx:151-155`）。narrow でマウントすると到達不能な UI になる。mobile-scope.md #1 は Consumption / Phase 1 現状維持なのでモバイル導線の追加は Phase 2（#321）に置いた
- **i18n**: `briefing.todo.*` 8 キーを en/ja 両カタログへ。完了・「タスクで開く」は既存の `briefing.toggleComplete` / `briefing.jumpToTasks` を再利用し、同一 namespace 内の重複キーは作らなかった
- **docs**: `tier-1-core.md` §Briefing の Boundary「やる」に本トレイを追記 + `2026-07-15-briefing-loop.md` Worklog に 1 行（Step 4 が予告していた「A-3 トレイとの合流」の実装記録）
- **検証**: shared vitest 146 files 1175 tests / shared `tsc -b` / web build / `eslint BriefingScreen.tsx` すべて exit 0。実ブラウザ確認は §7.4 どおり merge 後 chat-main

### 2026-07-27 - Issue #373: Settings「日付が変わる時刻」の設定 UI

#### 概要

day-start（日付が変わる時刻）の pref は #218 / PR #242 で**読み手側だけ**が入っていて、値を書き換える手段が無かった。その書き込み UI を Settings に追加し、既存フック `useDayStartHourPref` に配線（PR #415）。保存先・読み手ロジックは一切触っていないので、既定 0 のままなら挙動は完全に不変。

#### 変更点

- **SettingsDayStart.tsx (shared・新規)**: 0〜23 時の `<select>` を持つ pure カード。ホストから `value` / `onChange` / 翻訳済み文言のみ受ける（§6.4）。`components/index.ts` から export
- **選択肢ラベルを翻訳キーにしなかった判断**: `00:00`〜`23:00` の 0 埋め 24 時間表記は Schedule のグリッド軸・ルーチン時刻と同じで en/ja 共通のため、24 個の翻訳キーを増やさずコンポーネント内で組み立てる。理由はコード内コメントに明記
- **数値への変換**: `onChange` で `Number(e.target.value)`。`<select>` は文字列を返し pref はそのまま localStorage へ直列化されるため、文字列が漏れると `parseDayStartHour` の救済頼みの値が残る。この回帰をテストで固定
- **SettingsScreen (web)**: `useDayStartHourPref()` を呼び、起動時カードと言語カードの間に配置。ヘッダーコメントのカード列挙は「順序はコードが正」に置き換え（数値の非複製原則）
- **i18n**: `settings.dayStart.{heading,description,hourLabel,hint}` を en/ja に追加。hint は挙動を正直に書いた — 読み手は境界を呼ばれた時点で評価するので、変更は次に「今日」を計算するときから効き、開いたままの画面は塗り替わらない（起動セクション pref と同じ再読み込み semantics）
- **テスト**: `shared/tests/settingsDayStart.test.tsx` 3 件（24 個の選択肢と 0 埋め / 現在値が選択されている / 変更が**数値で**ホストに届く）。shared build / 146 files 1175 tests / web build / web eslint すべて exit 0
- **docs**: `mobile-scope.md` #14 の `SettingsScreen.tsx:219` → `:237`（カード挿入で動いた分を実測して更新）+ 新カードがモバイルでも表示される旨を追記
- **取り残し対策が実際に効いた**: PR #415 は tracker 更新を push する前に merge されていた（提出から数分）。`push-after-merge-strands-commits` の教訓どおり **push 直前に `gh pr view --json state,headRefOid` を取り直した**ため事前に検知でき、tracker / outbox は `origin/main` から切った `claude/briefing-tracker-373` に載せ替えて別 PR にした（#394 → #399 / #404 → #406 のような事後 cherry-pick が不要になった初のケース）
- **前タスクの決着**: #391 は PR #404 と監査反映の追随 PR #406 が両方 merge 済みで、取り残しは解消済み

### 2026-07-27 - Issue #391: モバイルの夕刊タブでも宣言(intention)を編集可に

#### 概要

狭幅（<768px）で夕刊タブに着地すると「今日の宣言」を書けない穴を塞いだ（PR #404・merge 待ち）。Issue 本文の file:line は 2026-07-23 時点で、その後 PR #357 が入っているため再実測したところ、実態は本文より一段悪く「read-only の入力欄」ではなく表示専用テキストで、宣言がまだ無い日はブロックごと描画されていなかった（= 入力口が存在しない）。narrow だけを編集可に切り替え、wide の読み返し専用は意図的に据え置いた。

#### 変更点

- **IntentionField.tsx (shared・新規)**: 朝刊 `BriefingView` に埋め込まれていた宣言入力欄（自動伸長 textarea・朱アクセント）を切り出して両紙面で共有。見た目・挙動は完全に同一のまま移設
- **EveningView (shared)**: 宣言ブロックを二枝化。`intentionEditable=true`（narrow）は `IntentionField` + 保存状態キャプション、`false`（wide）は従来どおり琥珀の読み返し表示で宣言が無ければ非描画。props は `intention: string \| null` → `intentionText: string` に変更し、下書き込みの値を受けるようにした（朝刊で打った直後に夕刊へ切替えても同じ文面が見える）
- **キャプションの整合（DoD）**: 保存状態キャプションは編集可能な枝でしか描画しない。出す/出さないの判断を View 側に置いたので、ホスト実装が変わっても「打てないテキストの横に保存済み」が出ない
- **BriefingScreen (web)**: `useMediaQuery("(min-width: 768px)")` を自前で読み（MainScreen / AppShell と同じ単一ブレークポイント）夕刊の編集可否を決定。保存経路は無変更 — 下書き state + 800ms デバウンス + `mergeIntentionSection` の直列チェーンを朝刊と共有するので同時書き込み経路は増えていない
- **wide を変えなかった理由**: 夕刊の宣言は「今朝立てた宣言を読み返す」設計意図（Step 4 = 講評の往復は reflection と翌朝）で、wide は SectionHeader のタブ帯から朝刊がワンクリック = 導線が塞がっていない。塞がっているのは narrow だけなので直すのも narrow だけにした。分岐は mobile-scope #3 で確定済みの意図的なもの
- **i18n**: `briefing.evening.intentionPlaceholder` を en/ja 両方に追加（朝刊の「今日は何をやり遂げますか」は夕方に読むと時制がずれるため）。見出しはモードで既存キーを差し替え（編集可 = `briefing.intentionTitle`「今日の宣言」/ 読み返し = `briefing.evening.intentionTitle`「今朝の宣言」）
- **docs**: `.claude/docs/requirements/mobile-scope.md` の #2 行（PR #357 前のまま stale だった DoD 指定分）と #3 行を実態に更新し、§5 Phase 1 の該当 2 行も完了に落とした（片方だけ直すと新しい矛盾になるため）
- **テスト**: `shared/tests/briefingView.test.tsx` に 4 件追加（17 → 21 件。wide の読み返し + キャプション非表示 / wide の空日は非表示 / narrow の編集・blur がホストに届く / narrow は空でも入力欄が出る）。shared vitest 145 files 1166 tests / shared `tsc -b` / web build / web eslint すべて exit 0。実ブラウザ狭幅確認は merge 後に chat-main（§7.4）
- **role-qa 独立監査（BLOCKING 0）**: MAJOR 1 件 = 同じ事実が mobile-scope.md と `tier-1-core.md` の 2 層にあり、#391 の DoD が前者だけを指していたため後者の「夕刊は表示専用で再掲」が narrow で偽のまま残っていた（docs-consistency §1 の N 層転記漏れ）→ 幅条件付きに修正。MINOR 1 件 = prop 変更で wide の読み返しが保存値でなく生ドラフトを表示していた（未正規化の空行・字下げがそのまま段落化 / 保存失敗時は未保存文字列をキャプション無しで表示）→ 読み返し枝は保存値に戻した。指摘はいずれも Read / grep で自分で裏取りしてから採用（docs-consistency §5）
- **取り残し事故（再発）**: 上記の監査反映 `8b16b349` を push した時点で PR #404 は既に merge 済み（head = `fe3265d5`）で、main に届かなかった。#394 → #399 と同型。原因は照合のタイミングで、PR 提出直後には state=OPEN / head 一致を確認していたが、監査に 11 分かかる間に merge されていた。`origin/main` から `claude/briefing-391-qa-followup` を切って cherry-pick（衝突なし）→ 全ゲート再実行 → 追随 **PR #406**。教訓は「照合は追加 push の直前にやり直す」で、`~/.claude` の memory `push-after-merge-strands-commits` にも追記済み

### 2026-07-26 - materials レーン: Issue #365 / #366 / #371 / #370

#### 概要

briefing-section worktree が materials レーンを担当し、バグ 3 件（#365 / #366 / #371）+ 機能 1 件（#370）を 1 Issue = 1 ブランチ = 1 PR で処理。#365 / #366 / #371 は PR #388 / #390 / #392 が merge 済み・Issue closed、#370 は PR #394 が merge 待ち。全件で shared vitest / shared tsc -b / web build を通過（DDL 変更ゼロ）。

#### 変更点

- **#365 タグ使用数がゴミ箱を過大計上（PR #388）**: ソフトデリートは `items_meta.is_deleted` だけを立て `wiki_tag_assignments` へ波及しない（波及させると復元時に「ゴミ箱が外した」と「ユーザーが外した」を区別できない）ため、`listAllTagAssignments` が trash 済みアイテム宛の割当を返し続けていた。読み取り側で生存を両側条件化（`items_meta!inner(is_deleted)` の埋め込み + `.eq(false)`）し、join を PostgREST 側に寄せて往復 1 回を維持。Issue の DoD 案（hook に active item id 集合を持たせる）を採らなかったのは、`syncVersion` が上がるたび（入力停止のたび）に items_meta 全 id フェッチが増えるため。使用数だけでなく Analytics のタグ集計 / Connect の辺の過大計上も同時に解消
- **#366 編集中 Note が最上位へ跳ねる（PR #390）**: `sortNotesForList` に固定ソートキー（`FrozenNoteSortKey`）を optional 引数で追加。選択時点のキーで比較するのでその行だけ動かず、返る配列は生きた Note オブジェクトのまま（タイトル編集は位置を変えずに反映）。`isPinned` は固定しない（ピン留めは意図的操作なので即移動すべき）。スナップショットは render 中に取る新規 hook `useFrozenNoteSortKey`（effect だと固定前の 1 フレーム = 跳ねるフレームが通る）。選択を移すと解除され本来の位置へ = 抑止ではなく延期
- **#371 新規 Daily の初回 `[[link]]` が Connect に載らない（PR #392）**: `wiki_tag_connections.from_item_id` は items_meta への FK で、初回保存前の日には辺を張れず DailyView が辺を捨てていた。`selectedDaily` の有無も判定に使えない（optimistic ノードは書き込み前に現れる）。挿入を日付キーで預ける純粋ユーティリティ `pendingItemLinks`（shared）を新設し、行を作った保存の完了後に辺を書く方式へ。`upsertDaily` は保存済みノード（失敗時 null）を返すよう変更 — 既存の投げっぱなし呼び出しは非破壊
- **#370 `[[link]]` 候補に tasks 追加（PR #394・merge 待ち）**: v1 で見送った理由は候補側ではなく行き先（他タブから特定タスクを開けなかった）。KanbanView に `pendingSelectTaskId` を追加し `pendingNewTask` と同じ作法で 1 回だけ消費 → 選択 + 広い画面は詳細パネルを開く（カードクリックと同一動作。狭い画面は選択のみ）。候補プールに `fetchTaskTree()`、MainScreen の role→tab 振り分けをマップ化、role ラベルを en/ja に追加。Connect グラフは task ノードを持たないため note→task の辺は `buildGraphModel` の端点チェックで落ちる（スコープ外として PR に明記）
- **テスト**: shared 側に 20 件追加（#365 クエリ形状 1 / #366 固定挙動 5 + hook 4 / #371 預かり所 4 + `upsertDaily` 返り値契約 3。#370 は web 層のみのため追加なし）。実ブラウザ検証は全件 merge 後に chat-main（§7.4）
- **運用**: Issue ごとに `claude/materials-<番号>` を `origin/main` から切り直し、`.claude/comm/.session-branch` も都度更新（#327 の新ポリシー準拠）

### 2026-07-26 - Issue #318: Mobile 幅で朝刊/夕刊タブが切替不能

#### 概要

狭幅（<768px）では AppShell が header スロットを wide ブランチでしか描画せず、Briefing のタブ帯（唯一の切替 UI）が消えて夕刊へ到達できなかったバグを修正（PR #357・merge 待ち）。両紙面ビューに optional な `tabSwitcher` スロットを設け、MainScreen が狭幅のときだけ shared の SegmentedControl を流し込む形にして、wide の SectionHeader 挙動は完全に据え置いた。

#### 変更点

- **BriefingView / EveningView (shared)**: optional `tabSwitcher?: ReactNode` を追加し masthead 直下に描画。loading スケルトン側にも同じスロットを出して、フェッチ待ちで片方のタブに閉じ込められないようにした。ガードは `!= null`（ホストが `cond ? <X/> : null` を渡しても空の罫線帯が残らない）
- **MainScreen (web)**: 朝刊/夕刊のタブ定義を `briefingTabDefs` に一本化し、wide の HeaderTabs と narrow の SegmentedControl が同じ配列を読むようにした。狭幅判定は既存の `isWide`（`(min-width: 768px)`）で、wide では `undefined` を渡すため in-body 帯は出ない = tablist の二重存在なし
- **BriefingScreen (web)**: `tabSwitcher` を両ビューへパススルー（データ取得ロジックは無変更）
- **i18n**: 新規キーなし。既存の `briefing.tabs.morning` / `briefing.tabs.evening` / `briefing.tabsLabel`（en/ja 両方に実在）を再利用
- **テスト**: shared/tests/briefingView.test.tsx に 7 件追加（10 → 17 件。朝刊・夕刊 × 通常/loading で帯が出る 4 / 未指定で出ない 2 / null で出ない 1）。shared vitest 1087 / shared tsc -b / web build / web eslint 全 green
- **監査**: role-qa 独立監査を 2 回（実装後・commit 後）とも PASS（BLOCKING 0）。指摘の null ガードは本 PR に取り込み済み。残課題として「帯が紙面と一緒にスクロールする（Materials は固定ヘッダー方式）」「`(min-width: 768px)` リテラルが 11 ファイル 12 箇所に散在（`web/src/work/WorkScreen.tsx:47` に `WIDE_QUERY` の局所定義が既存）」を PR 本文に明記
- **既知の穴（実測）**: スロットのガードは `!= null` のため `false` / `0` / `""` は素通しする（`cond && node` を渡すと空の罫線帯が残る）。現行ホストは三項で `undefined` を渡すため実害なし。JSDoc に注意書きを追記して回避
