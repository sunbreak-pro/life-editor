---
Status: REFERENCE — Phase 5 で削除予定の対象リスト（実削除は本ファイルではなく移行 SSOT 側で行う）
Created: 2026-05-24 (cleanup-and-consolidation Phase 4-2)
Updated: 2026-05-24
Branch: refactor/cleanup-and-consolidation
Parent: 2026-05-23-cleanup-and-consolidation.md（本計画書）
Migration SSOT: ../../../2026-05-04-cross-platform-migration.md（実削除フェーズの正本）
---

# Cleanup & Consolidation — 削除対象リスト

> 並立期間中は触らず、移行 SSOT Phase 5 でまとめて削除する対象を列挙する。本ファイルは「何を、どの理由で、どの Phase で削除するか」の参照表。**本ファイル自体ではコード削除は行わない**。

## Context

CLAUDE.md §7 と移行 SSOT §7 で「Phase 5 まで `frontend/` + `src-tauri/` + `cloud/` は並立維持」と明文化されている。本ブランチ (`refactor/cleanup-and-consolidation`) もこの境界を尊重し、ドキュメント整理に留める。Phase 5 着手時に本リストを `move/rm` チェックリストとして使う。

## 削除対象 Tier A — Backend 全体（移行 SSOT Phase 5）

| 対象                                  | サイズ                                          | 理由                                        | Phase             |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ----------------- |
| `src-tauri/` 全体                     | 2.6 MB (`.rs` × 90)                             | Tauri → Electron 置換完了で全体不要         | 移行 SSOT Phase 5 |
| `cloud/` 全体                         | 164 KB (migration × 7, `src/`, `wrangler.toml`) | Cloudflare Workers + D1 → Supabase に置換済 | 移行 SSOT Phase 5 |
| `src-tauri/tauri.conf.json`           | (上記内)                                        | Tauri 設定                                  | 移行 SSOT Phase 5 |
| `src-tauri/Cargo.toml` / `Cargo.lock` | (上記内)                                        | Rust 依存                                   | 移行 SSOT Phase 5 |

## 削除対象 Tier B — Frontend Tauri 依存層（DataService factory 差し替えで対応）

| 対象                                        | 役割                                      | 置換先                                       | Phase                                         |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `frontend/src/services/TauriDataService.ts` | Tauri invoke ラッパー（DataService 実装） | `shared/src/services/SupabaseDataService` 系 | 移行 SSOT Phase 5                             |
| `frontend/src/services/bridge.ts`           | `tauriInvoke` + `isTauri()`               | 不要（Electron では window.api 経由）        | 移行 SSOT Phase 5                             |
| `frontend/src/services/events.ts`           | `@tauri-apps/api/event` 動的 import       | Electron IPC または DOM event                | 移行 SSOT Phase 5                             |
| `frontend/src/services/terminalBridge.ts`   | terminal\_\* 系 Tauri invoke ラッパー     | Electron 子プロセス IPC                      | 移行 SSOT Phase 5 (Terminal 機能の置換と同時) |

> **Note**: `frontend/src/services/data/` の **19 domain ファイル** (calendars / daily / databases / files / misc / notes / paper / playlists / routines / scheduleItems / sidebar / sound / sync / system / tasks / templates / timeMemos / timer / wikiTags) は Tauri 専用ではなく **DataService interface に従う domain 別 splitter**。Supabase 移行後は `shared/src/services/` 側にも同等の domain 分割が必要（または直接 SupabaseDataService に統合）。

## 削除対象 Tier C — 依存パッケージ & package.json scripts

| 対象                                | 場所                                 | 理由                                        | Phase                             |
| ----------------------------------- | ------------------------------------ | ------------------------------------------- | --------------------------------- |
| `@tauri-apps/cli`                   | root `package.json` devDependencies  | Tauri CLI 不要                              | 移行 SSOT Phase 5                 |
| `@tauri-apps/api`                   | `frontend/package.json` dependencies | invoke / event API 不要                     | 移行 SSOT Phase 5                 |
| root `"dev": "cargo tauri dev"`     | root `package.json` scripts          | Electron 起動コマンドに置換                 | 移行 SSOT Phase 5                 |
| root `"build": "cargo tauri build"` | root `package.json` scripts          | Electron build コマンドに置換               | 移行 SSOT Phase 5                 |
| `portable-pty`                      | `src-tauri/Cargo.toml`               | Terminal 機能を Electron 子プロセスに置換時 | 移行 SSOT Phase 3 (Terminal 移植) |
| `@xterm/xterm` / `@xterm/addon-fit` | `frontend/package.json`              | Terminal UI、Electron 移行後も使うなら保持  | 要再評価                          |

## DataService 層の関係図（cleanup-and-consolidation Phase 4-4）

