---
Status: IN PROGRESS — 自律スコープ（Tray 常駐 / 自動起動 / 画面外クランプ）実装中。実機 golden path・.dmg は 👀/🛑 ゲート（Mac 必須）
Created: 2026-06-19
Owner-chat: app-dev-roadmap
Task: STEP 1 — Electron Desktop を「日常使いできる常駐アプリ」ラインへ
Project path: /Users/newlife/dev/apps/life-editor
Branch: claude/app-dev-roadmap-cdhjjz
Parent: ../../../2026-05-04-cross-platform-migration.md（Phase 3 + Phase 5-A の一部を前倒し）
Related:
  - Phase 3 scaffold（完了・#79）: ../../../archive/2026-06-14-phase3-electron-packaging.md
  - 優先ロードマップ（HTML）: ../../reports/2026-06-19-dev-status-roadmap.html（STEP 1）
---

# Plan: STEP 1 — Desktop を毎日使える常駐アプリにする

> Phase 3 の scaffold（#79）で「`web/` を Electron で包んで起動できる」状態までは到達済み。
> 本計画は、それを **「自分の Mac で毎日起動して使い続けられる常駐ツール」** に引き上げる最小ラインを実装する。
> ユーザー優先順位の STEP 1（HTML ロードマップ）に対応。**未署名・$0 厳守・DDL なし**。

## Context（なぜ今・何が足りないか）

scaffold 時点の `desktop/` は「ウィンドウを閉じる＝アプリ終了」「ログイン時に自動起動しない」「トレイ常駐なし」。
日常ツールとして使うには次が要る:

1. **常駐（Tray）** — ウィンドウを閉じても終了せずトレイに残る。これにより Supabase Realtime 接続が維持され、再度開いた瞬間に最新状態。終了はトレイメニュー / Cmd+Q のみ。
2. **自動起動** — ログイン時に（トレイへ最小化した状態で）起動。
3. **ウィンドウ位置の画面外クランプ** — 外部モニタを外した後などに、保存位置が画面外だと二度と掴めなくなる事故を防ぐ（Phase 3 が Phase 5 送りにした security follow-up の前倒し）。

`web/src` は現状 `window.desktop` API を一切参照していない（grep 0 件）。よって本実装は **`desktop/` 内で完結**させ、トレイメニューから常駐・自動起動を直接トグルする。renderer / shared / web は **無改変**（他レーンと衝突ゼロ）。Settings 画面への配線は follow-up。

## Scope（触ってよいパス）

```
desktop/src/main/index.ts        ← Tray / close-to-tray / 自動起動 / bounds クランプ
desktop/electron-builder.yml     ← トレイ用 icon を extraResources で同梱 + mac/linux app icon
.claude/docs/vision/plans/        ← 本計画書
```

**対象外（明示・無改変）**:

- `desktop/src/preload/index.ts`（expose 関数 4 のまま。renderer は新 API を必要としない）
- `shared/` / `web/` / `frontend/` / `src-tauri/` / `cloud/` / `mobile/`
- `supabase/`（DDL なし）
- 署名 / 公証 / autoUpdater 有効化（$0 ポリシー・Phase 5 + コード署名とセット）

## 採用方針（移行 SSOT §5・逸脱したら拒否）

- Tray = Electron 標準 `Tray` + `nativeImage`（プラグイン不使用）
- 自動起動 = `app.setLoginItemSettings`（**Electron 組込・追加依存ゼロ**。mac/win 有効・Linux は no-op）
- 業務ロジックは `desktop/` に書かない（トレイ常駐はシェルの責務なので OK）
- 単一 BrowserWindow 維持 / preload expose ≤10（本計画では preload 無改変＝4）

## Steps

1. [x] Phase 3 scaffold の main/preload 構造を読み、close/quit/bounds の既存挙動を把握
2. [x] `store` スキーマに `closeToTray: boolean`（default true）を追加
3. [x] `sanitizeBounds()`: 保存位置が全ディスプレイの workArea 外なら x/y を捨てて中央表示
4. [x] `close` ハンドラを「bounds 保存 → 非 quit かつ closeToTray なら preventDefault + hide」に変更（常駐）
5. [x] `before-quit` で `isQuitting=true`（トレイ Quit / Cmd+Q から本当に終了できる経路）
6. [x] `Tray` 生成: アイコン（`resources/icon.png` を 18px へ resize）+ コンテキストメニュー（Open / 常駐トグル / 自動起動トグル / Quit）+ クリックで表示トグル
7. [x] 自動起動ヘルパ `getAutoLaunch / setAutoLaunch`（`openAsHidden` でトレイ最小化起動）
8. [x] `electron-builder.yml`: `extraResources` でトレイアイコン同梱 + mac(.icns)/linux(.png) app icon
9. [x] 機械検証: `cd desktop && npm install && npm run typecheck`（tsc）exit 0 ✅
10. [ ] 👀 **Mac 実機ゲート**: `npm run dev` → 閉じてトレイ常駐 → トレイから復帰 → ログイン時自動起動 → `npm run build:mac` で .dmg 生成
11. [ ] （任意・後）GitHub Actions で mac/win/linux の `electron-vite build` 成否確認（ユーザー判断で有効化）

## Gate（§7.3 Plan Gate Convention）

- 🤖 自律: Tray / close-to-tray / 自動起動 / bounds クランプ / builder の icon 同梱（すべて `desktop/` 内・型検証まで）
- 👀 目視: Mac 実機での常駐・復帰・自動起動の体感（Step 10）
- 🛑 人手: `.dmg` 実生成（Mac + ディスク）/ CI 有効化 / 署名（本計画では対象外）

## Acceptance Criteria（機械検証可能）

- [x] `cd desktop && npm run typecheck`（tsc --noEmit, strict + noUnusedLocals）exit 0 ✅
- [x] preload expose 関数が **4 のまま**（renderer 無改変・他レーン非干渉）
- [x] `git diff` が `desktop/src/main/index.ts` + `desktop/electron-builder.yml` + 本計画書のみ（shared/web/frontend 無改変）
- [x] 単一 BrowserWindow 維持 / `nodeIntegration:false` / `contextIsolation:true` / `sandbox:true` を温存
- [ ] 👀 `npm run dev` でトレイ常駐 → 復帰 → 自動起動が動く（Mac 実機ゲート）

## Risks

- **Tray アイコンが packaged app で見つからない**: dev = `app.getAppPath()/../resources`、prod = `process.resourcesPath` の二系統で解決。`extraResources` 同梱必須。空画像でもクラッシュしない fallback。
- **close-to-tray で「終了できない」**: トレイ Quit / Cmd+Q / App メニュー Quit の 3 経路を `isQuitting` で確実に通す。
- **Linux で自動起動が効かない**: Electron 仕様（no-op）。mac/win のみ対象と明記、Linux は実害なし。
- **フル build / .dmg は重く Mac 必須**: 本環境（Linux）では `typecheck` を機械ゲートにし、renderer バンドル・.dmg は実機ゲートへ送る（scaffold 時 #79 で build 緑を確認済み・renderer/web 無改変なので回帰リスク低）。

## Worklog

- 2026-06-19（app-dev-roadmap・起草+実装）: STEP 1 を Phase 3 残 + Phase 5-A 前倒しとして定義。`desktop/` 完結スコープで Tray 常駐 / 自動起動 / bounds クランプを実装。Mac 実機 golden path と .dmg はユーザーゲート。
