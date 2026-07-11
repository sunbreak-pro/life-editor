---
Status: ACTIVE — Phase 2 完了（2026-06-05 / PR #43・#44 + tracker commit 5b3021c。S0-S7 / perf / RLS 達成）。Phase 2↔3 間 Data Unification レーンは完了（DU-G G1-G4 = PR #29/#30/#31/#36 全 merge・計画書は archive 済）。Phase 3（Electron 包装 #79）/ Phase 4（Capacitor 包装 #88）は scaffold merged（`desktop/` `mobile/` 実在）、残は実機 golden path の目視ゲート。最新 Phase 状況は `memory/INDEX.md`（per-chat）+ 各 Phase 計画書 + git 履歴が正本（旧 MEMORY.md は 2026-05-23 凍結）。本ファイルは commit 60f5f63 で誤削除→2026-05-17 git 履歴から復元
Created: 2026-05-04
Updated: 2026-07-08
Task: クロスプラットフォーム移行 — Tauri / Cloudflare 構成 → Vite + React + TS + Supabase + Electron + Capacitor
Project path: /Users/newlife/dev/apps/life-editor
Branch: main（2026-05〜集約済み。旧 refactor/web-first-v2 は PR #3-9 merge 済で廃止 — CLAUDE.md ヘッダ参照）
Supersedes:
  - `2026-04-29-web-first-migration.md`（archive から削除済・逐語は git 履歴参照）— Web First 単体構成（Electron 不採用）から本プランへ統合
Related:
  - [CLAUDE.md](./CLAUDE.md) — 移行完了後に全面改訂(Tauri / SQLite / Cloud D1 / Cloud Sync 章を削除)
  - [docs/vision/core.md](./docs/vision/core.md) — 失効中の章あり、Phase 5 で全面改訂
  - [docs/vision/db-conventions.md](./docs/vision/db-conventions.md) — 並立期間は現行規約として有効、Phase 5 で Postgres + RLS 規約に置換
  - [archive/SUMMARY.md](./archive/SUMMARY.md) — Tauri 前提で失効した旧 vision/ 4 ファイル（vision-tauri/）は 2026-05-16 削除、恒久知見のみ本ファイルに圧縮（逐語原文は git 履歴）
  - `2026-04-29-claude-desktop-style-chat-ui.md`（archive から削除済・逐語は git 履歴参照）— 旧 Vision 前提のため archive 済
  - `2026-04-26-windows-android-port.md`（削除済・逐語は git 履歴参照）— Tauri ベースの Windows/Android 配布計画。本プランで完全に置換される
---

# Plan: クロスプラットフォーム移行（Electron / Capacitor / Web）

## 0. 2026-05-14 方針更新（最重要）

旧プランは「Phase 0 で 2.5 週間の学習スパイクを別ディレクトリで実施し、各日 Markdown 学習ログを残す」設計だったが、実運用で以下の弊害が明確になった:

1. **学習が長続きしない**: 別プロジェクトでの素振りはモチベーション維持が難しい。実物に手応えがないと続かない
2. **学習ログの執筆コストが高い**: Day ごとに数百行書くのは時間消費が大きく、書かないまま手だけ動く状態に陥りやすい
3. **完成までのコストを抑えたい**: いつリリースできるか不明なまま費用（Apple Developer Program $99/年、Supabase Pro $25/月、コード署名証明書など）を発生させたくない

これを受けて、本プランを次の三原則で再設計する:

| 原則                   | 内容                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **やりながら学ぶ**     | 学習スパイクは廃止。`life-editor` リポジトリ本体で `shared/` を立てて、本物のデータで動かしながら理解する。詰まったら都度 AI に質問・調査                                                                                        |
| **学習ログを書かない** | `.claude/learning/` への Day ごと Markdown 蓄積は廃止。必要な知識は実装失敗やコードレビューを通じて身に付ける                                                                                                                    |
| **完成まで $0 厳守**   | Phase 5 完了 = 「完成」と定義。それまで Supabase 無料枠 / Cloudflare 無料 / GitHub 無料 / Electron 未署名配布 / 無料 Apple ID 7 日署名 のみ使用。Apple Developer Program / Supabase Pro / Windows 署名証明書は **完成後** に判断 |

旧 Phase 0（学習スパイク 2.5 週）は本改訂で削除。Phase 番号は繰り上げない（旧 Phase 1 → 新 Phase 1）。

