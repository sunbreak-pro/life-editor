# HISTORY (chat-refactor-core)

### 2026-08-16 - Issue sweep 完走 — #890 / #894 / #895 を PR 化（#958 / #960 / #963 open）

#### 概要

自分宛 4 本の sweep を最後まで通した。#891（4 本の PR）は merge 済みで、残る 3 本を 1 本 1 PR で出した。3 つとも「重複を消す」より「**壊れても何も言わない経路に、言うようにさせる**」のが中身だった。

#### 変更点

- **#890（PR #958）5 role mapper の items_meta 側**: `assertItemsMetaPair` / `toItemsMetaInsertRow` / `toItemsMetaPatch` を `itemsMeta.ts` に寄せた。**核心は `updated_at` の bump が 5 箇所 → 1 箇所**になったこと。bump 漏れは例外もログも出さず、書き込みはローカルに通って「そのドメインだけ他のデバイスに届かない」形で出る。既存 mapper テスト 105 件は無改変で緑。**揃えなかった差分を 2 つ保存**した — `{isDeleted: undefined}` の扱い（todo/note/daily は `?? false` で列を書き、event/routine は列ごとスキップ）と INSERT の `version`（Todos だけクライアント値を載せる）。payload 側と READ 方向は畳んでいない（似て見えるが `deletedAt` の出し方などが role ごとに違い、畳むと 1 つのルールで残り 4 つを黙って変えることになる）
- **#894（PR #960）desktop の IPC 契約**: チャネル名を `desktop/src/shared/ipcContract.ts` に集約し、main の登録を `Record<DesktopIpcChannel, …>` 注釈の 1 つの表にした。**ハンドラの無いチャネルはコンパイルが通らない**。`shared/src/services/supabaseAuthStorage.ts` は `electron` を import できないので構造的宣言を残し、両方を見られる desktop 側テストで**双方向の代入可能性**を assert（署名がズレたら desktop の typecheck が落ちる）。desktop に vitest + 7 件 + CI ステップ
- **#895（PR #963）mcp-server tools.ts**: 986 行の単一配列を `tools/<domain>.ts` × 11 へ逐語移動（`handlers/` と 1 対 1）。`tools.ts` は 1,120 → 93 行。`toolDomains.test.ts` が対応関係を検査する — 片方だけあると落ちるのと、**`tools.ts` が spread を 1 つ忘れると落ちる**。後者を明示的に見張ったのは、忘れても何も壊れて見えないから（`TOOLS` を歩くテストがそのツールを最初から見ず、Claude Code には「そんなツールは無い」と伝わる）

#### 検証

- 各ブランチで CLAUDE.md §7.1 のゲートを全部。shared 240〜243 files / 2232〜2251 tests、web 54 / 485、desktop 1 / 7、mcp-server 20 / 288。lint の warning は既存分のみで error 0。CI も #958 / #960 は緑（#963 は投入直後）
- **噛みを 4 通り実測**: `toItemsMetaPatch` から bump を外す → 14 件落ちる / `shared` の bridge から引数を 1 つ落とす → desktop の typecheck が署名差分で落ちる / `DESKTOP_IPC` にチャネルを足してハンドラを書かない → main の typecheck と preload テストが落ちる / `...TRASH_TOOLS` を落とす → 3 件落ちる。すべて確認後に revert
- **踏んだ罠**: `mcp-server` のテストは開発端末に `LIFE_EDITOR_SUPABASE_*` が入っていると `silentDrops.test.ts` の 1 件が落ちる（「Supabase に到達したこと」を例外メッセージで確かめるテストが、資格情報があると成功してしまう）。main でも落ちるので PR 起因ではない。`git show origin/main:mcp-server/src/tools.ts` に戻して再現を確認した上で outbox に投げた

#### 次

3 本とも merge 待ち（P-001 でユーザー手番）。merge 後、#960 だけはパッケージ版デスクトップの起動とログイン維持を一度見ておきたい。

### 2026-08-16 - #891 の残り 3 本を PR 化して打ち止め（PR #949 / #950 / #951）

