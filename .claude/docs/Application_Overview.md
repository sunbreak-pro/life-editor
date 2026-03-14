# Project Name: Sonic Flow

## 概要

「Notionライクなタスク管理」に「環境音ミキサー」と「ポモドーロタイマー」を組み合わせた、没入型個人タスク管理アプリケーション。
フロントエンドにReact、バックエンドにJava (Spring Boot) を使用したSPA構成。

## 1. 技術スタック

### Backend (API Server)

- **Language:** Java 23
- **Framework:** Spring Boot 3.4.2
- **Build Tool:** Gradle (Groovy DSL)
- **Database:** H2 Database (ファイルベースモードで永続化)
- **AI Integration:** OpenAI API / Gemini API (Backend Proxy経由)

### Frontend (UI/UX)

- **Framework:** React 19 (TypeScript)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4
- **State Management:** React Context API
- **Icons:** Lucide React
- **HTTP Client:** native fetch (Axios削除済み)
- **Audio:** Web Audio API
- **Rich Text:** TipTap (@tiptap/react)
- **Drag & Drop:** @dnd-kit

### データ永続化

**タスクツリー・タイマー・サウンドはバックエンドAPI接続済み**。楽観的更新パターン（localStorage即時反映 → 500msデバウンスで非同期PUT）。

- タスクツリー: `localStorage("sonic-flow-task-tree")` + バックエンドAPI同期
- タイマー設定: `localStorage` + バックエンドAPI同期（work/break/longBreak/sessionsBeforeLongBreak）
- タイマーセッション: バックエンドAPI記録（start→POST、pause/reset/完了→PUT）
- サウンド設定: `localStorage("sonic-flow-sound-mixer")` + バックエンドAPI同期
- テーマ設定: `localStorage`経由（バックエンド未接続）

バックエンド不可用時はlocalStorageフォールバック。`ddl-auto=update`でDBスキーマは永続化済み。

## 2. アプリケーション機能要件

### Feature A: タスク管理 (TaskTree)

- 階層型タスクツリー（フォルダ/タスク、フラット配列 + parentId参照）
- フォルダは階層制限なくネスト可能
- @dnd-kitによるドラッグ&ドロップ並び替え・階層移動
- ソフトデリート (`isDeleted`フラグ) + ゴミ箱から復元
- TipTapリッチテキストによるタスクメモ編集
- Inbox + プロジェクト別フィルタリング

### Feature B: ノイズミキサー (Web Audio API)

- 6種の環境音UI（Rain, Thunder, Wind, Ocean, Birds, Fire）+ カスタムサウンド追加対応
- 各環境音の音量を個別にスライダーで調整（0% - 100%）
- Web Audio APIによるリアルタイム再生・ミキシング（フェードイン/アウト）
- カスタムサウンド: IndexedDBでblob管理、メタデータはlocalStorage

### Feature C: 集中タイマー (TimerContext)

- WORK → BREAK → LONG_BREAK の自動遷移
- 作業時間カスタマイズ（5〜60分、5分刻み）
- プログレスバー + ドットインジケータ
- タスクと紐付けてタイマー実行（`activeTask`）
- モーダル表示 / バックグラウンド継続
- TaskTreeNode上にインライン残り時間表示

### Feature D: AIコーチング (Gemini API連携)

- Gemini API (`gemini-2.5-flash-lite`) によるタスク分解・励まし・振り返りの3モード
- APIキーはバックエンド経由で管理（`SONICFLOW_AI_API_KEY`環境変数）
- `AICoachPanel`コンポーネントをTaskDetailに統合

### 外観設定

- ダークモード/ライトモード切替
- フォントサイズ設定（S/M/L）
- Settings画面（外観設定 + ゴミ箱）

## 3. API 定義 (RESTful) — フロントエンド接続済み（楽観的更新パターン）

### Tasks

