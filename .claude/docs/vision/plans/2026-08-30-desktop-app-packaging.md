---
Status: IN PROGRESS — Step 1-5 / 8-10 は着地済み（PR #1348 / #1360）。Step 3 は 2026-09-05 に `workflow_dispatch` を実走させて win / mac 両ジョブ success を実測（run 33958069275）。Step 7 の Windows 実機受け入れも同日、その run の artifact を入れて 6 項目中 5 項目まで通した。**Step 8（Mac 実機）は 2026-09-07 に全項目通過し、移行 SSOT の Phase 3 完了判定が埋まった**。**残りは Step 6（tag → Release — 外向き操作なのでユーザー手番）・Step 7 の最後の 1 項目（Windows 実機での実アカウントログイン + Todo CRUD）・Step 11（merge）**
Created: 2026-08-30
Branch: claude/desktop-packaging-win-1300（#1300）/ claude/desktop-packaging-mac-1301（#1301・前者に stack）/ claude/desktop-1300-release-verification（#1300 の実測記録）
Owner-chat: main（計画）/ refactor-core（実装）
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

| #   | Step                                                          | Gate    | Acceptance                                                                                     |
| --- | ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| 1   | `desktop/package.json` の version を実バージョンへ            | 🤖 自律 | `node -p "require('./desktop/package.json').version"` が `0.0.0` でない                        |
| 2   | `electron-builder.yml` 整備（buildResources / artifactName）  | 🤖 自律 | `cd desktop && npm run build` exit 0・設定読み込み警告なし                                     |
| 3   | `release-desktop.yml` 新規作成（win ジョブ + release ジョブ） | 🤖 自律 | `workflow_dispatch` 実行で windows ジョブが success ✅（2026-09-05 run 33958069275）           |
| 4   | 空ビルド防止ガードを workflow に追加                          | 🤖 自律 | env 未設定なら**赤くなる**ことを 1 度実測 ✅（2026-09-01 ローカル実測）                        |
| 5   | mac ジョブを追加                                              | 🤖 自律 | macos ジョブが success・arm64 `.dmg` が artifact に出る ✅（同じ run）                         |
| 6   | tag `desktop-v<version>` を打って Release 発行                | 🤖 自律 | `gh release view desktop-v<version> --json assets` に `.dmg` と `.exe`                         |
| 7   | Windows 実機の受け入れ（#1300）                               | 👀 目視 | インストール → 起動 → ログイン → Todo 追加 / 編集 / 削除                                       |
| 8   | macOS 実機の受け入れ（#1301）                                 | 👀 目視 | `.dmg` → `/Applications` → ログイン → 全 Section 表示 ✅（2026-09-07・未署名解除は不要だった） |
| 9   | `desktop/README.md` に配布手順を追記                          | 🤖 自律 | mac / win 両方の初回起動手順が書かれている                                                     |
| 10  | 移行 SSOT / step1 計画の Status 追随                          | 🤖 自律 | `bash scripts/docs-lint.sh` exit 0                                                             |
| 11  | PR → main merge                                               | 🛑 人手 | こうだいさんの merge ボタン（P-001）                                                           |

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

### Step 4 の実測（2026-09-01・ローカル / Windows 11）

計画時に 2 つ分からないことがあった。どちらもガードを一度も走らせていなかったからで、両方 3 回のビルドで潰した。

**(1) ガードの 3 つの `test -f` パスと `assets/` grep は正しいか** → 正しい。`electron-vite build` は `desktop/out/{main,preload}/index.js` と `desktop/out/renderer/index.html` を出し、JS/CSS は `desktop/out/renderer/assets/` に入る。

**(2) `env:` の値は本当に Vite に届くか** → 届く。`VITE_SUPABASE_URL=https://<probe>.supabase.co` を環境変数として渡してビルドすると、そのホスト名が `out/renderer/assets/` の中に文字列として現れる（`envPrefix: "VITE_"` が `process.env` 側も拾う）。**同じ手順を env 無しでやり直すとビルドは exit 0 のまま成功し、ホスト名は現れない** — これが「見た目は正常なインストーラで画面だけ真っ白」の正体で、ガードはここで赤くなる。