#### 概要

`useNotesUnifiedAPI` / `useDailiesUnifiedAPI` / `useWikiTagsUnifiedAPI` を `useDomainLoad` へ載せ替え、Issue の指定どおり 1 本 1 PR で出した。これで #891 の 4 本が揃う（1 本目 `useTodoTreeAPI` は PR #922 で merge 済み）。**3 本とも「同じ effect を同じ形で差し替える」では済まず、それぞれ違う理由で調整が要った**のが今回の中身。

#### 変更点

- **notes（PR #949）**: 素直に載る側。ただし **Trash の読み込みは別 effect に据え置いた** — 同じトリガ（mount + `notes` bump）だが独自の try/catch を持ち、Trash の失敗がツリー本体をブロックしない設計。load の `Promise.all` に畳むとこれが壊れる。effect の deps から `hydrateContent` / `mergeLoadedList` が消えたのは等価な整理（前者は `[ds, setNotes]`、後者は ref のみに依存し、どちらも `ds` 以外で identity が変わらない）
- **dailies（PR #950）**: 4 本で一番「無言」だった。失敗をログに出すだけで、**ローディングの旗もエラー state も持っていなかった**ので、fetch 失敗が「まだ日記が無い」と見分けが付かない。よって `isLoading` / `error` は**このフックの新規フィールド**。UI は未配線（エラーカードの配線は見た目の変更なので範囲外）で、PR 本文に「不要なら戻せる」旨を明記した
- **wikitags（PR #951）**: `refetchReportsLoading: false` では足りなかった。`loading = attemptInFlight && !hasLoaded` と書いた理由は**初回ロードが失敗した後**の挙動で、旧コードは次の試行で旗を立て直していた（`if (!hasLoadedRef.current) setLoading(true)`）。false 固定にすると「読み込み中」が「タグ 0 件」表示に変わる。`hasLoaded` は ref ではなく state（`loading` を導出するため再描画が要る）で、書き込みは `applyAll` の中だけ = effect 本体では書かない。また元の effect は **catch を 1 つも持っておらず** `void refresh()` で unhandled rejection になっていた。3 つの bulk read と 3 つの setter を `loadAll` / `applyAll` に名前を付けて、load effect と公開 API の `refresh` が drift しない形にした
- **新規テスト 19 件**: `notesUnifiedLoadEffect`(7) / `dailiesUnifiedLoadEffect`(6) / `wikiTagsUnifiedLoadEffect`(6)。**3 本とも load 経路のテストはそれまで 1 本も無かった**。既存の #300 スイート（`wikiTagsRefreshLoading.test.tsx`）は 1 文字も触らず緑

#### 検証

3 ブランチそれぞれで `shared` / `web` の lint・build・test（計 6 ゲート）を exit 0 まで確認。shared 241 files / 2238〜2239 tests、web 54 files / 485 tests。lint の warning は既存分のみで error 0。

#### 次

#890（5 role の mapper 共通化）→ #894（desktop IPC 契約のロックステップ）→ #895（mcp-server tools.ts の分割）。**#891 を close するのは #951**（先行 2 本は close しない本文にしてある）。

### 2026-08-16 - Issue sweep 開始 — 取り残しコミットの回収（PR #921）と #891 の 1 本目（PR #922）

#### 概要

自分宛の 4 本（#891 → #890 → #895 → #894）を消化する sweep に着手した。着手前の main 取り込みで、**PR #846 が merge された後に同ブランチへ push した 1 コミットが main に届いていない**ことが分かったので先に拾い直した。続けて #891 の 1 本目 `useTodoTreeAPI` を `useDomainLoad` へ載せ替えた。載せ替えは単純な差し替えでは済まず、そのままだと Kanban ボードが編集のたびに一瞬消える挙動変更になるため、共通フック側にオプトインを 1 つ足して回避した。

#### 変更点

