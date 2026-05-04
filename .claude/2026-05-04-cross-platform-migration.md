---
Status: ACTIVE — Phase 0 開始前
Created: 2026-05-04
Task: クロスプラットフォーム移行 — Tauri / Cloudflare 構成 → Vite + React + TS + Supabase + Electron + Capacitor
Project path: /Users/newlife/dev/apps/life-editor
Branch: refactor/web-first-v2
Supersedes:
  - [.claude/archive/2026-04-29-web-first-migration.md](./archive/2026-04-29-web-first-migration.md) — Web First 単体構成（Electron 不採用）から本プランへ統合
Related:
  - [CLAUDE.md](./CLAUDE.md) — 移行完了後に全面改訂(Tauri / SQLite / Cloud D1 / Cloud Sync 章を削除)
  - [docs/vision/core.md](./docs/vision/core.md) — Vision の "Web UI 否定" / "Desktop ネイティブのみ" を反転
  - [.claude/archive/2026-04-29-claude-desktop-style-chat-ui.md](./archive/2026-04-29-claude-desktop-style-chat-ui.md) — 旧 Vision 前提のため archive 済
  - [.claude/2026-04-26-windows-android-port.md](./2026-04-26-windows-android-port.md) — Tauri ベースの Windows/Android 配布計画。本プランで完全に置換される
---

# Plan: クロスプラットフォーム移行（Electron / Capacitor / Web）

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

| 領域             | 決定                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| プラットフォーム | Web (PC ブラウザ) / Electron Desktop (macOS / Windows / Linux) / iOS Capacitor / Android Capacitor                     |
| 認証             | Supabase Auth (Email + Apple Sign-in)。Apple Developer Program は iOS 友達配布期間のみ加入($99/年)                     |
| コスト           | 当面 Supabase 無料枠で開始(7 日無アクセスで pause、毎日触る前提なので問題なし)、超過時 Pro $25/月                      |
| オフライン       | **常時オンライン前提**。機内モード/圏外では「オンライン時にご利用ください」グローバルバナー表示。Service Worker 不採用 |
| AI 連携          | stdio MCP Server を terminal-division から起動(Remote MCP は採用しない)                                                |
| 既存資産         | 現状 React / TS コードの **65-70%** を流用。DataService 抽象化はそのまま維持                                           |

### 4. Electron 採用の判断と明示的デメリット

#### 採用理由

- Rust 学習・維持コスト ゼロ → 移行の主動機が達成される
- 作者は terminal-division で Electron 経験あり（main/preload/renderer 構造、IPC、electron-builder までは AI 任せだが感覚は持っている）
- JS/TS 単一言語で全レイヤ書ける、IPC も TS 型で書ける
- エコシステム最大（electron-builder / electron-updater / electron-store 等が枯れている）
- デバッグ容易（Chrome DevTools そのまま使える）

#### 明示的デメリット（受容することを承知）

| 項目               | Electron                                                 | 影響                                                     |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| インストーラサイズ | 80-200MB                                                 | 友達配布で「インストーラデカいけど大丈夫？」と聞かれがち |
| メモリ消費 (idle)  | 200-400MB                                                | low-end PC で他アプリと併用するとキツい                  |
| 起動時間           | 1-3秒                                                    | 体感的に重い                                             |
| 自動更新差分DL     | 毎回 80-200MB                                            | 友達回線が貧弱だと痛い                                   |
| バッテリー消費     | Chromium ベース                                          | ノート PC でファン回りやすい                             |
| セキュリティ更新   | 3-4ヶ月毎の Electron 更新必須                            | Chromium CVE 追従義務                                    |
| Native ABI 互換    | メジャー更新で `node-pty` 等 Native 依存が壊れることあり | 影響時は再ビルド必要                                     |

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

### 8. 配布・署名の現実（Mac App Store / Microsoft Store スコープ外）

| OS               | 配布形態           | 署名要否                         | 友達側の手間                        | 必須コスト                                         |
| ---------------- | ------------------ | -------------------------------- | ----------------------------------- | -------------------------------------------------- |
| macOS            | .dmg 手渡し        | 任意                             | 未署名: 右クリック→開く で警告解除  | **$0**（警告許容）/ $99/年（警告解消するなら）     |
| Windows          | NSIS .exe 手渡し   | 任意                             | 未署名: SmartScreen "詳細情報→実行" | **$0**（許容）/ $80-500/年（コード署名証明書）     |
| Linux            | AppImage           | 不要                             | 実行権限付与のみ                    | $0                                                 |
| **iOS 友達配布** | **要 TestFlight**  | **Apple Developer Program 必須** | TestFlight アプリ経由でインストール | **$99/年**（友達 100 人まで OK、配布期間のみ加入） |
| Android 友達配布 | 未署名 .apk 手渡し | 不要                             | "提供元不明アプリ許可"              | $0                                                 |
| Web URL          | Cloudflare Pages   | 不要                             | URL 開くだけ                        | $0                                                 |