**2026-06-07 追補（UI 集約方針 = W0 確定）**: Web/Desktop 機能差を埋める作業（計画書 `archive/2026-06-07-web-desktop-parity-roadmap.md`・#154 で完了 archive）で UI 共通化を **「2 層モデル」**＝部品層は `shared/src/components/` に完全共通集約・画面層は機能別に単一/分割、と確定（案 A）。デザインシステム + `lumen-*` トークン（#135 で `ink-*` から改名） + **i18n（en/ja catalog + i18next）** を `shared/` に集約し、3 配布形態（Electron/Capacitor/Web）が共用する。詳細原則は `docs/vision/coding-principles.md §6`。本書 Phase 2 の `frontend/src/i18n/ → shared/src/i18n/` は W0 で先行移植済（catalog を `frontend` から全量コピー、frontend は FROZEN のまま不変）。

---

## Context

### 1. 動機

現状の life-editor は Tauri 2 + Vite + React + Cloudflare Workers + D1 + Node.js MCP Server + portable-pty で構築されている。N=1 主作者 + 友達数人配布のスケールに対して **過剰に複雑**。作者の現スキルセット(JS / SQLite 入門〜中級、Rust 苦手)では cargo / Rust / 自前同期エンジン(`sync_engine.rs`)/ portable-pty / WebView 差異の維持が困難で、開発速度と継続性が損なわれている。

「自宅でも外でもメモ・タスク・スケジュールを読み書きし、AI に分析させる」という Vision の本質は、プラットフォーム多様性ではなく **どこからでもアクセスできるデータ層**。

旧 Web First プランでは Web URL 単体配信を主軸に置いたが、ユーザー要件再確認（2026-05-04）の結果、**Desktop（macOS/Windows/Linux）が主、Mobile（iOS/Android）が従、Web URL も公開可能** という優先順位が確定。これに合わせて単一 React コードベースを Electron / Capacitor / Web の 3 包装で配布する構成に変更する。

### 2. 採用アーキテクチャ

```
[shared React 19 + TS + Tailwind バンドル]
   ├─ Electron で包む → macOS / Windows / Linux .app/.exe/AppImage  — Desktop 主
   ├─ Capacitor で包む → iOS / Android                              — Mobile 従
   └─ Vite ビルド → Cloudflare Pages 等で Web URL 公開              — おまけ

[Supabase: Postgres + Auth + Realtime + Storage]
[terminal-division (Electron, 別リポジトリ) — stdio MCP 経由で接続]
```

#### 重要原則

- `shared/` は React コードの本体。Electron / Capacitor 固有 API を一切書かない
- プラットフォーム差は `Capacitor.isNativePlatform()` 等の小さなアダプタで吸収
- `desktop/` の main / preload は **可能な限り薄く保つ**。業務ロジック禁止
- `desktop/preload/index.ts` の expose 関数は **10 個以下** を目安

### 3. 制約

| 領域                   | 決定                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| プラットフォーム       | Web (PC ブラウザ) / Electron Desktop (macOS / Windows / Linux) / iOS Capacitor / Android Capacitor                                                                          |
| 認証                   | Supabase Auth (Email + Password を Phase 1 から使用 / Apple Sign-in は**完成後・友達 iOS 配布開始時**)                                                                      |
| **完成までのコスト**   | **$0 厳守**。Supabase 無料枠 / Cloudflare 無料 / GitHub 無料 / Electron 未署名配布 / 無料 Apple ID 7 日署名 のみ                                                            |
| **完成後のコスト判断** | Phase 5 完了後に必要性を再評価: Apple Developer Program $99/年 (iOS 友達配布)、Supabase Pro $25/月 (無料枠超過時)、Windows 署名証明書 $80-500/年 (SmartScreen 警告消すなら) |
| オフライン             | **常時オンライン前提**。機内モード/圏外では「オンライン時にご利用ください」グローバルバナー表示。Service Worker 不採用                                                      |
| AI 連携                | stdio MCP Server を terminal-division から起動(Remote MCP は採用しない)                                                                                                     |
| 既存資産               | 現状 React / TS コードの **65-70%** を流用。DataService 抽象化はそのまま維持                                                                                                |

### 4. Electron 採用の判断と明示的デメリット

#### 採用理由

- Rust 学習・維持コスト ゼロ → 移行の主動機が達成される
- 作者は terminal-division で Electron 経験あり（main/preload/renderer 構造、IPC、electron-builder までは AI 任せだが感覚は持っている）
- JS/TS 単一言語で全レイヤ書ける、IPC も TS 型で書ける
- エコシステム最大（electron-builder / electron-updater / electron-store 等が枯れている）
- デバッグ容易（Chrome DevTools そのまま使える）

#### 明示的デメリット（受容することを承知）