- **取り残しコミットの回収（PR #921）**: `shared/tests/useDomainLoad.test.tsx`（188 行）+ 計画書 §C5 の Worklog 追記。merge 済み PR への後追い push だったため main に反映されていなかった。現在の main 取り込み後に実測して 4 passed を確認してから出し直した
- **#891 の 1 本目（PR #922）**: `useTodoTreeAPI` の自前 load effect を撤去し `useDomainLoad` へ。`isLoading` / `error` の `useState` が消え、`isLoading` は settled 比較による導出値になった。**#296 の error un-latch がこのフックに初めて行き渡る**（従来は `error` を null に戻す経路が無く、一度失敗するとセッション終了までエラーが残った）
- **`useDomainLoad` に `refetchReportsLoading`（既定 true）**: 既に載っている 3 本は挙動据え置き。TodoTree だけ false を渡す。旧 effect は `isLoading` を false に落とすだけで true に戻さないため再取得中もボードが出たままだったのに対し、`useDomainLoad` の既定は再取得中も true を返し `KanbanView` はその間ボードごとスケルトンに差し替える（`web/src/todos/KanbanView.tsx:643`）。Realtime は自分の書き込みも echo する（`shared/src/context/syncDomains.ts:9`）ので、既定のままなら編集のたびに板が消えていた。タググラフ（#300）も同じ性質なので後続 PR で再利用できる
- **新規 `shared/tests/todoTreeLoadEffect.test.tsx`（6 ケース）**: 3 状態 / ドメイン単位の再取得（#499）/ 失敗しても settle する / #296 の un-latch / 再取得中もボードを消さない。最後の 1 件は `refetchReportsLoading` を落とすと実際に落ちることを実測で確認
- **検証**: shared build・lint（error 0）・test 238 files 2,198 tests、web lint（error 0）・build・test 46 files 408 tests。`desktop/` は未変更のため対象外

### 2026-08-13 - C5（#672）を締める — 実装は着手前に着地済みで、残っていたのは共通基盤自体のテストだった（PR #846 open）

#### 概要

#672 に着手して最初に分かったのは、**実装が着手前に全部 main へ着地していた**ことだった（PR-A + PR-B = #769 / PR-C = #801 / PR-E = #686）。DoD の grep 系 3 項目・テスト件数・RoutineContext の UndoRedo 配線と i18n ラベルはすべて実測で満たしており、書くべき実装が 1 行も残っていない。そこで**共通化した `useDomainLoad` そのもの**に目を向けたところ、3 本のドメインスイート（計 16 ケース）からは届かない契約が 3 つ残っていた。そこを直接テスト 4 件で塞ぎ、計画書 §C5 に着地状況を記録して締めた。

#### 変更点

- **6 ゲート + docs-lint をベースラインで実測してから着手**: shared lint（0 errors）/ typecheck:tests / build / test（225 files・2066 tests）、web lint（0 errors）/ test（41 files・381 tests）/ build、`LC_ALL=C bash scripts/docs-lint.sh`。全部緑で、**#672 に対して直すべき赤は存在しなかった**
- **ドメインスイートからは届かない 3 つ**: (1) **superseded ガード** — 呼び出し側スイートは常に 1 本ずつしか走らせないので「2 本が同時に飛んで**古い方が最後に着地する**」並びを作れない。抜けると古いリストが新しいリストを黙って上書きする / (2) **dep 配列の `dataService`** — 上位で service を差し替えるスイートが 1 本も無く、バックエンド差し替え時の再取得が消えても誰も気付かない / (3) **`load`・`apply` の ref ミラー** — 呼び出し側は全員インラインで書く（毎レンダー別オブジェクト）。dep 配列に戻すと永久に再取得するループになるが、**ドメインスイートは落ちずにただ回り続ける**
- **逆テスト 3 本で噛みを実測**: `apply` 直前の `if (cancelled) return;` を削除 → superseded のテストだけ失敗 / dep から `dataService` を削除 → 1 failed・3 passed / dep に `options.load` を追加 → 1 failed・3 passed。3 つとも確認後に revert（`git diff` 空を確認）
- **CRLF で perl の複数行置換が空振りする**: 逆テスト 1 本目が「置換したつもりで実は無変更のまま緑」になった。ファイルは CRLF なので `\n` 前提のパターンが当たらない。**`\r?\n` にして再実行**したら期待どおり落ちた。単行の置換は当たるので気付きにくい — 逆テストは「壊れたことを grep で確認してから走らせる」のが正解
- **PR-D は #672 の close 条件から外した**: 計画書で任意扱いのうえ playwright 必須。`createNoopUndoRedo` を凍結すると `push` の identity が安定し、周辺の `useCallback` が**初めて実際にメモ化される**ため、deps 漏れが stale closure として顕在化しうる。DoD の項目でもないので独立 Issue が妥当と判断し、計画書 §C5 にも記録
- **計画書 §C5**: 着地状況の表（どの手順がどの PR か）を追記し、AC の C5 3 項目にチェックを入れた
- **引き継ぎ**: merge 後の playwright（Schedule 初回描画 / 日付切替・Realtime bump 後にスケルトンが残らない・Calendar 管理ビューが refetch で白くならない・ルーチンの作成 / 更新 / 削除を Ctrl+Z で戻して生成済み Event が孤児にならない）。**#846 が原因ではなく #769 / #801 / #686 の持ち越し分**である旨を Issue コメントにも明記した

