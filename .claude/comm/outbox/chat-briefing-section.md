# chat-briefing-section outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-27 (2) → @chat-main（#373 実装完了 — PR #415 merge 済み / #391 は #404 + #406 とも着地確認済み）

**Issue #373（Settings の「日付が変わる時刻」）の実装が完了し、PR #415 は merge 済みです。** 読み手側は #218 / PR #242 で既に入っていたので、今回足したのは書き込み UI だけです。保存先も読み手ロジックも触っていません（既定 0 のままなら挙動は完全に不変）。

- 新規カード `shared/src/components/SettingsDayStart.tsx`（pure・0〜23 時の select）+ `SettingsScreen` で `useDayStartHourPref` に配線。i18n は `settings.dayStart.*` を en/ja 両方に追加
- **選択肢のラベルは翻訳キーにしていません**。`00:00`〜`23:00` の 0 埋め表記は Schedule の軸・ルーチン時刻と同じで en/ja 共通のため、24 個のキーを増やす価値がないと判断しました（コード内コメントに理由あり）
- 検証: shared build / **146 files 1175 tests** / web build / web eslint すべて exit 0。DDL ゼロ・`lumen-*` のみ・DataService 境界不変
- **依頼（merge 後の実機確認）**: Settings で 04:00 を選ぶ → 再読み込み → 選択が残っていること。理想は深夜 00:00〜04:00 に Daily を開いて前日の日付になることまでですが、時間帯依存なので永続の確認だけでも十分です
- **前エントリの決着報告**: #391 の PR #404 と追随 #406 は**両方 merge 済み**で、取り残しは解消しています（`gh pr view` の state と headRefOid で実測）。前エントリの依頼 2（未宣言の日に「保存済み」キャプションが出る・朝刊にも同性質）の起票は**まだ未処理**なので引き続きお願いします

---

## 2026-07-27 → @chat-main（#391 実装完了 — PR #404 merge 済み + **QA 反映の追随 PR あり**・実機確認依頼 + 起票依頼 1 件）

**Issue #391（モバイルの夕刊タブでも宣言を編集可に）の実装が完了し、PR #404 が merge 済みです**。狭幅の夕刊だけを編集可にし、wide の読み返し専用は据え置きです。

**⚠️ #394 と同じ取り残しが再発しました。** role-qa 独立監査の反映コミット `8b16b349` を push した時点で PR #404 は既に merge 済み（head = `fe3265d5`）だったため、監査反映分が main に入っていません。同コミットを `origin/main` へ cherry-pick した追随 PR を別途提出しています（衝突なし）。**#404 だけ見て完了扱いにしないでください。**

- 着手前の再実測で、Issue 本文より実態が一段悪いことが判明しました。夕刊の宣言は「read-only の入力欄」ではなく**表示専用テキスト**で、しかも宣言が無い日は**ブロックごと非描画**でした（= 入力口が存在しない）。PR #357 で狭幅から夕刊へ到達できるようになったことで表面化した形です
- 検証済み: shared tsc -b / shared vitest **145 files 1166 tests**（`briefingView.test.tsx` を 17 → 21 件）/ web build 全 green。DDL ゼロ・`lumen-*` のみ・DataService 境界不変。role-qa 独立監査の MAJOR 1 件（`tier-1-core.md` の「表示専用」記述がコードと矛盾）と MINOR 1 件（wide の読み返しが保存値ではなく生ドラフトを表示）は**追随 PR 側**に入っています（上記の取り残しのため）
- **依頼 1（merge 後の実機確認）**: 狭幅（DevTools + iOS Simulator）で (a) 夕刊タブに宣言の入力欄が出るか — **その日まだ宣言していない状態でも出ること**が要点 (b) 夕刊で入力 → 朝刊へ切替えて同じ文面が出るか (c) 再読込後も残っているか (d) wide の夕刊が従来どおり「今朝の宣言」の読み返しのままか
- **依頼 2（起票依頼・briefing レーン）**: **一度も宣言していない日に「保存済み」キャプションが出ます**。`intentionSaved` が「ドラフト未入力 = 保存済み」と判定するためで、朝刊にも同じ性質がある**既存挙動**です（#391 が作ったものではありません）。ただし狭幅の夕刊では「空欄の真上に保存済み」となり据わりが悪いので、朝刊・夕刊まとめて直す `section:briefing` 起票をお願いします。修正案は「未宣言かつドラフト無しならキャプションを出さない」で、`BriefingScreen.tsx` の `intentionCaption` 算出 2 箇所の変更で済みます
- 補足: `shared/` には eslint 設定が無く（config は `web/eslint.config.js` のみ）、新規の `shared/src/components/briefing/IntentionField.tsx` は lint 対象外です。本 PR 起因ではなくリポジトリの設備ギャップなので、`shared-fix` 化するかは貴レーン判断でお願いします

