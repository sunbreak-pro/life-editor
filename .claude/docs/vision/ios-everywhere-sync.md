# iOS Everywhere + Sync

> Life Editor を iPhone に **常時インストールした状態** で保ち、Desktop ↔ iOS で Cloud Sync を回す運用方針。
> Apple Developer Program（年 $99）には加入しない前提で、無料 Apple ID + ケーブル / ローカル再署名 で回す。
>
> 移植作業そのものの方針は [`mobile-porting.md`](./mobile-porting.md)。本ファイルは「端末に入れ続ける」側の計画。

---

## 目的

- N=1（作者本人）の iPhone に Life Editor をインストールしっぱなしにする
- 月数ドル以上のランニングコスト（Developer Program / クラウド固定費）を発生させない
- Desktop 側の SQLite SSOT と Cloudflare Workers + D1 経由で双方向同期する
- App Store 審査は通さない（Non-Goals に従う）

---

## 前提: 無料署名の制約（2026-04 時点）

無料 Apple ID（Personal Team）で iOS 実機に署名する場合の Apple 側制約:

| 項目              | 制約                                            |
| ----------------- | ----------------------------------------------- |
| 署名有効期限      | **7 日**（期限後アプリが起動しなくなる）        |
| 同時インストール  | **3 App ID / 端末**                             |
| 新規 App ID       | **10 個 / 7 日** のクールダウン                 |
| 配布              | 不可（自分の端末のみ）                          |
| Bundle ID         | 1 アプリ 1 Bundle ID（共有不可）                |
| 必須環境          | macOS + Xcode + Apple ID ログイン               |

→ **7 日ごとに再署名が必要** がこの方針の最大の運用ポイント。

## 選択肢の比較

| 方法                              | 再署名                | ケーブル | 追加ツール                | 備考                                                          |
| --------------------------------- | --------------------- | :------: | ------------------------- | ------------------------------------------------------------- |
| **① Xcode 直接**                  | 7 日ごと手動再ビルド  |    ✓     | Xcode のみ                | `cargo tauri ios dev` / `build` でそのまま実機デプロイ        |
| **② SideStore**                   | 7 日ごと自動（端末内）|    -     | SideStore + LiveContainer | Mac 不要（初回セットアップ後）、WireGuard + minimuxer で自己署名更新 |
| **③ AltStore (Classic)**          | 7 日ごと自動（母艦経由）|   -     | AltServer (Mac 常駐)      | 母艦が同一 Wi-Fi にいる必要あり                               |
| **④ TrollStore**                  | 不要（恒久署名）      |    -     | -                         | iOS 14.0–17.0 のみ。**iOS 17.0.1 以降は CoreTrust 修正で不可**。対象外 |

**採用方針**: ① を主、② を補助。

