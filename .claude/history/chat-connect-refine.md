# HISTORY (chat-connect-refine)

### 2026-11-02 - 目標と Todo・タグの 13 Issue を PR にした（/goal）

#### 概要

/goal の指示で、13 Issue それぞれに origin/main からのブランチ、CI の verify の緑、`Refs #n` の PR を揃えた。7 Issue に新しい PR を出し、残りの 5 Issue はコードが merge 済みと監査で確かめた。#2366 と #2399 の PR はこうだいさんが merge した。こちらからは 1 本も merge していない。

#### 変更点

- **#2366 → PR #2433（merged）**: 朝刊の 3 件上限を外した。#2380 が merge 済みで朝刊の分だけ残っていた。
- **#2399 → PR #2436（merged）/ PR #2459（open）**: 行の「＋」から短い期間の目標を足せるようにした。#2459 はスマホ幅の入力欄の幅を直す追いの PR で、1 本目が merge 済みだったので 2 本目のブランチにした。
- **#2398 → PR #2438 / #2388 → PR #2440 / #2405 → PR #2449 / #2409 → PR #2451 / #2410 → PR #2452 / #2401 → PR #2456（すべて open）**: どれも DDL なし。
- **merge 済みで PR を出していない 5 件**: #2367 → #2381、#2365 → #2378、#2364 → #2377、#2362 → #2370、#2283 → #2307 / #2316。
- **監査の指摘を直した**: #2456（日またぎの Todo が縮む、終日の往復で時刻が変わる、日付欄の Enter 保存、届かない行押下のコードの削除）、#2452（朝刊は常に親の select、朝刊のキャンセル、saveLinks の書き込みの柵）、#2449（入れ子の Todo の注記、失敗の文言）、#2440（子から親へ順に削除）。
- **検証**: 各 PR の HEAD で `node scripts/local-ci.mjs --job verify --skip-install` が 14/14 passed（origin/main の基準は 18/18）。docs-lint はローカルで回さず CI に委ねた。
- **main の取り込み**: 初回 push 後のブランチは rebase せず `git merge origin/main` にした。P-007 が force 系の操作を同期確認に回すため。
- **flake**: #2438 の 1 回目で `web/tests/dailyBodyPending.test.tsx` が 1 件落ち、単独 3 回と再実行は緑。全件並列のタイミングで、原因は未確認。
- **merge の順**: 21 組のうち 5 組が行で衝突する（#2438×#2452、#2440×#2449、#2440×#2456、#2449×#2452、#2449×#2456）。#2451 と #2459 はどれとも衝突しない。どの順でも最低 3 本は main の取り込みが要るので、小さい順に #2451 → #2459 → #2438 → #2440 → #2456 → #2449 → #2452 とした。他のレーンの PR との衝突は調べていない。

### 2026-11-01 - open PR の衝突を解消した（#2381 / #2382 / #2411 / #2418）

#### 概要

10-31 から 11-01 にかけて PR がまとめて merge され、open の PR が main と衝突した。自分の 2 本と、どの worktree も持っていない 2 本に main を取り込んだ。force push はしていない。

#### 変更点

- **#2382**: `GoalTreeView.tsx` で #2366 が消した 3 件の上限の変数を落とし、`hasCompleted` を残した。`goalTreeModel.test.ts` は両方の describe を残した。
- **#2381**: #2367 が改名の鉛筆を編集アイコンに畳んだので、main に残っていた `formatRename` と `rename` の文言を落とし、#2365 の `dropHere` と #2366 の日付の文言を残した（en / ja / ラベル / テスト 2 本）。
- **#2411**: `issue-prompter` の衝突を解いた。main との差分はモデル判定の 17 行の追加だけになった。
- **#2418**: #2414 の squash 前のコミットの上に積まれていたため、4 ファイルが衝突して見えた。#2396 のコミットだけを main に載せ直し、2 親の merge commit にした。差分の統計は元のコミットと同じ（24 files / +1884 -664）。
- **#2419**: schedule-refine が占有中なので触っていない。連絡は permission mode の違いで届かなかった。
- **検証**: #2381 / #2382 / #2418 は CI の verify 全ステップと docs-lint がすべて exit 0。#2411 は docs-lint だけ回した（Markdown 1 ファイルの変更のため）。

