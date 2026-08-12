# Decision Queue — chat-refactor-core

### D-20260811-refactor-1: Analytics の「今週」が 2 つの意味で併存しているが、揃えるか？

- 背景: #670 C3 PR 3 の重複整理中に発覚。`shared/src/components/Analytics/MobileAnalyticsView.tsx` は 1 画面の中で 2 つの「今週」を使っている — 作業時間・完了タスクのカードは**月曜〜日曜のカレンダー週**（`calendarWeekRange`）、ノート数のカードは**直近 7 日間のローリング窓**（`createdWithinLastDays(…, 7)`）。`OverviewTab.tsx` のノート数もローリング 7 日。つまり同じ「今週」ラベルの隣に別定義の数字が並んでいる
- 今回やったこと: 開いて書かれていた 2 つの窓に**名前を付けて可視化しただけ**（定義は 1 つも変えていない）。統一は表示される数字が変わるので P-005 に従い実装せずここへ
- A: **カレンダー週（月〜日）に統一する**（推奨 — 週バーのグラフが月〜日で描かれているので、隣の数字だけローリングだと読み手が合わせられない）
- B: ローリング 7 日に統一する（「直近の勢い」を見る指標としては連続性がある）
- C: 現状維持（別定義のまま。ラベルを「今週」/「直近 7 日」に描き分ける — 文言変更が要るので #321 の管轄）
- 放置時: **現状維持**。名前が付いただけで挙動は今と同じなので、無回答でも壊れない。次のクラスタ（C4 以降）へ進む
- 期限感: いつでも（C3 の merge をブロックしない）

### D-20260811-refactor-2: `window.confirm` を自前ダイアログに置き換えるか（計画書 §C3 PR 4 の 1 項目）

- 背景: #670 C3 PR 4 で着手しようとして、**計画書とコード内の記録が食い違っている**のを見つけた。計画書は「`window.confirm` を既存 `RepeatScopeDialog` の形へ（規約ドリフト是正）」としているが、コード側は 3 箇所で「意図してそう選んだ」と明記している:
  - `web/src/schedule/CalendarTab.tsx:1492`（#628）— 「a browser confirm is the one dialog that cannot be missed on either platform」
  - `web/src/settings/SettingsScreen.tsx:124`（#216）— 「window.confirm is the app's existing lightweight confirm affordance for a one-shot destructive action」
  - `web/src/tasks/KanbanView.tsx` / `CalendarTab.tsx:1765`（#573）— 上の 2 つが参照している元パターン
- つまり調査時は「ドリフト（統一漏れ）」に見えたが、実際は**過去に下した判断**。ドリフト是正として黙って剥がすと、その判断を無言で覆すことになるので P-008 に従い実装せずここへ
- 影響範囲: 6 箇所（CalendarTab 4 / SettingsScreen 1 / KanbanView 1）+ 共有 `ConfirmDialog` 新設 + en/ja の文言。うち `CalendarTab.tsx:1494` の `askDiscard` だけは `decideUnsavedClose()` の**同期契約**（#628 が web/tests で固定した純関数）を非同期に変える必要があり、他の 5 箇所より重い
- A: **現状維持**（推奨 — コード側の記録が新しく、かつ具体的な理由「どのプラットフォームでも見落とされない」を持っている。計画書 §C3 のこの項目を取り下げる）
- B: 全 6 箇所を共有 `ConfirmDialog` に置き換える（見た目の管轄は Epic #290 なので、`RepeatScopeDialog` の形を流用し新規デザインはしない）
- C: `askDiscard` 以外の 5 箇所だけ置き換える（同期契約に手を入れない範囲）
- 放置時: **現状維持**（A と同じ）。#670 の DoD にこの項目は無いので、C3 の完了はブロックしない
- 期限感: いつでも（#290 Schedule redesign の着手時に一緒に決めるのが自然）

### D-20260812-refactor-2: 「画面を操作せずにボタンの処理を叩く」経路をどの道で主軸にするか（#701 Step 1）

- 背景: #701 Step 1。ユーザー要望（2026-08-11）=「実際に画面で操作するのではなく、ボタン発火時の引数に値を設定して検証したい」。Issue 本文が挙げる 3 つの道（A = 純関数として切り出して直接呼ぶ / B = Testing Library・renderHook でハンドラを呼ぶ / C = 開発ビルド限定のデバッグ入口）から主軸を 1 つ選ぶ。実装は Step 2 で 1 画面ぶんだけ通す
- 実測 1（既存テストがどの形をどれだけ採っているか。`grep -rlE` の**ファイル数**・2026-08-12 時点の `origin/main` = dcc2ae09）:

| 形                                                  | web/tests | shared/tests | 合計 |
| --------------------------------------------------- | --------- | ------------ | ---- |
| テストファイル総数                                  | 30        | 211          | 241  |
| `@testing-library/react` で render する             | 24        | 120          | 144  |
| `fireEvent` / `userEvent` を使う                    | 9         | 77           | 86   |
| `renderHook` を使う                                 | 7         | 27           | 34   |
| `result.current.<fn>(...)` でハンドラを直接呼ぶ     | 5         | 15           | 20   |
| React を一切載せない（render も renderHook も無い） | 7         | 92           | 99   |

