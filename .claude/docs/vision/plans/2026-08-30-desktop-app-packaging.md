---
Status: Draft
Created: 2026-08-30
Branch: claude/main-desktop-packaging-1300
Owner-chat: main
Task: Desktop 配布パッケージ化 — mac / Windows のインストーラを tag 駆動で再現可能に作る
Parent: ../../../2026-05-04-cross-platform-migration.md（Phase 3 完了判定 + Phase 5-B の配布側）
Related:
  - "#1300" — Windows 配布パッケージ化（リリース基盤 + windows ジョブ + 実機受け入れ）
  - "#1301" — macOS 配布パッケージ化（macos ジョブ + Gatekeeper 導線 + 実機受け入れ）
  - ./2026-06-19-step1-desktop-daily-driver.md — Mac 実機ゲートだけ残して停止中の先行計画
---

# Plan: Desktop 配布パッケージ化（mac .dmg / Windows NSIS）

> 一言で言うと「**ビルドはできるが、配れない**」状態を終わらせる計画。
> 材料も調理器具も揃っていて味見も済んでいるのに、持ち帰り用の容器とラベルが無いので誰にも渡せていない — 今はそういう状態になっている。

---

## Context

- **動機**: `desktop/` の Electron 殻は Windows 実機の golden path を通過済み（#530）だが、**成果物を配る経路が存在しない**。GitHub Release は 1 本も無く、リリース自動化も無く、`desktop/package.json` の `version` は `0.0.0` のまま。macOS に至っては一度もビルドされていない。2026-08-29 の裁定（[D-20260829-main-1](../../../decisions/D-20260829-main-1.md)）で **限定人数への配布 + サインアップ開放**へ方針転換したため、「渡せる .dmg / .exe がある」ことが前提条件になった。
- **制約**:
  - **$0 厳守**（移行 SSOT §8）。署名 / 公証 / ストア申請は入れない。
  - このリポジトリは **public** なので GitHub-hosted の macOS / Windows ランナーが**無料**。ここが今回の実現可能性の土台で、private 化すると前提が崩れる。
  - renderer は `web/` を丸ごと再利用する構成のため、ビルドには `shared` → `web` → `desktop` の 3 パッケージの `npm ci` が要る（`desktop/electron.vite.config.ts` の renderer `root` が `../web`）。
  - Supabase の URL / anon key は **ビルド時に文字列として焼き込まれる**（Vite の `import.meta.env`）。実行時に読む口は無い。
- **Non-goals**:
  - コード署名・公証（mac $99/年 / win $80-500/年 — SSOT §8「完成後の判断」）
  - `electron-updater` の有効化（未署名の update feed を開けるのは危険。`desktop/src/main/index.ts` の SECURITY コメントの通り、署名導入と**同時**にしか入れない）
  - Mac App Store / Microsoft Store 申請（SSOT §9 Non-goals）
  - Linux AppImage の配布（設定は既にあるが、今回の受け入れ対象から外す）
  - Capacitor（iOS / Android）側の配布（Phase 4 の別件）

### 現状の実測（2026-08-30）

| 項目                           | 実測                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `desktop/electron-builder.yml` | mac dmg（arm64 + x64）/ win nsis（x64）/ linux AppImage（x64）を宣言済み             |
| Windows ビルド                 | ローカルで green・NSIS インストール → golden path 通過（#529 / #530）                |
| macOS ビルド                   | **一度も実行されていない**。`resources/icon.icns` は commit 済みだが未検証           |
| リリース自動化                 | **無い**。`ci.yml` は `electron-vite build` で止まる（パッケージングは意図的に除外） |
| GitHub Release                 | **0 本**（`gh release list` が空）                                                   |
| `desktop/package.json` version | `0.0.0` — `artifactName` に版が乗るので成果物名が `... 0.0.0.exe` になる             |
| `directories.buildResources`   | `build` を指しているが `desktop/build/` が実在しない                                 |
| auto-updater                   | 意図的な no-op スケルトン（Phase 3 のまま）                                          |

---

## 検討した代替案（必須）

