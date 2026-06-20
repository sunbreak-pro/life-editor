# ai-context.md — 新セッション用 1枚リファレンス

> **使い方**: 新しい Claude セッションを始めるとき、まずこの1枚だけ読ませる。長い会話履歴を引き継がない。
> このファイルは「今どこが生きていて、どこが死んでいるか」を確定させるための生死マップ。古い `.claude/` ドキュメント（138枚）の渋滞に巻き込まれず、ここから再スタートするためのもの。
> **鮮度**: 2026-06-20 時点。コード構造が変わったら同じ PR でここも直す。1ページに収める（増やさない）。

---

## 1. 最新ゴール（今どこにいるか）

- **何を作っているか**: AI と会話しながら生活を設計・記録・運用するパーソナル OS。ユーザーは作者本人のみ（N=1 / macOS + iOS）。
- **進行中の移行**: 旧 Tauri 2 + Cloudflare D1 → **Web (Vite) + Supabase、Electron/Capacitor で包む** 構成へ移行中。
- **現在地**: Phase 2（コア機能の web/shared 移植）完了。Data Unification レーン進行中。**Phase 3（Electron 包装）未着手**。
- **SSOT**: 移行の詳細は [`.claude/2026-05-04-cross-platform-migration.md`](./.claude/2026-05-04-cross-platform-migration.md)。設計不変式は [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)。
- **方針**: 完成まで $0 厳守 / 学習ログは書かない。

---

## 2. 生死マップ（最重要 — これを間違えると全部ずれる）

引っ越しの途中で、新居（`shared/`）と旧居（`frontend/`）の両方に同じ食器が散らばっている状態。**触っていいのは新居だけ。**

### 生きている（触る・読む）

| パス | 役割 | 規模 |
| --- | --- | --- |
| `shared/src/` | **React コードの本体**。`@life-editor/shared` として全プラットフォーム共通 | 211 ファイル / 約 29,600 行 |
| `web/src/` | ブラウザ向け Vite renderer（画面層。本体は shared を import） | 約 45 ファイル |
| `desktop/src/` | Electron 薄ラッパー（`main/index.ts` + `preload/index.ts` のみ） | 2 ファイル |
| `mobile/` | Capacitor 薄ラッパー（ios/android ネイティブ + capacitor.config.ts） | 設定のみ |
| `supabase/` | Postgres マイグレーション（DB の正本） | — |
| `mcp-server/` | MCP サーバー（Phase 5 で Postgres 版へ書き換え予定。現状は旧 SQLite 版） | — |

### 凍結（実行には使わない。が、まだ消せない）

| パス | 何だったか | 状態 |
| --- | --- | --- |
| `frontend/` | 旧 Tauri モノリス（670 ファイル / 約 93,700 行） | **FROZEN だが削除不可**。実行されない（生きたシェルからの import = 0）が、(1) 未移植 UI の**移植参照元**として生存（frontend 固有ファイル 529 個・Terminal/Materials/Database 等まだ未移植）、(2) **CI が今も build している**、(3) DB マイグレーション/web が「列定義の正本」として参照。**Phase 5 まで維持**（SSOT 準拠） |
| `src-tauri/` | 旧 Rust バックエンド | 完全死亡。ただし CI（下記）がまだ build に使う |
| `cloud/` | 旧 Cloudflare Workers + D1 | 完全死亡（Supabase へ移行） |
| ルート `package.json` の scripts | `cargo tauri dev` 等 | Tauri 時代の遺物。**使わない** |
| `.github/workflows/build.yml` | リリース CI | **まだ Tauri を build**（`cd frontend && npm ci` → src-tauri → dmg/exe）。生きている web/shared/electron 用 CI は**未整備**。Phase 5 で要差し替え |

> **削除しない理由（2026-06-20 実測）**: frontend は「死んだ重複」ではなく「凍結中の移植参照元」。529 個の未移植ファイルを抱え、CI・DB スキーマ・web コメントから参照されている。今削除すると移植作業と CI が壊れる。SSOT の「Phase 5 まで維持」は正しい。**削除は Phase 5 まで保留。** 代わりに検索ノイズだけ `.ignore` で抑制（§3 末尾）。

### 実証した根拠

- `from '.../frontend/...'` のクロスツリー import は `web/desktop/mobile/shared` のどこにも**存在しない**（0 件）。
- `web/` は 31 ファイルで `@life-editor/shared` を import。`web/vite.config.ts` が `../shared/src/index.ts` をエイリアスで直読み。
- `web/tsconfig.json` は `../shared` を project reference に持つ。

---

## 3. 重複棚卸し（ブラックボックス化の主犯）

**`frontend/src` と `shared/src` で同名ファイルが 117 個重複している。** リポジトリを検索すると、ほとんどのファイルが「生（shared）」と「死（frontend）」の2件ヒットする。これが「どっちが本物か毎回迷う」原因。

