---
Status: COMPLETED # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: 2026-09-14
Branch: claude/connect-refine-<issue> # Issue ごとに切替（worktree = connect-refine）
Owner-chat: chat-connect-refine # 計画の作成は chat-main（2026-09-14）
Parent: .claude/decisions/D-20260912-main-1.md
Previous: (なし)
---

# Plan: Connect をタグとリンクの編集所へ作り替える（ClaudeDesign 生成デザインの実装）

## Context

- **動機**: D-20260912-main-1 の裁定 3 点（タグ編集モーダルを退役して Connect に一本化 / 右パネルで選択アイテムの近傍を出す / Desktop と Mobile を同時に作る）を、ClaudeDesign で生成したデザインどおりに実装する。いまの Connect は読むだけの一覧で、未分類 133 件・イベントのタグ付け 0 件・リンク 4 本という実測の偏りを、この画面から直せない
- **デザインの正本**（claude.ai/design。実装セッションは `DesignSync` の `get_file` で読む）:

  | 対象    | projectId                              | ファイル                      | 中身                                                                                                                                                   |
  | ------- | -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Desktop | `ece0b993-9247-44b7-bdae-f03b4c82609b` | `TsunagariBoard.dc.html`      | 1440×900 の盤面本体。props `theme` × `mode`(A/B) × `state`(normal / edit / multi / noTag / empty / loading / error) で全状態を描き分ける               |
  | Desktop | 同上                                   | `つながり - 通常状態.dc.html` | キャンバス。1a〜1d（通常 A/B × light/dark）・2a〜2f（編集 / 未選択 / 空 / ローディング / 複数選択 / エラー）と注記                                     |
  | Mobile  | `6aad0553-9d05-4759-bb29-d0552540079f` | `Tsunagari Mobile.dc.html`    | 390×844。1a〜1f（画面 1〜3 × light/dark）・1g〜1i（「…」メニュー 2 種 / リンク追加シート）・1j〜1l（空 / ローディング / エラー）・1m（フォーカス仕様） |

- **プロンプトと根拠の正本**: [`docs/design/briefs/connect-relations.md`](../docs/design/briefs/connect-relations.md)。デザインに描かれていない状態は、同 brief §4.1 / §4.2 の文言を仕様とする（下の「デザイン未描画の項目」）
- **制約**: コスト $0 / DDL なし（既存の DataService メソッドの組み合わせで足りる）/ `lumen-*` トークン必須・hex 直書き禁止 / 新規 UI は `shared/src/components/` / i18n は en・ja 両 catalog / Mobile のタップ面 44px 以上
- **Non-goals**:
  - 力学グラフ・全体関係図の復活（#1152 / D-20260829-connect-1）
  - タグの階層・グループ（#329 で退役済み）
  - アイテム本体の編集（完了トグル・本文・日付）と「今日に入れる」導線
  - MCP ツールの追加（タグ系ツールは既存のまま）
  - LinkPanel（ノート詳細ヘッダ）の見た目の変更。導出ロジックの共通化だけを行う

---

## 検討した代替案（必須）

| 案                                                                                    | 採否 | 却下理由                                                                | 復活条件                                                                                         |
| ------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| モーダル退役・Connect に一本化（D-20260912-main-1 Q1-A）                              | ✓    | —                                                                       | —                                                                                                |
| モーダルを残し Connect にも編集を足す（Q1-B）                                         | ✗    | 同じタグ一覧の二重保守が続く                                            | ユーザー裁定の変更のみ                                                                           |
| リンクを右パネルの近傍として出す（Q2-A）                                              | ✓    | —                                                                       | —                                                                                                |
| リンクを Connect の 2 つ目のタブに立てる（Q2-B）                                      | ✗    | リンク 4 本に画面 1 枚は重い                                            | 生存リンクが 50 本以上になり、リンク起点の一覧を読みたくなったとき                               |
| 一括操作・統合をフック層で既存メソッドの逐次呼び出しとして組む                        | ✓    | —                                                                       | —                                                                                                |
| 一括操作・統合を Postgres の RPC 関数（1 トランザクション）にする                     | ✗    | DDL と db push（🛑）が要り、10〜20 件規模の操作には過剰                 | 実測で途中失敗が出る、または 1 回の一括操作が 100 件を超えて Realtime の再取得が体感で詰まるとき |
| サイドバーの「タグを編集」行を Connect への遷移に差し替える（D-20260912-main-1 波及） | ✓    | —                                                                       | —                                                                                                |
| 「タグを編集」行を削除する（ナビの「つながり」と行き先が重複するため）                | ✗    | 裁定の波及欄が「差し替え」と明記している                                | ユーザーが重複を理由に削除を指示したとき                                                         |
| 近傍の導出を LinkPanel から shared の純関数へ切り出し、LinkPanel も同じ関数を使う     | ✓    | —                                                                       | —                                                                                                |
| Connect 用に近傍の導出を別実装する                                                    | ✗    | 「同じタグ」「同じ日」の規則が 2 か所に分かれ、片方だけ直る事故が起きる | なし                                                                                             |