| 項目               | Electron                                                 | 影響                                                    |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------- |
| インストーラサイズ | 80-200MB                                                 | 友達配布で「インストーラデカいけど大丈夫?」と聞かれがち |
| メモリ消費 (idle)  | 200-400MB                                                | low-end PC で他アプリと併用するとキツい                 |
| 起動時間           | 1-3秒                                                    | 体感的に重い                                            |
| 自動更新差分DL     | 毎回 80-200MB                                            | 友達回線が貧弱だと痛い                                  |
| バッテリー消費     | Chromium ベース                                          | ノート PC でファン回りやすい                            |
| セキュリティ更新   | 3-4ヶ月毎の Electron 更新必須                            | Chromium CVE 追従義務                                   |
| Native ABI 互換    | メジャー更新で `node-pty` 等 Native 依存が壊れることあり | 影響時は再ビルド必要                                    |

これらを受容してでも、Rust 学習コスト回避と JS 単言語化の方が体感メリットが大きいと判断。

### 5. Electron スタック選定（AI 友好版）

「AI が代わりに書く前提」では、よくある well-trodden な選択肢を採用する。マイナー構成を選ぶと、AI が古い情報や複数パターンを混ぜて壊れたコードを生成しやすい。

| レイヤ            | 採用                                       | 理由                                                                              |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Scaffold          | **electron-vite**                          | Vite native 統合、TS 型安全 IPC ヘルパー組込、テンプレート豊富                    |
| Builder           | **electron-builder**                       | デファクト、macOS / Win / Linux 全対応、auto-updater との統合滑らか               |
| Updater           | **electron-updater + GitHub Releases**     | 設定ファイル数行で動く、無料、ドキュメント豊富                                    |
| Process Mgr       | **メイン + 単一 preload + 単一 renderer**  | Multi-window や hidden helper は当面禁止                                          |
| IPC               | **`contextBridge` + `ipcRenderer.invoke`** | Promise ベース、型定義 1 ファイル集中、context isolation 必須                     |
| Persistent Config | **electron-store**                         | 1KB 設定（ウィンドウサイズ / テーマ）保存用。データ本体は Supabase なので最小用途 |
| Native menu       | electron 標準 Menu API                     | プラグイン不使用                                                                  |
| Tray              | electron 標準 Tray                         | 同上                                                                              |
| Tests             | なし（当面）                               | E2E は Playwright を将来検討。N=1 なら手動で十分                                  |

#### 禁止スタック (混入したら即拒否)

- `webPack` 直書き（electron-vite が内部で Vite/esbuild 管理）
- `nativeWindowOpen` カスタム設定
- `nodeIntegration: true`
- 複数 BrowserWindow 構成（最初はメイン 1 枚のみ）
- IPC で関数オブジェクトをやり取り（必ず serializable）

### 6. データ層: Supabase 確定

学習コスト・既存知識活用度・運用負荷の比較で **Supabase** を本命採用。

| BaaS         | 慣れまで        | 既存知識活用度 | 運用負荷       | 料金リスク     | 判定     |
| ------------ | --------------- | -------------- | -------------- | -------------- | -------- |
| **Supabase** | ★★★★☆ 1ヶ月     | ★★★★★ SQL 直結 | ★★★★★ 不要     | ★★★★☆ 低       | **採用** |
| PocketBase   | ★★★★☆ 3週間     | ★★★★★ SQLite   | ★★☆☆☆ VPS 必要 | ★★★★★ ほぼなし | 対抗     |
| Convex       | ★★★☆☆ 1ヶ月以上 | ★★☆☆☆ 独自     | ★★★★★ 不要     | ★★★★☆ 低       | 不採用   |
| Firebase     | ★★★☆☆ 1-2ヶ月   | ★★☆☆☆ NoSQL    | ★★★★★ 不要     | ★★☆☆☆ 高       | 却下     |

#### Supabase 学習で詰まりやすいポイント（事前注意）

1. **RLS** — Row Level Security のポリシー DSL。`auth.uid() = user_id` 系の決まり文句を覚えれば 80% 解決
2. **Realtime のフィルタ** — Postgres CDC の購読で関係カラム指定が必要
3. **Edge Functions** — Deno ベース、Node とは少し違う（必要時のみ）
4. **Database Migration** — `supabase migrate` CLI の使い方、本番への適用手順

→ 学習スパイクは廃止したので、Phase 1 で実装しながら詰まったら都度調査する。

### 7. プロジェクト構造

```
life-editor/
├── shared/                   # ← React コードの本体（電子・モバイル・ブラウザで共有）
│   ├── src/
│   │   ├── services/
│   │   │   ├── DataService.ts            # 抽象（既存から流用）
│   │   │   └── SupabaseDataService.ts    # 単一実装、全プラットフォーム共通
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── i18n/
│   └── package.json
│
├── desktop/                  # ← Electron 包装（薄く保つ）
│   ├── src/
│   │   ├── main/index.ts                 # BrowserWindow 起動、メニュー、IPC ハンドラ
│   │   ├── preload/index.ts              # contextBridge.exposeInMainWorld のみ
│   │   └── renderer/index.html           # shared/ の React を mount するだけ
│   ├── electron.vite.config.ts
│   ├── electron-builder.yml
│   └── package.json
│
├── mobile/                   # ← Capacitor 包装
│   ├── ios/                  # cap add ios 生成
│   ├── android/              # cap add android 生成
│   ├── capacitor.config.ts
│   └── package.json
│
├── web/                      # ← ブラウザ向け Vite ビルド
│   ├── vite.config.ts
│   └── package.json
│
└── supabase/
    └── migrations/
```