### 2026-08-13 - #675 の残り 3 項目を完走（PR #839 / #841 / #842 open）

#### 概要

#819 が merge されたことで解禁された 3 項目を、依存の薄い順に 1 つずつ main から切って通した。**4 本とも互いにファイルが 1 つも重ならない**ので merge 順は自由で、#675 が禁じる stacked にもなっていない。3 本とも「公開インターフェース不変・挙動は逐語移動」を守り、各 PR でソースを 3 通り壊してテストが噛むことを実測してから戻した。

#### 変更点

- **やること 1（PR #839）— CalendarTab の task 半分**: Schedule は 2 種類の行を 2 つのストアから描いている（イベント = visible-range ストア / スケジュール済み TaskNode = 派生層の青チップ）。後者だけが丸ごと剥がれたのは、range ストアも繰り返し機構も mutation 層も読まないから。`taskDetailId` も同行（TASK の id で `selectedId` には入らない = #626）。2,716 → 2,553 行・新規 16 tests
- **やること 2（PR #841）— WeekTimeGrid のポインタ機構**: 部品の中で「考えている」唯一の部分。残りとのやり取りは 3 つだけ（プレビューを載せる items / 計測する DOM ref 2 本 / ホストコールバック）。判断（`resolveDrag`）は動かさず配線だけ移した。既存 `weekTimeGrid.test.tsx` 21 件を**無改造で通した**のが挙動不変の一番強い証拠。921 → 719 行・新規 7 tests
- **やること 4（PR #842）— 繰り返し / スコープ機構**: `useScheduleMutations` は「行を書く」と「行がシリーズの一員であることを考える」の 2 つを持っていた。継ぎ目は 1 語 — CRUD 側は routine が何かを知らず `requestScope` を呼ぶだけ、逆向きに繰り返し層が `applyOccurrencePatch` / `dismissOccurrence` を注入で受け取る（スコープ「この日だけ」は CRUD が聞かずに書くのと同じ書き込みなので、2 つが食い違ってはいけない）。1,041 → 456 行
- **引数 28 → 12**: `UseScheduleMutationsArgs` が繰り返し層の interface を `Omit` で継承する形にしたので、各フィールドが**それを使うファイルにコメントごと**置かれた。DoD の「実質半減」を diff で見える形にした
- **#842 が一番の収穫**: この機構には**テストが 1 つも無かった**。下敷きの純関数（`runSeriesEdit` / `seedFrequencyPatch` / `useInFlightGuard`）は固定済みだが「どのスコープがどのサービス呼び出しになるか」は誰も見ていない。分岐を間違えても画面はもっともらしいままで、被害は数日後に「触っていない予定が勝手に戻る / 消える」として出る型。16 tests で固定
- **変異確認の型**: #839 = today の窓をグリッドの窓に差し替え（3 件）/ 詳細削除の閉じ + カスケード確認を除去（3 件）/ findTaskChip の today フォールバック除去（1 件）。#841 = 主ボタン判定・終日ガード・配列 identity（各 1 件）。#842 = 「削除 / この日だけ」を削除に（Issue 017 の復活）・「これ以降」を epoch 起点に・事前 materialise 失敗で detach を中止しない（各 1 件）
- **1 件は変異が過激すぎて全滅**: #841 で `effectiveItems` の早期 return を消したら `dragPreview` が null のまま参照されて TypeError になり、全 28 件が落ちた。`return [...items]`（意味は同じ・identity だけ壊す）に直して 1 件だけ落ちることを確認した
- **残るのは実ブラウザ検証だけ**: #675 の DoD で唯一未消化。merge 後に chat-main へ

