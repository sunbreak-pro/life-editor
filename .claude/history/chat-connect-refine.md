# HISTORY (chat-connect-refine)

### 2026-08-30 - Connect 2 本（#1152 / #1171）の merge 後始末 — 計画書を archive へ

#### 概要

PR #1175（退役）と #1230（Tag hub）が両方 merged・Issue #1152 / #1171 が CLOSED になったのを実測で確認し、対応する計画書 2 本を COMPLETED 化して `archive/` へ移した。コード変更なし。

#### 変更点

- **archive 移動**: `plans/2026-08-29-connect-section-retirement.md` と `plans/2026-08-29-connect-tag-hub.md` を `.claude/archive/` へ。Status を `COMPLETED # … PR #NNNN merged / Issue #NNNN CLOSED` に更新
- **相対パスの貼り替え**: 計画書は `plans/`（`.claude` から 3 階層下）から `archive/`（1 階層下）へ移るので、本文の `../../../CLAUDE.md` → `../CLAUDE.md`・`../../../rules/…` → `../rules/…`・`../../requirements/…` → `../docs/requirements/…` を全数置換。tag-hub 側の `Previous:` は前計画も同時に移したため `./…` のまま有効
- **参照元の追随**: `docs/design/briefs/connect.md` の「新 Connect の仕様の正本」リンクが `plans/` を指したままだったので `../../../archive/…` へ。**これは markdown リンクなので放置すると docs-lint (a) が落ちる**（history / memory 側の言及はインラインコードなので lint 対象外）
- **乖離レビュー 3 行**を両計画書の Worklog へ記入（archive 前の必須手順）。tag-hub 側の要点 = スコープ逸脱は docs 4 本で計画時に宣言済み / AC 免除なし / 途中で出た判断は TagPill・snapshot slot が計画書の §スコープ外、Briefing テストの flake が outbox
- **`archive/SUMMARY.md` は更新しない**（同ファイルの運用宣言どおり、2026-05-24 以降の archive 入りは索引しない）

### 2026-08-29 - Tag 起点の新 Connect セクション（Tag hub）を新設（#1171 / PR #1230 open）

#### 概要

#1152 で退役させた Connect を、力学グラフではなく**タグを入口にしたハブ**として同じ id で戻した。タグ一覧 → 選択 → そのタグの Note / Todo / Event / Daily を種類別に一覧し、行クリックで各アイテムの本来の画面へ飛ぶ。DataService への追加メソッドはゼロ・DDL 変更ゼロ。CI verify 全ステップ + docs-lint をローカルで全通しし、`origin/main`（#1215 = #1199 着地後）へ rebase してから PR #1230 を open（**merge はユーザー = P-001**）。

#### 変更点