並立期間中の `frontend/` + `src-tauri/` は触らず維持。Phase 5 で削除（`cloud/` は 2026-06-28 に先行撤去済 — Supabase 直結で実行経路外の dead stack だったため）。

### 8. 配布・署名の現実（Mac App Store / Microsoft Store スコープ外）

「完成まで $0 厳守」原則により、**Phase 5 完了までは ✗ の手段を取らない**:

| OS               | 配布形態            | Phase 1-5 中                                  | 完成後の判断                                             |
| ---------------- | ------------------- | --------------------------------------------- | -------------------------------------------------------- |
| macOS            | .dmg 手渡し         | **未署名**（右クリック→開く で警告解除、$0）  | 加入したくなれば $99/年で警告解消                        |
| Windows          | NSIS .exe 手渡し    | **未署名**（SmartScreen "詳細情報→実行"、$0） | 加入したくなれば $80-500/年で署名証明書                  |
| Linux            | AppImage            | 不要                                          | —                                                        |
| **iOS 自分用**   | Xcode 直接 Run      | **無料 Apple ID + 7 日署名**（$0）            | —                                                        |
| **iOS 友達配布** | TestFlight / Ad Hoc | **やらない**                                  | **加入の判断はここ**。$99/年で TestFlight or Ad Hoc 配布 |
| Android 友達配布 | 未署名 .apk 手渡し  | **未署名**（"提供元不明アプリ許可"、$0）      | —                                                        |
| Web URL          | Cloudflare Pages    | $0                                            | —                                                        |

#### Phase 1-5 中の iOS 運用ポリシー

- 自分の iPhone のみ。**友達 iPhone への配布はやらない**
- Xcode 直接 Run で動作検証、または無料 Apple ID + Capacitor + 7 日署名再ビルド
- Apple Developer Program $99/年は **加入しない**
- 完成後、友達配布の需要があれば加入を検討

### 9. Non-goals(今回やらない)

- オフライン編集
- マルチテナント / 認証ありの公開配布スケール
- Tauri / Rust / portable-pty / Cloud D1 / `sync_engine.rs` の維持
- Database(汎用 DB)機能 — Postgres での動的テーブル生成は難度高、一旦凍結
- Mac App Store / Microsoft Store 申請
- Linux ARM ARM64 対応（x86_64 のみ）
- Service Worker / PWA インストール体験
- **学習用 Markdown ログの作成**（旧 `.claude/learning/web-first/` は廃止）
- **iOS 友達配布**（Phase 1-5 期間は自分用のみ）

---

## Phases

> 各 Phase に「学習ログを書く」「動作原理を Markdown で説明」のような完了基準は**設けない**。動けば次に進む。詰まったら都度 AI に質問・調査。

### Phase 1 — life-editor リポジトリでの新スタック土台構築

ゴール: `shared/` `desktop/` `mobile/` `web/` `supabase/` の 5 ディレクトリ構造を設置し、`frontend/` (Tauri) と並立させる（当時の作業ブランチ `refactor/web-first-v2` は merge 済み・廃止 — 現行のブランチ / worktree 運用は CLAUDE.md §7.4）。動かしながら必要技術を体得していく。

#### 着手順序

1. **web/ の最小起動**: `npm create vite@latest web -- --template react-ts` で雛形、`npm run dev` で localhost:5173 が立ち上がるところまで
2. **Tailwind 4 セットアップ**: `@tailwindcss/vite` plugin、`ink-*`（当時の仮称・現 `lumen-*`）トークンの一部をコピー
3. **Supabase 無料プロジェクト作成**: `supabase.com` で 1 個。credentials を `.env.local` に格納（コミットしない）
4. **最小スキーマ**: `supabase/migrations/0001_initial.sql` で `tasks` テーブル 1 個（id uuid / user_id uuid / title text / status text / created_at timestamptz）
5. **`@supabase/supabase-js` 接続**: web/ から CRUD 動作確認
6. **Supabase Auth (Email + Password)**: signUp / signIn / signOut フローを web/ に最小実装
7. **RLS ポリシー**: `auth.uid() = user_id` で自分のデータのみアクセス可能に
8. **shared/ 雛形**: `shared/src/services/DataService.ts` を `frontend/src/services/DataService.ts` からコピー
9. **`shared/src/services/SupabaseDataService.ts`**: tasks 用最小実装
10. **本格 Supabase スキーマ**: 既存 SQLite から Tasks / Schedule / Notes / Daily / WikiTags の Postgres スキーマを起こす
11. **データ移行スクリプト**: 既存 SQLite データを Supabase へ移す 1 回限りスクリプト（任意、Phase 2 序盤でも可）