### 2026-08-13 - main の赤を直して #819 を緑にし、#675 に着手（PR #829 merged / #833 merged）

#### 概要

#819 のコンフリクト確認から入り、**落ちていたのは #819 ではなく main 自体**だと突き止めた。手書きのテーブル 2 本が merge の波で古びる、同じ型の事故が 2 件同時に起きていた。修理を #819 に混ぜず別 PR（#829）に切ったので、1,400 行のリファクタをレビューせずに main を直せる。#829 merge 後に main を再取り込みして #819 は CI 全緑。続けて #675 に入り、4 項目のうち **#819 と非干渉な「やること 3」だけ**を選んで PR #833 を open した。

#### 変更点

- **main の赤 その 1（`web/tests/kanbanView.test.tsx`）**: #798（#789）が `scheduleScreen.*` の削除キーを使う describe を足し、#813（#790）がそのキーを `taskDetail.*` へ改名したが、改名 PR の base に #798 の describe が無かった。6 箇所を改名して 3 件の失敗を解消
- **main の赤 その 2（`mcp-server/tests/toolRegistry.test.ts`）**: #821（#700）が verification 3 ツールを registry に足し、#822（#782）が同じ手書き `VALID_CALLS` を verification 抜きの base から編集。`covers every published tool` ガードは**正しく発火した**ので、3 行足して解消（ガード自体は直していない）
- **どちらも「各 PR 単独では緑・組み合わせで赤」**: 手書きの網羅テーブルは並行レーンの構造的な地雷。CI が main で初めて赤くなる
- **#675 やること 3（PR #833）**: `shared/` 最後の未分割 API hook。727 行 → 4 モジュール（mirror 137 / CRUD 459 / trash 73 / composer 239）。mirror は `viewMirrorRef.current?.` を十数箇所で書いていたのを「未登録なら no-op」を 1 度だけ述べる access object に寄せた
- **戻り値は無改造**: `ScheduleItemsContextValue` が `ReturnType<typeof useScheduleItemsAPI>` なので、公開インターフェースがズレたらコンパイルが通らない。`ScheduleItemsViewMirror` は新居から re-export して barrel も維持
- **新規テストは既存の守りの穴だけを取った**: `undoRedoDomainWiring` が update / toggle / delete のアンカー外の日を既にカバーしているので、create / dismiss / undismiss / bulk delete / ゴミ箱一式 / mirror の端条件へ。3 本ともソースをわざと壊して落ちることを実測（`dateRef.current` → `date` / StrictMode ガード除去 / restore の日付判定除去）
- **#675 の項目選択は衝突回避**: やること 1（CalendarTab）と 2（WeekTimeGrid）は #819 と同一ファイルで、Issue 自身が「stacked にしない」と定めているため着手不可。3 は `shared/src/hooks/` 内で完結し main から独立に切れる唯一の項目だった

### 2026-08-13 - #701 Step 2 と C6（#673）— PR #800 / #819 open、#675 は merge 待ちで着手せず

#### 概要

