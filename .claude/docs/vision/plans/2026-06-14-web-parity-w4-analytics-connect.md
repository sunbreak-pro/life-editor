---
Status: IN_PROGRESS
Created: 2026-06-14
Branch: feat/w4-analytics-connect
Owner-chat: main
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-10-web-parity-w3-work-timer-audio.md
---

# Plan: W4 — Analytics + Connect を web/shared へ移植（lean）

> 親ロードマップ W4。Web を Desktop 同等へ引き上げる最終 Phase。
> ユーザー確定スコープ（2026-06-14）: **Analytics + Connect を 1 PR で** /
> Analytics は **コア集計 lean 先行**（Overview/Tasks/Work/Schedule、Materials 除外）/
> Connect は **ノードグラフ + backlink のみ**（Paper Boards = Tier3 凍結は除外）。

---

## Context

- **動機**: web に Analytics / Connect が未移植。親ロードマップ W4 で Desktop 同等の操作感・情報密度へ。
- **制約**: コスト $0（新規 DB 不要・既存 read メソッドのみ）/ `frontend/` は FROZEN（参照のみ）/ 2 層モデル（部品=shared 共通 / 画面=機能別）。
- **Non-goals**: Materials/Connect 集計タブ・Paper Boards・汎用 DB・ピクセル一致・legacy note_links 実装。

### 重要な設計判断（recon 2026-06-14 で確定）

1. **Analytics 集計層は純粋関数** → `frontend/src/utils/analyticsAggregation.ts`（879行・Tauri/React 非依存）を `shared/src/utils/` へそのままコピー可。データギャップ **ゼロ**（全データが既存 shared DataService に存在）。
2. **Connect のグラフ描画層（PointGraph）は Canvas 2D + d3-force**（@xyflow/react ではない。@xyflow は Paper 側＝drop）。Tauri 結合ゼロ → 描画層は流用可。
3. **Connect のデータ層は unified item-link モデルで組み直す**（最重要）:
   - `SupabaseNoteLinkService` / `SupabaseNoteConnectionService` の `fetchAllNoteLinks` / `fetchBacklinksForNote` / `fetchNoteConnections` 等は **全部スタブ（`return []`）= web では空**。
   - frontend の `useNoteConnections`（legacy note_links/note_connections 依存）を**そのまま移植してはいけない**（web でグラフが空になる）。
   - 正解 = DU 完了済みの **unified API**（実装済み・実 Supabase クエリ）でモデルを構築:
     - ノード: `listNotesUnified()`（+ 必要なら他 role の items_meta）
     - item↔item リンク（エッジ）: `listAllTagConnections()`（WikiTagConnection unified）
     - タグ割当（エッジ/グルーピング）: `listAllTagAssignments()` / タグ実体 `listAllWikiTagsUnified()`
     - backlink: `listLinksToItem(itemId)`（実装済み）
4. **i18n は移植不要**: shared locales に `analytics` / `connect` / `ideas` / `backlinks` subtree が W0 で全量コピー済み。欠落 leaf のみ追記。
5. **2 層モデルの遵守**: shared の部品/集計は **props でデータ・`t` 注入**（`getDataService()` / `useTranslation()` を leaf で直呼びしない。§6.4）。データ取得・`t` 解決は web host screen 側。UI 状態のみの `AnalyticsFilterContext` は shared に置いてよい（ThemeContext と同格）。

---

## Scope (Touchable Paths)

```
shared/src/utils/analyticsAggregation.ts          # 新規（frontend からコピー）
shared/src/utils/analyticsAggregation.test.ts     # 新規（コピー）
shared/src/context/AnalyticsFilterContext*.ts(x)  # 新規（コピー・chart group prune）
shared/src/components/Analytics/**                 # 新規（チャート + 4タブ + AnalyticsView）
shared/src/components/Connect/**                   # 新規（PointGraph 描画 + 新モデル hook + Backlink）
shared/src/components/index.ts                     # ★ Phase A のみ（main が編集）: Analytics/Connect 再export 2行
shared/src/index.ts                               # 触らない（components 経由で自動 re-export）
shared/src/types/**                               # 必要なら graph 用型を追加（Analytics 型は既存流用）
web/src/analytics/**                              # 新規 host screen（data/t 注入）
web/src/connect/**                               # 新規 host screen
web/src/MainScreen.tsx                            # ★ Phase A のみ（main）: section 結線 analytics/connect
web/package.json , shared/package.json            # ★ Phase A のみ（main）: deps 追加
shared/src/i18n/locales/{en,ja}.json              # 欠落 leaf のみ（極力触らない）
.claude/docs/vision/plans/2026-06-14-web-parity-w4-analytics-connect.md
```

**対象外**: `frontend/`（FROZEN・参照のみ）/ `desktop/` `mobile/`（未作成）/ Paper Boards / Materials・Connect 集計タブ / 汎用 DB / DDL（新テーブル不要）。

