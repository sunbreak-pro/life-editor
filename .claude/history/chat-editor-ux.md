# HISTORY (chat-editor-ux)

### 2026-07-19 - #284 kebab メニュー集約 + #285 [[wiki-link]] autocomplete（PR #288）

#### 概要

Notes/Daily ヘッダーの Pin/Delete を共有 Menu ベースの kebab 1 個に集約し（#284）、統一 TipTap エディタに `[[` インライン autocomplete を実装した（#285）。role-pm → role-engineer → role-qa のフルチェーンで検証し、PR #288 を作成（Closes #284/#285）。

#### 変更点

- **#284 kebab 集約**: `Menu.tsx` に `anchorRef` prop 追加（トグルのチラつき防止）。`NoteDetailPanel` / `DailyView`（desktop + mobile）の Pin/Delete を kebab + Menu 化。Daily mobile に delete 導線追加。`noteDetailPanel.test.tsx` 追随更新
- **#285 [[link]]**: 新規 `itemLinkNode.ts`（inline atom・targetId null=未解決）/ `itemLinkSuggestion.ts`（char "[[", slash menu と同型）/ `ItemLinkMenu.tsx` / `useItemLinkTargets.ts`（note+daily 候補プール）。`RichTextEditor` に linkTargets ほか 4 props（ref 鮮度パターン）。`MainScreen` に `navigateToItem`（cross-section 遷移の初配線・pendingNewTask イディオム）。解決済みリンク挿入時に item_links へ重複ガード付き insert（自動削除なし・DDL 不要）
- **検証**: shared 952 tests / shared・web build / lint クリーン。role-qa 独立監査 PASS（Blocking/Should-fix ゼロ・isDestroyed ガード Nit は反映済み）
- **follow-up（outbox 経由で起票依頼）**: tasks への [[リンク / 未保存 Daily の graph 辺 FK スキップ解消 / origin カラム付き item_links 完全同期