---

## 2026-07-26 (2) → @chat-main（訂正 — **PR #394 の監査反映コミットが main に乗っていません**・PR #399 で拾い直し）

下の 2026-07-26 エントリで「PR #394 は監査指摘を反映して 2 commit 目を追加済み」と書きましたが、**実際には main に届いていませんでした**。実測で確認した内容は次のとおりです。

- PR #394 は head = `a3e4c378`（tracker コミット）の時点で merge されており（09:39:38Z）、監査反映の `ecdede3d` はその後に `claude/materials-370` へ push されたため merge 対象外。merge 済み PR のブランチに push しても PR には入りません
- 結果として `origin/main` には `shared/src/utils/balanceByRole.ts` が存在せず、`web/src/notes/itemLinkSuggestion.ts` は `.slice(0, MAX_CANDIDATES)` のまま、`web/src/tasks/KanbanView.tsx` の生存チェックも未適用
- **実害**: ノートが 8 件以上ある環境では `[[` 候補にタスクが 1 件も出ません（#370 の目的そのものが未達）。またゴミ箱行きタスクへのリンクをクリックすると空の詳細パネルが開きます
- **対応**: `ecdede3d` を `origin/main` へ cherry-pick した **PR #399** を提出済み（`shared/src/index.ts` の export 隣接行のみ衝突 → 両方残して解消）。shared vitest 144 files / 1150 tests 緑・shared tsc -b 緑・web build 緑
- **他レーンへの注意喚起**: 同じ事故は「PR を出す → merge される → 後から追加 commit を push する」順序でいつでも起きます。監査反映を push したら `gh pr view <n> --json state,headRefOid` で state と head を確認するのが確実です。materials レーンの他 4 本（#388 / #390 / #392 / #398）は merged head = remote head 一致を実測済みで、取り残しは #394 のみでした

これに伴い、下エントリの表の #370 行と実ブラウザ検証項目 4（`[[` にタスクが出る）は **PR #399 merge 後**に確認してください。

---

## 2026-07-26 → @chat-main（materials レーン 4 件完了 — 実ブラウザ検証依頼 + 起票依頼 5 件）

**このチャット（worktree = briefing-section）が materials レーンを担当し、Issue #365 / #366 / #371 / #370 を 1 Issue = 1 ブランチ = 1 PR で処理しました。**

| Issue                                                   | PR   | 状態                     |
| ------------------------------------------------------- | ---- | ------------------------ |
| #365 タグ使用数がゴミ箱アイテムを過大計上               | #388 | merge 済み・Issue closed |
| #366 編集中 Note が tag グループ内で最上位へ跳ねる      | #390 | merge 済み・Issue closed |
| #371 新規 Daily の初回 `[[link]]` が Connect に載らない | #392 | merge 済み・Issue closed |
| #370 `[[link]]` 候補に tasks を追加                     | #394 | **open**                 |
| #371 追撃（リンクのみの新規 Daily が保存されない）      | #398 | **open**                 |

全件 shared vitest / shared tsc -b / web build 緑・DDL 変更ゼロ。実装後に role-qa + security-reviewer の独立監査を通し、指摘は下記のとおり実測で裏取りしてから反映しています（security は Critical/High/Medium ゼロ）。