- **Primary: ① Xcode 直接ビルド**。Tauri の `cargo tauri ios build` / `dev` が Xcode プロジェクトを生成 → USB 接続の iPhone に Run。
  - Tauri の CI 経由では物理デバイスへのデプロイで既知の問題がある（[tauri#12327](https://github.com/tauri-apps/tauri/issues/12327) 等）ため、Xcode GUI から Run するのが最も確実。
  - 週 1 回「母艦 Mac で `cargo tauri ios build` → Xcode で実機 Run」の運用を定例化する。
- **Secondary: ② SideStore**。Mac が手元にない週や出先運用に備えたフォールバック。LiveContainer 併用で 3 App ID 制限を回避できる余地がある（ただし挙動未検証）。
- **④ TrollStore は採用しない**。対象 iOS が絞られ、将来性がない。

## 運用ランブック（コマンド粒度）

### 0. 事前インストール（1 回だけ）

```bash
# macOS
xcode-select --install                       # Command Line Tools（インストール済みならスキップ）
brew install rustup-init && rustup-init -y   # Rust toolchain
rustup target add aarch64-apple-ios          # iOS 実機ターゲット
rustup target add aarch64-apple-ios-sim x86_64-apple-ios  # シミュレータ（任意）
cargo install tauri-cli --version '^2.0.0'   # Tauri CLI v2
```

Xcode は **App Store 版の Xcode 本体**（Command Line Tools のみでは不足）。起動後 `Xcode > Settings > Accounts` で Apple ID をサインインし、Team 一覧に **(Personal Team)** が出ていることを確認する。

### 1. 初回セットアップ（プロジェクト側、1 回だけ）

```bash
cd /Users/newlife/dev/apps/life-editor

# Tauri iOS プロジェクト骨格生成（src-tauri/gen/apple/ が作られる）
cargo tauri ios init

# 生成された Xcode ワークスペースを開く
open src-tauri/gen/apple/life-editor.xcworkspace
```

Xcode GUI 側（1 回だけ）:

1. 左ペインで `life-editor` プロジェクト → TARGETS > `life-editor_iOS` を選択
2. **Signing & Capabilities** タブ
   - `Automatically manage signing` にチェック
   - `Team` = `<Apple ID 名> (Personal Team)`
   - `Bundle Identifier` = `com.newlife.lifeeditor`（他人と衝突しないオリジナルに。以後**固定**）
3. エラー `Failed to register bundle identifier` 等が出たら ID を微変更してリトライ
4. 初回ビルドでは Xcode が自動で App ID と Provisioning Profile を発行する

iPhone 側（1 回だけ、iOS 16+）:

1. 設定 > 一般 > 情報（またはこの時点ではまだ現れないので先に Mac 側で Run → 後述のダイアログ経由でオン）
2. 設定 > プライバシーとセキュリティ > **デベロッパモード** = ON → 再起動
3. Mac に USB で接続、「このコンピュータを信頼」

### 2. 初回インストール（USB、実機デプロイ）

```bash
# 方式 A: CLI から実機ビルド＋起動（Xcode を開きっぱなしでよい）
cargo tauri ios dev --host       # 実機を選ぶプロンプトが出る。LAN 経由で dev server も接続
# ↑ 実機が表示されない場合は Xcode > Window > Devices and Simulators で認識確認

# 方式 B: Xcode GUI から Run（最も安定。推奨）
#   1. 上部のスキームバーで実機を選択
#   2. Scheme > Edit Scheme > Run > Build Configuration = Release
#   3. ⌘R で Run
```

初回起動時、iPhone 画面に「信頼されていないデベロッパ」ダイアログが出る:

1. 設定 > 一般 > **VPN とデバイス管理** > `Apple Development: <Apple ID>` を開き「このデベロッパを信頼」
2. アプリアイコンをタップして起動

### 3. 4G での動作確認（ケーブルを抜く）

```bash
# Mac 側で Release ビルドを bundle 済みにしてから Run（dev server 依存を切る）
cargo tauri ios build                              # 成果物 .ipa は src-tauri/gen/apple/build/arm64/
# または Xcode GUI で Scheme を Release に切り替えて ⌘R
```

iPhone 側:

1. USB ケーブルを抜く
2. Wi-Fi をオフ、モバイルデータ通信（4G/5G）のみに切替
3. Life Editor を起動
4. 初期同期が走ることを確認:
   - ノートが D1 から pull されて表示される
   - 新規メモ作成 → 数秒以内に Desktop 側にも反映
5. 失敗する場合の一次切り分け:
   - ATS（Info.plist に平文 HTTP を含んでいないか）
   - Cloudflare Workers endpoint が `.workers.dev` 等の公開 HTTPS URL になっているか（`src-tauri/src/sync/` の設定確認）
   - 証明書信頼が完了しているか（上記 §2 最後）

### 4. 週次リフレッシュ（7 日ごと）

署名が切れるとアプリ起動時に「このアプリを検証できません」と出る。以下で再署名:

```bash
cd /Users/newlife/dev/apps/life-editor

# iPhone を USB 接続。
# cargo clean は絶対に叩かない（Rust の iOS release キャッシュが消えて 10 分以上余計にかかる）

# Xcode の incremental build に任せる最短コース:
open src-tauri/gen/apple/life-editor.xcworkspace
# → Xcode で実機選択 → ⌘R
# コード未変更なら incremental build + re-sign + install で 2〜5 分
```

所要時間の目安:

| フェーズ                 | 初回 / clean | 週次（キャッシュ有り） |
| ------------------------ | :----------: | :--------------------: |
| Rust release build       | 5〜15 分     | 10〜30 秒              |
| Vite frontend build      | 10〜30 秒    | 10〜30 秒              |
| Xcode 包装 + codesign    | 30 秒〜1 分  | 10〜30 秒              |
| 実機 install + 起動      | 30 秒〜2 分  | 30 秒〜1 分            |

Bundle ID は **固定**。変えると 10 App ID / 7 日の枠を消費し、翌週以降の再署名が詰まる。

### 5. トラブル別の 1 次対処

| 症状                                              | 対処                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Unable to boot device` / `No such file ...app`   | iPhone 再接続、Xcode > Window > Devices and Simulators でデバイスを Unpair → 再ペア  |
| `Could not find Developer Disk Image`             | iOS バージョンと Xcode バージョンの不整合。Xcode を最新に                              |
| `Unable to install: valid provisioning not found` | Signing & Capabilities で Team 再選択、または一度 `Bundle Identifier` を微変更して戻す |
| 起動直後クラッシュ                                | Release でのみ落ちる場合 → Xcode コンソールログ確認。ATS / WKWebView / Capability     |
| 4G で同期だけ失敗                                 | Workers URL のドメイン、`/sync/full` のレスポンスコード、`SYNC_TOKEN` の期限          |

### 6. Life Editor ノート連携（手順自体をアプリ内に残す）

本 Markdown のうち §0〜§5 を Life Editor のノートにも保存しておくと、Mac が手元にないときに iPhone から手順参照できる。

Mac 側 Claude Code で MCP 経由で同期:

```text
# 既存ノート検索
search_all({ query: "iOS ビルド手順", limit: 10 })

# ヒットあり → 既存ノート末尾に追記
update_note({
  id: "<note-id>",
  content: "<既存本文> + 本 Markdown の §0〜§5>"
})

# ヒット無し → 新規作成
create_note({
  title: "iOS ビルド & 4G 同期 運用手順",
  content: "<本 Markdown の §0〜§5>"
})
```

### 同期設計（再掲: CLAUDE.md §3.1 / §3.4）

- iOS 側も Desktop と同じ SQLite スキーマを持つ（`src-tauri/src/db/migrations.rs` が正本）
- Cloudflare Workers + D1 経由で双方向同期、バージョンカラム + last-write-wins
- 7 日の署名切れ直前に iOS 側で pending 変更が残らないよう、**アプリ起動時 + 一定間隔で push** の sync 方針を維持
- 既知課題: `sync_last_synced_at` 未保存 / `tasks.updated_at` NULL on creation は本計画の前提条件としてブロッカー（[known-issues/004](../known-issues/004-sync-last-synced-at-not-persisted.md) / [005](../known-issues/005-tasks-updated-at-null-on-creation.md)）

## 範囲外

- TestFlight / App Store 配布（Developer Program が必要なので当面見送り）
- 他者配布（家族・知人の iPhone への導入。無料署名では不可）
- Push 通知 / Background Fetch（Apple Developer Program 必須機能）
- JIT コンパイル系の最適化（無料署名では entitlements 不足）

## 残リスクと監視項目

- **iOS メジャーアップデート時の SideStore / Xcode 挙動変化**: 年 1 回の iOS x.0 リリース直後は移行リスク高。Xcode 側を優先、SideStore は安定版リリース後に追従
- **Apple Developer Program の制約変更**: EU DMA 対応で 2024 以降変動が続いている。年次で最新調査
- **Bundle ID の 10 個/7 日制限**: 再ビルド時に Bundle ID を頻繁に変えるとヒット。固定 Bundle ID 運用を徹底

## 個別実装プランの運用

本ファイルは方針のみ。初回セットアップ手順の詳細化・スクリプト化・Known Issue 解消は `.claude/YYYY-MM-DD-<slug>.md` プランで扱う（CLAUDE.md §9）。
