# Point View — 実装計画書

> **対象**: life-editor / Tauri 2.0 + Rust + React 19 + Vite + Tailwind v4
> **対象ブランチ**: 新規 feature ブランチ（推奨: `feat/point-view`）
> **想定実装者**: Claude Code（人間レビューあり）
> **デモ参照**: `PointGraphView.jsx`（添付された artifact）
> **作成日**: 2026-05-15

---

## 0. このドキュメントの読み方

この計画書は **要件定義書ではなく実装計画書** です。要件は既にデモで確定しており、ここではそれを life-editor の実コードベースに落とすためのタスクと意思決定を列挙します。

Claude Code は **Phase ごとにコミット** し、各 Phase 終端の「完了チェックリスト」を満たしてから次に進んでください。チェックが満たせない場合は止まって人間に確認してください。

---

## 1. 要件サマリー（確定済）

| 項目 | 確定内容 |
|---|---|
| ビューの位置付け | サイドバー `Memo` 配下の「Point ビュー」として実装 |
| ノード規模 | 200〜2000（Canvas 2D で十分） |
| データ取得 | **ハイブリッド方式**（後述、§3.1） |
| リアルタイム反映 | 不要（開いた時点のスナップショットで十分。手動リロードボタンを設置） |
| UI 機能 | デモ全機能を継承（検索 / Type / Tag / Local Graph / Forces / Display） |
| インタラクション | ドラッグで連動・タップでスムーズパン・ピンチ/スクロールズーム・ホバー強調 |
| ノード視覚 | サイズ統一 / Project は黒固定 / 他は Catppuccin Mocha 色 |
| テスト | スキップ（手動検証） |

---

## 2. アーキテクチャ全体図

```
┌─ Frontend (React 19 + Vite + Tailwind v4) ──────────────────────────┐
│                                                                      │
│  PointGraphView.tsx (entry)                                          │
│   ├── usePointGraphData()        ← データ取得フック                  │
│   ├── usePointGraphSimulation()  ← d3-force シミュレーション          │
│   ├── usePointGraphInteraction() ← drag/zoom/hit-test                │
│   ├── components/                                                    │
│   │   ├── GraphCanvas.tsx        ← Canvas 描画                        │
│   │   ├── ControlPanel.tsx       ← 右パネル (検索/フィルタ/Forces)    │
│   │   ├── SelectedNodeCard.tsx   ← 選択ノード詳細カード               │
│   │   └── TopBar.tsx             ← FPS/α/フィルタ数表示               │
│   ├── lib/                                                           │
│   │   ├── graph-types.ts         ← Node/Link 型定義                   │
│   │   ├── graph-filters.ts       ← フィルタロジック（pure 関数）       │
│   │   ├── graph-layout.ts        ← d3-force ラッパー                  │
│   │   └── catppuccin.ts          ← パレット定数                       │
│   └── services/                                                      │
│       └── DataService.ts         ← 既存抽象、Tauri command 経由        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼ invoke('graph_load_snapshot', ...)
┌─ Backend (Rust / Tauri command) ─────────────────────────────────────┐
│  src-tauri/src/commands/graph.rs                                     │
│   ├── graph_load_snapshot()      ← ノード+エッジを一括返却             │
│   ├── graph_load_neighborhood()  ← Local Graph 拡張用                  │
│   └── graph_node_metadata()      ← クリック時の詳細取得（任意）        │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼  rusqlite
                       SQLite (~/life-workspace/...)
                       既存テーブル：
                       - notes
                       - daily_notes
                       - note_links
                       - note_connections
                       - wiki_tags
                       - wiki_tag_assignments
                       - wiki_tag_connections
```

---

## 3. データ層

### 3.1 データ取得方針（提案）

ハイブリッド + スナップショット型を採用：

```
[グラフを開く瞬間]
   ↓
   graph_load_snapshot() を 1 回だけ呼ぶ
   ↓
   返却内容: 全 Project + 全 Tag + 全 Daily + Note サマリ（メタのみ）
   ↓
   フロントでメモリ保持。以降のフィルタ・検索・Local Graph は全部メモリ内
   ↓
   ユーザーが「リロード」を押すまで再取得しない
```

**なぜスナップショットか**

