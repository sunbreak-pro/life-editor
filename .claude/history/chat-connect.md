# HISTORY (chat-connect)

### 2026-06-27 - Connect グラフのリンク作成・削除 UI（PR #107）

#### 概要

閲覧専用だった Connect ノードグラフに、ノード間 item-link を作成・削除する UI を最小 v1 で追加。STEP 2「タスク整理・スケジュール管理をストレスなく」の Connect 機能ギャップ解消。「main」名の並行セッション衝突を受け、本レーンを chat-connect として分離。

#### 変更点

- **配置**: ノード選択時の `SelectedNodeCard` に統合。相手は datalist 検索（任意 id 貼付で cross-role 可）、outgoing リンク行の × で削除。Canvas ドラッグ結線・エッジクリック削除は v1 スコープ外。
- **配線**: `ConnectGraphView` に `onCreateLink`/`onDeleteLink` props 追加。host `ConnectScreen` を `WikiTagsUnifiedProvider` で包み、context mutator を配線、connections を cache 由来にして作成/削除で自動再描画。
- **純関数**: `buildGraphModel.ts` に `resolveLinkId(fromId,toId,connections)` 追加（削除の linkId 解決・soft-deleted/逆向き skip）。
- **重複防止**: 候補から既リンク先を除外 + submit ガード（`outgoingLinkIds.has(targetId)`）の二段。QA [Should]#1 対応。
- **不変式**: shared 部品はコールバック注入（context 直呼びなし）/ `notion-*` トークン / i18n en・ja 両 catalog / IME ガード。DDL・DataService 拡張なし（既存 `createItemLink`/`deleteItemLink`/`wiki_tag_connections`）。
- **品質**: role-pm 要件分解 → role-engineer 実装 → role-qa 独立監査（APPROVE-with-nits・Blocking ゼロ）。検証: shared 512 tests / shared tsc -b 0 / web build 0。PR #107（commit `b2f9781e`・base main・未 merge）。
- **follow-up 据え置き**: mutation 失敗時の UI フィードバック / byLabel・raw 貼付経路のテスト追加・冗長な optional chaining 整理。