- `GET /api/tasks/tree`: タスクツリー一括取得
- `PUT /api/tasks/tree`: タスクツリー一括同期
- `POST /api/tasks`: 新規タスク作成
- `PUT /api/tasks/{id}`: タスク更新
- `DELETE /api/tasks/{id}/soft`: ソフトデリート
- `POST /api/tasks/{id}/restore`: 復元
- `DELETE /api/tasks/{id}`: 完全削除

### Sound Settings

- `GET /api/sound-settings` / `PUT /api/sound-settings`
- `GET /api/sound-presets` / `POST /api/sound-presets` / `DELETE /api/sound-presets/{id}`

### Timer

- `GET /api/timer-settings` / `PUT /api/timer-settings`
- `POST /api/timer-sessions` / `PUT /api/timer-sessions/{id}`
- `GET /api/timer-sessions` / `GET /api/tasks/{taskId}/sessions`

### AI

- `POST /api/ai/advice`: AIコーチングアドバイス取得
- `GET /api/ai/settings` / `PUT /api/ai/settings`: AI設定

### Migration

- `POST /api/migrate/tasks`: localStorage→DB一括インポート

## 4. データモデル

### フロントエンド: TaskNode (`types/taskTree.ts`)

```typescript
interface TaskNode {
  id: string;
  type: "folder" | "task";
  title: string;
  parentId: string | null;
  order: number;
  status?: "TODO" | "DONE";
  isExpanded?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  completedAt?: string;
  scheduledAt?: string;
  content?: string; // TipTap rich text (JSON)
  workDurationMinutes?: number;
  color?: string;
}
```

### バックエンド: Task Entity（フロントエンドと同期済み、IDはString型）

- `id`: String（フロントエンドの"task-xxx"/"folder-xxx"形式に統一）
- `title`: String, `type`: String, `parentId`: String, `sortOrder`: Integer
- `status`: Enum (TODO/DONE), `isExpanded`: Boolean, `isDeleted`: Boolean
- `createdAt`, `completedAt`, `deletedAt`, `scheduledAt`: LocalDateTime
- `content`: String (CLOB), `workDurationMinutes`: Integer, `color`: String

### その他バックエンドエンティティ

- SoundSettings, SoundPreset, TimerSettings, TimerSession

## 5. フロントエンド構成

### Context Provider スタック (`main.tsx`)

```
ErrorBoundary → ThemeProvider → TaskTreeProvider → MemoProvider → TimerProvider → AudioProvider → App
```

### レイアウト (3カラム)

```
App (状態オーケストレーター)
├── Sidebar (240px固定)
├── SubSidebar (リサイズ可能160-400px)
│   └── TaskTree (Inbox + Projects + Completed)
└── MainContent (flex-1)
    └── TaskDetail | MemoView | WorkScreen | CalendarView | AnalyticsView | Settings | Tips
```

### 主要フック

| Hook                                   | 管理対象               | 永続化                                   |
| -------------------------------------- | ---------------------- | ---------------------------------------- |
| useTaskTree (+ CRUD/Deletion/Movement) | タスクツリー全体       | localStorage + バックエンドAPI           |
| useLocalSoundMixer                     | サウンドミキサー設定   | localStorage + バックエンドAPI           |
| useAudioEngine                         | Web Audio API再生制御  | —                                        |
| useCustomSounds                        | カスタムサウンド管理   | localStorage + IndexedDB                 |
| useTimerContext                        | タイマー状態           | Context + localStorage + バックエンドAPI |
| useLocalStorage                        | 汎用localStorage永続化 | localStorage                             |

## 6. 開発の進め方と制約事項

1. **CORS設定:** `WebConfig.java`で`localhost:5173`のみ許可
2. **音源ファイル:** リポジトリにコミット禁止（`public/sounds/`は`.gitignore`対象）
3. **AIキー:** フロントエンドに直接記載禁止、バックエンド経由のみ
4. **データ永続化:** 楽観的更新パターンでバックエンド同期済み（バックエンド不可用時はlocalStorageフォールバック）