| 案                                                         | 採否 | 却下理由                                                                                                                                        | 復活条件                                                       |
| ---------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| tag 駆動の GitHub Actions（macos-latest + windows-latest） | ✓    | —                                                                                                                                               | —                                                              |
| 各 OS でローカル手動ビルド                                 | ✗    | mac 実機が常時使えるとは限らず、再現性が人の手順書頼みになる                                                                                    | mac / win 実機が常時使える運用になったら手元ビルドを一次に戻す |
| `ci.yml` に electron-builder をフルで載せる（PR ごと）     | ✗    | PR ごとに 2 OS のランナーを回すのは時間の無駄。`ci.yml` 冒頭コメントの判断（パッケージングは CI で回さない）を維持する                          | —                                                              |
| electron-builder の `publish: github` に直接投げる         | ✗    | mac / win の 2 ジョブが同じ Release を取り合って draft が壊れる事故が起きやすい                                                                 | 単一 OS 構成に戻ったら                                         |
| ad-hoc 署名（`mac.identity: "-"`）で「壊れています」を回避 | ✗    | **ad-hoc 署名はビルドしたマシンでしか動かない**ので配布の答えにならない。加えて electron-builder 26 系で ad-hoc のカメラ / マイク回帰報告がある | —                                                              |
| 今回まとめて署名 + 公証を入れる                            | ✗    | $99/年 + $80-500/年。$0 原則（SSOT §8）に反する                                                                                                 | こうだいさんが有料化を裁定したら（配布先が警告で詰まった時）   |
| `electron-updater` を同時に有効化                          | ✗    | 未署名バイナリへの自動更新は、feed が乗っ取られたら任意コードが流れ込む。署名とセットでしか安全にならない                                       | コード署名を導入したタイミングで同時に                         |

> `ask-user` は今回使っていない（$0 原則・Non-goals・配布方針はいずれも既存の裁定で決着済みのため）。唯一割れる論点は下記の 1 件で、これは P-005 に従い実装で先行せずキューへ積む。

### ユーザー判断待ち（P-005 — 実装で先行しない）

**Intel Mac 向け x64 `.dmg` を出すか**。`macos-latest` は arm64 ランナーなので x64 は**クロスビルドになり、CI 上では起動検証ができない**。「検証できないものは配らない」なら arm64 のみに絞る。現行 `electron-builder.yml` は両方を宣言している。→ `comm/decisions/chat-main.md` に起票済み。**回答が来るまでは現行宣言（両アーキ）のまま作り、arm64 だけを受け入れ対象にする**（安全側）。

---

## Scope (Touchable Paths)

```
.github/workflows/release-desktop.yml          ← 新規
desktop/package.json                            ← version / scripts
desktop/electron-builder.yml                    ← buildResources / artifactName
desktop/README.md                               ← 未署名の初回起動手順
.claude/docs/vision/plans/2026-08-30-desktop-app-packaging.md
.claude/2026-05-04-cross-platform-migration.md  ← Phase 3 完了判定の追随（受け入れ通過後）
.claude/docs/vision/plans/2026-06-19-step1-desktop-daily-driver.md ← Mac ゲートの追随（同上）
```

**対象外（明示・無改変）**: `shared/` / `web/` / `mcp-server/` / `mobile/` / `supabase/` / `desktop/src/`。

> 本計画は**配布の器**だけを触る。`desktop/src/main/index.ts` に手を入れたくなったら、それは配布の問題ではなくアプリの問題なので **P-008** に従い実装せずキュー or Issue へ積む。

---

## Steps