---

## 仮定（実装セッションで覆ったらキューへ）

1. **Desktop の行クリックの意味が変わる**。クリック = 選択（右パネルがモード B へ）、シェブロンのボタンとダブルクリック = 元の画面へ移動。brief §4.1 の指定どおりで、現行テスト `routes a clicked row to the shell's item-nav` は書き換える。Mobile は行タップ = 移動のまま
2. **アイテムを選んだとき右パネルが閉じていれば開く**。`RightSidebarContext` の `open()`（`shared/src/context/RightSidebarContext.tsx:48`）を呼ぶ。閉じたままだと選択が空振りに見えるため
3. **編集ブロックの未保存ガードは「タグの切替」だけに掛ける**。セクションを離れたときは下書きを黙って捨てる（旧モーダルの close ガードに相当する出口が、単画面では section 切替しか無いため）。ここがユーザーの期待と違えば P-005 に従いキューへ
4. **統合は「統合元の所属を統合先に付け直す → 統合元の所属を外す → 統合元タグを soft delete」の順**。統合元の所属行を残したまま tag だけ消すと、DB に宙に浮いた assignment が残るため明示的に外す
5. **一括操作の途中失敗は、成功分を残して失敗件数をトーストで出す**。`assignTagToItem` は同じ組み合わせの行を再利用する（#1593）ので、やり直しは冪等になる
6. **アイテム選択も `connectSelectionStore` に持たせる**（#1473 と同じ理由でセクション往復に耐える）

---

## デザインと現行コードの差分（実装の対応表）

### Desktop