- **PR #394 は監査指摘を反映して 2 commit 目を追加済み**: (a) 候補プールが role 連結順で `slice(0,8)` されていたため、ノートが 8 件以上あるとタスク候補が 1 件も出なかった → `balanceByRole`（shared・新規・テスト 6 件）で role ごとに 1 枠ずつ配る方式に変更。(b) trash 済み / 実体の無いタスクへのリンクをクリックすると空の詳細パネルが開いた → 生存チェックを追加（`tree.isLoading` で gate。タブ遷移直後は nodeMap が空なので、ガードだけ足すと全部弾く）
- **PR #398 は merge 済み #392 の穴を塞ぐもの**: 解決済みリンクは atom ノードでテキストを持たないため、`dailyContentExcerpt` ベースの空判定が「リンクだけの本文」を空と誤判定し、保存自体がスキップされていました（＝リンクも辺も消える）。#392 だけ merge して #398 を落とすと Issue #371 の症状が一部残るので、セットで merge してください

### 依頼 1（merge 後の実ブラウザ検証・貴レーン担当）

worktree からは build / 型検証までなので（CLAUDE.md §7.4）、以下は chat-main でお願いします。

1. **#365（最優先）**: タグ付きノートを 1 件ゴミ箱へ → Tag 編集モーダルの件数が減ること。**この PR は PostgREST の埋め込み join（`items_meta!inner(is_deleted)`）を導入していて、リポジトリ内に前例がありません**。型検査もスタブテストも構文の正しさを保証しないので、実物で 1 回叩くまでは未検証扱いです。もし構文が通らない場合、`useWikiTagsUnifiedAPI` の `refresh()` に catch が無いためタグ UI・Analytics・Connect が同時に無言で空になります（＝「タグが全部消えた」ように見えたら真っ先に #388 を疑ってください）
2. **#366**: タグ付き Note を開いて入力 → 行が動かない / 別 Note を選ぶと先頭へ移動する
3. **#371 + 追撃**: 新しい日の Daily に `[[note]]` **だけ**挿入 → 1 秒待ってリロード → リンクが残っていて Connect に辺がある
4. **#370**: Notes で `[[` → タスクが候補に出る → 挿入 → クリックで Materials/Tasks が開き該当タスクの詳細が出る

### 依頼 2（起票依頼 5 件）

1. **[Analytics] ゴミ箱行きタスクの作業時間が「タグなし」へ移る**: `analyticsAggregation` は session を itemId で assignment に突き合わせるため、#365 で assignment が返らなくなった結果、trash 済みタスクの実績が除外ではなく untagged バケットへ加算されます。仕様として正しいかの判断が要ります（実測で確認済み・現状は意図的な挙動ではありません）
2. **[materials] `listAllTagConnections` に #365 と同じ書き方はコピーできない**: `wiki_tag_connections` は `from_item_id` / `to_item_id` の 2 本が `items_meta` を参照するため、素の `items_meta!inner(...)` は PGRST201 で 400 になります。将来同じ手を使うときは FK 名指しが必要、という注意書きの話です
3. **[all] 狭幅では `[[link]]` クリックが視覚的に何も起きない**: note / daily / task いずれも同じで、タブが切り替わるだけです（`MobileTaskList` も narrow の NotesView も選択状態を読んでいない）。mobile-scope.md 上は Phase 2 の範囲なので #370 の後退ではありませんが、リンクが壊れて見えるので Epic #321 の配下候補です
4. **[materials] `[[` 候補プールのフェッチが同期のたびに走る**: `useItemLinkTargets` は `syncVersion` 依存なので、Notes / Daily を開いている間は入力が止まるたびに notes + dailies + tasks の全件フェッチが走ります（#370 で 1 本増えました）。初回 `[[` まで遅延させる余地あり
5. **[all] web の eslint が既存エラーで赤**: `web/src/notes/NotesView.tsx:269`（`react-hooks/static-components` — `DesktopTagHeading` が render 中に `Icon` を生成）。`origin/main` 時点で存在する既存エラーで本レーン起因ではありませんが、赤いままだと lint がゲートとして機能しません。`shared-fix` 起票をお願いします

## 2026-07-26 → @chat-main（#318 実装完了 — PR #357・実機確認依頼 + 起票依頼 1 件）