- 確定済みの「fsnotify 不要」「ノード数 2000 まで」「個人開発」の 3 条件下で最もシンプル。Tauri ↔ Rust ↔ SQLite の往復が起動時 1 回だけになる
- フィルタや Local Graph はクライアント側 JS で完結 → レスポンス即時
- メモリ占有：1 ノード ≒ 200 byte（id, label, type, path）× 2000 = ~400KB。リンクも同程度。**合計 1MB 以内** で問題なし

**なぜハイブリッドか**

- 「Note 本文 / 詳細メタ」は最初に取らない。クリック時に `graph_node_metadata(id)` で個別取得
- これで起動を高速化しつつ、選択時の詳細は遅延ロード

### 3.2 Rust 側 SQL

#### `graph_load_snapshot()`

```rust
// src-tauri/src/commands/graph.rs

#[derive(Serialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub node_type: String,  // "note" | "daily" | "project" | "idea" | "tag"
    pub path: Option<String>,
}

#[derive(Serialize)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
    pub kind: String,       // "wikilink" | "tag" | "temporal" | "manual"
}

#[derive(Serialize)]
pub struct GraphSnapshot {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[tauri::command]
pub async fn graph_load_snapshot(db: State<'_, DbPool>) -> Result<GraphSnapshot, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();
    let mut links = Vec::new();

    // --- (A) Notes ---
    // 既存 notes テーブルから読み込み。Project/Idea/Note の判別はパスや
    // タグから推定する（後述の §3.3 type 判定ルール）
    let mut stmt = conn.prepare(
        "SELECT id, title, path FROM notes WHERE is_deleted = 0"
    ).map_err(|e| e.to_string())?;
    let note_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in note_rows {
        let (id, title, path) = row.map_err(|e| e.to_string())?;
        let node_type = classify_note(&path);  // §3.3
        nodes.push(GraphNode {
            id,
            label: title,
            node_type,
            path,
        });
    }

    // --- (B) Daily notes ---
    // daily_notes テーブルから（実際のテーブル名を確認すること）
    let mut stmt = conn.prepare(
        "SELECT id, date FROM daily_notes ORDER BY date"
    ).map_err(|e| e.to_string())?;
    let daily_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut daily_chain: Vec<String> = Vec::new();
    for row in daily_rows {
        let (id, date) = row.map_err(|e| e.to_string())?;
        nodes.push(GraphNode {
            id: id.clone(),
            label: date.clone(),
            node_type: "daily".to_string(),
            path: Some(format!("daily/{}.md", date)),
        });
        daily_chain.push(id);
    }
    // Daily chain (temporal links)
    for win in daily_chain.windows(2) {
        links.push(GraphLink {
            source: win[0].clone(),
            target: win[1].clone(),
            kind: "temporal".to_string(),
        });
    }

    // --- (C) Tags ---
    let mut stmt = conn.prepare(
        "SELECT id, name FROM wiki_tags"
    ).map_err(|e| e.to_string())?;
    let tag_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in tag_rows {
        let (id, name) = row.map_err(|e| e.to_string())?;
        nodes.push(GraphNode {
            id: format!("tag:{}", id),  // フロント側で tag: prefix で識別
            label: format!("#{}", name),
            node_type: "tag".to_string(),
            path: None,
        });
    }

    // --- (D) Wikilinks (note_links) ---
    let mut stmt = conn.prepare(
        "SELECT
            COALESCE(source_note_id, source_daily_date) AS src,
            target_note_id AS tgt
         FROM note_links
         WHERE is_deleted = 0
           AND (source_note_id IS NOT NULL OR source_daily_date IS NOT NULL)"
    ).map_err(|e| e.to_string())?;
    let link_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in link_rows {
        let (src, tgt) = row.map_err(|e| e.to_string())?;
        links.push(GraphLink {
            source: src,
            target: tgt,
            kind: "wikilink".to_string(),
        });
    }

    // --- (E) Manual connections (note_connections) ---
    let mut stmt = conn.prepare(
        "SELECT source_note_id, target_note_id FROM note_connections"
    ).map_err(|e| e.to_string())?;
    let conn_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in conn_rows {
        let (s, t) = row.map_err(|e| e.to_string())?;
        links.push(GraphLink {
            source: s,
            target: t,
            kind: "manual".to_string(),  // 新規 kind。線種はデモの wikilink と区別
        });
    }

    // --- (F) Tag assignments ---
    let mut stmt = conn.prepare(
        "SELECT entity_id, tag_id FROM wiki_tag_assignments"
    ).map_err(|e| e.to_string())?;
    let ta_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in ta_rows {
        let (entity_id, tag_id) = row.map_err(|e| e.to_string())?;
        links.push(GraphLink {
            source: entity_id,
            target: format!("tag:{}", tag_id),
            kind: "tag".to_string(),
        });
    }

    // --- (G) Tag-to-tag connections ---
    let mut stmt = conn.prepare(
        "SELECT source_tag_id, target_tag_id FROM wiki_tag_connections"
    ).map_err(|e| e.to_string())?;
    let tc_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in tc_rows {
        let (s, t) = row.map_err(|e| e.to_string())?;
        links.push(GraphLink {
            source: format!("tag:{}", s),
            target: format!("tag:{}", t),
            kind: "tag".to_string(),
        });
    }

    Ok(GraphSnapshot { nodes, links })
}
```