「#701 Step 2 → #673 → #675」の 3 本立てゴールを、**2 本完走 + 1 本ブロック**で返した。#701 は D-20260812-refactor-2（A+B）で決まった道を Trash 1 画面ぶんだけ通し、#673 は CalendarTab / WeekTimeGrid の純粋部分を 3 モジュールへ出して 60 件のテストで固定した（挙動変更ゼロ）。#675 は前提の #673 が未 merge で、かつ schedule-refine レーンが同じ `CalendarTab.tsx` に open PR を 2 本持っていたため、Issue の「持っていたら merge を待つ」規定どおり着手していない。

#### 変更点

- **#701 Step 2（PR #800）**: `web/tests/trashScreenActions.test.tsx`（16 tests）。Trash を選んだのは Schedule 以外・Provider 不要・全ボタンが DataService 呼び出しで終わり引数がそのまま挙動、の 3 点。既存 `shared/tests/trashView.test.tsx` は `vi.fn()` を渡した presentation の pin なので、ホストの 2 つの switch 文（クリックが 10 個のメソッドの**どれ**に届くか）を一切見ていなかった
- **#701 の使い分け基準**: `rules/frontend.md` に 1 行追記（既定 = Testing Library / 逃げ道 = 純関数切り出し）。決定の「波及」に成果物として明記されていた分
- **#673（PR #819）**: 4 組の ViewModel 変換 → `web/src/schedule/scheduleViewModels.ts` / 日付書式 5 箇所 + `t(...)` バンドル → `web/src/schedule/scheduleCopy.ts` / ドラッグの配置解決 → `shared/src/utils/scheduleGridLayout.ts` の `resolveDrag`。CalendarTab 2,927 → 2,704 行、WeekTimeGrid 977 → 921 行
- **DOM 計測は component に残した**: `resolveDrag` は数値（`allDayLaneBottom` / `timeGridTop` / `colWidth`）を受け取る。jsdom は rect が全部 0 なので、これがルールをテストできる唯一の形
- **既存の非対称を揃えずに固定した**: task chip はアジェンダで status を持ちグリッドでは持たない（#761 がアジェンダだけ配線した）。揃えると UI 変更になるため、テストに「意図的」と明記して pin
- **ミューテーション確認を 2 回**: #701 は notes の復元を `restoreTask` に取り違えて 2 件落ちるのを確認。#673 は all-day レーン境界を `<` → `<=` に壊したら**最初の版は捕まえられず**、境界そのもの（y == bottom）を突く形にテストを書き直してから捕まえた
- **#675 の必須追加調査を消化**: `handleScopeChoose`（約 203 行）を読み、`handleChangeRepeat`（約 227 行）との重複は無い＝繰り返し系を `useRepeatMutations` へ分離する設計は成立する、と Issue #675 にコメント。共通なのは rule-2 テンプレートの作り方など語彙 4 点のみ

### 2026-08-11 - C3（#670）死蔵の削除と共有物の寄せ直し — 4 PR 完了（#698 / #699 / #703 / #705）

#### 概要

C2（#669）に着手しようとして、**別チャットが PR #694 で先に着地済み**（Issue も CLOSED）だったのを実装前に検知し、重複ゼロで C3 へ切り替えた。C3 は 4 本とも main から独立に切り、stacked にしていない。#698 / #699 は merge 済み、#703 / #705 は open。計画書の記述と実コードが食い違う箇所を 2 件見つけ、どちらも実装せず判断キューへ回した。

#### 変更点