- **新規（部品層）**: `shared/src/components/TagHub/` — `buildTagHubModel`（導出を丸ごと純関数化）+ レール / 種類別グループ / それを組む View。**新しい視覚言語を作らずに済んだ**のが設計上の要点で、レール行はタグ編集（#740）の行形、種別見出しはその `ItemRoleBadge`（#409）をそのまま使っている
- **新規（画面層）**: `web/src/connect/ConnectScreen.tsx` — `fetchTodoTree` / `fetchEvents` / `listNotesUnified` / `listDailiesUnified` の 4 本を `useDomainLoad` で読み、labels を解決して `navigateToItem` に配線。Provider は descriptor 側の `WikiTagsUnifiedProvider` 1 本だけ（4 ドメインは読み取り専用なので Briefing / Trash と同じ「Provider を足さない」形）
- **registry / i18n**: `sections.ts` に `connect`（icon = `Tags` / materials の直後 / `mobileOrder: 5`）を追加し、settings・trash の mobileOrder を 1 つ後ろへ。`connect.*` ブロックと `section.connect` を en / ja に新設。**`MainScreen.tsx` は無改変**（registry + descriptor の 2 箇所で閉じる = `rules/frontend.md`）— 同時進行の #1199 レーンと衝突しないための必須条件だった
- **設計判断（PR 本文にも記載）**: (1) 未分類バケツは必須機能 — タグ起点一本化ではタグ無しアイテムに入口が無くなる。soft-delete された assignment と、削除済みタグを指す assignment の 2 経路も未分類へ落とすようにした (2) 件数は `countsByTag` ではなく**表示している行から**導出（前者は hub が並べない role も数えるため 5 と 4 がズレる） (3) hub は編集しない・「今日への配置」導線を持たない（#1153 の領分。不在をテストで固定） (4) code-split しない（重いのはベンダー依存で、entry gzip は 233KB → 236KB の実測）
- **テスト**: `shared/tests/tagHubModel.test.ts`(20) が導出、`tagHubView.test.tsx`(15) が描画と狭幅 1 画面ずつ遷移、`web/tests/connectScreen.test.tsx`(7) がホスト配線（どの read がどの種別になるか / ゴミ箱行の除外 / event の date が nav intent に乗るか）を固定
- **docs 追随**: CLAUDE.md §8 / `rules/frontend.md` / `mobile-scope.md` #13（Full → **Consumption**）/ `tier-2-supporting.md`。**Issue の Scope に無い `docs/design/IA.md` と `briefs/connect.md` も追加**（#1152 が「Connect は退役した」と現況として書いた場所で、放置すると実在するセクションを docs が「無い」と言う状態になるため。決定本文は書き換えず注記のみ）
- **検証**: shared 265 files / 2570 tests・web 91 / 865・desktop 7・mcp-server 24 / 319 全 pass、lint / build / typecheck:tests 全 exit 0、`LC_ALL=C bash scripts/docs-lint.sh` exit 0。rebase 後の再検証で `web/tests/briefingEveningLazyMount.test.tsx` が 1 度だけ落ちたが、単体でも次のフル実行でも緑 = **フル実行時の flake**（#1115 の lazy mount・本 PR と無関係）。起票依頼を outbox に投函
- **スコープ外へ送った分（P-008）**: TagPill へのアイコン展開（Issue が「計画書で判断」としていた点 → **今回は入れない**と判断）・hub 内編集・`useDomainLoad` の snapshot slot（key の union が本計画の Scope 外にある）
- **計画書**: `plans/2026-08-29-connect-tag-hub.md`（Status: IN PROGRESS。archive 移動は merge 後）

### 2026-08-29 - Connect セクションを力学グラフごと退役（#1152 / PR #1175 merged）

#### 概要

Connect セクションと力学グラフ描画一式（shared 3,903 行 + web host 177 行）を削除し、タグ・アイテム間リンク・検索のデータと取り出し口は無改変で温存した。DDL 変更ゼロ。CI verify 15 ステップ + docs-lint をローカルで全通しして PR #1175 を open（**merge はユーザー = P-001**）。

#### 変更点