| #   | デザイン上の要素                                                                                                                                                                            | 現行                                                                    | 実装先                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | ヘッダーの補助テキスト「タグ 14 ／ アイテム 150」                                                                                                                                           | 無し                                                                    | Connect の section header（`web/src/sectionDescriptors.tsx` / `web/src/hooks/useShellChrome.tsx` の header 組み立て）                        |
| D2  | レール: 行ホバーで件数チップ右に「…」→ 名前を変更 / アイコンを変える / 色を変える / 別のタグへ統合… / 削除（danger）                                                                        | 無し                                                                    | `TagHubTagRail.tsx` + 既存 `Menu`                                                                                                            |
| D3  | レール: 選択行 = accent-subtle 地 + 左端 2px の accent バー                                                                                                                                 | 地のみ                                                                  | `TagHubTagRail.tsx`                                                                                                                          |
| D4  | レール末尾: 区切り線 → 未分類 → 折り畳み「使われていないタグ（N）」                                                                                                                         | 件数 0 のタグも名前順で本流に混在（`buildTagHubModel.ts` の summaries） | `buildTagHubModel.ts` に `unusedTags` を分離して返す + レールで折り畳み                                                                      |
| D5  | レール最下部固定: ＋ + 「タグ名を入力」+「追加」                                                                                                                                            | 無し（モーダル側にあった）                                              | `TagHubTagRail.tsx`                                                                                                                          |
| D6  | 中央ヘッダー: 18px アイコン + 名前 16px 太字 + 「7 件」+ 鉛筆ボタン                                                                                                                         | 鉛筆無し                                                                | `TagHubView.tsx`                                                                                                                             |
| D7  | 編集ブロック（2a）: 名前 / アイコン（四角ボタン + 変更）/ 色（12 色 2 段 6 列 + デフォルト + カスタム）/ 左下「タグを削除」/ 右下「未保存」ドット + 保存                                    | モーダル内 `TagDetailPane.tsx`                                          | 新規 `TagHubEditBlock.tsx`（`TagIconPicker` / `ColorPicker` / `tagRowPatch` を再利用。`colorPresets.ts` の 12 色はデザインと一致を確認済み） |
| D8  | アイテム行: 16px のチェックボックス枠（**常時表示** — 2026-09-21 にこうだいさんの指示で変更。旧仕様は「ホバー行 or 1 件以上選択中に表示」）+ タイトル + 右端補助 + ホバーでシェブロン                                                                         | ボタン 1 個（クリック = 移動）                                          | `TagHubItemGroups.tsx`                                                                                                                       |
| D9  | 行の単一選択 = accent-subtle 地 + 2px バー                                                                                                                                                  | 無し                                                                    | 同上                                                                                                                                         |
| D10 | 選択バー（2f）: 高さ 48px・bg-secondary・上 border・影 sm。「3 件を選択中」/ タグを付ける ▾（主）/ このタグを外す / 別のタグへ移す ▾ / 選択解除                                             | 無し                                                                    | 新規 `TagHubSelectionBar.tsx`                                                                                                                |
| D11 | タグ検索ポップオーバー: 検索欄 + タグ行 + 区切り + 「「設計」を作成」（role=dialog）                                                                                                        | 無し（`web/src/wikitag/TagPicker.tsx` は 1 アイテム専用）               | 新規 `TagHubTagPickerPopover.tsx`（shared・props 注入）                                                                                      |
| D12 | 右パネル モード A: タグ見出し / 種類別 / 最近タグを付けたもの（行頭 22px の円チップ + 色付きアイコン）                                                                                      | ほぼ実装済み（#1472）                                                   | `TagHubDetailPanel.tsx` の見た目合わせのみ                                                                                                   |
| D13 | 右パネル モード B: 「← このタグの内訳へ」/ アイテムカード（アイコン + タイトル + 「素材で開く ↗」）/ リンク（N）・同じタグのアイテム（N）・同じ日のデイリー（N）/ 最下部「＋ リンクを追加」 | 無し（LinkPanel の「関連」ポップオーバーはノート専用）                  | 新規 `RelationPanel.tsx` + 純関数 `buildItemRelations.ts`                                                                                    |
| D14 | エラー（2e）: 右下トースト = bg-secondary + border-strong + 左 4px danger バンド + AlertCircle + 閉じる X、role=alert                                                                       | 書き込み系のエラー表示が無い                                            | 既存 `useToast`（`shared/src/context/ToastContext.tsx:132`）                                                                                 |
| D15 | 空（2c）: レール「タグはまだありません」+ 中央 EmptyState + 主ボタン「タグを追加」                                                                                                          | 文言のみ                                                                | `TagHubView.tsx`                                                                                                                             |
| D16 | ローディング（2d）: レール・中央とも骨組み 6 行、詳細パネルは空                                                                                                                             | 中央のみ `SkeletonList`                                                 | `TagHubView.tsx`                                                                                                                             |

### Mobile