- **PR 1（#698・merged）**: 単一行 Mapper シム 12 シンボル（routine / scheduleItem）と孤児型ファイル 6 本を削除。production は純減 −462 / +19。**シムを生かしていたのは `_unused_*` ダミーフィールド 8 本だけ**で、サービスは DU-C-3 / DU-C-5 で 2 行 API に移行済みだった
- **PR 1 でテストは減らしていない**: `shared/tests/scheduleMapper.test.ts`（199 行）は消したシムのテストだが、そこに書かれた Issue 020「部分更新が触っていない列を巻き込まない」は 2 行 API にも効く。写経ではなく**2 行 API の意味論に合わせて書き直して** routine / scheduleItem / calendar の 3 ファイルへ移設した（2 行 API は `updated_at` を常に出すので assertion が変わる / 旧シムが落としていた `version` は 2 行 API では意図的に whitelist なのでその旨を 1 ケース追加）
- **PR 2（#699・merged）**: 置き場所の是正 4 件。`ItemsMetaRow` ほか role 非依存の 4 シンボルを `taskMapper` → 新 `services/itemsMeta.ts`（他 4 mapper が「共有の型」を「Tasks のモジュール」から借りていた）/ `contentJsonToString` 系の同一実装 2 本を `services/contentJson.ts` へ 1 本化（mcp-server の 3 本目は #677 の管轄なので触らない）/ `ShortcutRow` を表示コンポーネントから `types/shortcut.ts` へ / 死んだ Phase 2 `TimerState` を削除
- **PR 2 で #668 のゲートが効いた**: `ShortcutRow` 移設時に古い import が 1 箇所残ったが、**vitest は 1623 件すべて緑**（型は実行時に消える）。赤にしたのは `typecheck:tests` だけ。C1 PR 3（#690）が無ければ push して CI で初めて分かっていた
- **PR 3（#703・open）**: 手写しの差し替え。`(min-width: 768px)` 12 箇所 → `constants/breakpoints.ts` / `[y,m,d] = key.split("-").map(Number)` + `new Date(y, m-1, d)` の 12 箇所 → 新 `dateFromKey(key, timeHHMM?)` と既存 `dayOfWeek` / `parseDateKey` / `minutesToTime` の複写 2 本 / `clamp` の複写 1 本（`utils/clamp.ts` へ切り出し）
- **PR 3 で踏んだ罠**: `export { clamp } from "./clamp"` は**再 export であってモジュール内の束縛を作らない**。同ファイル内の 4 箇所が未定義になり、型検査 4 error + shared 126 tests / web 5 tests が落ちた。`import` + `export` の 2 行に分けて解決
- **PR 4（#705・open）**: IME ガード 3 箇所（Notes の `[[` 候補 / スラッシュメニュー / Connect の window keydown）。どれも**変換中の Escape が「変換取り消し」と「閉じる」の両方を起こしていた**。`web/tests/suggestionImeGuard.test.ts` で固定し、**ガードを外すと落ちることを実測**（`itemLinkRender` / `slashRender` を export したのは、`createItemLinkSuggestion` 経由だと実エディタ無しに Escape 分岐へ到達できないため）。あわせて Audio を「Mobile 省略 Provider」と書いていた誤コメント 2 箇所を訂正（実際は mobile でもマウントされ、省略されるのは Ambient mixer UI だけ）

#### 判断キューへ回した 2 件（どちらも放置時 = 現状維持）

- **D-20260811-refactor-1**: Analytics の「今週」が**同じ画面で 2 つの意味**（月〜日のカレンダー週 / 直近 7 日ローリング）。計画書は「4 箇所の重複」と見ていたが実際は定義違いで、1 本化すると表示数字が変わる。1:1 だったローリング側だけ `createdWithinLastDays()` に統一し、カレンダー週にも `calendarWeekRange()` と名前を付けて 2 定義が並んで見える状態にした
- **D-20260811-refactor-2**: `window.confirm` の置き換え。計画書は「規約ドリフト是正」としているが、コード側 3 箇所（#628 / #216 / #573）に**理由付きで選んだ**と明記されていた（「どのプラットフォームでも見落とされない唯一のダイアログ」）。黙って剥がすと過去の判断を無言で覆すので P-008 に従い実装せず。#670 の DoD には含まれないので C3 の完了はブロックしない

### 2026-08-11 - C1（#668）検証ゲートの穴を塞ぐ — 残り 3 PR 完了（#689 / #690 / #695）

#### 概要

C1 の PR 2〜4 を出し切り、クラスタ #668 を完了させた（PR 1 = #687 は前セッション）。**#689 / #690 は CI 緑で merge 済み**、PR 4 = #695 は open。4 本とも main から独立に切り、stacked にしていない。「計測してから決める」を PR 3 で実際に守り、閾値・除外リストはどちらも実測値から決めた。