おまけで計画時の保留も解けた: **`desktop/.env` は効く**。renderer の `root` は `../web` だが `envDir` はそこには従っておらず、`desktop/.env` に書いた値は renderer のバンドルに焼かれた（実測）。`desktop/README.md` の記述は正しい。

> ここで検証していないのは **workflow 上で実際にこのステップが走ること**（Step 3 の acceptance）。ローカルで証明したのはガードの中身であって、ランナー上での実行ではない。

### Secrets

`deploy-web.yml` が既に使っている 2 件をそのまま流用する（**新規登録は不要**）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

anon key がバンドルに載るのは仕様（公開前提の公開鍵で、実際の防御は RLS）。**`service_role` key は絶対に置かない**（RLS を素通りする合鍵）。

---

## Acceptance Criteria (機械検証可能)

- [x] `gh run list --workflow release-desktop.yml --limit 1 --json conclusion --jq '.[0].conclusion'` が `success`（run 33958069275・2026-09-05）
- [ ] `gh release view desktop-v<version> --json assets --jq '[.assets[].name]'` に arm64 `.dmg` と NSIS `.exe` が含まれる
- [x] `node -p "require('./desktop/package.json').version"` が `0.0.0` でない（`0.1.0`）
- [x] `cd desktop && npm run typecheck` exit 0
- [x] `cd desktop && npm run test` exit 0
- [x] `cd desktop && npm run build` exit 0（既存 CI の desktop ステップが緑のまま）
- [x] `bash scripts/docs-lint.sh` exit 0（ローカル実行時は `LC_ALL=C` を付ける — CLAUDE.md §7.1）
- [ ] PR diff が ±500 行以内（workflow + yml + README + 計画書）
- [ ] 👀 Windows 11 実機で install → 起動 → ログイン → Todo 追加 / 編集 / 削除（#1300 — install / 起動 4 プロセス / 画面描画 / Supabase 往復まで 2026-09-05 に実測済み。実アカウントのログイン以降だけ未消化）
- [x] 👀 macOS 実機で `.dmg` → 起動 → ログイン → 全 Section 表示（#1301 — 2026-09-07）
- [x] 追加コスト **$0**（public repo の無料ランナー枠内・実機受け入れもランナー artifact の再利用で $0）
- [ ] 完了時: 本計画・移行 SSOT Phase 3 完了判定・per-chat memory の Status を更新した

---

## DB Migration Notes

なし（DDL を含まない）。

---

## Risks / Known Issues 参照

### R1 (高): macOS 未署名は Apple Silicon で「壊れているため開けません」— ただし**ダウンロード経路次第**（2026-09-07 実測で条件が判明）

`identity: null`（現行）でビルドした `.app` は、Big Sur / M1 以降では**署名の存在自体を要求されるため**起動を拒否される。

