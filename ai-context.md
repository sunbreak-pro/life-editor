# ai-context.md — 新セッション用 1枚リファレンス

> **使い方**: 新しい Claude セッションを始めるとき、まずこの1枚だけ読ませる。長い会話履歴を引き継がない。
> このファイルは「今どこが生きていて、どこが死んでいるか」を確定させるための生死マップ。古い `.claude/` ドキュメントの渋滞に巻き込まれず、ここから再スタートするためのもの。
> **鮮度**: 2026-07-11 時点（旧 Tauri スタック削除を反映）。コード構造が変わったら同じ PR でここも直す。1ページに収める（増やさない）。

---

## 1. 最新ゴール（今どこにいるか）

- **何を作っているか**: AI と会話しながら生活を設計・記録・運用するパーソナル OS。ユーザーは作者本人のみ（N=1 / macOS + iOS）。
- **進行中の移行**: 旧 Tauri 2 + Cloudflare D1 → **Web (Vite) + Supabase、Electron/Capacitor で包む** 構成へ移行中。
- **現在地**: Phase 2（コア機能の web/shared 移植）完了。Data Unification レーン進行中。**Phase 3（Electron 包装）未着手**。
- **SSOT**: 移行の詳細は [`.claude/2026-05-04-cross-platform-migration.md`](./.claude/2026-05-04-cross-platform-migration.md)。設計不変式は [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)。
- **方針**: 完成まで $0 厳守 / 学習ログは書かない。

---

## 2. 生死マップ（最重要 — これを間違えると全部ずれる）

**旧スタックはリポジトリからすべて削除済み**。今 disk にあるツリーは基本的に全部「生きている」。

| パス                       | 役割                                                                                 | 備考                                                   |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `shared/src/`              | **React コードの本体**。`@life-editor/shared` として全プラットフォーム共通           | services / components / context / hooks / types / i18n |
| `web/src/`                 | ブラウザ向け Vite renderer（画面層。本体は shared を import）                        | `*Screen.tsx` が各 Section                             |
| `desktop/src/`             | Electron 薄ラッパー（`main/index.ts` + `preload/index.ts` のみ）                     | Phase 3 未着手・雛形のみ                               |
| `mobile/`                  | Capacitor 薄ラッパー（ios/android ネイティブ + capacitor.config.ts）                 | 設定のみ                                               |
| `supabase/`                | Postgres マイグレーション（DB の正本）                                               | —                                                      |
| `mcp-server/`              | MCP サーバー（Phase 5 で Postgres 版へ書き換え予定。現状は旧 SQLite 版）             | —                                                      |
| `.github/workflows/ci.yml` | 本流 CI。PR / main push で shared(tsc -b + vitest) → web(tsc -b + vite build) を検証 | —                                                      |

### 削除済みの旧スタック（2026-07-11 完了・#197）

`frontend/`（旧 Tauri モノリス）・`src-tauri/`（旧 Rust バックエンド）・`cloud/`（旧 Cloudflare Workers + D1）・`.github/workflows/build.yml`（旧 Tauri リリース CI）・`.ignore`（旧ツリーの検索除外）は**すべて削除済み**。

- **復元**: git tag **`pre-tauri-removal`**（origin に push 済み）または git 履歴。`git show pre-tauri-removal:frontend/<path>` で当時のファイルを読める。
- **未移植機能の参照元**: 旧 frontend/ にしか実装がなかった機能（Playlist UI / リッチテキスト拡張 / UndoRedo / Paper Boards / Templates / Time memos / Sidebar links / TipsPanel 等）の棚卸しは Issue **#197** のコメントに記録。移植を再開するときは git 履歴を参照元にする。

---

## 3. フォルダ構造（生きている側だけ）

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

> 単一で巨大なファイル: `shared/src/services/SupabaseDataService.ts`（2,300 行超）。分割するならテストを張ってから。

---

## 4. 主要データ構造（変わらない不変式）

- **DataService 境界（不変式）**: フロントは `getDataService()` 経由でのみデータアクセス。コンポーネントから直接バックエンド呼び出し禁止。`shared/src/index.ts` から `getDataService` を import する。
- **items_meta + 5 role**: 5 つの role（`task` / `event` / `routine` / `note` / `daily`）は `items_meta(id, role)` が SSOT。各 payload テーブルは `(id, role)` 複合 FK で参照する 2 行分割モデル。
- **Sync (LWW)**: `items_meta.updated_at` を Last-Write-Wins カーソルにする。`<role>_payload` は `updated_at` を持たない。
- **ID 不変式**: TaskNode = `<type>-<timestamp+counter>` / DailyNode = `daily-<YYYY-MM-DD>` / その他 = `generateId(prefix)`。全て String。role を跨いで一意。
- **ソフトデリート**: `is_deleted` + `deleted_at` → TrashView 復元。
- **WikiTag / Link**: role 区別なしで `items_meta.id` を参照する共通グラフ。

---

## 5. 開発の起点（生きているコマンドだけ）

```bash
# 共通ライブラリ（本体）のビルド・テスト
cd shared && npm run build      # tsc -b（dist 出力も兼ねる。--noEmit にしない）
cd shared && npm run test       # vitest

# ブラウザ起動・型検証
cd web && npm run dev           # vite（localhost。web/.env.local に Supabase 接続情報が必要）
cd web && npm run build         # tsc -b --force && vite build

# Electron（Phase 3 未着手だが雛形はある）
cd desktop && npm run dev       # electron-vite dev
```

> 同じ手順を `.github/workflows/ci.yml` が PR ごとに自動実行する。ルート `package.json` の `dev` / `build` は web への委譲エイリアス。

---

## 6. やってはいけないこと

1. 新規実装は必ず `shared/src`（部品層）+ `web/src`（画面層）。旧 frontend/ のコードを git 履歴から掘って**そのまま貼らない**（Tauri 前提のため。参照して設計を読むのは可）。
2. DDL（DB 変更）は「ローカルファイル先行 → ユーザーが `supabase db push`」。`apply_migration` MCP の単独使用は禁止。
3. このファイルを肥大化させない。1 ページを超えそうなら詳細は `.claude/` の SSOT へ逃がし、ここはリンクだけ残す。