#### 重要な前提確認（Claude Code へ）

実装開始時に **必ずスキーマを実コードで確認すること**。この計画書は以下を前提にしている：

- `notes` テーブルに `id` / `title` / `path` / `is_deleted` カラムが存在する
- `daily_notes` テーブルが存在する（テーブル名がもし違うなら要修正）
- `wiki_tags` の id は UUID-like。フロントで `tag:` prefix を付けてノード id 衝突を避ける

実スキーマと食い違う場合は、以下のいずれかで対応：
1. SQL を実スキーマに合わせて修正（推奨）
2. 計画書のこの節を更新して人間に共有

### 3.3 ノードタイプ判定ルール（`classify_note`）

`notes` テーブルに `type` カラムがないので、パスから推定する：

```rust
fn classify_note(path: &Option<String>) -> String {
    let path = match path {
        Some(p) => p.to_lowercase(),
        None => return "note".to_string(),
    };
    if path.starts_with("projects/") { return "project".to_string(); }
    if path.starts_with("ideas/")    { return "idea".to_string(); }
    if path.starts_with("daily/")    { return "daily".to_string(); }
    "note".to_string()
}
```

ユーザーの life-editor では `projects/` / `ideas/` というディレクトリ規約があるはず（user memory より）。違う規約なら修正してください。

### 3.4 フロント側型定義

```typescript
// frontend/src/components/PointView/lib/graph-types.ts

export type NodeType = 'daily' | 'project' | 'idea' | 'note' | 'tag';
export type LinkKind = 'wikilink' | 'tag' | 'temporal' | 'manual';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  path?: string;
  // simulation が付与する位置情報（読み取り専用扱い）
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;  // d3-force が node オブジェクトに置換する
  target: string | GraphNode;
  kind: LinkKind;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

### 3.5 DataService 拡張

```typescript
// frontend/src/services/DataService.ts への追加

export interface DataService {
  // ...existing methods
  loadGraphSnapshot(): Promise<GraphSnapshot>;
  loadNodeMetadata(id: string): Promise<NodeMetadata>;
}