| #   | デザイン上の要素                                                                                                                                                                                  | 現行                                                        | 実装先                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| M1  | 画面 1 上部バー: 左「詳細を開く」 / 中央は見出しなし / 右 Undo・Redo（**2026-09-21 に実装を仕様として確定** = D-20260919-connect-1 / -2 とも A・#1734）。narrow ヘッダーは shell の形状 enum（`web/src/sectionDescriptors.tsx` の `narrowHeader`）で、末尾アクションを 1 つ足すだけで全セクションに波及する。タグの追加はレール最下部の追加行（Desktop の D5 と同じ形）が入口 | 同左（#1646 で着地済み） | 変更しない — `MainScreen.tsx` と `narrowHeader` には触れない |
| M2  | タグ行 48px + 右端に常時「…」（44×44）→ BottomSheet メニュー（名前を変更 / アイコンを変える / 色を変える / 削除）。対象行は accent-subtle を保持。メニュー行 52px、削除は danger + ゴミ箱アイコン | 行のみ                                                      | `TagHubTagRail.tsx`（narrow 分岐）+ 各操作は単機能シート（`TagHubEditBlock` の narrow 変種を BottomSheet に載せる） |
| M3  | 画面 2: 戻る（44）+ タグ見出し + 件数、行 48px + 「…」（44）→ シート（関連を見る / このタグを外す ※通常色）                                                                                       | 戻ると行のみ                                                | `TagHubItemGroups.tsx`（narrow 分岐）                                                                               |
| M4  | 画面 3: 関連 BottomSheet（高さ約 70%・角丸 16・つまみ・閉じる X 44）、下端固定「＋ リンクを追加」（safe-area 込み）、dialog「関連: 〈タイトル〉」                                                 | 無し                                                        | `RelationPanel.tsx` を `BottomSheet` に載せる                                                                       |
| M5  | リンク追加シート（1i）: 検索欄に自動フォーカス / 「候補（N）」/ 行 = アイコン + タイトル + 種別名                                                                                                 | 無し                                                        | `RelationPanel` のリンク追加を narrow ではシートで出す                                                              |
| M6  | 空（1j）: EmptyState（アイコン + 「タグはまだありません」+ 補足「素材や予定にタグを付けると、ここからまとめて読めます。」+ 主ボタン）。絞り込み入力は出さない                                     | 文言のみ                                                    | `TagHubView.tsx`                                                                                                    |
| M7  | ローディング（1k）: 横棒 6 行・48px 間隔・aria-busy「タグを読み込み中」                                                                                                                           | `SkeletonList` 6 行                                         | 行高だけ合わせる                                                                                                    |
| M8  | エラー（1l）: トーストを下部タブバーの上 16px に浮かせる                                                                                                                                          | —                                                           | `useToast`（位置が合わなければ viewport の narrow 配置を確認）                                                      |
| M9  | ハンバーガー → 左 drawer に Desktop の詳細パネルと同じ中身                                                                                                                                        | shell 側で配線済み（`RightSidebarPortal` → `MobileDrawer`） | 追加作業なし（モード A/B がそのまま入る）                                                                           |
| M10 | フォーカス（1m）: `:focus-visible` のみ accent 2px リング + 外側 2px オフセット。ホバーは地色のみ・タッチでは出さない                                                                             | 部品ごとにまちまち                                          | 新規部品は `focus-visible:ring-2 ring-offset-2` で統一                                                              |

### デザイン未描画の項目（brief の文言を仕様とする）

- Desktop のタグ行「…」メニューの開いた状態、統合ダイアログ（`TagMergeDialog`）、モード B の「＋ リンクを追加」ポップオーバー、「使われていないタグ」を開いた状態、状態バリエーションの dark 版
- Mobile の「名前を変更 / アイコン / 色」各シートの中身、「＋」タグ追加シート、削除確認
- 描かれていない dark 版は、盤面の `theme=dark` のトークン対応（下表）から導く

### トークン対応（盤面の CSS 変数 → lumen）

盤面の `--bg / --bg2 / --sub / --sunk / --tx / --tx2 / --tx3 / --bd / --bd2 / --ac / --onac / --acs / --hov / --ac2 / --info / --warn / --danger` は、それぞれ `lumen-bg-primary / bg-secondary / bg-subsidebar / surface-sunken / text / text-secondary / text-tertiary / border / border-strong / accent / on-accent / accent-subtle / hover / accent-secondary / info / warning / danger` に当たる。class 名の最終確認は tailwind 設定を正とする。タグ固有色（`wiki_tags.color`）だけは既存の `TagHeadingIcon` 経由で inline 指定のまま。

---

## Worktree 分担

単一レーン（`connect-refine`）で Issue を上から順に 1 PR ずつ進める。起票は chat-main。