#### 変更点

- **PR 2（#689・merged）**: `web/tsconfig.app.json` + `tsconfig.node.json` に `"strict": true` を明示。TS 6.0 では既定が true なので**今日は no-op** — 他 3 パッケージは自分で宣言しており、web だけが既定に依存していた。5.x 側へ統一すると strict 一族が無言で消える経路を先に塞ぐのが目的で、**PR 4 より先に merge** する必要があった（実際 17:46 に先着）
- **PR 2 の coverage**: `@vitest/coverage-v8` + `test:coverage` を shared / web に追加、**thresholds は入れない**。`coverage.include` を `src/**` と明示（既定は「テストが import したファイルだけ」を数えるので、一度も import されないファイルが分母から消える）。実測 = shared 66.77% statements（354 ファイル中 32 本が 0%）/ web 36.56%（69 ファイル中 28 本が 0%）。CI には載せていない（閾値が無い＝落ちないので、毎回 1 分払って誰も読まない）
- **PR 3（#690・merged）**: `shared/tsconfig.test.json` + `web/tsconfig.test.json` を新設し、CI にブロッキングで挿した。**先に計測 → shared 15 errors / 12 suites・web 1 error / 1 suite**（約 50 で停止する取り決めの範囲内）。0 でなかったので eslint baseline と同形の per-file `exclude` を持たせ、除外外の約 180 本は今日から検査される
- **PR 3 が暴いた中身**: 全部が設定ではなく**テストが隠していたドリフト** — 型が獲得したフィールドを欠く fixture（`TrashViewLabels.close` / `WikiTag.icon`）/ 型が落としたプロパティを指す patch（`SeriesEditablePatch.memo`）/ `TaskStatus` でなくなった `"todo"` / `void | Promise<void>` に `number` を返す mock / 既に起きないエラーを守る `@ts-expect-error` 5 件。直すと assertion が変わるので別 PR
- **PR 3 の落とし穴 3 つ**: composite project は emit を止められない（`composite`/`declaration` を打ち消す）/ `rootDir: "src"` のままだと tests 全件が「rootDir 外」で即死（`"."` へ）/ `@types/node` が shared に**そもそも無かった**（tests が `node:crypto` / `node:fs` を import している）
- **PR 4（#695・open）**: TypeScript を shared `~5.6.0` / desktop `~5.6.0` / mcp-server `~5.9.3` → 全部 `~6.0.2`（web は既定で一致）。4 パッケージとも 6.0.3 に解決することを node_modules と lockfile の両方で実測
- **PR 4 で唯一壊れた場所**: mcp-server が **15 errors**（全部 `TS2591: Cannot find name 'process' / 'node:crypto'`）。`@types/node` はずっと入っていた。**TS 6.0 はここで 5.9 がやっていた `@types` 自動探索をしない** — `--traceResolution` に type reference の行が 1 本も出ない。`"types": ["node"]` を足して解決（コンパイラの error text が勧める形で、shared / web / desktop が既にやっている形）。**ソース変更ゼロ**。mcp-server は #687 で CI に載ったばかりなので、この暗黙依存は先週まで誰にも見えなかった
- **PR 4 は rebase して交差検証**: #690 の tests 型検査ゲートは TS **5.6** で計測したベースライン。6.0 でも成立するかが本当の問いなので、#689 / #690 が着地した後に rebase して再測 — shared / web とも exit 0、除外リストへの追加ゼロ
- **負のテスト（実施 → revert）**: 型エラーを含む新規 suite を `shared/tests/` に置くと新ゲートが名指しで落ちる（`TS2322` / exit 2）ことを確認。ベースラインは 12 本を隔離するだけで、他に穴を開けていない
- **`mobile/` は `~5.6.0` のまま**: 計画書の Scope 宣言が触るなと言っている。今回以降 5.x が残る唯一のパッケージで、CI にも載っていない旨を #695 の本文に明記した

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