// TauriDataService.ts
async loadGraphSnapshot(): Promise<GraphSnapshot> {
  return await invoke<GraphSnapshot>('graph_load_snapshot');
}
```

---

## 4. UI レイヤ詳細

### 4.1 ファイル構成

```
frontend/src/components/PointView/
├── PointGraphView.tsx              ← エントリ（ルーティング先）
├── index.ts                        ← export
├── components/
│   ├── GraphCanvas.tsx             ← Canvas + シミュレーション統合
│   ├── ControlPanel.tsx            ← 右パネル全体
│   ├── SelectedNodeCard.tsx        ← 左下のフローティングカード
│   ├── TopBar.tsx                  ← FPS/α/フィルタ数表示
│   ├── filters/
│   │   ├── SearchFilter.tsx
│   │   ├── TypeFilter.tsx
│   │   ├── TagFilter.tsx
│   │   ├── LocalGraphFilter.tsx
│   │   ├── DisplayFilter.tsx
│   │   └── ForcesFilter.tsx
│   └── primitives/
│       ├── Slider.tsx
│       ├── Toggle.tsx
│       ├── IconButton.tsx
│       └── Section.tsx
├── hooks/
│   ├── usePointGraphData.ts        ← データ取得
│   ├── usePointGraphSimulation.ts  ← d3-force ラッパー
│   ├── usePointGraphInteraction.ts ← drag/zoom
│   └── useGraphFilters.ts          ← フィルタ状態管理
├── lib/
│   ├── graph-types.ts
│   ├── graph-filters.ts            ← フィルタロジック（pure）
│   ├── graph-layout.ts             ← d3 force config
│   ├── graph-render.ts             ← Canvas 描画ロジック
│   └── catppuccin.ts               ← パレット
└── README.md                       ← この機能の使い方と内部構造
```

### 4.2 デモコードからの分割方針

デモ `PointGraphView.jsx` は単一ファイル ~1200 行。これを以下の責務で分割：

| ファイル | 含めるもの |
|---|---|
| `GraphCanvas.tsx` | canvas 要素 + simulation 起動 + tick の draw 呼び出し |
| `usePointGraphSimulation.ts` | d3.forceSimulation の生成、forceX/forceY/forceCenter/forceLink/forceCollide/forceManyBody 設定 |
| `usePointGraphInteraction.ts` | d3.zoom、drag のための pointer handler、window レベルリスナ、quadtree hit-test |
| `graph-render.ts` | `draw(ctx, state, transform)` 関数（リンク描画 → ノード描画 → ラベル描画） |
| `graph-filters.ts` | フィルタ 6 種を pure 関数で実装（後述） |
| `ControlPanel.tsx` | 右パネルの折りたたみ可能セクション 6 個を統合 |

### 4.3 フィルタの pure 関数化

デモでは useMemo 内で全部やっているが、本実装では切り出してテスタブルにする：

```typescript
// graph-filters.ts

export interface FilterState {
  search: string;
  activeTypes: Record<NodeType, boolean>;
  activeTags: Set<string>;
  localFocusId: string | null;
  localDepth: number;
  showOrphans: boolean;
}

export function applyFilters(
  snapshot: GraphSnapshot,
  state: FilterState,
): GraphSnapshot {
  let { nodes, links } = snapshot;

  nodes = filterByType(nodes, state.activeTypes);
  let ids = new Set(nodes.map(n => n.id));

  if (state.activeTags.size > 0) {
    ({ nodes, ids } = filterByTags(nodes, ids, links, state.activeTags));
  }

  if (state.search.trim()) {
    ({ nodes, ids } = filterBySearch(nodes, ids, links, state.search));
  }

  if (state.localFocusId && state.localDepth > 0) {
    ({ nodes, ids } = filterByLocalGraph(
      nodes, ids, links, state.localFocusId, state.localDepth
    ));
  }

  links = links.filter(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return ids.has(s) && ids.has(t);
  });

  if (!state.showOrphans) {
    nodes = removeOrphans(nodes, links);
  }

  return { nodes, links };
}
```

### 4.4 位置キャッシュ（重要）

デモで実装した位置キャッシュ機構は **必ず継承**。これがないとフィルタ変更でノードがバラバラに動く：

```typescript
// usePointGraphSimulation.ts 内
const positionCacheRef = useRef(new Map<string, { x: number; y: number }>());

// tick 内で更新
sim.on('tick', () => {
  graph.nodes.forEach(n => {
    if (n.x != null && n.y != null) {
      positionCacheRef.current.set(n.id, { x: n.x, y: n.y });
    }
  });
});