```
Current (Tauri-era)                                   Target (Supabase-era)
================================                      =====================
frontend/src/services/                                shared/src/services/
├── DataService.ts (interface)                  ─→   ├── DataService.ts (interface, 同一)
├── TauriDataService.ts (1453 lines)            ─→   ├── SupabaseDataService.ts (新規、domain 単位)
├── dataServiceFactory.ts                       ─→   ├── dataServiceFactory.ts (環境判定)
├── bridge.ts (tauriInvoke)                     ─→   ├── (削除 — Electron IPC へ)
├── events.ts (@tauri-apps/api/event)           ─→   ├── (削除 — DOM event へ)
├── terminalBridge.ts                           ─→   ├── (削除 — Electron 子プロセス IPC へ)
├── notSupported.ts                             ─→   ├── notSupported.ts (継続)
└── data/  (19 domain splitter)                       └── data/  (Supabase へ移植)
    ├── calendars.ts                                      ├── calendars.ts (移植先)
    ├── daily.ts                                          ├── daily.ts
    ├── databases.ts                                      ├── databases.ts
    ├── files.ts                                          ├── files.ts
    ├── misc.ts                                           ├── misc.ts
    ├── notes.ts                                          ├── notes.ts
    ├── paper.ts                                          ├── paper.ts
    ├── playlists.ts                                      ├── playlists.ts
    ├── routines.ts                                       ├── routines.ts
    ├── scheduleItems.ts                                  ├── scheduleItems.ts
    ├── sidebar.ts                                        ├── sidebar.ts
    ├── sound.ts                                          ├── sound.ts
    ├── sync.ts                                           ├── sync.ts (新方式 = Supabase Realtime)
    ├── system.ts                                         ├── system.ts
    ├── tasks.ts                                          ├── tasks.ts
    ├── templates.ts                                      ├── templates.ts
    ├── timeMemos.ts                                      ├── timeMemos.ts
    ├── timer.ts                                          ├── timer.ts
    └── wikiTags.ts                                       └── wikiTags.ts
```

- **DataService interface (`DataService.ts`)** は CLAUDE.md §3.1 で「恒久的境界」と明記。実装が Tauri → Supabase に切り替わってもこの interface は維持。
- **dataServiceFactory.ts** が環境（Tauri / Web / Electron）を判定して適切な実装を返す。Phase 5 で Tauri 判定分岐を削除。
- 19 domain ファイルは `TauriDataService` を **構成する内部分割**。同等の構造を `shared/src/services/` に持つか、Supabase 側は単一ファイル統合かは Phase 2 実装時に判断（Phase 2 進行中）。

## .mcp.json verify 結果（cleanup-and-consolidation Phase 4-5）

CLAUDE.md §9 と MEMORY 既知問題 (`feedback_mcp_json_token_placeholder.md`) に従い、`.mcp.json` の API トークン参照形式を verify。

| MCP Server    | env 設定                                            | 形式                          | 判定                           |
| ------------- | --------------------------------------------------- | ----------------------------- | ------------------------------ |
| `life-editor` | `DB_PATH`, `FILES_ROOT_PATH` (絶対パス)             | パス指定のみ、トークン無し    | ✅ 安全                        |
| `supabase`    | `SUPABASE_ACCESS_TOKEN: "${SUPABASE_ACCESS_TOKEN}"` | **${...} プレースホルダ形式** | ✅ 安全 — shell 環境変数で供給 |

加えて supabase MCP は `--read-only` フラグ付きで起動されており、write 操作は MCP 経由では実行不可。**MEMORY 教訓 (2026-05-17 GitHub Push Protection ブロック事案) に準拠**。Phase 4 として変更不要、現状維持。

## Phase 5 実削除時のチェックリスト（移行 SSOT 側で使用）

- [ ] `src-tauri/` ディレクトリ削除前に `frontend/` 側の Tauri 依存 import が 0 件になっていることを確認 (`grep -r '@tauri-apps' frontend/src/`)
- [ ] `cloud/` ディレクトリ削除前に Supabase 側の対応 RLS policy が全テーブルで適用済みであることを確認
- [ ] root `package.json` scripts 差し替え後に `npm run dev` / `npm run build` が新コマンドで通ることを確認
- [ ] frontend `package.json` から `@tauri-apps/api` 削除後に `tsc -b` が通ることを確認（孤立 import 検出）
- [ ] `.mcp.json` の `life-editor` MCP server は SQLite ベース → Supabase 移行後は再設計 (`DB_PATH` 不要、`SUPABASE_*` 環境変数に置換) が必要

## 関連ドキュメント

- 親計画書: [`2026-05-23-cleanup-and-consolidation.md`](./2026-05-23-cleanup-and-consolidation.md)
- 移行 SSOT: [`2026-05-04-cross-platform-migration.md`](../../../2026-05-04-cross-platform-migration.md)
- archive 済 code 棚卸し: [`archive/code-inventory-2026-04-25.md`](../../../archive/code-inventory-2026-04-25.md) (2026-04-25 時点スナップショット、ARCHIVED マーク済 / Phase 4-1 で archive 移動済)
