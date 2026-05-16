# Plan: Connect / Node タブを Point Graph (d3-force Canvas) へ置換

> Status: COMPLETED（2026-05-16 全12ステップ実装完了 + パネル閉じる/Connect廃止/perf HUD削除の追補）
> Created: 2026-05-13
> Project path: /Users/newlife/dev/apps/life-editor
> Task: MEMORY.md 連携は task-tracker で別途登録
> 参照: `.claude/docs/vision/PointGraphView.jsx`（デモ） / `.claude/docs/vision/point-view-implementation-plan.md`（汎用版・本書が上書き）

---

## Context（なぜ・制約・non-goals）

### 動機

現在の Connect タブ「Node」タブは React Flow ベースの `TagGraphView`（1438 行）。
ノートが多いと描画が重く、タグはノード上の色ドット＋共有エッジでしか表現されない。
デモ `PointGraphView.jsx`（Canvas 2D + d3-force、~1200 行）の軽快な物理グラフへ置き換える。

### 確定済み意思決定（2026-05-13 ユーザー確認）

| 論点       | 決定                                                                      | 影響                                                      |
| ---------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| タグ表現   | **デモ方式: タグも独立ノード**（`tag:<id>`）                              | データ変換でタグをノード化。ノート⇄タグはエッジ           |
| ノード種別 | **folder→project / note→note / daily→daily / tag→tag**（idea 廃止、4 種） | `classify` はパス prefix でなく `NoteNode.type` で判定    |
| 配色       | **notion-\* トークンへ全面移行**（ライト/ダーク両対応、§6.4 準拠）        | Catppuccin ハードコード全廃。Canvas 描画色は CSS 変数解決 |

### 汎用計画書からの重要な乖離（必読）

`.claude/docs/vision/point-view-implementation-plan.md` は「サイドバー Memo 配下の新規 Point ビュー」「Rust `graph_load_snapshot` を新設」を前提とするが、**本タスクでは両方とも不要**:

- 設置先は **既存 Connect タブの Node タブ置換**（新規セクションではない）。
- データは既に `ConnectView.tsx` 経由で props（`tags / assignments / noteConnections / noteLinks / notes / dailies`）として供給済み。**Rust 側は一切触らない**（汎用版 Phase 1 / §3.2 / §3.3 は破棄）。`GraphSnapshot` はフロントで既存 props から合成する。
- DB マイグレーション不要・MCP 不要・読み取りのみ。

### 制約

- コスト $0 厳守（npm パッケージ追加のみ。署名・課金なし）
- §6.4: 主要 UI コンテナ背景に透明度禁止 / `notion-*` トークン使用 / i18n テキストは props 経由
- 既存の右サイドバー `ConnectSidebar` はそのまま流用（portal 経由、`ConnectView.tsx` で既に分離済み）
- デモのキャンバス内アイテム・フィルタ・パネルは可能な限り流用（TS 化 + テーマ移行のみ）
- フロント型検証は `tsc -b` か `npm run build`（feedback: `tsc --noEmit` は無効）

### Non-Goals

- Board タブ（Paper）は一切変更しない
- React Flow（`@xyflow/react`）の他用途（Board / Schedule 等）からの撤去はしない
- 新しいフィルタ種別やレイアウトアルゴリズムの追加（デモ挙動の範囲に限定）
- リアルタイム同期（スナップショット＋手動リロードで十分）
- テストは原則スキップ（pure 関数のみ任意でユニットテスト）

---

## アーキテクチャ