// applyFilters で復元
return {
  nodes: filteredNodes.map(n => {
    const cached = positionCacheRef.current.get(n.id);
    return cached ? { ...n, x: cached.x, y: cached.y, vx: 0, vy: 0 } : { ...n };
  }),
  links: filteredLinks,
};
```

### 4.5 サイズ変更時のリセンタリング

サイドパネル開閉時にノードが片寄らないよう、デモの `prevSizeRef` シフト処理を継承：

```typescript
const prevSizeRef = useRef<{w:number,h:number}|null>(null);
useEffect(() => {
  if (size.w === 0 || size.h === 0) return;
  const prev = prevSizeRef.current;
  if (prev && (prev.w !== size.w || prev.h !== size.h)) {
    const dx = (size.w - prev.w) / 2;
    const dy = (size.h - prev.h) / 2;
    graphRef.current.nodes.forEach(n => {
      if (n.x != null) n.x += dx;
      if (n.y != null) n.y += dy;
    });
    positionCacheRef.current.forEach((pos, id) => {
      positionCacheRef.current.set(id, { x: pos.x + dx, y: pos.y + dy });
    });
  }
  prevSizeRef.current = { w: size.w, h: size.h };
}, [size.w, size.h]);
```

### 4.6 選択時スムーズパン

デモの最終版（interrupt + zoomTransform 経由）をそのまま継承。**オフセットは入れない**（前回の試行で右ズレを起こした原因）。

```typescript
useEffect(() => {
  if (!selectedId) return;
  const raf = requestAnimationFrame(() => {
    const node = graphRef.current.nodes.find(n => n.id === selectedId);
    if (!node?.x) return;
    const sel = d3.select(canvasRef.current);
    sel.interrupt();
    const t = d3.zoomTransform(canvasRef.current);
    const rect = canvasRef.current.getBoundingClientRect();
    const tx = rect.width / 2 - node.x * t.k;
    const ty = rect.height / 2 - node.y * t.k;
    node.fx = node.x; node.fy = node.y;  // pin
    sel.transition().duration(550).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform,
            d3.zoomIdentity.translate(tx, ty).scale(t.k))
      .on('end interrupt', () => { node.fx = null; node.fy = null; });
  });
  return () => cancelAnimationFrame(raf);
}, [selectedId, size.w, size.h]);
```

---

## 5. 実装フェーズ

### Phase 1: バックエンド API（半日〜1 日）

**ゴール**: `graph_load_snapshot()` が動き、devtools の `window.__TAURI__.invoke()` でデータが返ってくる。

**タスク**:

1. `src-tauri/src/commands/graph.rs` を新規作成
2. `GraphNode` / `GraphLink` / `GraphSnapshot` 構造体定義
3. `graph_load_snapshot()` 実装（§3.2 のコードを参考）
4. `classify_note()` ヘルパ実装（§3.3）
5. `src-tauri/src/main.rs` の `invoke_handler` に追加
6. 動作確認：`invoke('graph_load_snapshot')` で N+L 件のデータが返る

**完了チェック**:
- [ ] devtools で `await window.__TAURI__.core.invoke('graph_load_snapshot')` を実行し、JSON が返る
- [ ] ノード数・リンク数を console.log し、SQLite の件数と一致する
- [ ] `wiki_tags` のレコードが 1 件でもあれば、結果に `tag:` prefix 付きで含まれる

### Phase 2: フロント骨格（半日）

**ゴール**: 空のキャンバスがサイドバー `Memo` 経由で開く。データ取得のみ動く。

**タスク**:

1. `frontend/src/components/PointView/` ディレクトリ作成
2. `graph-types.ts`, `catppuccin.ts`, `DataService.ts` 拡張
3. `usePointGraphData.ts`：マウント時に `loadGraphSnapshot()` を呼ぶフック
4. `PointGraphView.tsx`：データを取って `<pre>{JSON.stringify(snapshot)}</pre>` で表示するだけの仮実装
5. 既存のサイドバー `Memo` ヘッダードロップダウン / または Phase 2 計画にある Command Palette から Point View に遷移できるようにする

**完了チェック**:
- [ ] グラフを開くと数百行の JSON がレンダリングされる
- [ ] リロードボタンで再フェッチが動く
- [ ] ローディング・エラーの基本 UI がある

### Phase 3: Canvas 描画 + 物理シミュレーション（1〜2 日）

**ゴール**: デモと同じグラフが life-editor 内で表示され、ドラッグで連動する。

**タスク**:

1. `lib/graph-layout.ts`：d3-force 設定の純粋関数を作成
2. `usePointGraphSimulation.ts`：simulation ライフサイクル管理
3. `lib/graph-render.ts`：`draw(ctx, state, transform)` 関数
4. `GraphCanvas.tsx`：canvas + ResizeObserver + simulation 結合
5. **位置キャッシュ機構** を実装（§4.4）
6. **forceX/forceY を含めた centering** を実装
7. **サイズ変更時のリセンタリング**（§4.5）

**完了チェック**:
- [ ] 起動時にノードが画面中央に集まる
- [ ] ドラッグで連動が動く（タッチ含む。`touch-action: none`）
- [ ] サイドパネル開閉でノードが片側に流れない
- [ ] FPS が 30 以上を維持（ノード 500 以下で）

### Phase 4: インタラクション + 選択パン（1 日）

**ゴール**: ノードをタップ→中央へスライド、ホバーで近傍ハイライト、ピンチ/ホイールズーム。

**タスク**:

1. `usePointGraphInteraction.ts`：d3.zoom + window レベル pointer handler
2. quadtree ヒット判定（タッチ用に半径拡大版）
3. **選択時スムーズパン**（§4.6、`interrupt + zoomTransform` パターン）
4. ホバー隣接ハイライト
5. **ラベルのズーム閾値表示**（k >= 0.85 で表示）

**完了チェック**:
- [ ] タップで中央にスライド、ズーム倍率は維持
- [ ] 連続選択でドリフトしない
- [ ] ズームアウトでラベルが消え、ズームインで復活
- [ ] 指で大きく動かしてもドラッグが切れない

### Phase 5: UI 機能群（1〜2 日）

**ゴール**: デモの全パネル機能が動く。

**タスク**:

1. `SearchFilter.tsx` — 検索 + 緑グロー + 1-hop 拡張
2. `TypeFilter.tsx` — Daily/Project/Idea/Note/Tag のトグル
3. `TagFilter.tsx` — タグチップ多選択
4. `LocalGraphFilter.tsx` — 0/1/2-hop ボタン
5. `DisplayFilter.tsx` — orphan / label トグル
6. `ForcesFilter.tsx` — 4 スライダー（Repel / Link / Center / Collide）
7. `SelectedNodeCard.tsx` — Project は黒背景、他は色付き背景
8. `TopBar.tsx` — α / FPS / フィルタ数バッジ
9. `applyFilters` 関数で全フィルタ統合（§4.3）

**完了チェック**:
- [ ] 全フィルタが組み合わせ可能
- [ ] 「Clear filters」ボタンで一括解除
- [ ] フィルタ変更時にノードが大きく動かない（位置キャッシュ効果）
- [ ] 空状態 UI（ノード 0 件時）が表示される

### Phase 6: 統合 + ポリッシュ（半日〜1 日）

**ゴール**: life-editor 内のテーマと整合し、本番投入可能な品質。

**タスク**:

1. Catppuccin Mocha との完全整合（既存テーマ変数を流用）
2. キーボードショートカット
   - `Esc` → 選択解除
   - `Cmd/Ctrl + F` → 検索フォーカス
   - `R` → reheat
3. ノードクリックでメインエディタ側でそのノートを開く（既存ナビゲーション統合）
4. リロードボタン（手動再フェッチ）
5. 「使い方」hint をオーバーレイ表示
6. README.md（このフォルダ専用）を作成

**完了チェック**:
- [ ] life-editor 全体のテーマと違和感がない
- [ ] ノード → エディタへの遷移が動く
- [ ] 手動リロードが効く
- [ ] ノード規模 1000 で FPS 30+ を維持

---

## 6. 既存決定事項との整合

life-editor の既存方針（user memory より）と矛盾しないこと：

| 項目 | 既存方針 | Point View 実装での扱い |
|---|---|---|
| ターミナル | 次期リリースで廃止 | Point View は影響なし |
| MCP Server | Cloudflare Workers でホスト | Point View MVP は MCP 連携しない（将来拡張余地あり、§7） |
| イミュータブルストレージ | メモ・ノートに限定適用 | Point View はメタのみ扱うので影響なし |
| Catppuccin Mocha | 固定 | 完全準拠 |
| データ層抽象 | DataService 経由 | `loadGraphSnapshot()` も DataService に追加 |
| Tauri command 命名 | `snake_case` | `graph_load_snapshot` で統一 |
| DB マイグレーション | V69 まで | Point View では新規マイグレーション不要（読み取りのみ） |

---

## 7. 将来拡張余地（MVP には含めない）

- **MCP リソース化**: グラフを Remote MCP の `resources/graph` として公開し、Claude Desktop から「`#ai` タグの 2-hop 範囲を要約」のような自然言語クエリでアクセス可能にする
- **AI セマンティック類似エッジ**: user memory にある「Claude Code が MCP 経由で SQLite 読み取り → 類似ノード提案」機能と統合し、graph の `kind: 'semantic'` エッジとして可視化
- **3D グラフ**: ノード数 2000+ で必要になった場合、d3-force-3d + three.js 構成へ
- **Time travel**: イミュータブル履歴を使い、過去の任意時点のグラフを再生
- **Color groups**: タグ/フォルダ/日付による色分け（Obsidian Graph の Groups 機能相当）

