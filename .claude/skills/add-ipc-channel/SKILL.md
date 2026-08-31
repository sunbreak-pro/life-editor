---
name: add-ipc-channel
description: life-editor のデータアクセスは IPC を通らない（正本 = CLAUDE.md §3.1 の DataService 境界）ことの導線と、desktop 殻だけが持つ 7 関数の IPC ブリッジに 1 本足すときの 3 ファイル lockstep。Use when someone reaches for an IPC channel, a preload bridge, or `window.desktop`. Triggers include "IPC", "preload", "contextBridge", "ipcMain", "window.desktop", "チャンネル追加", "メインプロセスと通信".
---

# IPC — まず「それは IPC の仕事ではない」を確認する

## データは IPC を通らない

**Todo / Note / Schedule / Daily / タグ — アプリのデータに IPC は一切関与しない。** 正本は CLAUDE.md §3.1:

> フロントは `getDataService()` 経由でのみデータアクセス。**コンポーネントから直接バックエンド呼び出し（`invoke()` 等）禁止**。実装 = `shared/src/services/`

Supabase Postgres へは renderer から直接行く。Web / Electron / Capacitor の 3 配布形態が同じ `shared/` を共用するので、**Electron にしか無い経路にデータを乗せた瞬間、web とモバイルでその機能が消える**。データを足すなら行き先は `add-feature` スキルの Phase 2（DataService 境界）で、このファイルではない。

「メインプロセスと通信したい」と思ったら、まず**それが renderer で完結しないか**を疑うこと。たいていは完結する。

## 例外: desktop 殻のローカル事情（現在 7 関数）

完結しないのは「OS の外側にしか無いもの」だけ。実在するのはこれだけで、実体は `desktop/src/shared/ipcContract.ts` が正本:

- テーマ設定とウィンドウ位置の永続化（`electron-store`）
- アプリのバージョン
- **Supabase の認証セッション保存**（#838）— パッケージ版の renderer は `file://` で動き、そこでは `localStorage` が確実に永続しない。だからセッションだけはメインプロセス側（`safeStorage` 暗号化）に置いている

**Risk 1 の上限 = contextBridge の expose 関数 10 個まで**（現在 7）。上限に当たったら、それは殻が厚くなりすぎたサインなので、足す前に `desktop/README.md` の Constraints を読み直す。

## 足すときの 3 ファイル lockstep

Electron の IPC は「main の `ipcMain.handle` と preload の `ipcRenderer.invoke` に同じ文字列を書く」だけの仕組みで、**文字列同士は型で繋がらない**。片方だけ改名しても typecheck は通り、壊れるのはパッケージ版の実行時だけ（#838 = invoke が "No handler registered" で reject → auth init が「セッション無し」と解釈 → 起動のたびにログインを求められる）。

なので名前と signature を 1 箇所に置き、両端がそれを import する形になっている。

1. **`desktop/src/shared/ipcContract.ts`** — `DESKTOP_IPC` にチャンネル名を足し、`DesktopIpcApi` に呼び出し signature を足す。命名は `<namespace>:<action>`（`config:` / `window:` / `app:` / `authStorage:`）。**このモジュールは依存フリーを保つ**（`electron` を import しない — テストが素の Node から読む）
2. **`desktop/src/main/index.ts`** — ハンドラ表に `[DESKTOP_IPC.foo]: …` を足す。表は `DesktopIpcHandlers`（= `Record<DesktopIpcChannel, …>`）で注釈されているので、**契約に足してハンドラを書かないとコンパイルが落ちる**。登録は `DESKTOP_IPC_CHANNELS` のループが自動で行うため、登録漏れという失敗モードは存在しない
3. **`desktop/src/preload/index.ts`** — `api` オブジェクトにメソッドを足す。`DesktopIpcApi` で注釈されているので、抜けと型違いはここで落ちる

引数は**メインプロセス側で必ず検証する**。renderer は TS の型に関係なく任意の値を送れるので、ハンドラの引数型は `unknown` で受けて中で絞る（契約側の `DesktopIpcHandler` がそういう形になっている）。関数は橋を渡らない（シリアライズ可能な値のみ）。

## 検証

`desktop/tests/ipcContract.test.ts` が両端の被覆・チャンネルの重複と名前空間・引数の受け渡しを見張る。`shared/src/services/supabaseAuthStorage.ts` は `electron` を import できないため同じ 3 メソッドを自前で宣言していて、その 2 つもこのテストで突き合わせている — **どちらかの signature を変えると desktop の typecheck が落ちる**のが設計意図。

```bash
cd desktop && npm run typecheck && npm run test
```

`desktop/src` を触るのが配布まわりの作業の途中なら、それは配布の問題ではなくアプリの問題なので **P-008 に従い実装せずキュー / Issue へ**（`2026-08-30-desktop-app-packaging.md` の Scope 宣言）。
