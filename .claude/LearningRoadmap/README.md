# Life Editor コードベース学習ロードマップ

## 概要

AIにコード生成を任せてきたため、自分のプロジェクト（Life Editor）の全体像が掴めていない。基本的なReact概念（useState、スプレッド構文）は知っているが、**なぜそのパターンを使うのか**や**コード全体のつながり**が理解できていない。このロードマップでは、実際のコードベースを教材として、段階的に理解を深める。

---

## 進捗状況

| Step | テーマ                                                    | 状態                 | ファイル                                      |
| ---- | --------------------------------------------------------- | -------------------- | --------------------------------------------- |
| 1    | Reactの再レンダリングモデル                               | 解説済み・課題未回答 | [Step1](./Step1_React再レンダリングモデル.md) |
| 2    | useMemo / useCallback と依存配列                          | 未着手               | -                                             |
| 3    | useLocalStorageフックを読み解く                           | 未着手               | -                                             |
| 4    | Context APIの仕組みと設計意図                             | 未着手               | -                                             |
| 5    | TaskTreeContextを読み解く（Context + カスタムフック合体） | 未着手               | -                                             |
| 6    | データフロー全体を追跡する                                | 未着手               | -                                             |
| 7    | バックエンドとの接続を理解する                            | 未着手               | -                                             |

---

## 学習ステップ詳細（全7ステップ）

各ステップは「解説 → コード追跡 → ミニ課題」の3部構成。

---

### Step 1: Reactの再レンダリングモデルを理解する

**目標**: なぜイミュータブル更新が必要なのか、根本的な理由を掴む

**解説対象**:

- Reactは「参照が変わったか」で再レンダリングを判断する仕組み
- `n.title = "new"` (ミュータブル) vs `{ ...n, title: "new" }` (イミュータブル) の違い
- `setNodes(newArray)` で参照が変わる → 再レンダリングが走る流れ

**コード追跡**: `frontend/src/hooks/useTaskTreeCRUD.ts`

- `updateNode`関数: `nodes.map(n => n.id === id ? { ...n, ...updates } : n)`
- なぜmap + 三項演算子 + スプレッドの組み合わせになるのか1行ずつ解体

**ミニ課題**: `toggleTaskStatus`関数を読んで、何がどう変わるか日本語で書き出す

---

### Step 2: useMemo / useCallback と依存配列

**目標**: パフォーマンス最適化フックの「なぜ」を理解する

**解説対象**:

- 関数コンポーネントは毎回全部実行される事実
- `useMemo`: 計算結果をキャッシュ（依存配列が変わらなければ前回の結果を再利用）
- `useCallback`: 関数自体をキャッシュ（子コンポーネントの無駄な再レンダリング防止）
- 依存配列 `[nodes]` の意味: 「nodesが変わったときだけ再計算」

**コード追跡**: `frontend/src/hooks/useTaskTreeAPI.ts`

- `activeNodes`の`useMemo`: 毎回filterするのは重い → nodesが変わったときだけ再計算
- `persist`の`useCallback`: 関数の参照を安定させる理由

**ミニ課題**: もしuseMemoを外したら何が起きるか予測する

---

### Step 3: useLocalStorageフックを読み解く

**目標**: カスタムフックの「型」を理解する（最もシンプルな例）

**解説対象**:

- カスタムフック = 複数のReactフックを1つにまとめた関数
- `useLocalStorage<T>(key, defaultValue)` → `[value, setValue]` を返す
- ジェネリクス`<T>`の意味: 使う側が型を決められる仕組み

**コード追跡**: `frontend/src/hooks/useLocalStorage.ts` (37行の小さいフック)

- 中身はuseState + useEffectの組み合わせ
- なぜuseState単体ではなくlocalStorageと組み合わせるのか

**ミニ課題**: ThemeContext.tsxで`useLocalStorage`がどう使われているか追跡する

---

### Step 4: Context APIの仕組みと設計意図

**目標**: props drilling問題とContextによる解決を理解する

**解説対象**:

- Props drilling問題: App → Layout → RightSidebar → TaskTree → TaskTreeNode に値を渡すつらさ
- Context = 「グローバル変数」のようなもの（ただしProvider内だけ）
- `createContext` → `Provider` → `useContext` の3ステップ