```
ConnectView.tsx (既存・最小改修)
 └─ activeTab === "node"
     ├─ renderContent(): <TagGraphView/> を <PointGraphView/> に差し替え
     │    （ReactFlowProvider ラッパは Node タブでは不要 → 削除）
     └─ renderSidebar(): ConnectSidebar はそのまま（変更なし）

frontend/src/components/Ideas/Connect/PointGraph/
├── PointGraphView.tsx          ← エントリ。props は TagGraphView と同じ I/F を維持
├── index.ts
├── components/
│   ├── GraphCanvas.tsx         ← canvas + simulation + interaction 統合
│   ├── GraphControlPanel.tsx   ← デモ右 aside を「キャンバス内フローティングパネル」化
│   ├── SelectedNodeCard.tsx    ← 左下フローティング詳細カード（デモ流用）
│   ├── GraphTopBar.tsx         ← α/FPS/フィルタ数/ズーム%（デモ流用）
│   └── primitives/             ← Slider / Toggle / IconButton / Section（デモ流用・TS 化）
├── hooks/
│   ├── usePointGraphModel.ts   ← props → GraphSnapshot 合成（タグ=ノード化）
│   ├── usePointGraphSimulation.ts
│   ├── usePointGraphInteraction.ts
│   └── useGraphFilters.ts
└── lib/
    ├── graph-types.ts
    ├── graph-filters.ts        ← pure 関数（テスタブル）
    ├── graph-render.ts         ← draw(ctx,state,transform)
    └── graph-theme.ts          ← notion-* CSS 変数 → Canvas 色解決
```

### テーマ移行方式（graph-theme.ts）

Canvas 2D は CSS クラスを使えないため、描画前に `getComputedStyle(document.documentElement).getPropertyValue('--notion-...')` で実際の色を解決し、ライト/ダーク + テーマ切替に追従する。

- ノード種別色は notion トークンへマッピング:
  - `project`: `--notion-text`（黒/白＝前景色。デモの「Project=黒固定」を踏襲しつつテーマ追従）
  - `note`: `--notion-accent`
  - `daily`: `--notion-blue`（無ければ `--notion-accent` フォールバック）
  - `tag`: ユーザー定義 `WikiTag.color`（タグは個別色を持つ）。未割当タグは `--notion-text-secondary`
- 背景/枠/サブテキスト: `--notion-bg` / `--notion-border` / `--notion-text-secondary`
- ハイライト（hover/selected）: `--notion-accent`
- テーマ切替検知: `MutationObserver`（`document.documentElement` の `class`/`data-theme`）または既存 ThemeContext を購読し、色キャッシュを再解決 → 再 draw
- パネル/カード背景は **不透明** notion トークン（§6.4 透明度禁止。デモの `${C.mantle}cc` 半透明は使わない）

---

## データモデル（props → GraphSnapshot 合成）

`usePointGraphModel.ts` が既存 props だけで構築（Rust 不要）。

### ノード

| 種別      | ソース                                         | id                               | label         |
| --------- | ---------------------------------------------- | -------------------------------- | ------------- | --- | ----------- |
| `project` | `notes` で `type==='folder'` かつ `!isDeleted` | `note.id`                        | `note.title`  |
| `note`    | `notes` で `type==='note'` かつ `!isDeleted`   | `note.id`                        | `note.title   |     | "Untitled"` |
| `daily`   | `dailies` で `!isDeleted`                      | `daily.id`（`daily-YYYY-MM-DD`） | `daily.date`  |
| `tag`     | `tags` 全件                                    | `tag:<tag.id>`                   | `#<tag.name>` |

ノード `color` は graph-theme で種別→トークン解決。`note` は `note.color` があれば優先（ユーザー配色尊重）。`tag` は `tag.color`。

### エッジ（kind 別）

| kind        | ソース                                | source → target                                                  | 線種（描画）                     |
| ----------- | ------------------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| `hierarchy` | `note.parentId`（folder/note ツリー） | 親 `note.id` → 子 `note.id`                                      | 実線・控えめ（project 構造）     |
| `wikilink`  | `noteLinks`（`isDeleted===0`）        | `sourceNoteId` または `daily-${sourceMemoDate}` → `targetNoteId` | 実線                             |
| `manual`    | `noteConnections`                     | `sourceNoteId` → `targetNoteId`                                  | 実線・強調色（クリックで削除可） |
| `tag`       | `assignments`                         | `entityId` → `tag:<tagId>`                                       | 破線                             |
| `temporal`  | `dailies` を `date` 昇順、隣接ペア    | `daily[i].id` → `daily[i+1].id`                                  | 破線                             |