| #   | Step                                                          | Gate    | Acceptance                                                              |
| --- | ------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| 1   | `desktop/package.json` の version を実バージョンへ            | 🤖 自律 | `node -p "require('./desktop/package.json').version"` が `0.0.0` でない |
| 2   | `electron-builder.yml` 整備（buildResources / artifactName）  | 🤖 自律 | `cd desktop && npm run build` exit 0・設定読み込み警告なし              |
| 3   | `release-desktop.yml` 新規作成（win ジョブ + release ジョブ） | 🤖 自律 | `workflow_dispatch` 実行で windows ジョブが success                     |
| 4   | 空ビルド防止ガードを workflow に追加                          | 🤖 自律 | env 未設定でジョブを回すと**赤くなる**ことを 1 度実測                   |
| 5   | mac ジョブを追加                                              | 🤖 自律 | macos ジョブが success・arm64 `.dmg` が artifact に出る                 |
| 6   | tag `desktop-v<version>` を打って Release 発行                | 🤖 自律 | `gh release view desktop-v<version> --json assets` に `.dmg` と `.exe`  |
| 7   | Windows 実機の受け入れ（#1300）                               | 👀 目視 | インストール → 起動 → ログイン → Todo 追加 / 編集 / 削除                |
| 8   | macOS 実機の受け入れ（#1301）                                 | 👀 目視 | `.dmg` → `/Applications` → 未署名解除 → ログイン → 全 Section 表示      |
| 9   | `desktop/README.md` に配布手順を追記                          | 🤖 自律 | mac / win 両方の初回起動手順が書かれている                              |
| 10  | 移行 SSOT / step1 計画の Status 追随                          | 🤖 自律 | `bash scripts/docs-lint.sh` exit 0                                      |
| 11  | PR → main merge                                               | 🛑 人手 | こうだいさんの merge ボタン（P-001）                                    |

### Gate 凡例

- **🤖 自律** — Claude が完結（型検査 / CI の成否で判定）
- **👀 目視** — 実機でしか確認できない（インストーラの起動・Gatekeeper・SmartScreen）
- **🛑 人手** — ユーザー操作必須（PR merge = P-001）

> Step 8 は **Mac 実機が要る**。Windows 機しか無い日は Step 1-7 + 9-10 まで進めて Step 8 だけを残してよい（#1301 を open のまま残す）。

---

## 実装の骨子（release-desktop.yml）

```yaml
on:
  push:
    tags: ["desktop-v*"]
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest # arm64 ランナー
            target: --mac
          - os: windows-latest
            target: --win
    # steps:
    #   checkout / setup-node 22（cache-dependency-path = shared, web, desktop の 3 lock）
    #   shared:  npm ci && npm run build   … web が ../shared/src を引くので node_modules が要る
    #   web:     npm ci                    … renderer の実体（react / tiptap / supabase）
    #   desktop: npm ci
    #   desktop: npx electron-vite build   … env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    #   空ビルドガード（下記）
    #   desktop: npx electron-builder <target> --publish never
    #   upload-artifact: desktop/release の .dmg / .exe

  release:
    needs: build
    # download-artifact（全 OS 分）→ gh release create "$GITHUB_REF_NAME" --draft <ファイル群>
```

### 空ビルドガード（Step 4）

`deploy-web.yml` の `verify build output` と同じ思想。**env が抜けたまま「ビルドは通る」のが一番危ない** — 見た目は正常なインストーラができて、入れた人の画面だけが真っ白になる。

```bash
test -f desktop/out/renderer/index.html
grep -rq "supabase.co" desktop/out/renderer/assets/   # URL が焼けているか
```

> `desktop/electron.vite.config.ts` は renderer の `root` を `../web` に置いており、Vite の `envDir` は `root` 既定。つまり**ローカルの `desktop/.env` が renderer に効いているかは自明でない**（README は `desktop/.env` と書いている）。CI では `env:` 経由の `process.env` が `envPrefix: "VITE_"` で拾われる経路を使うが、**このガードが「拾えている」ことの唯一の証拠**になる。ローカル側の `.env` 解決の実態は Step 4 の実測でついでに確認する。

### Secrets

`deploy-web.yml` が既に使っている 2 件をそのまま流用する（**新規登録は不要**）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

anon key がバンドルに載るのは仕様（公開前提の公開鍵で、実際の防御は RLS）。**`service_role` key は絶対に置かない**（RLS を素通りする合鍵）。

---

## Acceptance Criteria (機械検証可能)