- **回避（配布時に必ず添える）**: 「システム設定 → プライバシーとセキュリティ → "このまま開く"」、または `xattr -dr com.apple.quarantine "/Applications/Life Editor.app"`
- **ad-hoc 署名は答えにならない**: `identity: "-"` はビルドしたマシンでしか動かない
- **恒久解**: Apple Developer Program（$99/年）での署名 + 公証。SSOT §8 の「完成後の判断」に従い今回は入れない
- 出典: [electron-builder macOS docs](https://www.electron.build/docs/mac/) / [Code Signing for macOS](https://www.electron.build/docs/features/code-signing/code-signing-mac/)

**2026-09-07 の実測で分かった条件**: この拒否が起きるのは `.dmg` に **`com.apple.quarantine` が付いている場合だけ**。Gatekeeper は「ダウンロードされた物」に付く検疫の付箋を見て評価に入る仕組みで、付箋が無ければ評価そのものが走らない。`gh run download` / `curl` は付箋を貼らないので、**その経路で入れた `.app` は警告ゼロで普通に起動した**（Step 8 はこの経路で通っている）。付箋を貼るのは LaunchServices 経由のダウンロード = **ブラウザや Mail**。つまり **GitHub Release のページから Safari / Chrome で落とした人だけが「壊れています」に当たる** — そして配布先の全員がその経路なので、README の手順は消さずに残す。

ついでに署名の実態も測れた。`codesign -dv` は `Signature=adhoc` / `linker-signed` / `Sealed Resources=none` を返す（electron-builder は署名していないが、Electron 本体のバイナリがリンカ由来の ad-hoc 署名を持っている）。`spctl -a -vv` は `code has no resources but signature indicates they must be present` で **reject** — 検疫の付箋が付いていれば、これがそのまま「壊れています」になる。「署名が無いから落ちる」ではなく「壊れた署名として落ちる」が正確な姿。

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
- **2026-08-31 (refactor-core / #1300)**: Step 1-4 + 9-10 を実装し、PR へ。`desktop/package.json` を `0.1.0` へ（lock も同時に揃えた）。`electron-builder.yml` は `buildResources` を**削除**した — アイコンは mac / win / linux とも `../resources` を明示参照しており、buildResources ディレクトリに入れるものが実際に無いため（実在化ではなく削除を選んだ）。`nsis.artifactName` は dmg と揃えて pin。
- **2026-08-31 実測 1（Step 4 のガード）**: `workflow_dispatch` は workflow が default branch に乗るまで起動できないので、workflow と**同じ bash をローカルのビルド成果物に当てて**両方向を確かめた。`VITE_SUPABASE_URL` を渡してビルド → ホストが bundle に焼けて exit 0。env 無し / 焼けていない bundle → exit 1。つまり「空のまま緑になる」経路は塞がっている。
- **2026-08-31 実測 2（計画書の疑問の回答）**: 「`desktop/.env` が renderer に効いているかは自明でない」の件は、**効いている**が結論。`desktop/.env` だけを置いて process env なしでビルドしたところ、そのホストが `out/renderer/assets/` に焼けていた（renderer `root` は `../web` だが、envDir は desktop/ 側を見ている）。README の記述は正しいので直さない。
- **2026-08-31 未実行**: Step 6（tag `desktop-v0.1.0` を打つ）は本セッションの指示で禁じられているため未実行。GitHub Release は引き続き 0 本。
- **2026-08-31 (refactor-core / #1301)**: Step 5（macos ジョブ）を #1300 のブランチに stack して追加。matrix に macos-latest 行を入れ、**Release に載せるのは arm64 dmg だけ**で x64 は `unverified-*` 名の artifact に留めた（release ジョブの download を `pattern: desktop-*` に絞っている）— D-20260830-main-1 の「放置時」の安全側に従った。回答が A なら electron-builder.yml から x64 宣言を消し、B なら glob を `*.dmg` に戻すだけで切り替わる。
- **2026-08-31 実測 3（Step 5-2 のアイコン）**: `resources/icon.icns` をバイナリでパースし、magic `icns` / 宣言長 = 実ファイル長（1,205,487 B）/ エントリ 11 種（`ic04`-`ic14` + `info`。`ic10` = 1024px を含む）を確認した。**「実際に `.app` のアイコンとして焼けるか」は Mac 実機でしか見られない**ので、ここでは「壊れていない / 必要なサイズが入っている」まで。
- **2026-08-31 未実行 (#1301)**: macos ジョブの run 自体（Step 5 の Acceptance）と Step 8（Mac 実機受け入れ）は未実施。前者は workflow が default branch に入るまで起動できず、後者は Mac 実機が要る。
- **2026-09-05 (refactor-core / #1300) — Step 3 実走**: `workflow_dispatch` を main に対して起動（run 33958069275）。**初回から両 OS とも success**、`release` ジョブはタグ無しのため意図どおり skip。ランナ上でも `verify renderer bundle is not empty` が「renderer bundle carries the configured Supabase host」を出して通過し、`electron-builder` が `Life Editor-0.1.0-x64-setup.exe` を作って artifact に上げた（84,344,716 B）。これで「ローカルでガードの中身は証明したが、ランナ上での実行は未検証」という 2026-09-01 の宿題が閉じた。
- **2026-09-05 実測（Step 7 = Windows 実機受け入れ）**: 上の run の `desktop-windows` artifact を落として `/S` でサイレントインストール。(1) レジストリの `DisplayName` が `Life Editor 0.1.0` になり版が実機まで通った。(2) `resources/app.asar` に本番の Supabase ホストが焼けていた（packaging を跨いでも消えていない）。(3) 起動して **プロセス 4 本**（R6 / #545 の基準）。(4) ウィンドウがサインインカードを描画（真っ白ではない）。(5) **わざと誤った資格情報で送信 → 「Email or password is incorrect」**。この文言が出たこと自体が往復の証拠になる — `web/src/AuthScreen.tsx::errorKeyFor` は Supabase が返す生の `Invalid login credentials` に正規表現が当たったときだけこの文を選び、当たらなければ（＝リクエストがそもそも届いていない場合を含めて）汎用の「Authentication failed…」に落ちる。つまりパッケージ後の `file://` renderer から Supabase まで実際に届いている（dev では素通りする origin / CSP 系の事故が出るならここ）。**残るのは実アカウントでのログインと Todo CRUD だけ**で、これは資格情報が要るためこうだいさんの手番。
- **2026-09-05 実装（release 経路のガード 2 本）**: この run で分かったのは「build 経路は通る」ことだけで、`release` ジョブはタグでしか動かないため**一度も実行されていない**。初回のタグがぶっつけ本番になるので、2 つだけ機械に守らせた。(a) **タグと `desktop/package.json` の版一致**（README が文章で注意していた「先に版を上げる」を強制。約 5 分のパッケージングの前に置いて、打ち直しで済む間違いに 2 OS 分を払わせない）。(b) **集約側の資産検査**（NSIS 1 本 + arm64 dmg 1 本が揃い、どちらも 1 MB 以上）。`gh release create dist/*` は渡された物を素直に添付するので、artifact が片方欠けても「アセット 1 個の Release」が普通に出来上がる。
- **2026-09-05 実測（ガードの落とし穴）**: (b) を書いたとき最初は `find -size -1M` にしていたが、**2 KB の偽 dmg を置いても素通りした**。GNU find の `-size` は指定単位に**切り上げ**てから比較するため、`-1M` は実質「0 バイトのファイル」しか拾わない。`-size -1000000c`（バイト指定）に直して、full / 片方欠け / 2 KB の 3 ケースで期待どおりになることを確かめた。**書いたガードは一度わざと壊して確かめる**という Step 4 の教訓がそのまま効いた形。
- **2026-09-05 未実行**: Step 6（tag `desktop-v0.1.0`）は外向き操作（public repo に恒久的な ref が残り、draft とはいえ Release が生える）のため踏んでいない。GitHub Release は引き続き 0 本。判断材料は揃っているので、こうだいさんが `git tag desktop-v0.1.0 && git push origin desktop-v0.1.0` を打てば残りの経路が一度に埋まる。
- **2026-09-07 (main / #1301) — Step 8 = macOS 実機受け入れ通過**: run 33958069275 の `desktop-macos` artifact（`Life Editor-0.1.0-arm64.dmg`・99 MB）を Apple Silicon 実機へ。**ローカル `npm run build:mac` は選ばなかった** — 実 DMG 生成は数 GB 食い、空きが細いと Bash ごと止まる事故歴がある（この機械の空きは 15 GB）。加えて「配る物そのものを受け入れる」という README の原則にも合う。通した順に: `hdiutil attach` → `/Applications` へコピー → **警告ゼロで起動**（理由は R1 の追記）→ **プロセス 4 本**（main / GPU / network utility / renderer = #545 の基準）→ サインインカード描画 → ネイティブ Menu（Life Editor / Edit / View / Window）→ `app.asar` に本番 Supabase ホストが焼けている（packaging を跨いで生存）→ **Dock アイコンが `icon.icns` から焼かれている**（#1301 の «icns が実際にアイコンになるか» が実測で埋まった）→ **メニューバーにトレイアイコンが常駐**（`2026-06-19-step1-desktop-daily-driver.md` の Mac ゲートの一部）→ **ログイン → 全 Section 表示**（こうだいさん目視）。
- **2026-09-07 事故と中止**: 上の受け入れの途中、残っていたログイン確認を自動化しようとして `System Events` の座標クリックを 1 回撃った。その時フォアグラウンドにいたのは Life Editor ではなく**別アプリの購入画面**で、無関係なウィンドウにクリックが落ちた（購入ボタンとは別座標のため実害は無し）。**画面全体を対象にした GUI 自動操作は、フォアグラウンドが自分の想定どおりである保証がないので使わない** — Windows 側 README が «スクリプト化するなら DPI-aware にせよ» と書いているのと同じ場所の、もう一段手前の落とし穴。資格情報が要る確認は自動化せず人手に返すのが正しい。