#### 影響ファイル

| File                                         | Operation | Notes                                           |
| -------------------------------------------- | --------- | ----------------------------------------------- |
| `web/`                                       | 新規      | Vite + React + TS + Tailwind 雛形               |
| `shared/`                                    | 新規      | React 本体（最初は services/ のみ）             |
| `shared/src/services/DataService.ts`         | コピー    | frontend/ から interface のみ                   |
| `shared/src/services/SupabaseDataService.ts` | 新規      | Postgres 実装                                   |
| `supabase/migrations/0001_initial.sql`       | 新規      | tasks のみ                                      |
| `supabase/migrations/0002_full_schema.sql`   | 新規      | Tasks / Schedule / Notes / Daily / WikiTags     |
| `scripts/migrate-sqlite-to-supabase.ts`      | 任意      | データ移行（不要なら作らない）                  |
| `frontend/`, `src-tauri/`                    | 触らない  | 並立期間は維持（`cloud/` は 2026-06-28 撤去済） |

#### Phase 1 完了判定 — ✅ 全達成（2026-05-16）

- [x] `web/` で `npm run dev` が起動
- [x] Supabase に接続して signIn 可能
- [x] tasks テーブルに対する SupabaseDataService の CRUD が通る
- [x] RLS で他ユーザーのデータが見えないことを確認（probe 実証: 未認証 0 行 / USER A 自分の 1 行 / USER B は A の行 0 件・削除 0 件）
- [x] `frontend/`(Tauri)は壊れていない（role-qa 実測 `tsc -b`=0）

> 実装: commit `d1abd8a`(R1 スキャフォールド) + `ce6a5cb`(R2 Auth/RLS/CRUD)。0001/0002 は Supabase SQL Editor で適用（CLI 非対話の制約回避、Phase 5 で CLI 管理へ移行する申し送り）。RLS は `to authenticated` で式評価 + ロール層の二重防御。Phase 2 申し送り: ①新テーブル RLS 漏れの CI 機械検証 ②tsconfig project references 化 ③signOut scope 堅牢化

---

### Phase 2 — コア機能のフロントエンド移植

ゴール: 既存 `frontend/src/` の **Tauri 非依存コンポーネント** を `shared/src/` に移し、Tasks / Schedule / Notes / Daily / WikiTags が Supabase 上で動作。

#### 着手順序（小さい順）

1. **Tasks**: 最も成熟、TaskTree + DnD。Provider 経由で Supabase に寄せる
2. **Daily**: 単一テーブル、UPSERT 中心。Tasks の次に簡単
3. **Notes**: TipTap + 階層。中規模
4. **Schedule**: Routine + ScheduleItems + CalendarTags の 3 分割。最大
5. **WikiTags**: relation テーブル。Tag アサインの move

#### 移植単位

> ✅ 本節は Phase 2 完了（2026-06-05 / PR #43・#44 — Status 行参照）で消化済み。

- [x] `frontend/src/components/Tasks/` → `shared/src/components/Tasks/`
- [x] `frontend/src/components/Tasks/Schedule/` → `shared/src/components/Schedule/`
- [x] `frontend/src/components/Notes/` → `shared/src/components/Notes/`
- [x] `frontend/src/components/Daily/` → `shared/src/components/Daily/`
- [x] `frontend/src/components/WikiTags/` → `shared/src/components/WikiTags/`
- [x] `frontend/src/context/` → `shared/src/context/`（Tauri 依存除く）
- [x] `frontend/src/hooks/` → `shared/src/hooks/`
- [x] `frontend/src/types/` → `shared/src/types/`
- [x] `frontend/src/i18n/` → `shared/src/i18n/`（W0 で先行移植 — §0 追補参照）
- [x] Tauri 依存ファイル 4 個(TitleBar / Settings 3 個)の Web 版を新規実装 or 除外
- [x] **オフライン警告バナー** 実装（`navigator.onLine` 監視 + 全画面共通）
- [x] Mobile レスポンシブ確認(Chrome DevTools)（pass 1 = PR #49。残る目視 fix は design fan-out 実装レーンで消化 — s9 計画書は archive）

#### Phase 2 完了判定

- [x] Tasks / Schedule / Notes / Daily / WikiTags の CRUD が `web/` で動く
- [x] PC + Mobile の両方でレイアウトが崩れない（モバイル目視の残りは design fan-out 実装レーンへ）
- [x] Supabase Realtime 経由で他タブからの変更が反映される
- [x] オフライン時にバナーが表示される