**データマッピング注意点（実装者へ）**:

- `noteLink.sourceMemoDate`（日付文字列）→ daily ノード id は `daily-${sourceMemoDate}`。現 `TagGraphView` は `memo-${date}` を使っており不整合があるので、**`dailies` 配列の実 id 形式（`daily-YYYY-MM-DD`）に合わせる**こと。両端が nodes に存在しないエッジは破棄。
- `assignment.entityType`: `"note"` は note/folder、`"memo"` は daily（`entityId` は daily の id）。`"task"` はグラフ対象外で無視。
- タグ id 衝突回避: タグノードは必ず `tag:` prefix。エッジ生成時も付与。
- フォルダ＝project だが、フォルダにも `assignments`/`noteConnections` が付きうる → そのまま project ノードにエッジを張る。

### スナップショット型（graph-types.ts）

```ts
export type GraphNodeType = "project" | "note" | "daily" | "tag";
export type GraphLinkKind =
  | "hierarchy"
  | "wikilink"
  | "tag"
  | "temporal"
  | "manual";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  color?: string; // note.color / tag.color（種別色は theme で解決）
  entityId?: string; // タグなら素の tagId、それ以外は元 id
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: GraphLinkKind;
}
export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

---

## UX 設計（UI/UX を意識）

### レイアウト

```
┌─ Connect Node タブ ─────────────────────────────┬─ ConnectSidebar ─┐
│  [GraphTopBar: ● α | n/total · e | filters | %k | fps]  (左上)        │ （既存・変更なし）│
│                                                  [⌖controls] (右上)    │  検索/タグ/ノート │
│                                                                       │  /デイリー一覧     │
│            ● ● ●  Canvas 2D グラフ（d3-force）  ● ●                    │  → portal 経由     │
│                                                                       │                    │
│  ┌ SelectedNodeCard (左下) ┐        ┌ GraphControlPanel (右、開閉) ┐  │                    │
│  │ アイコン/タイトル/パス  │        │ Search/Types/Tags/Local/      │  │                    │
│  │ links·tags / Local hop  │        │ Display/Forces                │  │                    │
│  │ Connections リスト       │        │ (デモ aside をパネル化)        │  │                    │
│  └─────────────────────────┘        └───────────────────────────────┘  │                    │
└───────────────────────────────────────────────────────────────────────┴────────────────────┘
```

- **右サイドバー = 既存 `ConnectSidebar`（不変）**。デモの右 `<aside>` ControlPanel は **右サイドバーにしない**。キャンバス内右側のフローティングパネル（`GraphControlPanel`）として描画し、右上歯車ボタンで開閉（デモの `showPanel` 流用）。デフォルトは閉（ConnectSidebar と二重で重くしない）。
- ConnectSidebar の `selectedTagId`（タグ選択）と `sidebarSelectedItemId`（ノート/デイリー フォーカス）は **グラフ側フィルタ/ハイライトに連動**:
  - `sidebarSelectedItemId` あり → そのノードへスムーズパン＋選択状態＋（任意で Local Graph 1-hop 既定 ON）。デモ「選択時スムーズパン」を流用。
  - `selectedTagId` あり → 対応 `tag:<id>` ノードを選択扱いでハイライト＋隣接強調。
- グラフ内クリック選択 ↔ `onSelectTag` / `setSidebarSelectedItemId` を双方向反映（現 `TagGraphView` の `focusedItemId = sidebarSelectedItemId ?? selectedNodeId` の思想を継承）。

### インタラクション（デモ挙動を完全継承）

- ドラッグでノード連動（タッチ含む。`touch-action:none`、window レベル pointer リスナで指が外れても切れない）
- タップ→中央スムーズパン（`interrupt + zoomTransform`、オフセット無し。汎用計画書 §4.6 のドリフト対策を厳守）
- ピンチ / ホイールでズーム、ラベルは `k >= 0.85` で表示（ズームゲート）
- ホバーで 1-hop 隣接ハイライト、それ以外を dim
- 検索: マッチに緑グロー＋1-hop 拡張表示
- 位置キャッシュ（フィルタ変更でノードが飛び散らない・汎用計画書 §4.4 必須）
- パネル/ConnectSidebar 開閉によるサイズ変化時のリセンタリング（§4.5 `prevSizeRef` シフト）

### 既存機能の保全（リグレッション防止）

現 `TagGraphView` が持ち、ユーザーが日常使用している機能を Point Graph でも維持:

- **ノートを開く**: ダブルクリック → `onNavigateToNote` / デイリー → `onNavigateToMemo`
- **ノード右クリック/選択メニュー**: 「ノートを開く」＋ `UnifiedColorPicker`（`onUpdateNoteColor`）。デモの SelectedNodeCard 内にカラーピッカー導線を統合
- **Connect モード**: トグル ON で 2 ノード間ドラッグ → `ConnectPanel`（タグ経由接続 `onConnectViaTag`）。OFF 時の通常ドラッグはノード移動
- **手動接続の削除**: `manual` エッジクリック → `onDeleteNoteConnection`
- **ノード削除**: Delete/Backspace → `onDeleteNoteEntity` / `onDeleteDailyEntity`
- **focusedNoteId**: 指定ノードへフォーカス演出 → `onFocusComplete`
- **CanvasControls 相当**: zoom in/out / fit / フィルタ / connect トグル（デモ TopBar/IconButton に集約）
- **位置/ビューポート永続化**: 既存 `tagGraphStorage.ts`（`TAG_GRAPH_POSITIONS` / `TAG_GRAPH_VIEWPORT`）を流用し、d3 シミュレーション初期位置として復元。新規ノードのみ force レイアウト

> 上記のうち Connect モード / カラーピッカー / 削除 / focusedNoteId は **デモには無い**。「デモ範囲外」だが既存機能のため **維持必須**。デモ UI に最小統合する（新規フィルタ追加ではなく既存導線の移植）。

---

## Steps

各ステップ完了時にコミット。チェック未達のまま次へ進まない。

- [ ] **S1. 依存追加 & 足場**: `frontend/package.json` に `d3-zoom` `d3-selection` `d3-quadtree` `d3-transition` `d3-ease` 追加（`d3-force` `lucide-react` は導入済）。`PointGraph/` ディレクトリと `graph-types.ts` 作成。`npm install` 後 `npm run build` が通る。
- [ ] **S2. データ合成フック**: `usePointGraphModel.ts` を実装（props → GraphSnapshot、タグ=ノード化、5 kind エッジ、daily id 整合、deleted 除外）。`PointGraphView.tsx` 仮実装で `nodes.length / links.length` を画面表示し件数を目視検証。
- [ ] **S3. graph-theme.ts**: notion-\* CSS 変数解決 + テーマ/ライトダーク追従（MutationObserver or ThemeContext）。色キャッシュ。
- [ ] **S4. Canvas + Simulation**: `usePointGraphSimulation.ts` / `graph-render.ts` / `GraphCanvas.tsx`。位置キャッシュ・forceX/Y センタリング・リサイズ時リセンタリング。`tagGraphStorage` から初期位置復元。
- [ ] **S5. インタラクション**: `usePointGraphInteraction.ts`（d3-zoom / window pointer drag / quadtree hit-test / 選択スムーズパン / ホバー隣接強調 / ズームゲートラベル）。
- [ ] **S6. パネル/カード/トップバー流用**: `primitives/*` `GraphControlPanel.tsx`（右上歯車で開閉・既定閉）`SelectedNodeCard.tsx` `GraphTopBar.tsx`。全テキスト i18n（`useTranslation` は呼び出し側で、文言は props or t() を view 直下で）。Catppuccin 全廃。
- [ ] **S7. フィルタ統合**: `graph-filters.ts`（pure: type/tag/search/local-graph/orphan/labels）+ `useGraphFilters.ts`。「Clear filters」。空状態 UI。
- [ ] **S8. ConnectSidebar 連動**: `sidebarSelectedItemId` → 選択+パン、`selectedTagId` ↔ タグノード選択、グラフ選択 → `onSelectTag`/`onSidebarSelect` 反映。`focusedNoteId`/`onFocusComplete`。
- [ ] **S9. 既存機能移植**: ダブルクリック遷移 / 選択メニュー+`UnifiedColorPicker`(`onUpdateNoteColor`) / Connect モード+`ConnectPanel`(`onConnectViaTag`) / `manual` エッジ削除(`onDeleteNoteConnection`) / Delete キー削除 / 位置・ビューポート永続化。
- [ ] **S10. ConnectView 差し替え**: `renderContent()` の `case "node"` を `<PointGraphView .../>` に変更。Node タブの `ReactFlowProvider` ラッパ削除（Board の `key="connect-board"` は残す）。未使用 import 整理。`TagGraphView.tsx` 等は **削除しない**（S11 で判断）。
- [ ] **S11. 旧コード整理**: Node タブからのみ参照される `TagGraphView` / `NoteNodeComponent` / `DailyNodeComponent` / `CurvedEdge` / `forceLayout` / `layoutTemplates` / `reactFlowMerge` の参照を grep。Board 等で未使用と確定したものをユーザー確認の上で削除（agent-management の削除前確認則に準拠＝確認必須）。
- [ ] **S12. ポリッシュ & 検証**: ライト/ダーク両テーマ目視、ノード ~1000 で FPS 30+、Esc 解除 / Cmd+F 検索 / R reheat、ブラウザでゴールデンパス手動確認、`npm run build` グリーン、`session-verifier`。

## Files

| File                                                                          | Operation                      | Notes                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `frontend/package.json`                                                       | Modify                         | d3-zoom/selection/quadtree/transition/ease 追加                                           |
| `frontend/src/components/Ideas/ConnectView.tsx`                               | Modify                         | `case "node"` を PointGraphView に。Node の ReactFlowProvider 撤去。import 整理           |
| `frontend/src/components/Ideas/Connect/PointGraph/PointGraphView.tsx`         | Create                         | エントリ。props I/F は TagGraphView を踏襲                                                |
| `.../PointGraph/index.ts`                                                     | Create                         | export                                                                                    |
| `.../PointGraph/components/GraphCanvas.tsx`                                   | Create                         | canvas+sim+interaction                                                                    |
| `.../PointGraph/components/GraphControlPanel.tsx`                             | Create                         | デモ aside をフローティングパネル化                                                       |
| `.../PointGraph/components/SelectedNodeCard.tsx`                              | Create                         | デモ流用＋カラーピッカー導線                                                              |
| `.../PointGraph/components/GraphTopBar.tsx`                                   | Create                         | デモ流用                                                                                  |
| `.../PointGraph/components/primitives/{Slider,Toggle,IconButton,Section}.tsx` | Create                         | デモ流用・TS 化・notion 化                                                                |
| `.../PointGraph/hooks/usePointGraphModel.ts`                                  | Create                         | props→GraphSnapshot                                                                       |
| `.../PointGraph/hooks/usePointGraphSimulation.ts`                             | Create                         | d3-force ラッパ                                                                           |
| `.../PointGraph/hooks/usePointGraphInteraction.ts`                            | Create                         | zoom/drag/hit-test/pan                                                                    |
| `.../PointGraph/hooks/useGraphFilters.ts`                                     | Create                         | フィルタ状態                                                                              |
| `.../PointGraph/lib/graph-types.ts`                                           | Create                         | 型                                                                                        |
| `.../PointGraph/lib/graph-filters.ts`                                         | Create                         | pure フィルタ                                                                             |
| `.../PointGraph/lib/graph-render.ts`                                          | Create                         | draw()                                                                                    |
| `.../PointGraph/lib/graph-theme.ts`                                           | Create                         | notion 変数解決                                                                           |
| `frontend/src/i18n/locales/{ja,en}.json`                                      | Modify                         | 追加文言（filters/forces/display/local graph 等。`connect.*`/`ideas.*` 既存キー流用優先） |
| `frontend/src/components/Ideas/Connect/TagGraphView.tsx` ほか旧 Node 系       | Delete?（S11・要ユーザー確認） | Board 未使用確認後のみ                                                                    |
| `.../PointGraph/lib/graph-filters.test.ts`                                    | Create（任意）                 | pure 関数のみ                                                                             |

## Verification

- [ ] `cd frontend && npm run build`（または `tsc -b`）がエラーなし（`tsc --noEmit` は使わない）
- [ ] Connect → Node タブでグラフが表示、ノード数＝（フォルダ＋ノート＋デイリー＋タグ）件、エッジ数が SQLite と整合
- [ ] 起動時ノードが画面中央に集まる（左右に偏らない）
- [ ] ドラッグ連動が指の激しい移動で切れない（タッチ）
- [ ] タップ→中央パンで正確に着地、連続選択でドリフトしない
- [ ] ズームアウトでラベル消滅 / ズームインで復活（k=0.85）
- [ ] ConnectSidebar でノート/タグ選択 → グラフが連動（パン/ハイライト）
- [ ] ダブルクリックでノート/メモへ遷移、選択メニューから色変更、Connect モードで `ConnectPanel`、manual エッジ削除、Delete 削除がすべて動作
- [ ] ライト/ダーク切替で配色が即追従、Catppuccin 固有色（#1e1e2e 等）が混入していない
- [ ] パネル/カード背景が不透明（透明落ちなし、§6.4）
- [ ] ノード ~1000 で FPS 30+、コンソールエラーなし
- [ ] バンドルサイズが過大増加していない（d3 サブパッケージ個別 import）

---

## リスクと回避策

| リスク                                     | 影響                         | 回避策                                                                                 |
| ------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------- |
| daily id 形式不整合（`daily-` vs `memo-`） | wikilink/temporal エッジ欠落 | S2 で `dailies` 実 id に統一、両端存在チェック                                         |
| Catppuccin→notion で色味が貧弱             | 視認性低下                   | graph-theme で種別ごとにトークン選定、tag は個別色維持。ライト/ダーク両方を S12 で目視 |
| Connect モード等デモ外機能の移植漏れ       | 既存ワークフロー破壊         | UX 節「既存機能の保全」をリグレッションチェックリスト化（Verification 反映済）         |
| 旧 TagGraphView を他所が参照               | 削除でビルド破壊             | S11 で grep、未確定なら削除せずユーザー確認（削除前確認則）                            |
| d3 フル import でバンドル肥大              | 起動遅延                     | サブパッケージ個別 import を最初から徹底                                               |
| タグノード激増（タグ多数）でハブが過密     | レイアウト崩れ               | tag リンク距離を短く（デモ `linkDist*0.7`）、Forces スライダーで調整可                 |

## レビューチェックリスト（人間用・PR 時）

- [ ] Node タブが Canvas グラフに置換され、Board は無変更
- [ ] 右サイドバーは既存 ConnectSidebar のまま（デモ aside で置換していない）
- [ ] 既存機能（遷移/色変更/Connect/削除/フォーカス/永続化）が全て動く
- [ ] notion-\* トークンのみ。ライト/ダーク両対応。透明背景なし
- [ ] Rust / DB / MCP に変更なし（読み取りのみ・props 合成）
- [ ] d3 個別 import、バンドル増加が許容範囲

---

**運用ルール**: ステップ毎にコミット / 完了チェック未達で次へ進まない / スキーマ・構成のズレは独断で進めずユーザー確認 / デモ挙動を超える変更（新フィルタ等）は計画外。完了後この計画を `.claude/archive/` へ移動し Status=COMPLETED に更新。
