# HISTORY (chat-phase3-electron)

### 2026-06-14 - Phase 3 Electron 包装: desktop/ scaffold（自律スコープ Steps 2-8）

#### 概要

移行 SSOT Phase 3。`shared/` を Electron で包んで macOS 起動可能にする scaffold を lead-pipeline 重チェーンで実装・検証。偵察で「shared に組み立て済み App は無く、実体は `web/src/`」と判明したため、renderer は web アプリを `root=web` で包む構成にユーザー判断で確定。実装・監査・セキュリティ強化まで完了し、実機 golden path（Step 9 👀）をユーザーゲートとして残す。

#### 変更点

- **renderer 戦略**: electron-vite の renderer `root` を `../web` に向け、`web/index.html → web/src/main.tsx` をそのまま再利用。React 二重ロードは root=web + `dedupe:['react','react-dom']` で構造的に回避。shared は `@life-editor/shared → ../shared/src/index.ts` の alias で source 解決（web と同型）。`envPrefix:'VITE_'` で web と同じ Supabase env を読む
- **desktop/main**: 単一 BrowserWindow（contextIsolation+nodeIntegration:false+sandbox:true）+ 標準 Menu + 最小 IPC 4 ハンドラ（theme/window/version）+ electron-store（window bounds/theme 永続化）+ electron-updater skeleton（Phase 5 で本格化・未署名のうちは有効化禁止と明記）
- **desktop/preload**: contextBridge expose = 4 関数（≤10 厳守）・serializable のみ・sandbox 整合のため CJS 出力
- **electron-builder.yml**: macOS(dmg arm64+x64) / Windows(nsis) / Linux(AppImage) 3 ターゲット・未署名（`mac.identity:null`）
- **検証**: `electron-vite build` exit 0（renderer=web/src 3664 modules）/ `tsc --noEmit` exit 0 / preload 4 関数 / 非破壊（shared・web・frontend の build 3 つとも exit 0）
- **監査**: role-QA = PASS with concerns（Blocker/Major 0・スコープ完全遵守・`shared/package.json`/tsconfig 無改変で W4 衝突回避）/ security-reviewer = approve with notes（Critical/High 0・Medium 4）
- **セキュリティ強化（監査反映・全 desktop/ 内）**: `will-navigate` ガード（prod のトップレベル遷移ブロック）/ `setTheme` の enum 入力検証 / `openExternal` スキーム allowlist（https/mailto のみ）/ updater 未署名警告コメント / typecheck npm script / README env 明確化。再検証 green
- **Phase 5 追跡（security Medium 見送り）**: renderer CSP（onHeadersReceived・prod 限定・Vite inline preload script + Supabase connect-src のランタイム調整要）/ window bounds 画面外クランプ / setPermissionRequestHandler / autoUpdater はコード署名導入とセットで有効化
- **インシデント**: 途中 electron-builder の DMG 実生成が環境ディスクを枯渇（ENOSPC）させ全 Bash が停止 → ユーザーがキャッシュ削除で解放。DMG 実生成は Step 9 実機ゲートへ移送
