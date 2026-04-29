---
Status: ACTIVE — Phase 0 開始前
Created: 2026-04-29
Task: 大規模技術移行 — Tauri / Cloudflare 構成 → Vite + React + TS + Supabase + Capacitor
Project path: /Users/newlife/dev/apps/life-editor
Branch: refactor/web-first-v2
Related:
  - [CLAUDE.md](./CLAUDE.md) — 移行完了後に全面改訂(Tauri / SQLite / Cloud D1 / Cloud Sync 章を削除)
  - [docs/vision/core.md](./docs/vision/core.md) — Vision の "Web UI 否定" は反転される
  - [.claude/archive/2026-04-29-claude-desktop-style-chat-ui.md](./archive/2026-04-29-claude-desktop-style-chat-ui.md) — 旧 Vision 前提のため archive
---

# Plan: Web ファーストへの大規模技術移行

## Context

### 1. 動機

現状の life-editor は Tauri 2 + Vite + React + Cloudflare Workers + D1 + Node.js MCP Server + portable-pty で構築されており、N=1 主作者 + 友達数人配布のスケールに対して **過剰に複雑**。作者の現スキルセット(JS / SQLite 入門〜中級)では cargo / Rust / 自前同期エンジン(`sync_engine.rs`)/ portable-pty / WebView 差異の維持が困難で、開発速度と継続性が損なわれている。

「自宅でも外でもメモ・タスク・スケジュールを読み書きし、AI に分析させる」という Vision の本質は、プラットフォーム多様性ではなく **どこからでもアクセスできるデータ層**。Tauri 4 プラットフォーム展開より、**Web 1 コードベースを Capacitor で iOS / Android にラップ** する方が遥かに少ない学習コストで同じ要件を満たせる。

### 2. 採用アーキテクチャ

```
[Browser (PC) / iOS Capacitor / Android Capacitor]
        ↓ HTTPS + WebSocket(Realtime)
[Vite + React 19 + TypeScript + Tailwind + @supabase/supabase-js]
        ↓
[Supabase: Postgres + Auth + Realtime + Storage]
        ↑
[terminal-division (Electron, 別リポジトリ) — stdio MCP 経由で接続]
```

### 3. 制約

| 領域             | 決定                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| プラットフォーム | Web (PC ブラウザ) / iOS Capacitor / Android Capacitor。Desktop ネイティブは将来 Electron で再追加検討 |
| 認証             | Supabase Auth (Email + Apple Sign-in)。Apple Developer Program は配布期間のみ加入($99/年)             |
| コスト           | 当面 Supabase 無料枠で開始(7 日無アクセスで pause、毎日触る前提なので問題なし)、超過時 Pro $25/月     |
| オフライン       | 常時オンライン前提。機内モード/圏外での編集は切り捨て                                                 |
| AI 連携          | stdio MCP Server を terminal-division から起動(Remote MCP は採用しない)                               |
| 既存資産         | 現状 React / TS コードの **65-70%** を流用。DataService 抽象化はそのまま維持                          |

### 4. Non-goals(今回やらない)

- Desktop ネイティブアプリ(macOS / Windows はブラウザ運用)
- オフライン編集
- マルチテナント / 認証ありの公開配布
- Tauri / Rust / portable-pty / Cloud D1 / `sync_engine.rs` の維持
- Database(汎用 DB)機能 — Postgres での動的テーブル生成は難度高、一旦凍結

---

## Phases

### Phase 0 — 環境構築 + 学習(2 週間目安)

ゴール: Vite + React + TS + Supabase + Capacitor の素プロジェクトを最小構成で動かし、各レイヤの動作原理を体得する。**life-editor リポジトリは触らず、別ディレクトリ `~/dev/learning/web-first-spike/` で実施**。

#### Day 1-3: Vite + React + TS + Tailwind 基礎

- [ ] `~/dev/learning/web-first-spike-1/` で `npm create vite@latest -- --template react-ts`
- [ ] Tailwind 4 をセットアップ(`@tailwindcss/vite` plugin)
- [ ] カウンタ + ローカル TODO リスト(localStorage)を作る
- [ ] React 19 hook / TS 型 / Tailwind ユーティリティを体得
- [ ] 学習ログを `~/dev/apps/life-editor/.claude/learning/web-first/day-01-03.md` に記録

#### Day 4-5: Supabase 基礎(DB + CRUD)

- [ ] supabase.com で無料プロジェクト作成、credentials を `.env.local` に格納
- [ ] `tasks` テーブル定義(id uuid / title text / status text / created_at timestamptz)
- [ ] `@supabase/supabase-js` で CRUD(挿入・取得・更新・削除)を確認
- [ ] Row Level Security(RLS)の概念を体験 — anon キーでは何が見えるか

#### Day 6-8: Supabase Auth(Email + Magic Link)