**コード追跡**: `frontend/src/context/ThemeContext.tsx` (最もシンプルなContext、59行)

- Provider: テーマ状態を保持して子コンポーネントに配信
- Consumer: どのコンポーネントからでも`useTheme()`で取得可能
- `main.tsx`のProvider入れ子構造の意味

**ミニ課題**: もしContextなしでテーマを渡すとしたら、何個のコンポーネントにpropsを追加する必要があるか数える

---

### Step 5: TaskTreeContextを読み解く（Context + カスタムフック合体）

**目標**: 複数フックの合成パターンを理解する

**解説対象**:

- `useTaskTreeAPI`が4つのフックを合成する構造
  - `useTaskTreeCRUD` (作成・更新)
  - `useTaskTreeDeletion` (削除・復元)
  - `useTaskTreeMovement` (移動・並び替え)
  - `useLocalStorage` (永続化)
- なぜ1つの巨大フックではなく分割するのか（単一責任の原則）

**コード追跡**:

- `frontend/src/hooks/useTaskTreeAPI.ts` → エントリポイント
- `frontend/src/hooks/useTaskTreeCRUD.ts` → CRUD操作
- 各フックがどの引数を受け取り、何を返すか

**ミニ課題**: `addNode`関数を読んで「新しいタスクが追加されるまでの全手順」を日本語で書く

---

### Step 6: データフロー全体を追跡する

**目標**: ユーザー操作 → UI更新 → データ保存の一連の流れを理解する

**シナリオ1: タスクのチェックボックスをクリック**

```
TaskTreeNode (onClick)
  → useTaskTreeContext().toggleTaskStatus(id)
    → nodes.map() でイミュータブル更新
      → setNodes() → React再レンダリング
      → saveLocalNodes() → localStorage保存
      → syncToBackend() → 500msデバウンスでHTTP PUT
```

**シナリオ2: タイマーの開始ボタンをクリック**

```
WorkScreen → TimerDisplay → start()
  → TimerContext.isRunning = true
    → setInterval(1000ms) で毎秒カウントダウン
      → remainingSeconds更新 → UI再レンダリング
```

**コード追跡**: 上記2つのシナリオを実際のファイルで追う

**ミニ課題**: 「新しいフォルダを作成する」操作のデータフローを自分で書いてみる

---

### Step 7: バックエンドとの接続を理解する

**目標**: フロントエンド ↔ バックエンドのデータ同期パターンを理解する

**解説対象**:

- Spring Bootの層構造: Controller → Service → Repository → Database
- フロントエンドの楽観的更新パターン（UI即時反映 → 非同期でバックエンド同期）
- DTOとEntityの変換（フロントとバックエンドで型が違う理由）

**コード追跡**:

- `frontend/src/api/taskClient.ts` → HTTPリクエスト送信
- `backend/.../controller/TaskController.java` → リクエスト受信
- `backend/.../service/TaskService.java` → ビジネスロジック
- `backend/.../entity/Task.java` → データモデル

**ミニ課題**: `PUT /api/tasks/{id}` のリクエストがDBに保存されるまでの全経路を書く

---

## 対象ファイル一覧

| Step | ファイル                            | 行数 | 難易度 |
| ---- | ----------------------------------- | ---- | ------ |
| 1    | `hooks/useTaskTreeCRUD.ts`          | ~55  | ★★☆    |
| 2    | `hooks/useTaskTreeAPI.ts`           | ~120 | ★★★    |
| 3    | `hooks/useLocalStorage.ts`          | ~37  | ★☆☆    |
| 4    | `context/ThemeContext.tsx`          | ~59  | ★☆☆    |
| 5    | `hooks/useTaskTree*.ts` (4ファイル) | ~400 | ★★★    |
| 6    | 複数コンポーネント横断              | -    | ★★★    |
| 7    | `api/taskClient.ts` + backend       | ~250 | ★★☆    |

## 検証方法

- 各ステップのミニ課題を自分の言葉で書き出せるか確認
- Step 6完了後: 任意のユーザー操作のデータフローを自力でトレースできるか
- 最終確認: 小さな機能追加（例: タスクに優先度フィールドを追加）を自力で設計できるか