---

## アーキテクチャ（contract）

- web→shared import = alias `@life-editor/shared` → `shared/src/index.ts`（`export * from "./components"`）。
- 公開エントリ（host が import する）:
  - `shared/src/components/Analytics/index.ts` → `export { AnalyticsView }`（props 注入型・presentational）
  - `shared/src/components/Connect/index.ts` → `export { ConnectGraphView }`（props 注入型）
  - `shared/src/components/index.ts` に上記 2 sub-barrel の re-export を追加（Phase A・main 担当）。
- host screen（web）が責務を持つ: `getDataService()` で fetch・`useTranslation()` で `t` 解決・状態管理 → shared コンポーネントへ props 注入。

---

## Steps

| #   | Step | Gate | Acceptance |
| --- | ---- | ---- | ---------- |
| A1  | deps 追加（recharts / d3-ease,force,quadtree,selection,zoom + @types）を web + shared package.json、`npm install`（worktree は node_modules 非共有） | 🤖 自律 | install 成功・lockfile 更新 |
| A2  | web MainScreen に `analytics` / `connect` section 結線（Section 型 / SECTIONS / SECTION_ICON / render 分岐）+ host screen stub + components/index.ts 再export | 🤖 自律 | `cd web && npm run build` exit 0（stub 状態） |
| B1  | **Analytics 移植**: aggregation コピー + AnalyticsFilterContext（Materials/Connect group prune）+ 15 チャート + 4 タブ（Overview/Tasks/Work/Schedule）+ AnalyticsView（props 注入）。web host が data/t 注入 | 🤖 自律 | shared/web build green・aggregation test green |
| B2  | **Connect 移植**: PointGraph 描画層（Canvas+d3-force）コピー + **新モデル hook（unified API）** + Backlink ビュー（`listLinksToItem`）+ ConnectGraphView（props 注入）。web host が data/t 注入 | 🤖 自律 | shared/web build green |
| C1  | session-verifier（shared build+test / web build / 非 frontend 変更の確認） | 🤖 自律 | 全 green・diff に frontend/ 変更なし |
| C2  | role-qa（別コンテキスト独立監査） | 🤖 自律 | Blocking 0 |
| D1  | golden path 実機目視（テーマ追従・チャート描画・グラフ表示/遷移・backlink） | 👀 目視 | ユーザー確認 |
| D2  | PR 作成 → main merge | 🛑 人手 | merge ボタン |

### Gate 凡例: 🤖 自律 / 👀 目視 / 🛑 人手（DDL push・PR merge 等）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build`（tsc -b）exit 0
- [ ] `cd shared && npm run test`（vitest, analyticsAggregation 含む）全 pass
- [ ] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [ ] `cd web && npx eslint .` 0
- [ ] `git diff --stat origin/main` に `frontend/` 配下の変更が **0 件**（FROZEN 担保 → frontend 非回帰のため frontend build はスキップ）
- [ ] web に `analytics` / `connect` section が表示され、空でない描画（要 D1 目視）

---

## DB Migration Notes

DDL なし。新テーブル不要。全データは既存 read メソッド（`listNotesUnified` / `listAllTagConnections` / `listLinksToItem` / `listAllTagAssignments` / `fetchTimerSessions` / `fetchScheduleItemsByDateRange` / `fetchAllRoutines` / `fetchTaskTree` / `fetchTimerSettings`）で取得。

---

## Risks / Known Issues

- **Connect モデルの落とし穴（最重要）**: legacy note-link スタブを使うとグラフ空。必ず unified API。
- **shared 部品の §6.4 違反**: leaf で `getDataService()` / `useTranslation()` を直呼びしない（注入）。
- **PR 巨大化**: Analytics(~3500行) + Connect(~1500行) で 1 PR。scope creep ガードは「Materials/Paper/Connect集計タブ除外」を厳守して抑制。
- **並列編集衝突回避**: package.json / MainScreen / components/index.ts / locales は **Phase A で main が単独編集**。B1/B2 engineer は各 feature サブツリーの新規ファイルのみ作成。

---

## References

- 親: `2026-06-07-web-desktop-parity-roadmap.md`（§W4 / 2 層モデル）
- vision: `docs/vision/coding-principles.md §6`（UI 集約 案A）/ `.claude/rules/frontend.md`
- recon: frontend Analytics（31f/集計879行）/ Connect PointGraph（Canvas+d3-force）

---

## Worklog

- 2026-06-14（起草・main）: recon 2 本（Analytics / Connect 精密マップ）完了。Connect は unified item-link モデルで組み直す方針確定（legacy note-link は web スタブ）。i18n は W0 コピー済みで移植不要。worktree `feat/w4-analytics-connect` 作成。
</content>
</invoke>