- [ ] `gh run list --workflow release-desktop.yml --limit 1 --json conclusion --jq '.[0].conclusion'` が `success`
- [ ] `gh release view desktop-v<version> --json assets --jq '[.assets[].name]'` に arm64 `.dmg` と NSIS `.exe` が含まれる
- [ ] `node -p "require('./desktop/package.json').version"` が `0.0.0` でない
- [ ] `cd desktop && npm run typecheck` exit 0
- [ ] `cd desktop && npm run test` exit 0
- [ ] `cd desktop && npm run build` exit 0（既存 CI の desktop ステップが緑のまま）
- [ ] `bash scripts/docs-lint.sh` exit 0（ローカル実行時は `LC_ALL=C` を付ける — CLAUDE.md §7.1）
- [ ] PR diff が ±500 行以内（workflow + yml + README + 計画書）
- [ ] 👀 Windows 11 実機で install → 起動 → ログイン → Todo 追加 / 編集 / 削除（#1300）
- [ ] 👀 macOS 実機で `.dmg` → 起動 → ログイン → 全 Section 表示（#1301）
- [ ] 追加コスト **$0**（public repo の無料ランナー枠内）
- [ ] 完了時: 本計画・移行 SSOT Phase 3 完了判定・per-chat memory の Status を更新した

---

## DB Migration Notes

なし（DDL を含まない）。

---

## Risks / Known Issues 参照

### R1 (高): macOS 未署名は Apple Silicon で「壊れているため開けません」

`identity: null`（現行）でビルドした `.app` は、Big Sur / M1 以降では**署名の存在自体を要求されるため**起動を拒否される。

- **回避（配布時に必ず添える）**: 「システム設定 → プライバシーとセキュリティ → "このまま開く"」、または `xattr -dr com.apple.quarantine "/Applications/Life Editor.app"`
- **ad-hoc 署名は答えにならない**: `identity: "-"` はビルドしたマシンでしか動かない
- **恒久解**: Apple Developer Program（$99/年）での署名 + 公証。SSOT §8 の「完成後の判断」に従い今回は入れない
- 出典: [electron-builder macOS docs](https://www.electron.build/docs/mac/) / [Code Signing for macOS](https://www.electron.build/docs/features/code-signing/code-signing-mac/)

### R2 (中): Windows SmartScreen

未署名の NSIS は初回起動で「Windows によって PC が保護されました」が出る。「詳細情報」→「実行」で通る。README に明記する。証明書（$80-500/年）は完成後判断。

### R3 (中): x64 mac の検証不能

上記「ユーザー判断待ち」の通り。回答が来るまで **arm64 だけを受け入れ対象**にする。

### R4 (中): 無言で壊れたインストーラを配る

env 抜けビルドは「成功したように見えて中身が空」。Step 4 のガードで塞ぐ。`deploy-web.yml` が同じ穴を先に塞いでいるので、思想はそこへ揃える。

### R5 (低): electron-builder のバージョン据え置き

現行 `^25.1.8`。26 系には ad-hoc 署名まわりの回帰報告があるため、本計画では**上げない**。上げるなら別 Issue。

### R6 (低): 起動判定を「プロセス生存」で見ない

Electron は**プロセス 4 本**で起動する。1 本だけ立って落ちている状態を生存確認は見抜けない（#545 の実例）。受け入れ手順では 4 本を基準にする。

### 参照する既知の環境系知見

- [known-issues 033](../../known-issues/033-electron-binary-not-extracted-dev-only.md) — この Windows 機で Electron バイナリの展開が壊れることがある（dev 起動時のみ）。CI ランナーには関係しないが、ローカル再現時に踏む

---

## References

- 移行 SSOT: [`.claude/2026-05-04-cross-platform-migration.md`](../../../2026-05-04-cross-platform-migration.md) §8 配布・署名の現実 / Phase 3 / Phase 5-B
- 先行計画: [`2026-06-19-step1-desktop-daily-driver.md`](./2026-06-19-step1-desktop-daily-driver.md)（Mac 実機ゲートで停止中）
- 既存の配布 workflow（思想の手本）: `.github/workflows/deploy-web.yml`
- 検証ゲートの正本: `.github/workflows/ci.yml`（`verify` ジョブ）
- Issue: #1300（Windows + リリース基盤） / #1301（macOS）

---

## Worklog

- **2026-08-30 (chat-main)**: 現状調査 → Issue #1300 / #1301 起票 → 本計画書作成。調査で確定した事実は §Context の実測表。macOS 未署名の挙動（R1）は electron-builder 公式ドキュメントで裏取り済み。x64 mac の可否だけは判断キューへ回した（P-005）。