**Issue #318（Mobile 幅で朝刊/夕刊タブが切替不能）の修正が完了し、PR #357 を提出しました**（Closes #318・merge はこうだいさん）。両紙面ビューに optional な `tabSwitcher` スロットを足し、MainScreen が狭幅のときだけ shared の `SegmentedControl` を流し込む構成です。wide は `undefined` を渡すので SectionHeader のタブ挙動は据え置き（tablist の二重存在なし）。

- 検証済み: shared tsc -b / shared vitest **1087/1087**（`briefingView.test.tsx` を 10 → 17 件に = #318 用 7 件追加）/ web build / web eslint 全 green。role-qa 独立監査を 2 回とも PASS（BLOCKING 0・指摘の null ガードは取り込み済み）
- **依頼 1（merge 後の実機確認）**: Issue 記載どおり DevTools 狭幅 + iOS Simulator での確認は貴レーン担当です。見どころは (a) 狭幅で朝刊 ⇔ 夕刊を往復できるか (b) wide でタブ帯が二重に出ないか (c) 帯が紙面と一緒にスクロールする挙動の是非。(c) は Materials 方式（`PageContainer` の header 行に載せて常時固定）へ寄せることも可能なので、実機で違和感があれば起票してください
- **依頼 2（起票依頼・横断タスク）**: `(min-width: 768px)` のリテラルが **11 ファイル 12 箇所**に散在しています（実測: `shared/` = AnalyticsView.tsx:106 / AppShell.tsx:115 / ConnectGraphView.tsx:109 / TrashView.tsx:110、`web/` = MainScreen.tsx:181 / DailyView.tsx:167 / NotesView.tsx:364 / CalendarTab.tsx:93 / ScheduleScreen.tsx:35 / SettingsScreen.tsx:56 / KanbanView.tsx:100 / WorkScreen.tsx:47）。うち `web/src/work/WorkScreen.tsx:47` は既に `const WIDE_QUERY = "(min-width: 768px)"` を局所定義していて、名前は先に実在します。1 箇所だけ動かすと「狭幅なのに切替 UI が出ない」「wide で二重表示」に化ける構造なので、shared から `WIDE_QUERY` を export して全箇所を寄せる `shared-fix` 起票をお願いします（briefing 単独では直しません）

## 2026-07-18 → @chat-main（#256 実装完了 — PR #273・手動 1 周の実測依頼）

**Issue #256（朝刊ループ Step 2: MCP schedule handler の Supabase 化 + `get_today_context` / `write_briefing`）の実装が完了し、PR #273 を提出しました**（Closes #256・DDL ゼロ・`mcp-server/` のみ変更で shared / web 非接触）。

- 検証済み: mcp-server tsc + vitest 14/14（shared `extractBriefing` との往復検証 = 「書いた朝刊を紙面表示できる」の機械チェック込み）/ shared vitest 917/917 + tsc -b / web build 全 green。briefing-loop 計画書 Step 2 チェック + Worklog 追記済み
- **依頼 1（merge 後の手動 1 周）**: DoD の「vitest + 手動 1 周」のうち手動 1 周は貴レーン担当です。MCP server 環境に `LIFE_EDITOR_SUPABASE_URL` / `LIFE_EDITOR_SUPABASE_ANON_KEY`（`VITE_*` でも可）+ `LIFE_EDITOR_SUPABASE_EMAIL` / `LIFE_EDITOR_SUPABASE_PASSWORD` を設定 →（DB path は省略可）→ `get_today_context` → `write_briefing` → Briefing 紙面表示、の 1 周をお願いします（手順の要点は README と PR 本文に記載）
- **依頼 2（Issue クローズ確認）**: PR merge で #256 は自動 close されます。close 時に briefing-loop Step 2 の「手動 1 周」実測結果を Worklog に 1 行追記してもらえると DoD が完結します
- 補足: schedule-refine レーンとの重なりは PR 本文に明記済み（mapper 非 import・規約 §10.2/§10.5 を mcp-server 内で実装のためコード衝突なし）。`generate_content` / `format_content` の schedule 経路は旧 SQLite のまま（残 handler の Supabase 化タスクのスコープ — 必要なら起票をお願いします）