- 実測 2（道 A = 「押したら何を決めるか」を React の外へ出した専用モジュールの現況）: **リポジトリ全体で 4 ファイル・約 250 行、全部が `web/src/schedule/` 配下**。`taskChipUndoWiring.ts` / `taskChipPanel.ts`（`answersChipClick` / `taskChipPanelModel`）/ `todoTrayDeleteGuard.ts`（`todoDeleteCascade`）/ `unsavedCloseGuard.ts`（`decideUnsavedClose`）。shared/src 側には 1 つも無い（`grep -rnE "export (function|const) (decide|plan|resolve)[A-Z]"` の 7 件はいずれもクリック判定ではなく値の解決関数）
- 実測 2 の含意: `web/tests/taskChipUndoWiring.test.ts:12-18` が A を選んだ理由を明記している — 「while they lived inside CalendarTab nothing could see them — the component needs the whole Provider stack plus real grid layout, which jsdom has none of」。つまり A は**好みで選んだ主軸ではなく、jsdom に載らないコンポーネント（CalendarTab）専用の逃げ道**として生まれている。そして #701 は「対象画面に Schedule を選ばない」と明記しているので、**A の前例が唯一存在する場所は Step 2 の対象外**
- 実測 3（直近で実ブラウザ検証に頼った項目を A / B のどちらで機械化できたかの 1 件ずつの判定）:

| Issue       | 内容                                                                  | 判定                     | 根拠                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #624        | ポモドーロ数値入力を空にすると「150」になる                           | **B で足りた**           | `shared/tests/pomodoroSettings.test.tsx` が render → 空入力 → 保存ボタンの引数を assert                                                                                                            |
| #543 / #524 | Connect グラフのクリックが `onActivate` に届かない / 選択解除されない | **B で足りた**           | `shared/tests/graphInteractionCallbacks.test.tsx` が `useGraphInteraction` を render し canvas listener を直接叩く（d3 も jsdom で動いた）                                                         |
| #517        | MobileDrawer にフォーカストラップが無い                               | **B で足りた**           | `shared/tests/mobileDrawer.test.tsx`                                                                                                                                                               |
| #548        | login 後に白画面（Provider の外で context を読む）                    | **B で足りる**           | Provider ツリーごと render すれば throw で落ちる（既存の `appShell.test.tsx` と同じ形）                                                                                                            |
| #608        | ソフトキーボードでボトムタブバーがせり上がる                          | **B で半分**             | `shared/tests/appShellSoftKeyboard.test.tsx` が matchMedia / visualViewport をスタブし「バーを出す / 出さない」の**決定**だけ固定。同ファイル 11-14 行が「見えは実機の 👀 ゲート」と自ら書いている |
| #563        | 週ビューの終日レーンの列線が右の列ほどずれる                          | **A / B / C すべて不可** | 累積ズレは実レイアウトの計算結果。jsdom は座標が全部 0（CLAUDE.md §7.1）。`weekTimeGrid.test.tsx` もヘッダ・レーン・クリックの id 返しまでで位置は見ていない                                       |
| #552        | アイコン変更パネルの背景が透明                                        | **A / B / C すべて不可** | Tailwind クラスから computed style を解決しないので「見え」が取れない。クラス名の literal assert は実装の写経になる                                                                                |

- 実測 3 の含意: 7 件中 5 件は B で機械化できている / できる。**A でしか行けなかったのは「jsdom にそもそも載らない」ケースだけ**。残る 2 件（#563 = 座標 / #552 = 見え）は 3 つの道のどれでも取れず、C（`window` にハンドラを生やす）でも解決しない — C が可能にするのは「実アプリの状態のままハンドラを呼ぶ」ことで、ズレや透明度の判定はスクリーンショット比較の領分。**よって C の必要性を裏づける実測は 1 件も出なかった**
- A: 純関数切り出しを主軸にする（Issue 本文の既定）。安いが、jsdom に載るコンポーネントに対しては「テストのためだけの間接層」を 1 枚増やすことになる
- B: Testing Library / `renderHook` を主軸にする。既に 241 中 144 ファイルがこの形で、新しい仕組みがゼロ
- **A+B（推奨）: B を既定にし、A は「コンポーネントが jsdom に載らないときの逃げ道」と位置づけて使い分け基準を 1 行で明文化する**（`rules/frontend.md` あたりに置く）。実測どおりの姿を規約にするだけで、新規の仕組みも間接層も増えない。Step 2 は B で 1 画面を通す
- C: 開発ビルド限定のデバッグ入口を作る。**非推奨** — 必要性を示す実測が 0 件で、唯一セキュリティの検討（本番ビルドに残さない機械検証）が要る
- 放置時: **Issue 本文の既定どおり A**（Step 2 が止まらない側）。ただし対象画面が jsdom に載る場合、A は上記のとおり間接層を 1 枚増やすだけになる可能性が高い
- 期限感: **#701 Step 2 の着手前まで**（#701 DoD の 2 番目「選んだ道で 1 画面ぶんのテストが緑」をブロックする）

（2026-08-12 昇格分 = D-20260812-refactor-1 — `.claude/decisions/` 台帳へ。台帳化とキューからの除去は chat-main が代行した）