| 順  | 担当（1 行）                                                                | 対応 Issue    | 触ってよいパス                                                                                                                     |
| --- | --------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 繰り返しアイテム（routine シリーズ）を Connect の 1 行として解決する        | #1631（既存） | `web/src/connect/**` `shared/src/components/TagHub/**` `web/tests/connectScreen.test.tsx` `shared/tests/buildTagHubModel*.test.ts` |
| 2   | タグ編集を Connect に統合し、モーダルと入口を差し替える（D1〜D7・D15・D16） | #1643        | 下の Scope の I-2 行                                                                                                               |
| 3   | 複数選択・一括タグ操作・タグ統合（D8〜D11・D14）                            | #1644        | 下の Scope の I-3 行                                                                                                               |
| 4   | 右パネルの近傍モードとリンクの追加・削除（D12・D13）                        | #1645        | 下の Scope の I-4 行                                                                                                               |
| 5   | Mobile 3 段（M1〜M10）                                                      | #1646        | 下の Scope の I-5 行                                                                                                               |

- 各 Issue の DoD は本文に機械検証可能な形で書く（本表に転記しない）
- #1631 の「タグ編集パネル側の表示」は順 2 でパネルごと退役するため、#1631 では Connect 側だけを直す（Issue にその旨をコメント）
- 順 2 以降は前の PR の merge を待たずに stacked で進めてよいが、**base が main 以外の PR は merge 後に main 着地を実測する**（memory: stacked-pr-base-retarget-race）

---

## Scope (Touchable Paths)

```
# 共通
.claude/docs/vision/plans/2026-09-14-connect-tag-link-workbench.md

# I-1（#1631）
web/src/connect/ConnectScreen.tsx
shared/src/components/TagHub/buildTagHubModel.ts
shared/src/components/TagHub/types.ts
web/tests/connectScreen.test.tsx
shared/tests/buildTagHubModel*.test.ts

# I-2 タグ編集の統合
shared/src/components/TagHub/**                  # TagHubEditBlock.tsx 新規・Rail / View 改修
shared/src/components/tagEdit/**                 # TagEditModal / TagMasterList / TaggedItemList 削除・TagDetailPane は吸収後に削除可
shared/src/components/index.ts
shared/src/index.ts
shared/src/hooks/useTaggedItemIndex.ts           # 呼び出し元ゼロになれば削除
shared/src/components/SidebarNav.tsx
shared/src/components/AppShell.tsx
web/src/tags/TagEditorHost.tsx                   # 削除
web/src/MainScreen.tsx
web/src/MobileShellActions.tsx
web/src/hooks/useShellChrome.tsx
web/src/sectionDescriptors.tsx
web/src/connect/**
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/tagEdit*.test.tsx shared/tests/tagEditLabels.ts   # 退役 or TagHub 側へ移植
web/tests/tagEditorActions.test.tsx              # connectScreen 側へ移植して削除
web/tests/connectScreen.test.tsx
shared/tests/tagHub*.test.tsx
.claude/CLAUDE.md                                # §8 Tier 2 の Connect / WikiTags 記述
.claude/docs/requirements/mobile-scope.md        # #9 の入口とパネル記述
.claude/docs/requirements/tier-2-supporting.md

# I-3 一括操作と統合
shared/src/hooks/useWikiTagsUnifiedAPI.ts        # bulkAssign / bulkUnassign / moveItemsToTag / mergeTags を追加
shared/src/components/TagHub/**                  # TagHubSelectionBar / TagHubTagPickerPopover / TagMergeDialog
web/src/connect/**
shared/src/i18n/locales/*.json
shared/tests/useWikiTagsUnifiedAPI*.test.ts* shared/tests/tagHub*.test.tsx web/tests/connectScreen.test.tsx

# I-4 近傍モード
shared/src/components/TagHub/**                  # RelationPanel.tsx / buildItemRelations.ts
shared/src/state/connectSelectionStore.ts
shared/tests/connectSelectionStore.test.ts shared/tests/buildItemRelations.test.ts
web/src/wikitag/LinkPanel.tsx                    # 導出を buildItemRelations に置換（UI 不変）
web/tests/linkPanel.test.tsx
web/src/connect/**
shared/src/i18n/locales/*.json

# I-5 Mobile
shared/src/components/TagHub/**
web/src/connect/**
web/src/sectionDescriptors.tsx                   # narrow header 行
shared/src/i18n/locales/*.json
web/tests/connectScreen*.test.tsx shared/tests/tagHub*.test.tsx
.claude/docs/requirements/mobile-scope.md        # #13 の目標列と実装状況
.claude/docs/design/briefs/connect-relations.md  # Status → Generated・§6 にデザインの所在
.claude/decisions/D-20260912-main-1.md           # implemented-by に PR を追記（最終 PR）
```