---

## 8. 依存関係追加

```json
// frontend/package.json への追加
{
  "dependencies": {
    "d3": "^7.9.0",
    "d3-force": "^3.0.0",
    "d3-quadtree": "^3.0.1",
    "d3-zoom": "^3.0.0",
    "d3-selection": "^3.0.0",
    "d3-transition": "^3.0.1",
    "lucide-react": "^0.x"
  }
}
```

**注意**: フル `d3` パッケージを入れると bundle が肥大化する。本番では個別サブパッケージ（`d3-force`, `d3-zoom`, `d3-selection`, `d3-quadtree`, `d3-transition`）の個別 import を推奨。デモは `import * as d3` で書いているので、Phase 6 で個別 import に書き換える：

```typescript
// 推奨 import パターン
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY, forceCollide } from 'd3-force';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { quadtree } from 'd3-quadtree';
import { easeCubicInOut } from 'd3-ease';
import 'd3-transition';  // side effect import for .transition()
```

---

## 9. リスクと回避策

| リスク | 影響 | 回避策 |
|---|---|---|
| 実 SQLite スキーマと計画書の SQL がズレる | バックエンド実装が動かない | Phase 1 着手前に `sqlite3` で `.schema notes` などで実スキーマ確認 |
| ノード規模が想定超え（5000+） | FPS 低下 | Phase 6 で計測。問題があれば WebGL（PixiJS）移行を計画 7 として記載済 |
| Daily チェーンが循環参照を起こす | 無限ループ | `daily_notes` を date ORDER BY して隣接ペアのみリンク化 |
| タグ id 衝突（note id == tag id） | グラフが壊れる | フロント全体で `tag:` prefix を必ず付ける |
| d3-force の初期配置でノードが画面外 | 起動時の見た目が悪い | `forceX + forceY` を必ず入れる（§4.4）|