#### Phase 2 ↔ Phase 3 間: Data Unification レーン（2026-05-21〜2026-05-24）

**目的**: 5 role を `items_meta + 5 payload + 7 専用/relation` の計 13 テーブルに統合し、WikiTag/Link を items_meta.id ベースの 5 role 共通グラフへ再定義。親計画書 [`archive/2026-05-21-data-unification-items-meta.md`](./archive/2026-05-21-data-unification-items-meta.md)（完了・archive 済）が SSOT。

**完了済 Phase**:

- DU-A (DB スキーマ) / DU-B (Tasks) / DU-C (Events+Routine) / DU-C+ (CalendarTag DROP + shared WikiTagUnified 層) / DU-D (Notes/Daily 2-row mapper + composite FK) / **DU-F (WikiTag/Link UI 4 role + wiki_tag_groups UI + CalendarTag 死削除)** ✅ 2026-05-24

**残作業**:

- DU-E (Calendar 2 ビュー) / **DU-G** (Notes/Daily Unified write path 完全切替 — DU-F で legacy 維持と判断、別計画分離)

**観測可能な成果** (DU-F 完了時点):

- 4 role (Task / Event / Note / Daily) すべてで Tag 付与・解除・Link 作成・backlink 表示が動作
- wiki_tag_groups CRUD UI (Tags セクション) 稼働
- CalendarTag 概念が DB / shared / web/ から完全消滅
- shared 170/170 vitest 緑 / RLS gate offender 0 / advisor lint 新規 WARN 0

---

### Phase 3 — Electron 包装（macOS で起動するまで）

ゴール: `shared/` を Electron で包んで macOS .app として起動できる状態に。Windows / Linux ビルドも CI でビルドが通ることを確認。

- [ ] `desktop/` 新規作成、electron-vite 雛形を投入
- [ ] `desktop/src/main/index.ts` で BrowserWindow 起動、メニュー、最小 IPC ハンドラ
- [ ] `desktop/src/preload/index.ts` で contextBridge expose（最大 10 関数まで）
- [ ] `desktop/src/renderer/` から `shared/` を import して mount
- [ ] `electron-builder.yml`: macOS / Windows / Linux 3 ターゲット
- [ ] macOS .dmg / Windows NSIS / Linux AppImage がビルドできる（**未署名**、$0）
- [ ] 起動 → ログイン → Tasks 操作の golden path 通過確認(macOS 実機)
- [ ] Windows / Linux は GitHub Actions のビルド成否のみ確認（友達 PC 配布は完成後）

#### Phase 3 完了判定

- [ ] macOS で .dmg を起動 → 全 Section 動作
- [ ] Windows / Linux は CI ビルドが green
- [ ] Supabase に Electron から接続可能

---

### Phase 4 — Capacitor 包装（iOS / Android シミュレータまで）

ゴール: `shared/` を Capacitor で包んで iOS / Android シミュレータで起動できる状態に。**実機配布は完成後**。

- [ ] `mobile/` 新規作成、Capacitor 8 install + `npx cap init`
- [ ] iOS プロジェクト生成 + **シミュレータ**起動確認
- [ ] iOS 実機検証は **無料 Apple ID + 7 日署名**（自分の端末のみ）
- [ ] Android プロジェクト生成 + Android Studio AVD 検証
- [ ] `capacitor.config.ts` 設定(bundle ID / app name / web dir)
- [ ] iOS スプラッシュ / アイコン整備
- [ ] Android safe-area inset 対応
- [ ] **Apple Sign-in は実装しない**（Email + Password で代用、完成後に追加）

#### Phase 4 完了判定

- [ ] iOS シミュレータで `mobile/` アプリ起動 + 操作可能
- [ ] Android AVD で同上
- [ ] iOS 実機（自分の iPhone のみ）で 7 日署名運用が回る
- [ ] Supabase に iOS / Android からも接続可能

---

### Phase 5 — 周辺機能整理 + terminal-division 連携 + 旧スタック削除（= 完成）

ゴール: 周辺機能の整理、terminal-division MCP 連携、Tauri / Cloud D1 完全削除、Cloudflare Pages デプロイ。**ここまで $0 で到達**。

#### 5-A: 周辺機能整理

- [ ] Audio Mixer: Web Audio API で動作確認(AudioContext は変更ほぼ無し)
- [ ] Timer / Pomodoro: Supabase 連携(timer_sessions テーブル)
- [ ] Settings: 不要項目(auto-launch / global shortcuts / tray)の Electron 版再実装
- [ ] **Electron Tray** 実装（最小機能: 表示/非表示、終了）
- [ ] **Electron 自動起動**（electron-auto-launch）
- [ ] **Electron グローバルショートカット**（globalShortcut API、最小限）
- [ ] FileExplorer: 削除(Web では用途なし、materials は Supabase Storage へ)
- [x] Database(汎用 DB): 一旦凍結、CLAUDE.md §8 に凍結注記済み（Phase 5-A 決定）
- [ ] Trash / UndoRedo: Supabase row レベルで実装