スコープ外の変更が必要になったら **P-008**: 実装せずキュー（`comm/decisions/chat-connect-refine.md`）か outbox の起票依頼へ積み、現計画を続行する。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                         | Gate    | Acceptance                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | chat-main: 順 2〜5 の Issue を `section:connect` で起票し、本計画の分担表に番号を書く。#1631 に「編集パネル側は順 2 で退役」をコメント                                                                                                                                       | 🤖 自律 | `gh issue list -R sunbreak-pro/life-editor --label section:connect --state open` に 5 件                                                             |
| 1   | I-1: routine をシリーズ 1 行（種別 = イベント・detail = 次回日付・遷移先 = 次回 occurrence）として items に加え、タグ付きシリーズの occurrence を未分類に入れない                                                                                                            | 🤖 自律 | `connectScreen.test.tsx` に「routine に付いたタグの行が出る」「その occurrence が未分類に入らない」の 2 ケース緑                                     |
| 2   | I-2a: `buildTagHubModel` が件数 0 のタグを `unusedTags` に分けて返す。レールに区切り線 → 未分類 → 折り畳み行、最下部に追加行、選択行の 2px バー                                                                                                                              | 🤖 自律 | model テストで「件数 0 のタグが tags に無く unusedTags にある」緑                                                                                    |
| 3   | I-2b: 行「…」メニュー（改名 / アイコン / 色 → 編集ブロックを開いて該当欄にフォーカス、削除 → ConfirmDialog）と中央ヘッダーの鉛筆・`TagHubEditBlock`（保存ボタンだけが書き込む・未保存表示・タグ切替時の破棄確認）                                                            | 🤖 自律 | 旧 `tagEditorActions.test.tsx` の 11 ケース相当（改名 / 色 / アイコンがそれぞれ別 patch・削除は soft delete・開くだけでは書かない）を connect 側で緑 |
| 4   | I-2c: `TagEditModal` / `TagMasterList` / `TaggedItemList` / `TagEditorHost` / 呼び出し元ゼロの `useTaggedItemIndex` を削除。サイドバー行と「その他」シートの「タグを編集」を `setSection("connect")` に差し替え。ヘッダー補助テキスト（D1）・空 / ローディング（D15・D16）   | 🤖 自律 | `git grep -nE "TagEditModal\|TagEditorHost\|TagMasterList\|TaggedItemList" -- shared/src web/src` が 0 件                                            |
| 5   | I-2d: docs 追随（CLAUDE.md §8 の Connect 記述・mobile-scope #9・tier-2-supporting）                                                                                                                                                                                          | 🤖 自律 | `LC_ALL=C bash scripts/docs-lint.sh` exit 0                                                                                                          |
| 6   | I-3a: `useWikiTagsUnifiedAPI` に `bulkAssign(itemIds, tagId)` / `bulkUnassign(itemIds, tagId)` / `moveItemsToTag(itemIds, fromTagId, toTagId)` / `mergeTags(sourceId, targetId)` を追加（既存 DS メソッドの逐次呼び出し・成功 / 失敗件数を返す）                             | 🤖 自律 | フックテストで呼び出し順（統合 = assign → unassign → soft delete）と途中失敗時の戻り値を検証                                                         |
| 7   | I-3b: チェックボックス（ホバー行 / 1 件以上選択中は全行）・`TagHubSelectionBar`・`TagHubTagPickerPopover`（検索 + 作成行）・`TagMergeDialog`（統合先を選び件数移動を確認）・失敗トースト。未分類バケツ選択中は「このタグを外す」「別のタグへ移す」を出さない。Esc で選択解除 | 🤖 自律 | 「3 件選択 → タグを付ける → assignTagToItem が 3 回」「作成行 → createWikiTagUnified 1 回 + assign 3 回」のテスト緑                                  |
| 8   | I-4a: `buildItemRelations({ itemId, assignments, connections, itemsById, dailyDate })` を shared の純関数に切り出し、LinkPanel の `linked` / `sharedTagItems` / `sameDayDaily` をこれに置換                                                                                  | 🤖 自律 | `buildItemRelations.test.ts` 緑・`web/tests/linkPanel.test.tsx` が無変更で緑                                                                         |
| 9   | I-4b: 行クリック = 選択（store に itemId）・シェブロン / ダブルクリック = 移動・右パネルが閉じていれば `open()`。モード B（戻り行 / アイテムカード / 3 節 / 行ホバーの × でリンク削除 / 「＋ リンクを追加」のタイトル検索ポップオーバー）                                    | 🤖 自律 | 「行クリックで navigate が呼ばれない・パネルにリンク節が出る」「リンク追加で createItemLink(from=選択, to=候補)」のテスト緑                          |
| 10  | I-5: Mobile 3 段（M1〜M8・M10）。各「…」と単機能シート、関連シート、リンク追加シート、44px 下限                                                                                                                                                                              | 🤖 自律 | narrow のテストで「…」ボタンと行に `min-h-11` 系の 44px 下限 class があること・シートの dialog 名を検証                                              |
| 11  | I-5 docs: mobile-scope #13 の目標列を実態に更新、brief の Status を Generated にしてデザインの所在（projectId）を §6 に追記、D-20260912-main-1 の `implemented-by` に PR を列挙                                                                                              | 🤖 自律 | `node .claude/scripts/records.mjs check` exit 0                                                                                                      |
| 12  | 実ブラウザ検証（chat-main のみ）: 1440×900 で 1a〜2f、390×844 で Mobile 1a〜1l と見比べる。light / dark 両方                                                                                                                                                                 | 👀 目視 | `playwright-ui-verifier` の findings 0 件、またはユーザーが差分を許容                                                                                |
| 13  | 各 PR の merge                                                                                                                                                                                                                                                               | 🛑 人手 | ユーザーが merge（P-001）                                                                                                                            |