| ファイル | 生（使う） | 死（無視） |
| --- | --- | --- |
| `DataService.ts` | `shared/src/services/` 844 行 | `frontend/src/services/` 803 行 |
| `analyticsAggregation.ts` | `shared/src/utils/` 899 行 | `frontend/src/utils/` 879 行 |
| …他 114 ファイル | `shared/src/**` | `frontend/src/**` |

**鉄則**: 同名ファイルが2つ出たら、必ず `shared/src` 側を採用する。`frontend/src` 側はもう動いていない。

> **検索ノイズ抑制（2026-06-20 導入）**: リポジトリ直下の `.ignore`（ripgrep 用。`.gitignore` ではないので git/ビルドに影響なし）で `frontend/` `src-tauri/` `cloud/` を**既定検索から除外**。これで 117 重複ヒットが消える。移植参照で死ツリーを検索したいときは `rg --no-ignore <pattern>` か `rg <pattern> frontend/`（パス明示）。

### 単一で巨大なファイル（重複ではないが将来の分割候補）

| ファイル | 行数 | メモ |
| --- | --- | --- |
| `shared/src/services/SupabaseDataService.ts` | **2,327** | 最大の単一ブラックボックス。重複なし（生で1本）。分割するならテストを張ってから |

---

## 4. フォルダ構造（生きている側だけ）

```
life-editor/
├── shared/src/          # ★本体
│   ├── services/        # DataService(抽象) + SupabaseDataService(実装) + *Mapper
│   ├── components/      # 共通部品 + 画面（2層モデルの部品層）
│   ├── context/         # Provider 群（Pattern A: Context + Value 分離）
│   ├── hooks/           # use*API / use*Context
│   ├── types/           # ドメイン型（taskTree / note / schedule / routine ...）
│   ├── i18n/            # en/ja カタログ（i18next）
│   └── index.ts         # ★公開 API のバレル（shared の入口はここ）
├── web/src/             # ブラウザ画面層（*Screen.tsx が各 Section）
├── desktop/src/         # Electron main + preload（薄く保つ）
├── mobile/              # Capacitor（ios/android）
└── supabase/migrations/ # DB スキーマの正本
```

---

## 5. 主要データ構造（変わらない不変式）

- **DataService 境界（不変式）**: フロントは `getDataService()` 経由でのみデータアクセス。コンポーネントから直接バックエンド呼び出し（`invoke()` 等）禁止。`shared/src/index.ts` から `getDataService` を import する。
- **items_meta + 5 role**: 5 つの role（`task` / `event` / `routine` / `note` / `daily`）は `items_meta(id, role)` が SSOT。各 payload テーブルは `(id, role)` 複合 FK で参照する 2 行分割モデル。
- **Sync (LWW)**: `items_meta.updated_at` を Last-Write-Wins カーソルにする。`<role>_payload` は `updated_at` を持たない。
- **ID 不変式**: TaskNode = `<type>-<timestamp+counter>` / DailyNode = `daily-<YYYY-MM-DD>` / その他 = `generateId(prefix)`。全て String。role を跨いで一意。
- **ソフトデリート**: `is_deleted` + `deleted_at` → TrashView 復元。
- **WikiTag / Link**: role 区別なしで `items_meta.id` を参照する共通グラフ。

---

## 6. 開発の起点（生きているコマンドだけ）

> ⚠️ `.claude/CLAUDE.md` §7.1 の開発コマンドは `cd frontend && ...`（**死んだツリー**）を指したまま。下記の生きている側を使うこと。

```bash
# 共通ライブラリ（本体）のビルド・テスト
cd shared && npm run build      # tsc -b（dist 出力も兼ねる。--noEmit にしない）
cd shared && npm run test       # vitest

# ブラウザ起動・型検証
cd web && npm run dev           # vite（localhost）
cd web && npm run build         # tsc -b --force && vite build

# Electron（Phase 3 未着手だが雛形はある）
cd desktop && npm run dev       # electron-vite dev
```

---

## 7. やってはいけないこと

1. `frontend/` `src-tauri/` `cloud/` を**編集・削除しない**（Phase 5 まで維持）。frontend を**移植の参照元として読むのは可**だが、そこに新規実装はしない（新規は `shared/src`）。
2. grep / 検索で同名2件出たら `frontend/` 側を採用しない。必ず `shared/src`。
3. **削除衝動に注意**: frontend は「死んだ重複」に見えて移植参照元＋CI 依存。丸ごと削除は Phase 5 まで保留（§2 参照）。
4. ルート `package.json` の `cargo tauri dev` を実行しない。
5. DDL（DB 変更）は「ローカルファイル先行 → ユーザーが `supabase db push`」。`apply_migration` MCP の単独使用は禁止。
6. このファイルを肥大化させない。1 ページを超えそうなら詳細は `.claude/` の SSOT へ逃がし、ここはリンクだけ残す。