#### 5-B: terminal-division + 自動更新

> ⚠️ アプリ内 Terminal 機能は **2026-07-05 に退役決定**（MCP Server 自体は存続）。Claude Code の常設起動導線は生成デザイン確定後に再設計するため、本節のブリッジ項目と Phase 5 完了判定の該当 1 項は導線再設計後に再定義する。

- [ ] `mcp-server/` を Postgres 接続版に書き換え(better-sqlite3 → @supabase/supabase-js)
- [ ] terminal-division の Main process から life-editor MCP を起動するブリッジ追加
- [ ] **electron-updater + GitHub Releases** 設定（auto-update 動作確認、$0）
- [ ] **Web URL 公開**: Cloudflare Pages デプロイ（$0）

#### 5-C: 旧スタック削除 + ドキュメント整理

- [ ] `frontend/` を `archive/frontend-tauri/` に移動 or 削除
- [x] `src-tauri/` 削除（2026-07-11 前倒し実行 #197 Stage A — 復元保険 = git tag `pre-tauri-removal`。root package.json の tauri スクリプト / `@tauri-apps/cli` も同時撤去）
- [x] `cloud/`(Cloudflare Workers + D1)削除（2026-06-28 先行撤去 — dead stack）
- [ ] **CLAUDE.md 全面改訂**(アーキテクチャ章を新スタック前提に書き換え)
- [ ] **`docs/vision/core.md` 全面改訂**(Web UI 否定 / Desktop ネイティブのみ を反転、移行警告ヘッダ削除)
- [ ] **`docs/vision/db-conventions.md` を Postgres + RLS 版に書き換え**
- [ ] `docs/known-issues/` の Tauri 関連項目を archive
- [x] `.claude/2026-04-26-windows-android-port.md` は削除済み・逐語は git 履歴（本プランで完全に置換）
- [ ] README.md 更新

#### Phase 5 完了判定 = **完成**

- [ ] terminal-division から Life Editor MCP 経由で Tasks 操作可能（⚠️ Terminal 退役 2026-07-05 — 導線再設計後に再定義）
- [ ] electron-updater で auto-update が GitHub Releases から流れる
- [ ] Web URL が公開されている
- [ ] `frontend/` + `src-tauri/` + `cloud/` が依存に残っていない
- [ ] CLAUDE.md / vision / requirements が新スタック前提
- [ ] cargo / Rust / portable-pty への依存ゼロ
- [ ] Electron ビルド時間 < 3 分（macOS aarch64 ローカル）
- [ ] **ここまでの累計コスト = $0**

---

## 完成後の判断（Phase 5 完了以降）

このタイミングで初めて以下を検討する。それまでは手を付けない:

| 判断項目              | 条件                                            | コスト                         |
| --------------------- | ----------------------------------------------- | ------------------------------ |
| iOS 友達配布          | 友達から要望が出たら加入                        | Apple Developer Program $99/年 |
| Supabase Pro          | 無料枠（500MB DB / 月 5GB egress 等）を超えたら | $25/月                         |
| Windows コード署名    | 友達が SmartScreen 警告で困ったら               | $80-500/年                     |
| macOS 公証            | 友達が「壊れたアプリ」警告で困ったら            | Apple Developer Program $99/年 |
| Apple Sign-in         | iOS 友達配布開始時に同時実装                    | 上記 $99/年に含む              |
| Sentry / ログ吸い上げ | 友達からのバグ報告が増えてきたら                | 無料枠 → 必要に応じて $26/月   |

---

## ブランチ運用ルール

- **作業ブランチ**: **`main` に集約済み**（旧 `refactor/web-first-v2` は PR #3-9 で merge・廃止。現行のブランチ / worktree 運用は CLAUDE.md §7.4 が正本）
- **子ブランチ**: 各 Phase の細分作業は短命の子ブランチ(例: `phase-1/web-skeleton`, `phase-1/supabase-tasks`, `phase-3/electron-skeleton`)
- **main 直接 push 禁止**: pre-push hook + `git config branch.main.pushRemote=no_push` で物理的にブロック
- **task-tracker は per-chat ファイル（`memory/chat-<self>.md` + `history/chat-<self>.md`）を作業ブランチで更新**（CLAUDE.md §9 が正本）: main に直接 commit しない

---

## 移行タイムライン目安

旧プランの「Phase 0 学習スパイク 2.5 週」を削除したため、累計目安は **0.5-1 ヶ月短縮**。ただし「やりながら学ぶ」方式は詰まりどころで時間が伸びうるので、上振れ可能性も同程度。