### 2026-10-28 - 「目標と Todo」の 7 Issue を 1 Issue 1 PR で出した（#2362〜#2368）

#### 概要

/goal の指示で、目標と Todo の画面の Issue を順に 1 本ずつ、origin/main から切ったブランチで実装し、CI の verify 全ステップと docs-lint を緑にして PR を出した。#2283 は既存ブランチの PR #2316 が merge 済みで、実ブラウザ確認も合格していたため新しい PR は出していない。

#### 変更点

- **#2362 → PR #2370（merged）**: Todo を押すと Schedule へ移らず、ItemPanel（#2218）で編集パネルをその画面の上に開く。閉じたら読み直す
- **#2363 → PR #2375**: 追加・編集・削除を試せる HTML のモックを `.claude/docs/reports/2026-10-28-goal-tree-crud-mockup.html` に置き、Artifact でも発行。CSS 変数 `--ink-*` が docs-lint の古いトークン名検査に当たったので `--fg-*` に改名
- **#2364 → PR #2377**: `Button` に縮まない・折り返さない指定が無く、`w-full` の入力欄の横で「追加」が 1 字幅に縮んでいた。目標の木のボタンにだけ `shrink-0 whitespace-nowrap` を付けた
- **#2365 → PR #2378**: 行全体の写しに影と傾きを付けて `setDragImage` に渡し、元の行は点線の穴、置き先は「ここへ移す」の札にした
- **#2366 → PR #2380**: 1 期間 3 件の上限を画面と MCP から外し、migration 0044 で `goals_payload.start_date` / `end_date` を足した（ファイルのみ・db push はユーザー）。migration-validator の指摘 3 件を反映。朝刊の欄が `connect.goals.limit` を使っていたので文言は残した
- **#2367 → PR #2381**: 目標の行に ＋（Todo か 1 段下の目標）・編集（鉛筆を統合、wide はパネルも開く）・削除（既存の確認）を置いた
- **#2368 → PR #2382**: 純粋な関数 `separateCompleted` で、達成した目標を子ごと、完了した Todo を元の場所から「完了済みのアイテム」へ移す。既存テスト 2 本が完了 Todo を木に残す前提だったので直した

### 2026-09-21 - Step 12 の設計差分 3 件（#1734）と、チェックボックスの常時表示（ユーザー直依頼）

#### 概要

2 本の PR を出した。**PR #1809（merged）** が Issue #1734、**PR #1814（open）** がユーザー直依頼のチェックボックス常時表示。どちらも Connect の中で閉じており、DataService も DDL も触っていない。

#### PR #1809 — #1734（裁定 = D-20260919-connect-2 = A）

chat-main の実ブラウザ検証で出た「設計と実装が違う 3 件」のうち、2 と 3 は実装を直し、1 は計画書を実態に合わせた。

- **リンク追加シートの「候補（N）」見出し**（brief M5）: `RelationPanel.tsx` の `AddLinkButton` に、パネル自身の節と同じ `formatSection` で見出しを足した。件数は**検索で絞った後の数**。i18n キー `connect.relations.candidates`（ja「候補」/ en「Candidates」）を新設し、リストは `aria-labelledby` で見出しに紐づけた。Desktop のポップオーバーと narrow のシートは同じ部品なので両方に出る
- **danger トーストの AlertCircle**（brief D14）: `Toast.tsx` で `variant === "danger"` のときだけ丸ドットを 16px の `AlertCircle`（`text-lumen-danger`）に替えた。**他 3 tone はドットのまま** — 設計が名指ししているのは error だけで、info / success / warning のアイコンは指定が無いため広げていない（P-008）
- **Mobile 画面 1 の上部バーは現状維持**（D-20260919-connect-1 = A）: 計画書の M1 行を実装（左「詳細を開く」/ 中央は見出しなし / 右 Undo・Redo）で置き換え、そう決めた理由と根拠 ID を同じ行に残した。**`MainScreen.tsx` と `sectionDescriptors.tsx` の `narrowHeader` には触っていない** — narrow ヘッダーは shell の形状 enum で、末尾アクションを 1 つ足すだけで全セクションに波及するため
- **判断キューの昇格**: 回答が付いた 2 件を `.claude/decisions/D-20260919-connect-1.md` / `-2.md` として台帳へ移し、キューから削除した（`ANSWERS.md` の行は残す）