---

## 10. レビューチェックリスト（人間用）

Claude Code が PR を出してきた時、以下を確認：

- [ ] Phase 1 のバックエンドコマンドが devtools から動く
- [ ] Phase 3 の起動時、ノードが画面中央に集まっている（左右に偏っていない）
- [ ] Phase 4 のタップ→中央パンで、ノードが画面中央に正確に着地する
- [ ] Phase 4 のドラッグが指で激しく動かしても切れない
- [ ] Phase 5 の全フィルタが組み合わせて動く
- [ ] Catppuccin Mocha 以外の色が混入していない（Project の黒は OK）
- [ ] ノードサイズが全タイプで統一されている
- [ ] エラーがコンソールに出ていない
- [ ] バンドルサイズが大幅増加していない（個別 d3 import 確認）

---

## 11. 参考資料

- デモ実装: 添付の `PointGraphView.jsx`（artifact）
- d3-force 公式: https://d3js.org/d3-force
- Obsidian Graph 解説（参考実装）: https://help.obsidian.md/Plugins/Graph+view
- Catppuccin Mocha パレット: https://github.com/catppuccin/catppuccin

---

**この計画書の運用ルール**

- Phase ごとに必ずコミット
- 各 Phase 完了チェック未達のまま次に進まない
- スキーマ・ファイル構成で予期しないズレがあれば、独断で進めず人間に確認
- デモ `PointGraphView.jsx` の挙動を超える変更（例: 新フィルタ追加、レイアウト変更）は計画書外。別途要件確認すること