| Phase                                  | 期間目安 | 累計    |
| -------------------------------------- | -------- | ------- |
| 1. 新スタック土台                      | 2-3 週   | 2-3 週  |
| 2. コア機能移植                        | 3-4 週   | 5-7 週  |
| 3. Electron 包装(macOS)                | 1-2 週   | 6-9 週  |
| 4. Capacitor 包装(シミュレータ)        | 1-2 週   | 7-11 週 |
| 5. 周辺機能 + terminal-division + 整理 | 2-3 週   | 9-14 週 |

合計 **2.5-3.5 ヶ月** を目安に進める。週次のペースは無理せず、毎日少しずつでよい。

---

## Risks & Mitigations

### Risk 1 (重大): Electron 経験が浅い → AI 任せで構造が崩壊

- **影響**: main / preload / renderer の責務分離が壊れて IPC が混乱、業務ロジックが Electron 側に染み出す
- **回避**:
  - `desktop/preload/index.ts` の expose 関数 10 個以下ルールを厳守
  - 業務ロジックは絶対に `desktop/` に書かない（`shared/` のみ）
  - electron-vite テンプレートから外れる構成を AI が提案したら即拒否
  - 学習スパイク廃止の代償として、Phase 3 着手前に terminal-division のコードを 1 度通読しておく

### Risk 2 (高): RLS で詰まる

- **影響**: Phase 1 後半で詰まると先に進めない
- **回避**: 詰まったら Supabase Discord / 公式 Examples / `auth.uid() = user_id` 系のテンプレートに頼る。最悪 RLS を一時的に無効化して先に画面を動かし、後で締める

### Risk 3 (中): Capacitor で iOS native 機能が必要になる

- **影響**: 通知 / バックグラウンド / 共有シート等で Capacitor プラグイン不足
- **回避**: 初期は通知のみに絞る。他機能は完成後に別 Plan で起票

### Risk 4 (中): Electron バンドルサイズで友達配布拒絶

- **影響**: 200MB 超で「重すぎ」と敬遠される
- **回避**: 完成後の友達配布時に判断。Linux AppImage は他より小さいので Linux ユーザー優先案内

### Risk 5 (低): Supabase 無料枠 7 日 pause

- **影響**: 旅行等で 7 日触らないと止まる
- **回避**: 毎日触る前提なので問題小。長期不在前は手動で wake-up。**完成後** に頻度を見て Pro 切替検討

### Risk 6 (新規・低): 「やりながら学ぶ」で根本理解が薄くなる

- **影響**: AI 提案を理解せずコピペすると、後から致命的なバグの原因解明ができなくなる
- **回避**: 動かなくなったら必ず「なぜ動かないか」を自分で説明できるところまで掘る。説明できなければ AI に聞くが、聞いた内容は実装に反映するだけで Markdown には残さない（記録は git diff と HISTORY.md で十分）

---

## 関連リサーチログ

- **2026-04-29 (旧 Web First プラン時)**:
  - 技術スタック比較(deep-web-research): Capacitor 8 を本命、Expo Universal を次点、Tauri 維持は不採用
  - BaaS 比較(deep-web-research): Supabase を本命($25/月で N=1 + 友達数人を完全カバー)、PocketBase を次点、Firebase は予期せぬ高額請求リスクで除外
  - 既存資産流用調査(Explore agent): Tauri 依存はわずか 4 ファイル、DataService 抽象化はそのまま使える、流用率 65-70%
  - Apple Developer Program 実態: 年額 $99、未更新で取り下げ、再加入で復活、無料署名は週次再署名運用も可能

- **2026-05-04 (本プラン初版)**:
  - ユーザー要件再確認: Desktop 主 / Mobile 従 / Web 公開は OK / オフライン不要 / 友達配布したい / Mac & MS Store スコープ外
  - Electron 採用判断: 作者 Electron 経験あり(terminal-division)、Rust 学習回避優先、デメリット(バンドル大 / メモリ大 / 起動遅)を受容
  - データ層 4 候補比較: Supabase / PocketBase / Convex / Firebase で Supabase 確定（学習コスト中、運用負荷ゼロ、SQL 直結が決め手）
  - Electron スタック確定: electron-vite + electron-builder + electron-updater + electron-store(AI 友好な well-trodden 構成)

- **2026-05-14 (本改訂)**:
  - 学習スパイク廃止: 別ディレクトリでの素振りは続かない、実物に手応えがないと継続不能
  - 学習ログ廃止: Day ごと Markdown は執筆コスト過大、書かないまま手だけ動く失敗パターン回避
  - コスト境界明確化: Phase 5 完了 = 完成と定義、それまで $0 厳守、Apple Developer Program は完成後判断
