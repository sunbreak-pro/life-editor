# Sonic Flow モバイル対応 + デバイス間リアルタイム同期 実装プラン

**Status: PLANNED**
**Date: 2026-02-20**
**Target: iOS のみ**

---

## 目次

1. [現状分析](#1-現状分析)
2. [モバイルアプリ方式](#2-モバイルアプリ方式)
3. [デバイス間連携（Supabase）](#3-デバイス間連携supabase)
4. [認証](#4-認証)
5. [データモデル変更](#5-データモデル変更)
6. [同期アーキテクチャ](#6-同期アーキテクチャ)
7. [新規・変更ファイル一覧](#7-新規変更ファイル一覧)
8. [3フェーズ実装計画](#8-3フェーズ実装計画)
9. [リスクと対策](#9-リスクと対策)
10. [検証方法](#10-検証方法)

---

## 1. 現状分析

### 1.1 DataService 抽象化層の強み

現在のフロントエンドは `DataService` インターフェース経由でデータアクセスしており、Electron IPC に直接依存していない。これは**モバイル対応における最大の強み**である。

```
DataService (interface)  ← フロントエンドが依存するのはここだけ
├── ElectronDataService  ← Electron IPC 実装（現在）
├── CapacitorDataService ← Capacitor + SQLite 実装（新規）
└── SupabaseDataService  ← クラウド同期実装（新規・内部利用）
```

**DataService インターフェース規模**: 70+ メソッド、12ドメイン

| ドメイン                   | メソッド数 | 同期対象                         |
| -------------------------- | ---------- | -------------------------------- |
| Tasks                      | 8          | Yes                              |
| Timer Settings/Sessions    | 6          | Yes                              |
| Pomodoro Presets           | 4          | Yes                              |
| Sound Settings/Tags/Meta   | 15         | Yes                              |
| Memo                       | 7          | Yes                              |
| Notes                      | 8          | Yes                              |
| Custom Sounds              | 7          | Yes（メタのみ。blob は Storage） |
| Calendars                  | 4          | Yes                              |
| Routines/Tags              | 12         | Yes                              |
| Schedule Items             | 7          | Yes                              |
| Playlists/Items            | 9          | Yes                              |
| Diagnostics/Updater/DataIO | 12         | No（デバイス固有）               |

### 1.2 変更が必要な箇所

#### フロントエンド（共有可能）

以下は**Electron にも Capacitor にもそのまま使える**:

- 全 React コンポーネント（`frontend/src/components/`）
- 全 Context / Provider（`frontend/src/contexts/`）
- 全カスタムフック（`frontend/src/hooks/`）
- 型定義（`frontend/src/types/`）
- i18n（`frontend/src/i18n/`）
- Tailwind CSS スタイル
- TipTap エディタ
- @dnd-kit ドラッグ&ドロップ

#### 変更が必要な箇所

| 箇所                              | 理由                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `dataServiceFactory.ts`           | プラットフォーム判定 + 実装切替                                                       |
| `window.electronAPI` 参照         | Capacitor では不存在。DataService 内に封じ込め済みだが、`preload.ts` 型定義は調整必要 |
| `useAudioEngine.ts`               | Web Audio API は iOS で `AudioContext` のユーザー操作起点が必須                       |
| `usePlaylistEngine.ts`            | 同上 + iOS バックグラウンド再生制約                                                   |
| レイアウト（3カラム）             | モバイルでは1カラム + タブナビゲーション                                              |
| `localStorage` 利用箇所（16キー） | Capacitor Preferences API に置換、または共通抽象化                                    |
| カスタムサウンド（blob）          | Electron は IPC でバイナリ転送、Capacitor は Filesystem API                           |

### 1.3 現在のDBスキーマ（V21）

**同期対象テーブル一覧**:

| テーブル                      | PK型                      | 備考                |
| ----------------------------- | ------------------------- | ------------------- |
| `tasks`                       | TEXT (`task-xxx`)         | ソフトデリート対応  |
| `timer_settings`              | INTEGER (singleton, id=1) | V22 で user_id 追加 |
| `timer_sessions`              | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `sound_settings`              | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `sound_presets`               | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `memos`                       | TEXT                      | ソフトデリート対応  |
| `notes`                       | TEXT (`note-xxx`)         | ソフトデリート対応  |
| `calendars`                   | TEXT                      | —                   |
| `pomodoro_presets`            | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `routines`                    | TEXT                      | ソフトデリート対応  |
| `routine_tag_definitions`     | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `routine_tag_assignments`     | composite PK              | —                   |
| `schedule_items`              | TEXT                      | —                   |
| `playlists`                   | TEXT                      | —                   |
| `playlist_items`              | TEXT                      | —                   |
| `sound_tag_definitions`       | INTEGER (AUTOINCREMENT)   | V22 で UUID に変更  |
| `sound_tag_assignments`       | composite PK              | —                   |
| `sound_display_meta`          | TEXT (sound_id)           | —                   |
| `sound_workscreen_selections` | TEXT (sound_id)           | —                   |

**課題**: `AUTOINCREMENT` PKのテーブルはデバイス間で ID が衝突する。V22 で UUID 化が必要。

---

## 2. モバイルアプリ方式

### 2.1 Capacitor を推奨する理由

| 比較項目       | Capacitor                     | React Native                  | Swift ネイティブ |
| -------------- | ----------------------------- | ----------------------------- | ---------------- |
| コード再利用率 | **90%+**                      | 40-60%                        | 0%               |
| React 19 互換  | そのまま                      | React Native版が必要          | N/A              |
| Tailwind CSS   | そのまま                      | NativeWind必要                | N/A              |
| TipTap         | そのまま                      | 代替ライブラリ必要            | N/A              |
| @dnd-kit       | そのまま                      | react-native-reanimated       | N/A              |
| Web Audio API  | WKWebView対応                 | expo-av                       | AVFoundation     |
| SQLite         | `@capacitor-community/sqlite` | `react-native-sqlite-storage` | Core Data        |
| App Store配信  | 可能                          | 可能                          | 可能             |
| 開発コスト     | **低**                        | 中                            | 高               |
| 学習コスト     | **ほぼゼロ**                  | 中                            | 高               |

### 2.2 Capacitor セットアップ

```bash
# Capacitor 導入
npm install @capacitor/core @capacitor/cli
npx cap init "Sonic Flow" "com.sonicflow.app" --web-dir frontend/dist

# iOS プラットフォーム追加
npm install @capacitor/ios
npx cap add ios

# 必要なプラグイン
npm install @capacitor-community/sqlite   # SQLite
npm install @capacitor/preferences        # localStorage 代替
npm install @capacitor/filesystem         # カスタムサウンド blob
npm install @capacitor/haptics            # 触覚フィードバック
npm install @capacitor/status-bar         # ステータスバー制御
npm install @capacitor/keyboard           # キーボード制御
npm install @capacitor/app                # アプリライフサイクル
npm install @nicepkg/capacitor-background-audio  # バックグラウンド音声（検討）
```

### 2.3 プロジェクト構成（変更後）

```
notion-timer/
├── electron/                 # Electron メインプロセス（変更なし）
├── frontend/                 # 共有フロントエンド
│   └── src/
│       ├── services/
│       │   ├── DataService.ts          # インターフェース（変更なし）
│       │   ├── ElectronDataService.ts  # Electron用（変更なし）
│       │   ├── CapacitorDataService.ts # 新規: Capacitor SQLite 実装
│       │   ├── SyncService.ts          # 新規: Supabase 同期エンジン
│       │   ├── SyncableDataService.ts  # 新規: ローカル + 同期ラッパー
│       │   └── dataServiceFactory.ts   # 変更: プラットフォーム判定追加
│       ├── hooks/
│       │   ├── useSync.ts             # 新規: 同期状態管理
│       │   └── usePlatform.ts         # 新規: プラットフォーム判定
│       ├── contexts/
│       │   ├── AuthContext.tsx         # 新規: 認証状態管理
│       │   └── SyncContext.tsx         # 新規: 同期状態 Provider
│       └── components/
│           ├── Auth/                   # 新規: ログイン画面
│           ├── Sync/                   # 新規: 同期ステータス UI
│           └── Mobile/                 # 新規: モバイル専用レイアウト
├── ios/                      # 新規: Capacitor iOS プロジェクト
│   └── App/
├── supabase/                 # 新規: Supabase マイグレーション・設定
│   ├── migrations/
│   └── config.toml
├── capacitor.config.ts       # 新規: Capacitor 設定
└── package.json              # 変更: Capacitor 依存追加
```

### 2.4 iOS 固有の考慮事項

#### Web Audio API の iOS 制約

iOS の WKWebView では `AudioContext` はユーザー操作（tap/click）を起点にしないと再生されない。

**対策**:

```typescript
// useAudioEngine.ts の修正
// iOS ではユーザー操作イベント内で AudioContext を resume する
const resumeAudioContext = async () => {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
};
// タイマー開始ボタン押下時に resumeAudioContext() を呼ぶ
```

#### バックグラウンド音声再生

iOS はアプリがバックグラウンドに遷移すると Web Audio API の再生が停止する。

**対策**:

- `Info.plist` に `UIBackgroundModes: audio` を追加
- Capacitor プラグイン `@nicepkg/capacitor-background-audio` または `AVAudioSession` のネイティブブリッジを実装
- 代替案: Media Session API を活用して OS のオーディオセッションと連携

#### iOS App Store 審査要件

- **Apple Sign-In 必須**: サードパーティログイン（Google等）を提供する場合、Apple Sign-In も必須提供
- **App Tracking Transparency**: ユーザーデータ収集時は ATT ダイアログ表示が必要（Supabase Analytics 使用時）
- **最低 iOS バージョン**: iOS 16+（Capacitor 6 要件）
- **プライバシーマニフェスト**: `PrivacyInfo.xcprivacy` ファイルが必要

---

## 3. デバイス間連携（Supabase）

### 3.1 Supabase を選択する理由

| 比較項目           | Supabase                      | Firebase           | 自前サーバー |
| ------------------ | ----------------------------- | ------------------ | ------------ |
| PostgreSQL         | Yes（RLS付き）                | NoSQL (Firestore)  | 選択可能     |
| リアルタイム       | Realtime (WebSocket)          | Firestore Listener | 要実装       |
| 認証               | 内蔵 (GoTrue)                 | Firebase Auth      | 要実装       |
| ファイルストレージ | Storage (S3互換)              | Cloud Storage      | 要実装       |
| オフライン対応     | 要実装                        | Firestore内蔵      | 要実装       |
| セルフホスト       | 可能                          | 不可               | 当然可能     |
| 料金 (Free tier)   | 500MB DB, 1GB Storage         | 1GB Firestore      | サーバー費用 |
| SQLite との親和性  | **高**（PostgreSQL ≈ SQLite） | 低                 | 中           |
| 型安全性           | `supabase gen types`          | 弱い               | 要実装       |

**決め手**: PostgreSQL ベースのため SQLite スキーマとの対応が自然。RLS でセキュリティ確保。Realtime で双方向同期。

### 3.2 Supabase プロジェクト構成

```sql
-- Supabase PostgreSQL スキーマ（ローカル SQLite と対応）

-- ユーザー管理（Supabase Auth と連携）
-- auth.users は Supabase が自動管理

-- 同期デバイス管理
CREATE TABLE sync_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('desktop', 'mobile')),
  platform TEXT NOT NULL, -- 'darwin', 'win32', 'ios'
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 全テーブルに user_id + sync メタデータを追加
-- 例: tasks テーブル
CREATE TABLE tasks (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('folder', 'task')),
  title TEXT NOT NULL DEFAULT '',
  parent_id TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  status TEXT CHECK(status IN ('TODO', 'DONE')),
  is_expanded BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  due_date TEXT,
  content TEXT,
  work_duration_minutes INTEGER,
  color TEXT,
  -- sync metadata
  sync_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

-- RLS (Row Level Security) ポリシー
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id);
```

### 3.3 Realtime 同期フロー

```
┌─────────────┐                    ┌─────────────────┐                    ┌─────────────┐
│  Desktop    │                    │    Supabase     │                    │   iPhone    │
│  (Electron) │                    │  (PostgreSQL)   │                    │ (Capacitor) │
└──────┬──────┘                    └────────┬────────┘                    └──────┬──────┘
       │                                    │                                    │
       │  1. ローカル SQLite に書き込み      │                                    │
       │────────────────────────────────────>│                                    │
       │  2. sync_changelog に記録           │                                    │
       │  3. Supabase に push               │                                    │
       │────────────────────────────────────>│                                    │
       │                                    │  4. Realtime broadcast              │
       │                                    │───────────────────────────────────>│
       │                                    │                                    │
       │                                    │                 5. pull & apply     │
       │                                    │<───────────────────────────────────│
       │                                    │  6. ローカル SQLite に適用           │
       │                                    │                                    │
```

---

## 4. 認証

### 4.1 認証フロー

```
未ログイン → サインイン画面 → OAuth / Magic Link → Supabase Auth → JWT取得 → 同期開始
```

**重要**: ログインは**同期機能を使う場合のみ**必要。ローカルのみで使用する場合はログイン不要（既存動作を維持）。

### 4.2 対応する認証方式

| 方式               | 優先度   | 理由                                                         |
| ------------------ | -------- | ------------------------------------------------------------ |
| Apple Sign-In      | **必須** | iOS App Store 審査要件（サードパーティログイン提供時に必須） |
| Google OAuth       | 高       | 最も利用率の高い認証方式                                     |
| Magic Link (Email) | 中       | パスワード不要で低摩擦                                       |

### 4.3 Supabase Auth 実装

```typescript
// frontend/src/services/auth/supabaseAuth.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const auth = {
  // Apple Sign-In (iOS 必須)
  signInWithApple: () =>
    supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: isPlatform("capacitor")
          ? "com.sonicflow.app://auth/callback"
          : "http://localhost:5173/auth/callback",
      },
    }),

  // Google OAuth
  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "..." },
    }),

  // Magic Link
  signInWithMagicLink: (email: string) =>
    supabase.auth.signInWithOtp({ email }),

  // セッション管理
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (cb: AuthStateChangeCallback) =>
    supabase.auth.onAuthStateChange(cb),
  signOut: () => supabase.auth.signOut(),
};
```

### 4.4 AuthContext

```typescript
// frontend/src/contexts/AuthContext.tsx
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

Provider スタック変更:

```
StrictMode → ErrorBoundary → ThemeProvider → AuthProvider → SyncProvider → UndoRedoProvider → ...
```

---

## 5. データモデル変更

### 5.1 Migration V22 設計

ローカル SQLite に同期メタデータを追加する。

```sql
-- V22: Add sync metadata columns to all syncable tables

-- 1. 同期デバイス管理テーブル
CREATE TABLE IF NOT EXISTS sync_devices (
  id TEXT PRIMARY KEY,        -- UUID
  user_id TEXT NOT NULL,      -- Supabase auth.uid()
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,  -- 'desktop' | 'mobile'
  platform TEXT NOT NULL,     -- 'darwin' | 'win32' | 'ios'
  last_sync_at TEXT,
  created_at TEXT NOT NULL
);

-- 2. 同期変更ログテーブル（アウトボックスパターン）
CREATE TABLE IF NOT EXISTS sync_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,      -- JSON: 変更内容
  created_at TEXT NOT NULL,
  synced_at TEXT              -- NULL = 未同期
);
CREATE INDEX IF NOT EXISTS idx_sync_changelog_unsynced
  ON sync_changelog(synced_at) WHERE synced_at IS NULL;

-- 3. 同期設定テーブル（singleton）
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  user_id TEXT,
  is_sync_enabled INTEGER NOT NULL DEFAULT 0,
  last_full_sync_at TEXT,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO sync_settings (id, is_sync_enabled, updated_at)
  VALUES (1, 0, datetime('now'));

-- 4. 全同期対象テーブルに sync_version カラム追加
ALTER TABLE tasks ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE timer_settings ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE memos ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notes ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE calendars ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE routines ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE schedule_items ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE playlists ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE playlist_items ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_settings ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_presets ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_tag_definitions ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_tag_assignments ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_display_meta ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sound_workscreen_selections ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pomodoro_presets ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE routine_tag_definitions ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE routine_tag_assignments ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1;

-- 5. AUTOINCREMENT PK テーブルを UUID ベースに変更
-- （timer_sessions, sound_settings 等 — 既存データのマイグレーション含む）
-- 注: 既存の INTEGER PK はローカルでは維持し、sync_id (TEXT UUID) カラムを追加する戦略を採用
ALTER TABLE timer_sessions ADD COLUMN sync_id TEXT;
ALTER TABLE sound_settings ADD COLUMN sync_id TEXT;
ALTER TABLE sound_presets ADD COLUMN sync_id TEXT;
ALTER TABLE pomodoro_presets ADD COLUMN sync_id TEXT;
ALTER TABLE sound_tag_definitions ADD COLUMN sync_id TEXT;
ALTER TABLE routine_tag_definitions ADD COLUMN sync_id TEXT;

-- sync_id にデフォルト値を設定（既存データ）
-- アプリ起動時に NULL の sync_id に UUID を生成して埋める

PRAGMA user_version = 22;
```

### 5.2 ID 戦略

| テーブル                                                                            | 現在のPK     | 同期時の扱い                                                           |
| ----------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| tasks, notes, memos, routines, playlists, playlist_items, schedule_items, calendars | TEXT UUID    | **そのまま同期可能**                                                   |
| timer_sessions, sound_settings, sound_presets, pomodoro_presets                     | INTEGER AUTO | `sync_id` (TEXT UUID) を追加。クラウドでは `sync_id` を PK として使用  |
| sound_tag_definitions, routine_tag_definitions                                      | INTEGER AUTO | 同上                                                                   |
| \*\_assignments (junction tables)                                                   | composite PK | 両方の FK が UUID なら問題なし。INTEGER FK のものは sync_id 経由で解決 |

### 5.3 updated_at の扱い

現状、`tasks` テーブルには `updated_at` カラムがない（`created_at` のみ）。同期には最終更新日時が必須。

**V22 で追加が必要なカラム**:

```sql
ALTER TABLE tasks ADD COLUMN updated_at TEXT;
-- 既存データの updated_at を created_at で初期化
UPDATE tasks SET updated_at = created_at WHERE updated_at IS NULL;
```

---

## 6. 同期アーキテクチャ

### 6.1 設計原則: ローカルファースト

```
ユーザー操作 → ローカル SQLite に即座に書き込み → UI に即座に反映
                     ↓（バックグラウンド）
              sync_changelog に記録
                     ↓（非同期）
              Supabase に push
                     ↓
              他デバイスに Realtime で broadcast
```

**オフライン時**: ローカル SQLite に書き込み + changelog に蓄積。オンライン復帰時に一括 push。

### 6.2 コンフリクト解決: Last Writer Wins (LWW)

```typescript
// コンフリクト解決ロジック
interface SyncRecord {
  id: string;
  sync_version: number;
  updated_at: string; // ISO 8601
}

function resolveConflict(
  local: SyncRecord,
  remote: SyncRecord,
): "local" | "remote" {
  // sync_version が高い方を優先
  if (local.sync_version !== remote.sync_version) {
    return local.sync_version > remote.sync_version ? "local" : "remote";
  }
  // 同一バージョンなら updated_at が新しい方を優先
  return new Date(local.updated_at) >= new Date(remote.updated_at)
    ? "local"
    : "remote";
}
```

**LWW を選択する理由**:

- Sonic Flow は個人タスク管理アプリであり、同時に複数デバイスで同じレコードを編集するケースは稀
- CRDT（Conflict-free Replicated Data Types）は実装複雑度が高く、TipTap の JSON コンテンツには不向き
- LWW はシンプルで予測可能な動作

### 6.3 SyncService 設計

```typescript
// frontend/src/services/SyncService.ts

export class SyncService {
  private supabase: SupabaseClient;
  private localDb: DataService;
  private realtimeChannel: RealtimeChannel | null = null;

  // --- Push（ローカル → クラウド） ---

  /** 未同期の changelog エントリを Supabase に送信 */
  async pushPendingChanges(): Promise<void> {
    const pending = await this.localDb.fetchPendingSyncChanges();
    for (const change of pending) {
      await this.pushChange(change);
      await this.localDb.markSynced(change.id);
    }
  }

  /** 単一の変更を Supabase に push */
  private async pushChange(change: SyncChangelogEntry): Promise<void> {
    const { table_name, record_id, operation, payload } = change;
    switch (operation) {
      case "INSERT":
      case "UPDATE":
        await this.supabase.from(table_name).upsert({
          ...JSON.parse(payload),
          user_id: this.userId,
        });
        break;
      case "DELETE":
        await this.supabase
          .from(table_name)
          .delete()
          .eq("id", record_id)
          .eq("user_id", this.userId);
        break;
    }
  }

  // --- Pull（クラウド → ローカル） ---

  /** 初回同期: Supabase から全データを pull */
  async fullSync(): Promise<void> {
    for (const table of SYNCABLE_TABLES) {
      const { data } = await this.supabase
        .from(table)
        .select("*")
        .eq("user_id", this.userId);
      if (data) {
        await this.localDb.mergeSyncData(table, data);
      }
    }
  }

  // --- Realtime（双方向リアルタイム） ---

  /** Realtime サブスクリプション開始 */
  startRealtimeSync(): void {
    this.realtimeChannel = this.supabase
      .channel("sync")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) =>
        this.handleRealtimeChange(payload),
      )
      .subscribe();
  }

  /** Realtime イベントハンドリング */
  private async handleRealtimeChange(
    payload: RealtimePostgresChangesPayload,
  ): Promise<void> {
    const { eventType, table, new: newRecord, old: oldRecord } = payload;
    // 自分自身の変更は無視（echo back prevention）
    if (this.isPendingChange(table, newRecord?.id)) return;

    switch (eventType) {
      case "INSERT":
      case "UPDATE":
        const winner = resolveConflict(
          await this.localDb.getRecord(table, newRecord.id),
          newRecord,
        );
        if (winner === "remote") {
          await this.localDb.upsertRecord(table, newRecord);
          this.emitSyncEvent({ type: "updated", table, record: newRecord });
        }
        break;
      case "DELETE":
        await this.localDb.deleteRecord(table, oldRecord.id);
        this.emitSyncEvent({ type: "deleted", table, id: oldRecord.id });
        break;
    }
  }

  stopRealtimeSync(): void {
    this.realtimeChannel?.unsubscribe();
  }
}
```

### 6.4 SyncableDataService（ローカル + 同期ラッパー）

```typescript
// frontend/src/services/SyncableDataService.ts
// ローカルの DataService をラップし、全書き込み操作に changelog 記録を追加

export class SyncableDataService implements DataService {
  constructor(
    private local: DataService, // ElectronDataService or CapacitorDataService
    private syncService: SyncService,
  ) {}

  // 例: createTask のラッパー
  async createTask(node: TaskNode): Promise<TaskNode> {
    const result = await this.local.createTask(node);
    // changelog に記録（非同期、UIはブロックしない）
    this.syncService.recordChange("tasks", result.id, "INSERT", result);
    return result;
  }

  // 読み取り系はそのまま委譲
  fetchTaskTree(): Promise<TaskNode[]> {
    return this.local.fetchTaskTree();
  }

  // ... 全70+メソッドを同様にラップ
}
```

### 6.5 カスタムサウンド（blob）の同期

カスタムサウンドファイルは Supabase Storage に保存。メタデータのみ通常の同期フローで処理。

```typescript
// blob 同期フロー
// 1. アップロード: ローカル保存 → Supabase Storage にアップロード → URL をメタに記録
// 2. ダウンロード: メタデータ同期 → Storage URL からダウンロード → ローカルに保存

async syncCustomSoundBlob(soundId: string): Promise<void> {
  const blob = await this.local.loadCustomSound(soundId);
  if (blob) {
    await this.supabase.storage
      .from('custom-sounds')
      .upload(`${this.userId}/${soundId}`, blob);
  }
}
```

### 6.6 同期状態管理

```typescript
// frontend/src/contexts/SyncContext.tsx
interface SyncContextValue {
  syncStatus: "idle" | "syncing" | "error" | "offline";
  pendingChanges: number; // 未同期変更数
  lastSyncAt: string | null;
  isSyncEnabled: boolean;
  enableSync: () => Promise<void>;
  disableSync: () => Promise<void>;
  forceSync: () => Promise<void>;
}
```

---

## 7. 新規・変更ファイル一覧

### 7.1 新規ファイル

#### プロジェクトルート

| ファイル                              | 役割                                        |
| ------------------------------------- | ------------------------------------------- |
| `capacitor.config.ts`                 | Capacitor 設定（appId, appName, webDir）    |
| `supabase/config.toml`                | Supabase ローカル開発設定                   |
| `supabase/migrations/001_initial.sql` | Supabase PostgreSQL スキーマ                |
| `supabase/migrations/002_rls.sql`     | Row Level Security ポリシー                 |
| `ios/`                                | Capacitor が自動生成する Xcode プロジェクト |

#### フロントエンド — サービス層

| ファイル                                         | 役割                                         |
| ------------------------------------------------ | -------------------------------------------- |
| `frontend/src/services/CapacitorDataService.ts`  | Capacitor SQLite によるデータアクセス        |
| `frontend/src/services/SyncService.ts`           | Supabase 同期エンジン（push/pull/realtime）  |
| `frontend/src/services/SyncableDataService.ts`   | DataService ラッパー（ローカル + changelog） |
| `frontend/src/services/auth/supabaseClient.ts`   | Supabase クライアント初期化                  |
| `frontend/src/services/auth/supabaseAuth.ts`     | 認証ヘルパー（OAuth, Magic Link）            |
| `frontend/src/services/sync/conflictResolver.ts` | LWW コンフリクト解決ロジック                 |
| `frontend/src/services/sync/changelogManager.ts` | sync_changelog 管理                          |
| `frontend/src/services/platform.ts`              | プラットフォーム判定ユーティリティ           |

#### フロントエンド — Context / Hooks

| ファイル                                | 役割                                               |
| --------------------------------------- | -------------------------------------------------- |
| `frontend/src/contexts/AuthContext.tsx` | 認証状態管理 Provider                              |
| `frontend/src/contexts/SyncContext.tsx` | 同期状態管理 Provider                              |
| `frontend/src/hooks/useAuth.ts`         | AuthContext 消費用ラッパー                         |
| `frontend/src/hooks/useSync.ts`         | SyncContext 消費用ラッパー                         |
| `frontend/src/hooks/usePlatform.ts`     | プラットフォーム判定 (`isElectron`, `isCapacitor`) |

#### フロントエンド — コンポーネント

| ファイル                                           | 役割                                          |
| -------------------------------------------------- | --------------------------------------------- |
| `frontend/src/components/Auth/SignInScreen.tsx`    | サインイン画面（Apple / Google / Magic Link） |
| `frontend/src/components/Auth/AuthGuard.tsx`       | 認証ガード（同期有効時のみ）                  |
| `frontend/src/components/Sync/SyncStatusBadge.tsx` | 同期状態インジケーター                        |
| `frontend/src/components/Sync/SyncSettings.tsx`    | 同期設定パネル                                |
| `frontend/src/components/Mobile/MobileLayout.tsx`  | モバイル1カラムレイアウト                     |
| `frontend/src/components/Mobile/MobileNav.tsx`     | ボトムタブナビゲーション                      |
| `frontend/src/components/Mobile/MobileHeader.tsx`  | モバイルヘッダー                              |

#### フロントエンド — 型定義

| ファイル                     | 役割                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `frontend/src/types/sync.ts` | 同期関連型（SyncStatus, SyncDevice, SyncChangelog 等） |
| `frontend/src/types/auth.ts` | 認証関連型（User, AuthState 等）                       |

### 7.2 変更ファイル

| ファイル                                        | 変更内容                                                        |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `package.json`                                  | Capacitor + Supabase 依存追加                                   |
| `frontend/package.json`                         | `@supabase/supabase-js` 依存追加                                |
| `frontend/src/services/dataServiceFactory.ts`   | プラットフォーム判定、SyncableDataService 統合                  |
| `frontend/src/main.tsx`                         | AuthProvider, SyncProvider 追加                                 |
| `frontend/src/App.tsx`                          | モバイルレイアウト分岐、認証フロー統合                          |
| `frontend/src/hooks/useAudioEngine.ts`          | iOS AudioContext resume 対応                                    |
| `frontend/src/hooks/usePlaylistEngine.ts`       | iOS バックグラウンド再生対応                                    |
| `frontend/src/components/Settings/Settings.tsx` | 同期設定セクション追加                                          |
| `frontend/src/i18n/locales/en.json`             | 認証・同期関連の翻訳キー追加                                    |
| `frontend/src/i18n/locales/ja.json`             | 同上                                                            |
| `frontend/src/types/index.ts`                   | sync, auth 型の再エクスポート                                   |
| `electron/database/migrations.ts`               | V22 マイグレーション追加                                        |
| `electron/preload.ts`                           | sync 関連 IPC チャンネル追加                                    |
| `electron/ipc/registerAll.ts`                   | syncHandlers 登録                                               |
| `frontend/src/services/DataService.ts`          | sync 関連メソッド追加（fetchPendingSyncChanges, markSynced 等） |
| `frontend/src/services/ElectronDataService.ts`  | sync 関連メソッド実装                                           |
| `frontend/src/constants/storageKeys.ts`         | sync 関連 localStorage キー追加                                 |
| `frontend/vite.config.ts`                       | 環境変数（VITE_SUPABASE_URL 等）設定                            |
| `.env.example`                                  | Supabase 環境変数テンプレート                                   |
| `.gitignore`                                    | `.env`, `ios/` の一部を追加                                     |

---

## 8. 3フェーズ実装計画

### Phase 1: 基盤整備（ローカル変更のみ、2-3週間）

**目標**: 同期に備えたデータ層の準備。既存機能を壊さない。

| #   | タスク                                       | 詳細                                               |
| --- | -------------------------------------------- | -------------------------------------------------- |
| 1.1 | V22 マイグレーション実装                     | `sync_version`, `sync_id`, `updated_at` カラム追加 |
| 1.2 | `sync_changelog` テーブル実装                | INSERT/UPDATE/DELETE の changelog 自動記録         |
| 1.3 | `sync_devices`, `sync_settings` テーブル実装 | デバイス管理・同期設定                             |
| 1.4 | DataService インターフェース拡張             | sync 関連メソッド追加                              |
| 1.5 | ElectronDataService sync メソッド実装        | IPC ハンドラ + リポジトリ追加                      |
| 1.6 | `SyncableDataService` 実装                   | 全書き込み操作に changelog 記録を追加するラッパー  |
| 1.7 | `dataServiceFactory.ts` 更新                 | SyncableDataService 統合（同期無効時はスルー）     |
| 1.8 | `usePlatform` hook 実装                      | Electron / Capacitor / Web 判定                    |
| 1.9 | テスト                                       | V22 マイグレーションテスト、changelog 記録テスト   |

**Phase 1 完了条件**:

- 既存の全機能が動作する
- 全書き込み操作が changelog に記録される
- `sync_version` が操作ごとにインクリメントされる

### Phase 2: Capacitor + Supabase 統合（3-4週間）

**目標**: iOS アプリ + クラウド同期の実装。

| #    | タスク                              | 詳細                                                  |
| ---- | ----------------------------------- | ----------------------------------------------------- |
| 2.1  | Capacitor プロジェクト初期化        | `capacitor.config.ts`, iOS プラットフォーム追加       |
| 2.2  | `CapacitorDataService` 実装         | `@capacitor-community/sqlite` による DataService 実装 |
| 2.3  | Supabase プロジェクトセットアップ   | PostgreSQL スキーマ、RLS ポリシー                     |
| 2.4  | 認証実装                            | Supabase Auth + Apple Sign-In + Google OAuth          |
| 2.5  | `AuthContext` + `SignInScreen` 実装 | 認証フロー UI                                         |
| 2.6  | `SyncService` 実装                  | push / pull / realtime 同期エンジン                   |
| 2.7  | `SyncContext` + Sync UI 実装        | 同期状態表示、設定パネル                              |
| 2.8  | モバイルレイアウト実装              | 1カラムレイアウト + ボトムナビ                        |
| 2.9  | iOS Audio 対応                      | AudioContext resume + バックグラウンド再生            |
| 2.10 | カスタムサウンド blob 同期          | Supabase Storage 連携                                 |
| 2.11 | 結合テスト                          | Desktop ↔ iPhone リアルタイム同期テスト               |

**Phase 2 完了条件**:

- iOS アプリが実機で動作する
- Desktop ↔ iPhone 間でリアルタイムにデータが同期される
- オフライン時もローカルで操作可能

### Phase 3: 最適化 + App Store 準備（2-3週間）

| #   | タスク                     | 詳細                                             |
| --- | -------------------------- | ------------------------------------------------ |
| 3.1 | 差分同期最適化             | 初回同期後は変更分のみ転送                       |
| 3.2 | バッチ同期                 | 大量変更のバッチ push/pull                       |
| 3.3 | 同期コンフリクト UI        | コンフリクト発生時のユーザー通知                 |
| 3.4 | App Icons + Splash Screen  | iOS 用アセット作成                               |
| 3.5 | iOS 固有の UI 調整         | Safe Area, Dynamic Island, 触覚フィードバック    |
| 3.6 | パフォーマンスチューニング | WKWebView メモリ管理、大量データ同期時の最適化   |
| 3.7 | App Store 審査準備         | プライバシーマニフェスト、ATT 対応、レビュー情報 |
| 3.8 | TestFlight ベータ配信      | 内部テスト → 外部テスト                          |
| 3.9 | App Store 提出             | 審査 + 公開                                      |

---

## 9. リスクと対策

### 9.1 技術リスク

| リスク                              | 影響度 | 発生確率 | 対策                                                                                            |
| ----------------------------------- | ------ | -------- | ----------------------------------------------------------------------------------------------- |
| iOS WKWebView の Web Audio API 制約 | 高     | 高       | ユーザー操作起点の AudioContext.resume() を実装。バックグラウンド音声はネイティブプラグイン検討 |
| Capacitor SQLite プラグインの互換性 | 高     | 中       | `@capacitor-community/sqlite` は mature。フォールバックとして IndexedDB も検討                  |
| 同期コンフリクトでデータ消失        | 高     | 低       | LWW + sync_version による楽観的ロック。危険な操作前にローカルバックアップ                       |
| TipTap コンテンツの同期             | 中     | 中       | JSON 文字列として丸ごと LWW。フィールドレベルマージは行わない                                   |
| AUTOINCREMENT ID のデバイス間衝突   | 高     | 高       | V22 で `sync_id` (UUID) を追加。クラウドでは UUID を PK として使用                              |
| Supabase Free Tier の制限超過       | 中     | 中       | 初期は Free Tier。ユーザー増加時に Pro にアップグレード                                         |

### 9.2 ビジネスリスク

| リスク                         | 対策                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| App Store 審査リジェクト       | Apple Human Interface Guidelines 準拠、プライバシーマニフェスト整備        |
| Supabase のサービス変更・停止  | セルフホスト可能な構成を維持。DataService 抽象化で別サービスに差し替え可能 |
| モバイル版のパフォーマンス問題 | 遅延ロード、仮想スクロール、画像最適化                                     |

### 9.3 セキュリティリスク

| リスク                       | 対策                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| Supabase Anon Key の漏洩     | RLS で全テーブルをユーザー単位に制限。Anon Key は読み取り制限のみ |
| JWT トークンの盗取           | HTTPS 強制、Secure Storage (Capacitor) でトークン保管             |
| ローカル SQLite のデータ露出 | iOS のデータ保護（NSFileProtection）を有効化                      |

---

## 10. 検証方法

### 10.1 ユニットテスト

| 対象                   | テスト内容                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `conflictResolver.ts`  | LWW ロジック（同一バージョン、異なるバージョン、同一タイムスタンプ） |
| `changelogManager.ts`  | INSERT/UPDATE/DELETE の changelog 正しい記録                         |
| `SyncableDataService`  | 全メソッドが changelog を記録し、ローカル操作を委譲する              |
| `CapacitorDataService` | SQLite CRUD の正常動作（モック環境）                                 |
| `V22 マイグレーション` | 既存データ保持 + 新カラム追加の確認                                  |

### 10.2 結合テスト

| シナリオ             | 手順                                                 | 期待結果                      |
| -------------------- | ---------------------------------------------------- | ----------------------------- |
| 初回同期             | Desktop でデータ作成 → iPhone でログイン             | iPhone にデータが pull される |
| リアルタイム同期     | Desktop でタスク追加                                 | iPhone に即座に反映           |
| オフライン → 復帰    | iPhone をオフラインにしてタスク追加 → オンライン復帰 | Desktop に変更が反映          |
| コンフリクト解決     | 両デバイスで同じタスクを同時編集                     | sync_version の高い方が勝つ   |
| カスタムサウンド同期 | Desktop でカスタムサウンド追加                       | iPhone で再生可能             |

### 10.3 iOS 固有テスト

| テスト               | 確認内容                                           |
| -------------------- | -------------------------------------------------- |
| バックグラウンド音声 | アプリをバックグラウンドにしてもタイマー音が継続   |
| メモリ使用量         | 長時間使用時の WKWebView メモリリーク              |
| キーボード挙動       | TipTap エディタのソフトキーボード表示/非表示       |
| Safe Area            | ノッチ / Dynamic Island / ホームインジケーター回避 |
| ダークモード         | iOS のシステムダークモードとの連動                 |
| Apple Sign-In        | 認証フロー + トークンリフレッシュ                  |

### 10.4 パフォーマンステスト

| テスト                     | 基準                 |
| -------------------------- | -------------------- |
| 初回同期（1000タスク）     | < 10秒               |
| リアルタイム同期レイテンシ | < 2秒                |
| アプリ起動時間（iOS）      | < 3秒                |
| changelog 蓄積時の push    | 100件/バッチで < 5秒 |

---

## 付録 A: Supabase PostgreSQL 全テーブルスキーマ

```sql
-- tasks, notes, memos, routines, calendars, schedule_items, playlists, playlist_items
-- → ローカル SQLite と同一スキーマ + user_id + sync_version
-- → 全テーブルに RLS ポリシー適用

-- timer_settings: user_id を PK に変更（ユーザーごとに1レコード）
CREATE TABLE timer_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_duration INTEGER NOT NULL DEFAULT 25,
  break_duration INTEGER NOT NULL DEFAULT 5,
  long_break_duration INTEGER NOT NULL DEFAULT 15,
  sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
  auto_start_breaks BOOLEAN DEFAULT false,
  sync_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- timer_sessions: sync_id を PK に変更
CREATE TABLE timer_sessions (
  id TEXT PRIMARY KEY,  -- UUID (= ローカルの sync_id)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT,
  session_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  sync_version INTEGER NOT NULL DEFAULT 1
);

-- custom_sound_storage: メタのみ。blob は Supabase Storage
CREATE TABLE custom_sounds (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT,  -- Supabase Storage のパス
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  sync_version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (id, user_id)
);
```

## 付録 B: 環境変数

```bash
# .env (gitignore 対象)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx

# .env.example (コミット対象)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 付録 C: capacitor.config.ts

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sonicflow.app",
  appName: "Sonic Flow",
  webDir: "frontend/dist",
  server: {
    // 開発時のみ: Vite dev server に接続
    url:
      process.env.NODE_ENV === "development"
        ? "http://localhost:5173"
        : undefined,
    cleartext: process.env.NODE_ENV === "development",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#000000",
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
```
