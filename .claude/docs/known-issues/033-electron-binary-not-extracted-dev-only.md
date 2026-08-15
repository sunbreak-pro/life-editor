# 033: Electron バイナリが展開されず `npm run dev` だけが起動しない（`build:win` は通るので気づけない）

**Status**: Workaround
**Category**: Tooling
**Severity**: Important
**Discovered**: 2026-08-13

## Symptom

`cd desktop && npm run dev` が vite dev server（`http://localhost:5173/`）を立てた直後に落ちる:

```
error during start dev server and electron app:
Error: Electron uninstall
    at getElectronPath (.../node_modules/electron-vite/dist/chunks/lib-q6ns0vZr.js:155:19)
```

**`npm run build:win` は exit 0 で通り、NSIS インストーラも正常に生成される**ため、この壊れ方は build 側からは一切見えない。CI ゲート（`desktop` の typecheck + electron-vite build）も緑のまま素通りする。

## Root Cause

`desktop/node_modules/electron/` のバイナリ展開が未完了だった。

- `node_modules/electron/dist/` に `LICENSES.chromium.html` **1 個だけ**が存在（展開が途中で止まった痕跡）
- `node_modules/electron/path.txt` が**無い** — `getElectronPath()` はこのファイルを読んで実体を解決するため、無いと `Error: Electron uninstall` になる
- ダウンロード自体は成功していた: `%LOCALAPPDATA%\electron\Cache\<hash>\electron-v33.4.11-win32-x64.zip`（115MB）が存在
- **`node node_modules/electron/install.js` を単体実行しても復旧しない** — 無出力・exit 0 で終了し、`dist/` も `path.txt` も変化しなかった（`ELECTRON_SKIP_BINARY_DOWNLOAD` は未設定・`.npmrc` はリポジトリにもホームにも無し・ディスク空き 326GB）

`build:win` が通るのは、electron-builder が `node_modules/electron/dist` ではなく自前で取得した Electron を使ってパッケージするため。**dev と build で Electron の入手経路が別**なのがこの症状の本質。

## Impact

- Windows 機で `desktop` の dev 起動ができない。ホットリロードでの UI 確認が丸ごと使えず、毎回 `build:win`（数分）を回す羽目になる
- **build と CI が緑のまま壊れている**ため、実際に dev を叩くまで誰も気づかない。#530 では 08-02 から 08-13 まで未計測のまま残っていた
- 再 clone / `node_modules` 作り直しのたびに再発しうる
- **worktree ごとに再発する**（2026-08-13 実測）: worktree は `node_modules` を共有しないため、メインリポジトリ側を直しても各 worktree は壊れたまま残る。#837 の実機確認で win-verify worktree が同じ `Error: Electron uninstall` を出した（`dist/` は 8/2 の npm install 時点のまま = `LICENSES.chromium.html` 1 個だけ）

## Fix / Workaround

応急処置（実測で復旧を確認）:

```bash
# 1. キャッシュ済み zip を dist へ展開
powershell -NoProfile -Command "Expand-Archive -LiteralPath '$LOCALAPPDATA\electron\Cache\<hash>\electron-v33.4.11-win32-x64.zip' -DestinationPath '<repo>\desktop\node_modules\electron\dist' -Force"

# 2. path.txt を書く（改行を入れないこと — 下記の落とし穴）
printf "electron.exe" > desktop/node_modules/electron/path.txt

# 3. 確認
node -e "console.log(require('electron'))"   # → ...\dist\electron.exe が出れば OK
```

### 近道: 同じマシンに復旧済みの clone / worktree があるとき

zip の展開（115MB）より速く、確実。展開済みの `dist/` をまるごとコピーして `path.txt` を書くだけでよい（2026-08-13 に win-verify worktree で実測・約 1 分）:

```bash
cp -r <復旧済み>/desktop/node_modules/electron/dist/. <対象>/desktop/node_modules/electron/dist/
printf "electron.exe" > <対象>/desktop/node_modules/electron/path.txt
node -e "console.log(require('electron'))"   # → ...\dist\electron.exe が出れば OK
```

### 落とし穴: `echo` で `path.txt` を書くと改行がパスの一部になる

`echo "electron.exe" > path.txt` と書くと末尾に `\n` が入り、electron-vite が**改行込みのパスを spawn しようとして失敗**する:

```
errno: -4058, code: 'ENOENT',
syscall: 'spawn ...\node_modules\electron\dist\electron.exe\n',
```

`path.txt` は electron 本体が trim せずそのまま使うため、**必ず `printf`（改行なし）で書く**。

### 残課題

- `install.js` が無言で何もしない根本原因は未特定（展開が最初に中断した理由も不明）。再発したら `force_no_cache=true node node_modules/electron/install.js` で強制再取得を試す
- `npm ci` からやり直せば直る可能性はあるが未検証（`node_modules` 全消しのコストが高く、上記の手動展開で復旧したため試していない）