#### iOS の重要警告

既存 Memory `project_ios_devicectl_provisioning_noise.md` 等にある「無料 Apple ID + 週次再署名」運用は **作者本人デバイス専用**。**友達 iPhone への配布には Apple Developer Program $99/年が事実上必須**（TestFlight or Ad Hoc Distribution）。Mac App Store / Microsoft Store はスコープ外。

### 9. Non-goals(今回やらない)

- オフライン編集
- マルチテナント / 認証ありの公開配布スケール
- Tauri / Rust / portable-pty / Cloud D1 / `sync_engine.rs` の維持
- Database(汎用 DB)機能 — Postgres での動的テーブル生成は難度高、一旦凍結
- Mac App Store / Microsoft Store 申請
- Linux ARM ARM64 対応（x86_64 のみ）
- Service Worker / PWA インストール体験

---

## Phases

### Phase 0 — 環境構築 + 学習(2.5 週間目安)

ゴール: Vite + React + TS + Supabase + Electron + Capacitor の素プロジェクトを最小構成で動かし、各レイヤの動作原理を体得する。**life-editor リポジトリは触らず、別ディレクトリ `~/dev/learning/web-first-spike-N/` で実施**。

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

#### Day 6-8: Supabase Auth(Email + Magic Link) + RLS

- [ ] Email + Password で signUp / signIn / signOut フロー実装
- [ ] Magic Link を試す(メール内リンクで認証)
- [ ] RLS ポリシー: `auth.uid() = user_id` で自分のデータのみアクセス可能に
- [ ] **RLS が分からなくなったらこの Day 6-8 を 1 日伸ばしてもよい**
- [ ] Apple Sign-in は Phase 1 で対応(Phase 0 では skip 可)

#### Day 9-11: Supabase Realtime

- [ ] Postgres CDC を有効化、`tasks` テーブルの変更を購読
- [ ] 別タブで変更 → リアルタイム反映を確認
- [ ] React Query との組み合わせを試す(`invalidateQueries` パターン)

#### Day 12-15: Electron 基礎(4日) ← 新設

- [ ] **Day 12**: electron-vite で雛形作成、`main / preload / renderer` の役割を Markdown で書く
- [ ] **Day 13**: contextBridge IPC で Hello World、型安全 invoke パターン体得
- [ ] **Day 14**: electron-builder で .dmg / .exe / AppImage ビルド成功させる
- [ ] **Day 15**: electron-updater + GitHub Releases で自動更新を素振り
- [ ] 各日の学習ログに **「main/preload/renderer の役割を自分の言葉で説明できる状態」** を完了基準として記載

#### Day 16-18: Capacitor で iOS / Android シミュレータ起動(3日)

- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init` で設定生成
- [ ] iOS: `npx cap add ios` → Xcode で起動(Apple Developer Program 不要、無料署名で動く)
- [ ] Android: `npx cap add android` → Android Studio の AVD で起動
- [ ] Web ビルドした /dist を Capacitor が iOS / Android に運ぶ仕組みを理解

#### Phase 0 完了判定

- [ ] Vite + React + TS で TODO アプリが動く
- [ ] Supabase Postgres の CRUD + RLS が動く
- [ ] Supabase Auth でログインできる
- [ ] Supabase Realtime で他タブ変更が反映される
- [ ] Electron で .dmg / .exe / AppImage が出せる
- [ ] electron-updater の自動更新フローが手元で動く
- [ ] iOS / Android シミュレータで Capacitor アプリが起動する
- [ ] 各日の学習ログを `.claude/learning/web-first/` に蓄積

---

### Phase 1 — life-editor リポジトリでの新スタック土台構築(2-3 週間)

ゴール: `refactor/web-first-v2` ブランチ上に `shared/` `desktop/` `mobile/` `web/` `supabase/` の 4 ディレクトリ構造を設置。`frontend/` (Tauri) と並立させる。

- [ ] `shared/` 新規作成(React + TS + Tailwind コードの本体)
- [ ] `web/` 新規作成(Vite ビルド設定)
- [ ] 本番用 Supabase プロジェクト作成 + 認証設定
- [ ] 既存 SQLite スキーマから Postgres スキーマを自動生成するスクリプト
- [ ] `supabase/migrations/0001_initial.sql` 作成 — Tasks / Schedule / Notes / Daily / WikiTags テーブル
- [ ] `shared/src/services/DataService.ts` を `frontend/src/services/DataService.ts` からコピー
- [ ] `shared/src/services/SupabaseDataService.ts` 実装(DataService interface に対応)
- [ ] 既存 SQLite データを Supabase へ移行する 1 回限りスクリプト
- [ ] Apple Sign-in 設定(Apple Developer 加入後)

#### 影響ファイル

| File                                         | Operation | Notes                                  |
| -------------------------------------------- | --------- | -------------------------------------- |
| `shared/`                                    | 新規      | React + TS + Tailwind 本体             |
| `web/`                                       | 新規      | Vite ビルド設定                        |
| `shared/src/services/DataService.ts`         | コピー    | frontend/ から interface のみコピー    |
| `shared/src/services/SupabaseDataService.ts` | 新規      | DataService interface の Supabase 実装 |
| `supabase/migrations/0001_initial.sql`       | 新規      | 初期 Postgres スキーマ                 |
| `scripts/migrate-sqlite-to-supabase.ts`      | 新規      | データ移行スクリプト                   |
| `frontend/`, `src-tauri/`, `cloud/`          | 触らない  | 並立期間中は維持                       |

#### Phase 1 完了判定

- [ ] `web/` で `npm run dev` が起動
- [ ] Supabase に接続できる
- [ ] Tasks テーブルに対する SupabaseDataService の CRUD が通る
- [ ] 既存 SQLite データが Supabase に移行されている
- [ ] `frontend/`(Tauri)は壊れていない

---

### Phase 2 — コア機能のフロントエンド移植(3-4 週間)

ゴール: 既存 `frontend/src/` の **Tauri 非依存コンポーネント** を `shared/src/` に移し、Tasks / Schedule / Notes / Daily / WikiTags が Supabase 上で動作。

- [ ] `frontend/src/components/Tasks/` → `shared/src/components/Tasks/`
- [ ] `frontend/src/components/Tasks/Schedule/` → `shared/src/components/Schedule/`
- [ ] `frontend/src/components/Notes/` → `shared/src/components/Notes/`
- [ ] `frontend/src/components/Daily/` → `shared/src/components/Daily/`
- [ ] `frontend/src/components/WikiTags/` → `shared/src/components/WikiTags/`
- [ ] `frontend/src/context/` → `shared/src/context/`(Tauri 依存除く)
- [ ] `frontend/src/hooks/` → `shared/src/hooks/`
- [ ] `frontend/src/types/` → `shared/src/types/`
- [ ] `frontend/src/i18n/` → `shared/src/i18n/`
- [ ] Tauri 依存ファイル 4 個(TitleBar / Settings 3 個)の Web 版を新規実装 or 除外
- [ ] **オフライン警告バナー**実装（`navigator.onLine` 監視 + 全画面共通）
- [ ] Mobile レスポンシブ確認(Chrome DevTools)

#### Phase 2 完了判定

- [ ] Tasks / Schedule / Notes / Daily / WikiTags の CRUD が `web/` で動く
- [ ] PC + Mobile の両方でレイアウトが崩れない
- [ ] Supabase Realtime 経由で他デバイスからの変更が反映される
- [ ] オフライン時にバナーが表示される

---

### Phase 3 — デスクトップ・モバイル包装(Electron + Capacitor 並行)(2-3 週間)

ゴール: `shared/` を Electron Desktop / Capacitor iOS / Capacitor Android として起動できる状態に。

#### 3-A: Electron 包装

- [ ] `desktop/` 新規作成、electron-vite 雛形を投入
- [ ] `desktop/src/main/index.ts` で BrowserWindow 起動、メニュー、最小 IPC ハンドラ
- [ ] `desktop/src/preload/index.ts` で contextBridge expose（最大 10 関数まで）
- [ ] `desktop/src/renderer/` から `shared/` を import して mount
- [ ] electron-builder.yml: macOS / Windows / Linux 3 ターゲット
- [ ] macOS .dmg / Windows NSIS / Linux AppImage がビルドできる
- [ ] 起動 → ログイン → Tasks 操作の golden path 通過確認(macOS実機)

#### 3-B: Capacitor 包装

- [ ] `mobile/` 新規作成、Capacitor 8 install + `npx cap init`
- [ ] iOS プロジェクト生成 + Xcode 無料署名で実機検証
- [ ] Android プロジェクト生成 + Android Studio AVD 検証
- [ ] `capacitor.config.ts` 設定(bundle ID / app name / web dir)
- [ ] Apple Sign-in プラグイン(`@capacitor-community/apple-sign-in`)統合
- [ ] iOS スプラッシュ / アイコン整備
- [ ] Android safe-area inset 対応

#### Phase 3 完了判定

- [ ] macOS で .dmg を起動 → 全 Section 動作
- [ ] Windows で .exe を起動（CI ビルド + 友達 PC 検証）
- [ ] Linux で AppImage を起動（友達 / VM 環境検証）
- [ ] iOS シミュレータで `mobile/` アプリ起動 + 操作可能
- [ ] Android AVD で同上
- [ ] Supabase に Electron / iOS / Android からも接続可能
- [ ] Apple Sign-in が iOS で動作

---

### Phase 4 — 周辺機能の整理(1-2 週間)

ゴール: Audio / Timer / Settings / Tray / 自動起動 を整理、不要機能を削除。

- [ ] Audio Mixer: Web Audio API で動作確認(AudioContext は変更ほぼ無し)
- [ ] Timer / Pomodoro: Supabase 連携(timer_sessions テーブル)
- [ ] Settings: 不要項目(auto-launch / global shortcuts / tray)の Electron 版再実装
- [ ] **Electron Tray** 実装（最小機能: 表示/非表示、終了）
- [ ] **Electron 自動起動**（electron-auto-launch）
- [ ] **Electron グローバルショートカット**（globalShortcut API、最小限）
- [ ] FileExplorer: 削除(Web では用途なし、materials は Supabase Storage へ)
- [ ] Database(汎用 DB): 一旦凍結、CLAUDE.md §8 から外す
- [ ] Trash / UndoRedo: Supabase row レベルで実装

#### Phase 4 完了判定

- [ ] 既存 Tier 2 機能が概ね動作(削除した機能を除く)
- [ ] Electron Tray / 自動起動 / グローバルショートカットが動く
- [ ] CLAUDE.md §8 Feature Tier Map 更新

---

### Phase 5 — terminal-division 連携 + 自動更新 + 最終整理(2-3 週間)

ゴール: terminal-division から Life Editor の MCP を stdio で叩ける状態に。Tauri / Rust / Cloud D1 を完全削除。

- [ ] `mcp-server/` を Postgres 接続版に書き換え(better-sqlite3 → @supabase/supabase-js)
- [ ] terminal-division の Main process から life-editor MCP を起動するブリッジ追加
- [ ] **electron-updater + GitHub Releases** 設定（auto-update 動作確認）
- [ ] Web URL 公開設定（Cloudflare Pages デプロイ）
- [ ] `frontend/` を `archive/frontend-tauri/` に移動 or 削除
- [ ] `src-tauri/` 削除
- [ ] `cloud/`(Cloudflare Workers + D1)削除
- [ ] CLAUDE.md 全面改訂(アーキテクチャ章を新スタック前提に書き換え)
- [ ] `docs/vision/core.md` の Web UI 否定 / Desktop ネイティブのみ を反転
- [ ] `docs/known-issues/` の Tauri 関連項目を archive
- [ ] `.claude/2026-04-26-windows-android-port.md` を archive（本プランで完全に置換）
- [ ] README.md 更新

#### Phase 5 完了判定

- [ ] terminal-division から Life Editor MCP 経由で Tasks 操作可能
- [ ] electron-updater で auto-update が GitHub Releases から流れる
- [ ] Web URL が公開されている（friends にも URL で渡せる）
- [ ] `frontend/` + `src-tauri/` + `cloud/` が依存に残っていない
- [ ] CLAUDE.md / vision / requirements が新スタック前提
- [ ] cargo / Rust / portable-pty への依存ゼロ
- [ ] Electron ビルド時間 < 3 分（macOS aarch64 ローカル）

---

## ブランチ運用ルール

- **作業ブランチ**: `refactor/web-first-v2`(本ブランチ)
- **子ブランチ**: 各 Phase の細分作業は短命の子ブランチ(例: `phase-0/setup`, `phase-1/data-service-supabase`, `phase-3/electron-skeleton`)
- **main 直接 push 禁止**: pre-push hook + `git config branch.main.pushRemote=no_push` で物理的にブロック
- **task-tracker(MEMORY.md / HISTORY.md)は本ブランチで更新**: main に直接 commit しない

---

## 移行タイムライン目安

| Phase                                  | 期間   | 累計         |
| -------------------------------------- | ------ | ------------ |
| 0. 環境構築 + 学習                     | 2.5 週 | 2.5 週       |
| 1. 新スタック土台                      | 2-3 週 | 4.5-5.5 週   |
| 2. コア機能移植                        | 3-4 週 | 7.5-9.5 週   |
| 3. Electron + Capacitor 包装(並行)     | 2-3 週 | 9.5-12.5 週  |
| 4. 周辺機能整理 + Tray/自動起動        | 1-2 週 | 10.5-14.5 週 |
| 5. terminal-division + 自動更新 + 整理 | 2-3 週 | 12.5-17.5 週 |

合計 **3-4.5 ヶ月** を目安に進める（旧 Web First プランより +1.5 週間）。

---

## Risks & Mitigations

### Risk 1 (重大): Electron 経験が浅い → AI 任せで構造が崩壊

- **影響**: main / preload / renderer の責務分離が壊れて IPC が混乱、業務ロジックが Electron 側に染み出す
- **回避**:
  - Phase 0 Day 12-15 の 4 日学習で「自分の言葉で役割を説明できる」ことを完了基準とする
  - `desktop/preload/index.ts` の expose 関数 10 個以下ルールを厳守
  - 業務ロジックは絶対に `desktop/` に書かない（`shared/` のみ）
  - electron-vite テンプレートから外れる構成を AI が提案したら即拒否

### Risk 2 (高): RLS 学習で詰まる

- **影響**: Phase 0 Day 6-8 で詰まると Phase 1 以降が全停止
- **回避**: Day 6-8 を最大 +1 日伸ばす許容を最初から計画。詰まったら Supabase Discord / 公式 Examples を参照

### Risk 3 (中): Capacitor で iOS native 機能が必要になる

- **影響**: 通知 / バックグラウンド / 共有シート等で Capacitor プラグイン不足
- **回避**: 初期は通知のみに絞る。他機能は将来 Plan で起票

### Risk 4 (中): Electron バンドルサイズで友達配布拒絶

- **影響**: 200MB 超で「重すぎ」と敬遠される
- **回避**: Linux AppImage が他より小さいので Linux ユーザーには優先案内。macOS / Windows は受容

### Risk 5 (低): iOS Apple Developer Program $99/年が負担

- **影響**: 友達 iOS 配布が事実上できない
- **回避**: 配布期間のみ加入する運用（ios-everywhere-sync.md 既出）。常時加入はしない

### Risk 6 (低): Supabase 無料枠 7 日 pause

- **影響**: 旅行等で 7 日触らないと止まる
- **回避**: 毎日触る前提なので問題小。長期不在前は手動で wake-up

---

## 関連リサーチログ

- **2026-04-29 (旧 Web First プラン時)**:
  - 技術スタック比較(deep-web-research): Capacitor 8 を本命、Expo Universal を次点、Tauri 維持は不採用
  - BaaS 比較(deep-web-research): Supabase を本命($25/月で N=1 + 友達数人を完全カバー)、PocketBase を次点、Firebase は予期せぬ高額請求リスクで除外
  - 既存資産流用調査(Explore agent): Tauri 依存はわずか 4 ファイル、DataService 抽象化はそのまま使える、流用率 65-70%
  - Apple Developer Program 実態: 年額 $99、未更新で取り下げ、再加入で復活、無料署名は週次再署名運用も可能

- **2026-05-04 (本プラン)**:
  - ユーザー要件再確認: Desktop 主 / Mobile 従 / Web 公開は OK / オフライン不要 / 友達配布したい / Mac & MS Store スコープ外
  - Electron 採用判断: 作者 Electron 経験あり(terminal-division)、Rust 学習回避優先、デメリット(バンドル大 / メモリ大 / 起動遅)を受容
  - データ層 4 候補比較: Supabase / PocketBase / Convex / Firebase で Supabase 確定（学習コスト中、運用負荷ゼロ、SQL 直結が決め手）
  - Electron スタック確定: electron-vite + electron-builder + electron-updater + electron-store(AI 友好な well-trodden 構成)