- **削除**: `shared/src/components/Connect/`（simulation / Canvas 2D / 操作パネル / 凡例 / 選択カード / mobile シート / primitives）・`web/src/connect/ConnectScreen.tsx` と `lazy()` 行 + descriptor 行・section registry の `connect` エントリ・i18n の `connect.*` と `section.connect`（en / ja）・グラフ系テスト 8 本。差分は 63 files / +522 -5521
- **救出（削除せず移設）**: `BacklinkView` → `shared/src/components/Backlinks/`（`GraphNode` 依存を 3 フィールドの `BacklinkNode` に置換）/ `backlinkSourceIds` + `resolveLinkId` → `shared/src/utils/itemLinks.ts` / 該当テスト 2 describe → `shared/tests/itemLinks.test.ts` / `connect.sidebar.incomingLinks` + `connect.graph.selectNodeHint` → 既存 `backlinks.*` ブロック。型手術の裏取りに `shared/tests/backlinkView.test.tsx` を新規追加（4 ケース）
- **前提の訂正（実測）**: Issue 本文の「BacklinkView / ヘルパは LinkPanel が使用」は実物と異なった。`web/src/wikitag/LinkPanel.tsx:126` は `getLinksForItem()` から自前で読んでおり、`:52` の言及はコメント内の設計参照。移設した 3 つは**現時点で呼び出し元ゼロ**で、`P-002` を適用すれば削除もできる状態 → 判断は `D-20260829-connect-1` としてキューへ（放置時＝保持）
- **docs 追随**: CLAUDE.md §8 / `rules/frontend.md` の lazy 対象 / `mobile-scope.md` #13（**D-20260723-main-1 の Full 指定を supersede**）/ `tier-2-supporting.md` WikiTags。**計画時に scope 外としていた `docs/design/IA.md` と `docs/design/briefs/connect.md` を sweep 中に追加**（前者は `Status: APPROVED` の現況 SSOT が「本流 5 = … Connect …」のままで、放置すると後続が Connect を再追加しうるため。どちらも決定本文は書き換えず注記のみ）
- **検証**: shared 266 files / 2545 tests・web 88 / 851・desktop 7・mcp-server 24 / 318 全 pass、lint / build / typecheck:tests 全 exit 0、`LC_ALL=C bash scripts/docs-lint.sh` exit 0。`web` の build 出力から `ConnectScreen-*.js`（約 101KB / gzip 約 29KB）が消えたことも確認
- **スコープ外へ送った分（P-008）**: d3 依存 4 本 + 型定義 4 本の削除は package.json + lockfile 2 本に及ぶため別 PR へ。起票依頼を `comm/outbox/chat-connect-refine.md` に投函
- **計画書**: `plans/2026-08-29-connect-section-retirement.md`（Status: IN PROGRESS。実装ブランチ側にあるため本 tracker ブランチには無く、archive 移動は merge 後）

### 2026-07-11 - Connect Layout Standard adoption 完了確認 + セッション帳簿整理

#### 概要

connect セクションの layout standard 追随（v1 gutter / v2 header 再編）が両方 main 反映済みであることを確認し、上の 2 件の `[途中]` 記録を確定。新規の実装作業は無し（section:connect open Issue = 0）。

#### 変更点

- **完了確認**: v1 gutter 追随 = PR #194 merged / v2 adoption（in-body ConnectHeader 撤去・graph アクションを rightSidebar 集約）= Issue #206 CLOSED → PR #212 merged。`git diff origin/main HEAD` 空 = 自ブランチ内容は main と完全一致
- **main 取り込み**: セッション開始時に `git merge origin/main` をクリーン適用（他 worktree の #230/#227/#226 等 14 コミット・コンフリクト無し）
- **Issue 帳簿**: #181 `[all]` の connect 行を `[x]` に更新 + 完了コメント投稿（close 判断は chat-main へ委譲・残 = schedule/work/settings/trash）

- 2026-07-11: [途中] Layout Standard v2 adoption（#206）— origin/main 取り込み（#202 docs 含む・merge 済）後、#196 由来の二重ヘッダーを解消。自前 ConnectHeader 撤去 + graph アクション（件数/フィルタ解除/reheat=再配置/fit=全体表示）を rightSidebar settings タブへ集約（新規 ConnectGraphActions.tsx + ConnectSidebarPanel に settingsHeader スロット + ConnectGraphView Desktop 分岐改修 + ConnectHeader.tsx 削除）。mobile/narrow 不変・幅トグルは layout-standard 後続。検証: shared build 緑 / web build 緑 / role-qa PASS(Blocker 0) / shared test は過負荷 flaky 6件のみ(単体 69/69 pass・Connect 無関係)。commit/PR 承認待ち
- 2026-07-11: [途中] #181 connect 行 — fluid variant 採用確認 + Connect の rem gutter 3 箇所を px lumen gutter トークンへ置換。検証全 pass（shared build / 768 tests / web build・role-qa PASS）。commit / PR 作成前
