---
Status: IN-PROGRESS — 自律スコープ（Steps 2-8）実装+検証完了。Step 9（👀 実機 golden path）はユーザーゲート待ち / Step 10（CI）は任意・後回し（2026-06-14 phase3-electron レーン）
Created: 2026-06-14
Owner-chat: phase3-electron
Task: 移行 SSOT Phase 3 — Electron 包装（macOS .app 起動まで）
Project path: /Users/newlife/dev/apps/life-editor
Worktree: .claude/worktrees/phase3-electron
Branch: feat/phase3-electron（origin/main ca0dbe1b = W3-C merged から作成）
Parent: ../../../2026-05-04-cross-platform-migration.md（§Phase 3 が一次仕様）
Related:
  - 親ロードマップ（並行中の W4 を含む）: ./2026-06-07-web-desktop-parity-roadmap.md
  - Electron スタック選定 / 構造 / Risk: 移行 SSOT §5・§7・Risks Risk 1
---

# Plan: Phase 3 — Electron 包装（macOS で起動するまで）

> このファイルは chat-main が W4 と並行で立ち上げた handoff brief。一次仕様は移行 SSOT `2026-05-04-cross-platform-migration.md` の Phase 3 節。本レーンは「重」ティア相当なので、着手は **lead-pipeline**（session-manager START → role-pm 分解 → role-engineer → session-verifier → role-qa → task-tracker → git-orchestrator）で回す。

## Context（なぜ今・なぜ並行できるか）

- W4（Analytics + Connect）が web-parity ロードマップの最終 Phase。これで `shared/` の UI が Desktop 同等に揃う方向。
- その次の節目が本 Phase 3 = `shared/` を Electron で包んで macOS .app として起動できる状態にすること。
- **並行可能な理由**: Phase 3 は `desktop/`（新設ディレクトリ）が主戦場で、`shared/` は import して mount するだけ。W4 が触る `shared/src/components/`（Analytics/Connect UI）や `web/src/` とはファイルが重ならない。
- **唯一の衝突点**: `shared/package.json` / `shared/tsconfig*.json`。W4 が依存を足す可能性があるため、本レーンが触るときは comm で W4 レーンの状況を先に確認する。

## ゴール

`shared/` を Electron で包んで macOS .app として起動できる状態に。Windows / Linux は CI でビルドが通ることのみ確認（友達配布は完成後）。**未署名・$0 厳守**。

## Scope（触ってよいパス）

```
desktop/                       ← 新設（main / preload / renderer・薄く保つ）
desktop/electron.vite.config.ts , desktop/electron-builder.yml , desktop/package.json
shared/package.json , shared/tsconfig*.json   ← Electron が import するための最小調整のみ（⚠ W4 と衝突注意）
.github/workflows/             ← Win/Linux CI ビルド（任意・最後）
.claude/docs/vision/plans/     ← 本子計画書
```

**対象外（明示）**:

- `shared/src/components/` の中身（W4 レーンが触る。読むだけ・改変しない）
- `web/` / `frontend/` / `src-tauri/` / `cloud/` / `mobile/`
- `supabase/`（本 Phase に DDL なし）

## 採用スタック（移行 SSOT §5・AI 友好な well-trodden 構成。逸脱したら拒否）

| レイヤ   | 採用                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| Scaffold | electron-vite                                                                     |
| Builder  | electron-builder（mac/win/linux 3ターゲット・未署名）                             |
| Updater  | electron-updater + GitHub Releases（本 Phase は skeleton まで・本格化は Phase 5） |
| 構成     | メイン + 単一 preload + 単一 renderer（multi-window 禁止）                        |
| IPC      | contextBridge + ipcRenderer.invoke、context isolation 必須、serializable のみ     |
| Config   | electron-store（window size / theme のみ。データ本体は Supabase）                 |

**禁止スタック（混入即拒否）**: webpack 直書き / nativeWindowOpen カスタム / `nodeIntegration: true` / 複数 BrowserWindow / IPC で関数オブジェクト授受。

## Steps