#### PR #1814 — アイテム行のチェックボックスを常時表示（Issue なし）

`TagHubItemGroups.tsx` から `!anyChecked && "opacity-0 group-hover/row:opacity-100 …"` を外し、出し分けにしか使っていなかった `anyChecked` も変数ごと落とした。旧仕様（brief D8）は「ホバー行 or 1 件以上選択中」で、**ホバーするまで複数選択できること自体が画面に出ていなかった**のが直した理由。行のシェブロンはホバー表示のまま。narrow はそもそも `onToggleChecked` を渡さないので新しく box が出ることはない（一括選択は Desktop 限定 = #1644）。計画書の D8 行も新仕様で置き換えた。

#### テスト

- `web/tests/connectScreen.test.tsx`: 候補見出しの件数が検索に追従すること（4 → 1 → 0）と、0 件で「No matching item」が併記されること / チェックボックスが 3 行とも `opacity-0` を持たないこと
- `shared/tests/components.test.tsx`: danger が icon を出しドットを出さないこと、info はドットのままであること
- **jsdom にホバーは無い**ので、常時表示は「隠していたクラスが付いていない」でしか固定できない。ホバー表示に戻すと落ちる形にした

#### 検証

どちらの PR も CI `verify` の 14 ステップをローカルで全通しして exit 0（shared 3301 / web 1379→1380 / desktop 62 / mcp-server 480・失敗 0）、`docs-lint: OK`、`records.mjs check` も OK。#1814 は #1809 の merge 後に計画書 Worklog が衝突したので `git merge origin/main` で両方の行を残す形に解消し、**取り込み後の木で 14 ステップを回し直した**。実ブラウザ確認は chat-main の手番（CLAUDE.md §7.4）。


### 2026-09-20 - ハブの行タイトルと種別見出しの文字を 1 段大きくした（ユーザー直依頼）

#### 概要

Connect のハブで、アイテム名（13px）がホバーで出るチェックボックス（16px）に対して小さく、Note / Todo の区切りも行と見分けにくい、というユーザー直依頼。Issue は起票していない（worktree チャットは起票せず、修正が小さいので outbox にも回さず PR 1 本で出した）。**PR #1790（open）**。触ったのは `TagHubItemGroups.tsx` と `ItemRoleBadge.tsx` の 2 ファイル。

#### 変更点

- 行タイトルを `text-[13px]` → `text-sm`（14px）。隣の `size-4` チェックボックスと、アプリの他の一覧に揃う
- `ItemRoleBadge` に `size`（`"sm"` = 従来のインラインチップ・既定 / `"md"` = 14px テキスト + 14px グリフ）を追加し、ハブの種別見出しだけが `"md"` を要求する。見出し横のカウントも `text-sm` へ
- **`className` 上書きではなく prop にした理由**: `cn` は単なる文字列結合（rules/frontend.md §Gotchas）なので、`text-sm` を渡しても内蔵の `text-xs` が消えず、勝敗を Tailwind の出力順が決めてしまう
- 右サイドバー `TagHubDetailPanel` の内訳は「区切り」ではなく件数サマリなので小さいチップのまま。他の `ItemRoleBadge` 呼び出し 6 箇所も既定の `"sm"` で不変

#### 検証と事故

- CI `verify` のステップ列をローカルで上から全通し、**14 ステップすべて exit 0**（shared / web / desktop / mcp-server）
- **このワークツリーが origin/main より古いことに、最初のブランチ切りで初めて気付いた**。古い版の `TagHubItemGroups.tsx` を編集していて、`git checkout -b ... origin/main` が「ローカル変更が上書きされる」で止まった。#1749 の `min-w-0 flex-1` が手元に無い版だった。変更を捨てて origin/main から切り直し、同じ編集を入れ直して verify も回し直している。**worktree は着手前に origin/main との差分を見る**のが安い
- 実ブラウザ確認は未実施（worktree は build / 型検証まで — CLAUDE.md §7.4）。merge 後に chat-main 側へ

