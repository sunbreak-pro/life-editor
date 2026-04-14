# アーキテクチャ全体図

## 概要

Life Editor はフロントエンド中心のSPAアプリケーション。React アプリが localStorage でデータを永続化し、Spring Boot バックエンドは構築済みだが未接続。将来的にバックエンド統合を予定。

## 現在のアーキテクチャ (Phase 2-3)

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (localhost:5173)                                    │
│                                                             │
│  main.tsx                                                   │
│    └─ ThemeProvider                                         │
│        └─ TaskTreeProvider                                  │
│            └─ TimerProvider                                 │
│                └─ App.tsx (オーケストレーター)                 │
│                    ├─ activeSection: tasks | session | settings │
│                    ├─ selectedTaskId, selectedFolderId      │
│                    ├─ isTimerModalOpen                      │
│                    └─ Layout                                │
│                        ├─ Sidebar (240px固定)               │
│                        ├─ SubSidebar (160-400px)           │
│                        │   └─ TaskTree                     │
│                        └─ MainContent (flex-1)             │
│                            └─ TaskDetail | WorkScreen | Settings │
│                                                             │
│  データ永続化: localStorage                                  │
│    ├─ life-editor-task-tree     (TaskNode[])                │
│    ├─ life-editor-work-duration (number)                    │
│    ├─ life-editor-sound-mixer   (SoundMixerState)           │
│    ├─ life-editor-theme         (light | dark)              │
│    ├─ life-editor-font-size     (small | medium | large)    │
│    └─ life-editor-subsidebar-width (number)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Spring Boot (localhost:8080) — 構築済み / 未接続             │
│                                                             │
│  Controllers: Task, Timer, Sound                           │
│  Services: TaskService, TimerService, SoundService         │
│  Repositories: JPA auto-generated                          │
│  Entities: Task, TimerSettings, TimerSession,              │
│           SoundSettings, SoundPreset                       │
│  Database: H2 (file: ./data/lifeeditor)                     │
└─────────────────────────────────────────────────────────────┘
```

## フロントエンド層の構造

### Context Provider スタック

```
main.tsx
  └─ ThemeProvider (テーマ・フォントサイズ)
      └─ TaskTreeProvider (タスクツリーCRUD)
          └─ TimerProvider (ポモドーロタイマー)
              └─ App
```

各Providerは`useLocalStorage`フックでlocalStorageに永続化。

### コンポーネント階層

```
App
├─ Layout (Layout.tsx)
│   ├─ Sidebar (Sidebar.tsx) — 240px固定
│   │   ├─ Tasks / Session / Settings ナビ
│   │   └─ タイマー実行中表示 (タスク名+残り時間)
│   ├─ SubSidebar (SubSidebar.tsx) — 160-400px リサイズ可
│   │   └─ TaskTree (TaskTree.tsx)
│   │       ├─ Inbox セクション
│   │       ├─ Projects セクション (フォルダ別)
│   │       ├─ Completed セクション
│   │       └─ TaskTreeNode × N
│   │           ├─ TaskNodeContent (表示)
│   │           ├─ TaskNodeEditor (インライン編集)
│   │           ├─ TaskNodeActions (アクションボタン)
│   │           └─ TaskNodeTimer (タイマー表示)
│   └─ MainContent (MainContent.tsx) — flex-1
│       ├─ TaskDetail (タスク詳細+メモ編集)
│       │   ├─ TaskDetailHeader
│       │   ├─ MemoEditor (TipTap)
│       │   └─ SlashCommandMenu
│       ├─ WorkScreen (タイマー+サウンド)
│       │   ├─ TimerDisplay
│       │   ├─ TimerProgressBar
│       │   ├─ DurationSelector
│       │   ├─ TaskSelector
│       │   └─ SoundMixer → SoundCard × 6
│       └─ Settings
└─ WorkScreen (モーダルオーバーレイモード)
```

## 状態管理パターン

### Context vs ローカル State

| State            | 管理場所                  | 永続化                  | スコープ   |
| ---------------- | ------------------------- | ----------------------- | ---------- |
| タスクツリー     | TaskTreeContext           | localStorage            | グローバル |
| タイマー         | TimerContext              | localStorage (duration) | グローバル |
| テーマ           | ThemeContext              | localStorage            | グローバル |
| サウンドミキサー | useLocalSoundMixer (hook) | localStorage            | WorkScreen |
| activeSection    | App.tsx ローカル          | なし                    | App        |
| selectedTaskId   | App.tsx ローカル          | なし                    | App        |

### カスタムフック

| Hook                  | ファイル                     | 管理データ           | 永続化       |
| --------------------- | ---------------------------- | -------------------- | ------------ |
| `useTaskTree`         | hooks/useTaskTree.ts         | TaskNode[], CRUD操作 | localStorage |
| `useTaskTreeCRUD`     | hooks/useTaskTreeCRUD.ts     | 作成・更新操作       | —            |
| `useTaskTreeDeletion` | hooks/useTaskTreeDeletion.ts | ソフトデリート・復元 | —            |
| `useTaskTreeMovement` | hooks/useTaskTreeMovement.ts | DnD移動・並び替え    | —            |
| `useLocalSoundMixer`  | hooks/useLocalSoundMixer.ts  | SoundMixerState      | localStorage |
| `useLocalStorage`     | hooks/useLocalStorage.ts     | 汎用localStorage     | localStorage |

## バックエンド層（参考: 未接続）

### レイヤー構成

```
Controller (REST受口)
    ▼
Service (@Transactional)
    ▼
Repository (JpaRepository)
    ▼
Entity (@Entity)
    ▼
H2 Database (file: ./data/lifeeditor)
```

### エンティティ

| Entity        | テーブル       | 備考                                                            |
| ------------- | -------------- | --------------------------------------------------------------- |
| Task          | tasks          | Phase 1のフラットTask。フロントエンドのTaskNodeとは構造が異なる |
| TimerSettings | timer_settings | シングルトン                                                    |
| TimerSession  | timer_sessions | taskIdはLong（FK制約なし）                                      |
| SoundSettings | sound_settings | soundType別に行を持つ                                           |
| SoundPreset   | sound_presets  | settingsJson でミキサー状態を保存                               |

## エラーハンドリングパターン

### フロントエンド (localStorage)

現在はtry/catchなし（localStorageはほぼ常に成功する）。
将来のBackend統合時にエラーハンドリングを追加予定。

### バックエンド

```java
// Controller層
try {
    Task task = taskService.updateTask(id, title, status);
    return ResponseEntity.ok(task);
} catch (IllegalArgumentException e) {
    return ResponseEntity.notFound().build();
}
```
