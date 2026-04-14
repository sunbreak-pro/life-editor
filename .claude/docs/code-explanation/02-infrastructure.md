# インフラストラクチャ（基盤コード）

## 概要

アプリケーション全体を支える基盤コード: フロントエンドのエントリポイント、Context Provider、レイアウトシステム、バックエンドの起動設定、CORS、データベース接続を解説する。

## フロントエンド基盤

### エントリポイント: main.tsx

**ファイル**: `frontend/src/main.tsx`

```
main.tsx
  createRoot(#root).render(
    <StrictMode>
      <ThemeProvider>
        <TaskTreeProvider>
          <TimerProvider>
            <App />
          </TimerProvider>
        </TaskTreeProvider>
      </ThemeProvider>
    </StrictMode>
  )
```

- `StrictMode` で開発時の問題検出を有効化
- Provider スタック: Theme → TaskTree → Timer の順
- 各Providerが`useLocalStorage`でlocalStorageに永続化

### スタイル基盤: index.css

Tailwind CSS v4 を使用。カスタムカラーは CSS変数で定義し、ダークモード対応:

- `--color-notion-bg`, `--color-notion-bg-secondary` — 背景色
- `--color-notion-text`, `--color-notion-text-secondary` — テキスト色
- `--color-notion-border`, `--color-notion-hover` — ボーダー・ホバー色
- `--color-notion-accent`, `--color-notion-danger` — アクセント・危険色

### localStorage永続化パターン

Phase 2でAxios/APIクライアントを廃止し、localStorage直接永続化に移行。
`useLocalStorage` フック (`hooks/useLocalStorage.ts`) で統一:

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void];
```

**localStorage キー定数** (`constants/storageKeys.ts`):

| キー                           | 用途                 | デフォルト値 |
| ------------------------------ | -------------------- | ------------ |
| `life-editor-task-tree`        | TaskNode配列         | `[]`         |
| `life-editor-work-duration`    | 作業時間（分）       | `25`         |
| `life-editor-sound-mixer`      | サウンドミキサー設定 | `{}`         |
| `life-editor-theme`            | テーマ               | `'light'`    |
| `life-editor-font-size`        | フォントサイズ       | `'medium'`   |
| `life-editor-subsidebar-width` | SubSidebar幅         | `240`        |

### レイアウトシステム

**Layout.tsx** — 3カラムレイアウト

```
<div className="flex min-h-screen">
  <Sidebar />                    <!-- 240px固定 -->
  <SubSidebar />                 <!-- 160-400px リサイズ可 -->
  <MainContent>{children}</MainContent>  <!-- flex-1 -->
</div>
```

**Sidebar.tsx** — 固定ナビゲーション

- 3つのセクション: Tasks, Session, Settings
- タイマー実行中: タスク名 + 残り時間 + 編集ボタン表示
- `activeSection` でアクティブスタイル切替

**SubSidebar.tsx** — リサイズ可能なタスクツリー

- 幅: 160-400px（ドラッグでリサイズ）
- SubSidebar幅はlocalStorageに永続化
- TaskTree を含む（Inbox + Projects + Completed セクション）

**MainContent.tsx** — メインコンテンツエリア

- `flex-1` で残り幅を占有
- セクションに応じて TaskDetail / WorkScreen / Settings を表示

## バックエンド基盤

### エントリポイント: LifeEditorApplication.java

**ファイル**: `backend/src/main/java/com/lifeeditor/LifeEditorApplication.java`

- `@SpringBootApplication` でコンポーネントスキャン、オートコンフィグレーション、設定を一括有効化
- パッケージ `com.lifeeditor` 配下が自動スキャン対象

### CORS設定: WebConfig.java

**ファイル**: `backend/src/main/java/com/lifeeditor/config/WebConfig.java`

| 設定         | 値                              | 説明                |
| ------------ | ------------------------------- | ------------------- |
| パスパターン | `/api/**`                       | 全APIエンドポイント |
| 許可オリジン | `http://localhost:5173`         | Vite開発サーバー    |
| 許可メソッド | GET, POST, PUT, DELETE, OPTIONS | CRUD + preflight    |
| 許可ヘッダー | `*`                             | 全ヘッダー許可      |
| 認証情報     | `true`                          | Cookie等を許可      |

### データベース設定: application.properties

| 設定                             | 意味                                        |
| -------------------------------- | ------------------------------------------- |
| `jdbc:h2:file:./data/lifeeditor` | ファイルベースH2                            |
| `ddl-auto=update`                | Entity定義からスキーマを自動生成・更新      |
| `h2.console.enabled=true`        | `/h2-console` でWebコンソールにアクセス可能 |

### 型定義ファイル一覧

**フロントエンド** (`frontend/src/types/`)

| ファイル      | 定義                                                     |
| ------------- | -------------------------------------------------------- |
| `taskTree.ts` | `NodeType`, `TaskStatus`, `TaskNode`, `MAX_FOLDER_DEPTH` |

**バックエンド** (`backend/src/main/java/com/lifeeditor/entity/`)

| ファイル             | 定義                              |
| -------------------- | --------------------------------- |
| `Task.java`          | `@Entity` tasks テーブル          |
| `TaskStatus.java`    | `enum` TODO, DONE                 |
| `TimerSettings.java` | `@Entity` timer_settings テーブル |
| `TimerSession.java`  | `@Entity` timer_sessions テーブル |
| `SessionType.java`   | `enum` WORK, BREAK, LONG_BREAK    |
| `SoundSettings.java` | `@Entity` sound_settings テーブル |
| `SoundPreset.java`   | `@Entity` sound_presets テーブル  |