---

## Acceptance Criteria（機械検証可能）

- [ ] `.github/workflows/ci.yml` の `verify` ジョブの全ステップ（shared → web → desktop → mcp-server の lint / build / typecheck:tests / test）を各 PR で exit 0。終了コードは `tail` を挟まずに取る（CLAUDE.md §7.1）
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` exit 0
- [ ] `git grep -nE "TagEditModal|TagEditorHost|TagMasterList|TaggedItemList" -- shared/src web/src` が 0 件（I-2 以降）
- [ ] `git grep -nE "#[0-9a-fA-F]{6}\b" -- shared/src/components/TagHub` が 0 件（hex 直書き禁止）
- [ ] 新規 i18n キーが `en.json` と `ja.json` の両方に同じ集合で存在（キー差分 0）
- [ ] 新規テストファイル `shared/tests/buildItemRelations.test.ts` が存在し緑
- [ ] `web/tests/linkPanel.test.tsx` を編集せずに緑（I-4a の置換が UI を変えていない証拠）
- [ ] PR diff の目安: I-1 ≤ 300 行 / I-2 ≤ 1,200 行（削除込み）/ I-3 ≤ 900 行 / I-4 ≤ 900 行 / I-5 ≤ 900 行。超える見込みなら分割を outbox で chat-main に相談
- [ ] 完了時: 本計画の Status を COMPLETED にして `archive/` へ移動、per-chat memory を更新（DoD）

---

## Risks / Known Issues 参照

- **一括操作と Realtime の再取得**: 1 件ごとの書き込みが Realtime のエコーで `syncVersion` を上げ、タグ 3 クエリの再取得が件数分走りうる。10 件で体感を実測し、詰まるなら「代替案: RPC 関数」の復活条件に照らして判断する
- **行クリックの意味の変更**（仮定 1）: 既存ユーザーの手癖と食い違う。シェブロンを常に押せる面として残し、ダブルクリックでも移動できるようにして緩和する
- **routine シリーズ行の遷移先**（#1631）: 次回 occurrence が無い（終了済み）シリーズは、最後の occurrence の日へ遷移する
- **Mobile の単機能シート**はデザインに中身が無い。`TagHubEditBlock` の narrow 変種で 1 欄だけを出す形にし、見た目は 👀 で確認する
- **テストの型ゲート**: `build` と `vitest` が緑でも `typecheck:tests` だけが落ちる（CLAUDE.md §7.1）。退役テストの削除漏れで型が壊れやすい
- **web の vitest の flake**: 冷えた vite キャッシュで lazy-mount 系が落ちる（memory: cold-vite-cache-fails-lazy-mount-tests）。web の vitest は verify の最後に静かな状態で回す
- **stacked PR の着地漏れ**（memory: stacked-pr-base-retarget-race / push-after-merge-strands-commits）
- 本計画書・brief・D-20260912-main-1 は 2026-09-14 時点で main の作業コピーに未追跡のまま。worktree からは絶対パスで読むか、先に docs PR で main に載せる

---

## References

- 裁定: [`D-20260912-main-1`](../decisions/D-20260912-main-1.md)（前提 = #1171 / #1152 / #1153 / #1290 / D-20260829-connect-1）
- brief: [`docs/design/briefs/connect-relations.md`](../docs/design/briefs/connect-relations.md)・再定義レポート: `docs/reports/2026-09-12-connect-redefinition.html`
- 関連 Issue: #1631（routine のタグ）/ #1632（schedule 側・本計画の対象外）
- related skills: `add-component` / `frontend-react-designer` / `test-writing` / `worktree-policy` / `session-verifier` / `playwright-verify`

---

## Worklog

- **2026-09-16 / chat-main**: Step 0 — 順 2〜5 を起票（#1643 / #1644 / #1645 / #1646）。計画書・brief・裁定を docs PR #1647 で main へ
- **2026-09-16 / connect-refine**: Steps 2〜5（I-2 = #1643・PR #1657 merged）。タグ編集モーダルを退役し Connect に一本化
- **2026-09-17〜19 / connect-refine**: 残り 4 本を 5 PR で。#1676 = タグ行の右クリックメニューと部品の切り出し（PR #1685 merged）／ #1644 = 一括タグ API とタグ統合（PR #1696）+ 複数選択と選択バー（PR #1698）。**Issue の 900 行上限を超えたため Step 6 / 7 の境目で 2 本に分割した**／ #1645 = 右パネルの近傍モード（PR #1703。`buildItemRelations` は LinkPanel も読む）／ #1646 = Mobile 3 段（本 PR）
- **仮定の実測**: 近傍の導出は `connections` ではなく `getLinksForItem` の 2 バケットを受け取る形にした（LinkPanel のテストを 1 行も変えずに通すため = I-4a の DoD）。Mobile の上部バー「＋」は shell 側（`MainScreen.tsx`）に触れるため実装せず、レールの追加行を入口として残した（判断キューへ）
- **2026-09-21 / connect-refine**: Step 12 の差分 3 件（#1734）を処理。M5 の「候補（N）」見出しと D14 の AlertCircle は実装を直し、M1（画面 1 の上部バー）は実装を仕様として上の M1 行に書き直した（D-20260919-connect-1 / -2 とも A）
- **2026-09-21 / connect-refine**: D8 のチェックボックスを常時表示へ。ホバーしないと出ないと、複数選択ができること自体に気付けないため（こうだいさんの指示・Issue 無し）
- **未実施**: Step 12 の実ブラウザ検証（👀 = chat-main）と Step 13 の merge（🛑 = ユーザー）。一括操作 10 件の体感実測も dev server が要るため chat-main 側