- [ ] Email + Password で signUp / signIn / signOut フロー実装
- [ ] Magic Link を試す(メール内リンクで認証)
- [ ] RLS ポリシー: `auth.uid() = user_id` で自分のデータのみアクセス可能に
- [ ] Apple Sign-in は Phase 1 で対応(Phase 0 では skip 可)

#### Day 9-11: Supabase Realtime

- [ ] Postgres CDC を有効化、`tasks` テーブルの変更を購読
- [ ] 別タブで変更 → リアルタイム反映を確認
- [ ] React Query との組み合わせを試す(`invalidateQueries` パターン)

#### Day 12-14: Capacitor で iOS / Android シミュレータ起動

- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init` で設定生成
- [ ] iOS: `npx cap add ios` → Xcode で起動(Apple Developer Program 不要、無料署名で動く)
- [ ] Android: `npx cap add android` → Android Studio の AVD で起動
- [ ] Web ビルドした /dist を Capacitor が iOS / Android に運ぶ仕組みを理解

#### Phase 0 完了判定

- [ ] Vite + React + TS で TODO アプリが動く
- [ ] Supabase Postgres の CRUD が動く
- [ ] Supabase Auth でログインできる
- [ ] Supabase Realtime で他タブ変更が反映される
- [ ] iOS / Android シミュレータで Capacitor アプリが起動する
- [ ] 各日の学習ログを `.claude/learning/web-first/` に蓄積

---

### Phase 1 — life-editor リポジトリでの新スタック土台構築(2-3 週間)

ゴール: `refactor/web-first-v2` ブランチ上の `/web/` ディレクトリに新スタックの骨組みを設置。`frontend/` (Tauri) と並立させる。

- [ ] `/web/` ディレクトリ新規作成(Vite + React + TS + Tailwind + Supabase)
- [ ] 本番用 Supabase プロジェクト作成 + 認証設定
- [ ] 既存 SQLite スキーマから Postgres スキーマを自動生成するスクリプト
- [ ] `supabase/migrations/0001_initial.sql` 作成 — Tasks / Schedule / Notes / Daily / WikiTags テーブル
- [ ] `/web/src/services/DataService.ts` を `frontend/src/services/DataService.ts` からコピー
- [ ] `/web/src/services/SupabaseDataService.ts` 実装(DataService interface に対応)
- [ ] 既存 SQLite データを Supabase へ移行する 1 回限りスクリプト
- [ ] Apple Sign-in 設定(Apple Developer 加入後)

#### 影響ファイル

| File                                       | Operation | Notes                                  |
| ------------------------------------------ | --------- | -------------------------------------- |
| `/web/`                                    | 新規      | Vite + React + TS + Tailwind 素        |
| `/web/src/services/DataService.ts`         | コピー    | frontend/ から interface のみコピー    |
| `/web/src/services/SupabaseDataService.ts` | 新規      | DataService interface の Supabase 実装 |
| `supabase/migrations/0001_initial.sql`     | 新規      | 初期 Postgres スキーマ                 |
| `scripts/migrate-sqlite-to-supabase.ts`    | 新規      | データ移行スクリプト                   |
| `frontend/`, `src-tauri/`, `cloud/`        | 触らない  | 並立期間中は維持                       |

#### Phase 1 完了判定

- [ ] `/web/` で `npm run dev` が起動
- [ ] Supabase に接続できる
- [ ] Tasks テーブルに対する SupabaseDataService の CRUD が通る
- [ ] 既存 SQLite データが Supabase に移行されている
- [ ] `frontend/`(Tauri)は壊れていない

---

### Phase 2 — コア機能のフロントエンド移植(3-4 週間)

ゴール: 既存 `frontend/src/` の **Tauri 非依存コンポーネント** を `/web/` に移し、Tasks / Schedule / Notes / Daily / WikiTags が Supabase 上で動作。

- [ ] `frontend/src/components/Tasks/` → `/web/src/components/Tasks/`
- [ ] `frontend/src/components/Tasks/Schedule/` → `/web/src/components/Schedule/`
- [ ] `frontend/src/components/Notes/` → `/web/src/components/Notes/`
- [ ] `frontend/src/components/Daily/` → `/web/src/components/Daily/`
- [ ] `frontend/src/components/WikiTags/` → `/web/src/components/WikiTags/`
- [ ] `frontend/src/context/` → `/web/src/context/`(Tauri 依存除く)
- [ ] `frontend/src/hooks/` → `/web/src/hooks/`
- [ ] `frontend/src/types/` → `/web/src/types/`
- [ ] `frontend/src/i18n/` → `/web/src/i18n/`
- [ ] Tauri 依存ファイル 4 個(TitleBar / Settings 3 個)の Web 版を新規実装 or 除外
- [ ] Mobile レスポンシブ確認(Chrome DevTools)

#### Phase 2 完了判定

- [ ] Tasks / Schedule / Notes / Daily / WikiTags の CRUD が `/web/` で動く
- [ ] PC + Mobile の両方でレイアウトが崩れない
- [ ] Supabase Realtime 経由で他デバイスからの変更が反映される

---

### Phase 3 — Capacitor 化(1-2 週間)

ゴール: `/web/` を iOS / Android アプリとして起動できる状態に。

- [ ] Capacitor 8 install + `npx cap init`
- [ ] iOS プロジェクト生成 + Xcode 無料署名で実機検証
- [ ] Android プロジェクト生成 + Android Studio AVD 検証
- [ ] `capacitor.config.ts` 設定(bundle ID / app name / web dir)
- [ ] Apple Sign-in プラグイン(`@capacitor-community/apple-sign-in`)統合
- [ ] iOS スプラッシュ / アイコン整備

#### Phase 3 完了判定

- [ ] iOS シミュレータで `/web/` アプリ起動 + 操作可能
- [ ] Android AVD で同上
- [ ] Supabase に iOS / Android からも接続可能
- [ ] Apple Sign-in が iOS で動作

---

### Phase 4 — 周辺機能の整理(1-2 週間)

ゴール: Audio / Timer / Settings を整理、不要機能を削除。

- [ ] Audio Mixer: Web Audio API で動作確認(AudioContext は変更ほぼ無し)
- [ ] Timer / Pomodoro: Supabase 連携(timer_sessions テーブル)
- [ ] Settings: 不要項目(auto-launch / global shortcuts / tray)削除
- [ ] FileExplorer: 削除(Web では用途なし、materials は Supabase Storage へ)
- [ ] Database(汎用 DB): 一旦凍結、CLAUDE.md §8 から外す
- [ ] Trash / UndoRedo: Supabase row レベルで実装

#### Phase 4 完了判定

- [ ] 既存 Tier 2 機能が概ね動作(削除した機能を除く)
- [ ] CLAUDE.md §8 Feature Tier Map 更新

---

### Phase 5 — terminal-division 連携 + 最終整理(1-2 週間)

ゴール: terminal-division から Life Editor の MCP を stdio で叩ける状態に。Tauri / Rust / Cloud D1 を完全削除。

- [ ] `mcp-server/` を Postgres 接続版に書き換え(better-sqlite3 → @supabase/supabase-js)
- [ ] terminal-division の Main process から life-editor MCP を起動するブリッジ追加
- [ ] `frontend/` を `archive/frontend-tauri/` に移動 or 削除
- [ ] `src-tauri/` 削除
- [ ] `cloud/`(Cloudflare Workers + D1)削除
- [ ] CLAUDE.md 全面改訂(アーキテクチャ章を新スタック前提に書き換え)
- [ ] `docs/vision/core.md` の Web UI 否定を反転
- [ ] `docs/known-issues/` の Tauri 関連項目を archive
- [ ] README.md 更新

#### Phase 5 完了判定

- [ ] terminal-division から Life Editor MCP 経由で Tasks 操作可能
- [ ] `frontend/` + `src-tauri/` + `cloud/` が依存に残っていない
- [ ] CLAUDE.md / vision / requirements が新スタック前提
- [ ] cargo / Rust / portable-pty への依存ゼロ
- [ ] ビルド時間 < 30 秒(現状 Tauri ビルドの数倍速)

---

## ブランチ運用ルール

- **作業ブランチ**: `refactor/web-first-v2`(本ブランチ)
- **子ブランチ**: 各 Phase の細分作業は短命の子ブランチ(例: `phase-0/setup`, `phase-1/data-service-supabase`)
- **main 直接 push 禁止**: pre-push hook + `git config branch.main.pushRemote=no_push` で物理的にブロック
- **task-tracker(MEMORY.md / HISTORY.md)は本ブランチで更新**: main に直接 commit しない

---

## 移行タイムライン目安

| Phase                           | 期間   | 累計     |
| ------------------------------- | ------ | -------- |
| 0. 環境構築 + 学習              | 2 週   | 2 週     |
| 1. 新スタック土台               | 2-3 週 | 4-5 週   |
| 2. コア機能移植                 | 3-4 週 | 7-9 週   |
| 3. Capacitor 化                 | 1-2 週 | 8-11 週  |
| 4. 周辺機能整理                 | 1-2 週 | 9-13 週  |
| 5. terminal-division + 最終整理 | 1-2 週 | 10-15 週 |

合計 **2.5-4 ヶ月** を目安に進める。

---

## 関連リサーチログ

すべて 2026-04-29 実施:

- **技術スタック比較**(deep-web-research): Capacitor 8 を本命、Expo Universal を次点、Tauri 維持は不採用
- **BaaS 比較**(deep-web-research): Supabase を本命($25/月で N=1 + 友達数人を完全カバー)、PocketBase を次点、Firebase は予期せぬ高額請求リスクで除外
- **既存資産流用調査**(Explore agent): Tauri 依存はわずか 4 ファイル、DataService 抽象化はそのまま使える、流用率 65-70%
- **Apple Developer Program 実態**: 年額 $99、未更新で取り下げ、再加入で復活、無料署名は週次再署名運用も可能