1. [x] 着手前チェック: ① W4 レーン状況を `.claude/comm/` + `memory/INDEX.md` で確認 → **W4 は「後回し（Tier3）」で最近のレーン活動なし＝`shared/` 設定衝突リスク低**。本 Phase は shared 設定を無改変で完遂 ② terminal-division 通読の代わりに electron-vite react-ts テンプレ + `@electron-toolkit/utils` の well-trodden 構成に厳密準拠（Risk 1 緩和）
2. [x] `desktop/` に electron-vite 雛形投入（main / preload / renderer + electron.vite.config.ts + tsconfig\*）
3. [x] renderer 戦略を確定（ユーザー判断）: **shared に App は無い**（providers/hooks/design-system のライブラリ層）。組み立て済みアプリは `web/src/` にあるため、renderer `root` を `../web` に向けて **web アプリをそのまま包む**。React 二重ロードは root=web + `dedupe:['react','react-dom']` で構造的に回避。shared は alias で source 解決（web と同型）
4. [x] `desktop/src/main/index.ts`: 単一 BrowserWindow + 標準 Menu + 最小 IPC（theme/window/version の 4 ハンドラ）+ will-navigate ガード + openExternal スキーム制限
5. [x] `desktop/src/preload/index.ts`: contextBridge.exposeInMainWorld（**expose 関数 = 4**・context isolation・sandbox CJS 出力）
6. [x] electron-store で window size / theme を永続化（最小用途のみ）
7. [x] env 注入: `envPrefix:'VITE_'` で web と同じ `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を読む。鍵は `desktop/.env`（gitignore 済）・コミットしない
8. [x] `electron-builder.yml`: macOS / Windows / Linux 3 ターゲット、未署名（`mac.identity:null`）
9. [ ] 👀 **ユーザー実機ゲート**: `npm run dev` で起動 → ログイン → Tasks CRUD（golden path）/ `npm run build:mac` で macOS `.dmg` 生成 exit 0（※ディスク確保後）
10. [ ] （任意・最後）GitHub Actions で Windows / Linux ビルド成否のみ確認

## Gate（§7.3 Plan Gate Convention）

- 🤖 自律: desktop/ scaffold・main/preload/renderer・electron-vite / electron-builder 設定・electron-store
- 👀 目視: macOS .app 起動 → ログイン → Tasks 操作 golden path（Step 9）
- 🛑 人手: なし（署名なし・配布しない・DDL なし＝$0）。GitHub Actions を有効化する場合のみワークフロー追加をユーザー確認

## Acceptance Criteria（機械検証可能）

- [x] `cd desktop && npm run build`（electron-vite build）で main+preload+renderer がバンドルされ exit 0（renderer = web/src 3664 modules 変換成功）+ `npm run typecheck`（tsc）exit 0
- [ ] ⏭ 👀 `npm run dev` 起動で `shared/`（web 経由）がマウントされる（実機ゲート）
- [ ] ⏭ 👀 `npm run build:mac`（electron-builder）で macOS arm64 `.dmg`/`.app` 生成 exit 0（実機ゲート・ディスク確保後）
- [ ] ⏭ 👀 Electron 起動 → Supabase ログイン → Tasks CRUD が通る（実機ゲート）
- [x] preload の expose 関数が **10 個以下**（実数 4）
- [x] 非破壊担保: `shared` / `web` / `frontend` の `npm run build` 3 つとも exit 0（git diff は `.gitignore` +6 行 + `desktop/`(新規) のみ＝対象外レーン無改変）

## Risks（移行 SSOT Risk 1 = 最重要）

- **AI 任せで構造崩壊**: preload expose ≤10 厳守 / 業務ロジックは `desktop/` に絶対書かない（`shared/` のみ）/ electron-vite テンプレを外れる提案は即拒否 / 着手前に terminal-division を通読。
- **W4 との `shared/` 設定衝突**: package.json / tsconfig を触る前に comm で W4 の状況確認。可能なら本 Phase は shared 設定を「読む」だけで済ませ、変更が要るなら最小差分。

## Worklog

- 2026-06-14（chat-main 起草）: W4 並行レーンとして worktree `feat/phase3-electron` を origin/main(ca0dbe1b・W3-C #75 merged) から作成。本 handoff を起草。実装着手・role-pm 分解は本レーンの新チャットが lead-pipeline で実施する。
- 2026-06-14（phase3-electron レーン・lead-pipeline 重チェーン）: 偵察で **shared に App 不在・組み立て済みアプリは web/src** と判明 → ユーザー判断で renderer 戦略「web アプリを包む（root=web）」確定。role-engineer が desktop/ scaffold 実装（main/preload/renderer config/electron-builder.yml/tsconfig/README）。検証: electron-vite build exit 0 / tsc exit 0 / preload 4 関数 / shared・web・frontend build exit 0（非破壊）。role-QA = **PASS with concerns**（Blocker/Major 0・スコープ完全遵守）、security-reviewer = **approve with notes**（Critical/High 0・Medium 4）。監査反映: will-navigate ガード / setTheme enum 検証 / openExternal スキーム制限 / updater 未署名警告 / typecheck script / README env 明確化 を追加（全 desktop/ 内・再検証 green）。**途中 electron-builder DMG 実生成が環境ディスクを枯渇させ ENOSPC** → ユーザーがキャッシュ削除で解放（DMG 実生成は Step 9 実機ゲートへ）。
  - **Phase 5 追跡（security Medium・本 Phase 見送り）**: ① renderer CSP（onHeadersReceived・prod 限定 + Supabase connect-src・Vite inline preload script 対応のランタイム調整要） ② window bounds 画面外クランプ（screen.getDisplayMatching） ③ setPermissionRequestHandler（通知許可との兼ね合いで要設計） ④ autoUpdater 有効化はコード署名導入とセット（未署名のまま有効化禁止）。
