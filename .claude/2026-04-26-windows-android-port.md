---
Status: PLANNING
Created: 2026-04-26
Updated: 2026-04-26 (v3: MVP 配布優先にスコープ縮小、Sentry/Updater/Sync 分離は別計画に切り出し)
Task: 新規 — Windows + Android MVP 配布 (友達向け)
Project path: /Users/newlife/dev/apps/life-editor
Related:
  - [docs/vision/mobile-porting.md](./docs/vision/mobile-porting.md) — Desktop → Mobile 移植方針 (iOS 主軸)
  - [docs/vision/desktop-followup.md](./docs/vision/desktop-followup.md) — Desktop 残課題
  - [CLAUDE.md §2 Platform](./CLAUDE.md) — 機能差分マトリクス（更新済 2026-04-26）
  - 後続計画 (未起票): `docs/vision/distribution-hardening.md` — Sentry / Updater / Sync 分離 / Store 申請
---

# Plan: Windows + Android MVP 配布 (友達向け)

## Context

### 動機

現状の Life Editor は **macOS Desktop + iOS** の 2 プラットフォーム構成 (作者 N=1)。これを **Windows / Android を持つ友達への配布** を最短ルートで実現する。

### スコープ方針 (v2 から縮小、重要)

v2 計画 (18-23 セッション) は負担過大だったため、**「友達に動くものを渡す」だけに絞る**。以下は本計画から外し、必要になったら別計画 `docs/vision/distribution-hardening.md` で起票する:

| 外したもの                          | 理由                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Sentry / クラッシュ収集             | MVP には不要、友達口頭フィードバックで一旦凌ぐ                           |
| Tauri Updater 自動更新              | 当面は DM で .apk / .exe を手渡し                                        |
| ローカルログ吸い上げ                | 同上                                                                     |
| Cloud Sync feature flag 分離        | UI 設定で「同期 OFF」をデフォルトにするだけで対応                        |
| Microsoft Store / Play Console 申請 | さらに先                                                                 |
| UTM + Windows 11 ARM ローカル検証   | Insider 登録不可のため断念。GitHub Actions windows-latest + 友達 PC のみ |

### 検証前提

- **作者は Windows / Android 実機なし**
- **Android**: M3 上の Android Studio aarch64 AVD で 80% 検証
- **Windows**: GitHub Actions `windows-latest` ビルド成功確認のみ。動作確認は友達 PC 依存
- 着手順: **Android 先** (M3 でネイティブ検証可能)、**Windows 後** (友達依存度高い)

### 主要意思決定 (確定済 2026-04-26)

| #   | 項目                | 決定                                                                |
| --- | ------------------- | ------------------------------------------------------------------- |
| 1   | SQLite アクセス層   | `rusqlite` 直接維持 + `bundled` feature 追加                        |
| 2   | MCP / Terminal      | iOS と同じく Android でも省略                                       |
| 3   | Frontend Provider   | `MobileProviders` を Android にも適用                               |
| 4   | AppData パス        | 全 OS で `app_local_data_dir()` 統一                                |
| 5   | Android 16KB page   | NDK r28 + AGP 8.5.1 + `build.rs` リンカフラグ                       |
| 6   | Windows PTY         | spawn 時に `CREATE_NO_WINDOW` flag                                  |
| 7   | Cloud Sync 友達向け | 当面 UI 設定で「同期 OFF」をデフォルトにするだけ (コード分離は後続) |

### Non-goals

- 自動更新 / クラッシュレポート / 商用ストア配布 (全て後続計画)
- Linux Desktop 対応
- Windows ローカル VM 検証 (Insider Preview 入手不可のため)

---

## Steps

### Phase 1: 共通基盤整備 ✅ 完了 (2026-04-26、1 セッションで終了)

> macOS / iOS 既存ビルドを壊さない。Android / Windows ビルド前提を整える。
> 実装中に判明: rusqlite bundled / reqwest rustls-tls は **既に有効**、notification の Android cfg は意図的設計、Sync は backend で auto-start していない → スコープ大幅縮小

#### 1-A: Cargo / 依存整理

- [x] **1-A-1**: `src-tauri/Cargo.toml` の `[target.'cfg(not(target_os = "ios"))'.dependencies]` を `[target.'cfg(not(any(target_os = "ios", target_os = "android")))'.dependencies]` に統一 (PTY / notify / trash 等)
  - 注: cargo の `[target.'cfg(...)'.dependencies]` は Tauri build script 設定の `cfg(desktop)` を認識しないため、明示的な OS 列挙が必要
- [x] **1-A-2**: ~~rusqlite bundled feature 追加~~ → **既に対応済** (Cargo.toml line 22)
- [x] **1-A-3**: ~~Android 用 reqwest rustls-tls 追加~~ → **既に対応済** (line 29 で全 OS rustls-tls)
- [x] **1-A-4**: `src-tauri/src/reminder.rs:65, 227` の `cfg(not(target_os = "ios"))` → **そのまま維持**。tauri-plugin-notification は Android で動作するため、現状の cfg は意図的に正しい (iOS のみ除外)
- [x] **1-A-5**: ~~claude_commands.rs の MCP `#[cfg(desktop)]` guard~~ → **Phase 2 で延期**。macOS で問題なし、Android build error が出てから対応する方が効率的

#### 1-B: パス解決の統一

- [x] **1-B-1**: `src-tauri/src/lib.rs::run()` の DB パス解決を `#[cfg(desktop)]` / `#[cfg(mobile)]` で分岐
  - Desktop: `dirs::data_dir().join("life-editor")` (Electron 時代の既存パス維持、macOS 既存 DB を保護)
  - Mobile: `app.path().app_data_dir()` (Android Scoped Storage / iOS sandbox)
- [x] **1-B-2**: macOS の既存 DB パスは `~/Library/Application Support/life-editor/` のまま不変 → 移行ロジック不要
- [x] **1-B-3**: `dirs` クレート使用箇所の置換 → **Phase 2 で必要時対応**。MCP / attachment / custom_sound / data_io / diagnostics は Mobile で順次 guard

#### 1-C: Cloud Sync OFF デフォルト化 → **実装不要と判明**

- [x] **判明**: `SyncContext.tsx:164` で `status?.enabled === true` のときだけ polling 起動。backend では sync auto-start していない (lib.rs に sync 起動コードなし)
- [x] **判明**: 友達ビルドで Workers URL/Token を渡さなければ未 configure 状態で `enabled = false` のまま → **既に default OFF と等価**
- [x] **結論**: SyncSettings UI / SyncContext / backend の追加実装すべて不要

#### 1-D: 回帰確認 (macOS)

- [x] **1-D-1**: `cargo build --lib --target aarch64-apple-darwin` warnings ゼロ (3m46s)
- [x] **1-D-2**: `cargo test --lib --target aarch64-apple-darwin` **25/25 pass** (1 ignored = `bench_fetch_tree`)
- [ ] **1-D-3**: `cargo tauri dev` で macOS 起動 → 全 Section / Terminal 動作確認 (作者本人実行待ち、必要時)

### Phase 2: Android ビルド + 友達配布 (2-3 セッション)

#### 2-A: 環境準備

- [ ] **2-A-1**: Android Studio + JDK 17 インストール (`brew install --cask android-studio temurin@17`)
- [ ] **2-A-2**: SDK Manager で NDK 28.x + Platform-Tools + cmdline-tools 追加
- [ ] **2-A-3**: AVD Manager で Pixel 7+ / API 34+ / arm64 を作成、起動確認

#### 2-B: Tauri Android 初期化

- [ ] **2-B-1**: `cargo tauri android init` で `src-tauri/gen/android/` 生成
- [ ] **2-B-2**: `tauri.android.conf.json` 作成 (package name, min SDK 24)
- [ ] **2-B-3**: `gen/android/build.gradle.kts` で AGP 8.5.1+ / NDK r28 / `useLegacyPackaging = false`
- [ ] **2-B-4**: `src-tauri/build.rs` (なければ新規) に Android 用 16KB page リンカフラグ:
  ```rust
  if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
      println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
  }
  ```

#### 2-C: Android 用コード調整

- [ ] **2-C-1**: `src-tauri/src/db/mod.rs` で Android のとき `journal_mode = DELETE` に切替 (Scoped Storage の WAL/SHM 残骸対策)
- [ ] **2-C-2**: `frontend/src/utils/platform.ts` に `isAndroid` 追加
- [ ] **2-C-3**: `frontend/src/providers/MobileProviders.tsx` を `ios ∪ android` で適用 (現状 iOS のみ判定なら拡張)
- [ ] **2-C-4**: タッチ操作 / バイブ / safe-area inset の確認

#### 2-D: ビルド & 検証 (M3 aarch64 AVD)

- [ ] **2-D-1**: `cargo tauri android build --apk --target aarch64` 成功
- [ ] **2-D-2**: AVD aarch64 に `adb install` → 起動 → クラッシュなし
- [ ] **2-D-3**: 全 Section 切替 / DB 初期化 / Mobile 省略 Provider が動作 (Terminal/MCP メニューなし)
- [ ] **2-D-4**: AAB ビルド (`--aab`) + `bundletool validate` で 16KB page 警告ゼロ

#### 2-E: 友達への配布

- [ ] **2-E-1**: 未署名 APK を友達に DM で送付 (Drive / Slack 等)
- [ ] **2-E-2**: 友達側で「提供元不明のアプリを許可」設定手順を簡易説明 (3-5 行)
- [ ] **2-E-3**: 友達端末で起動成功確認 (口頭/テキストで報告受領)

### Phase 3: Windows ビルド + 友達配布 (2-3 セッション)

> ローカル検証なし。CI ビルドが成功する → 友達 PC で動作確認、の流れ。

#### 3-A: Windows 用 Tauri 設定

- [ ] **3-A-1**: `src-tauri/tauri.conf.json` を分割: 共通 + `tauri.windows.conf.json`
  - Windows: NSIS bundle、WebView2 = Download Bootstrapper (デフォルト)、`icon.ico`
- [ ] **3-A-2**: `src-tauri/icons/icon.ico` を既存 .icns から ImageMagick で生成
- [ ] **3-A-3**: `src-tauri/src/main.rs` 先頭に `#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]` 確認/追加

#### 3-B: Windows 固有挙動

- [ ] **3-B-1**: `src-tauri/src/terminal/pty_manager.rs:64` の SHELL fallback に Windows 分岐 (PowerShell or cmd.exe)
- [ ] **3-B-2**: PTY spawn に `CREATE_NO_WINDOW` flag 付与 (Windows のみ)
- [ ] **3-B-3**: `src-tauri/src/commands/system_commands.rs:11-16` のブラウザ検出を Windows 対応 (`%PROGRAMFILES%\Google\Chrome\Application\chrome.exe` 等)
- [ ] **3-B-4**: `frontend/src/utils/platform.ts` に `isWindows` 追加、modKey を `Ctrl+` に解決

#### 3-C: GitHub Actions Windows ビルド

- [ ] **3-C-1**: `.github/workflows/build-windows.yml` 新規作成 (`windows-latest`、aarch64 + x64 両ターゲット)
- [ ] **3-C-2**: ビルドキャッシュ (`actions/cache` で `~/.cargo/registry`, `target/`)
- [ ] **3-C-3**: 生成 NSIS インストーラを Artifacts として保存
- [ ] **3-C-4**: ビルド成功 + Artifacts 出力確認

#### 3-D: 友達への配布

- [ ] **3-D-1**: GitHub Actions Artifacts から NSIS インストーラを DL
- [ ] **3-D-2**: 友達に DM で送付 (Drive 推奨、容量大きいため)
- [ ] **3-D-3**: 友達側で SmartScreen 警告 ("詳細情報" → "実行") の対処手順を説明
- [ ] **3-D-4**: 友達 PC で起動成功確認 (友達 PC が x64 想定。事前に確認しておく)

---

## Files

| File                                                | Operation        | Notes                                                           |
| --------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `src-tauri/Cargo.toml`                              | Modify           | `cfg(desktop)` 統一 / rusqlite bundled / Android reqwest rustls |
| `src-tauri/tauri.conf.json`                         | Modify           | 共通項のみ残す                                                  |
| `src-tauri/tauri.windows.conf.json`                 | Create           | NSIS / WebView2 / icon.ico                                      |
| `src-tauri/tauri.android.conf.json`                 | Create           | Android package / min SDK                                       |
| `src-tauri/build.rs`                                | Create or Modify | Android 16KB page リンカフラグ                                  |
| `src-tauri/src/main.rs`                             | Modify           | `windows_subsystem = "windows"`                                 |
| `src-tauri/src/db/mod.rs`                           | Modify           | `app_local_data_dir()` 統一 / Android WAL→DELETE                |
| `src-tauri/src/terminal/pty_manager.rs`             | Modify           | Windows shell + CREATE_NO_WINDOW                                |
| `src-tauri/src/commands/claude_commands.rs`         | Modify           | MCP `#[cfg(desktop)]` guard                                     |
| `src-tauri/src/commands/system_commands.rs`         | Modify           | Windows ブラウザ検出                                            |
| `src-tauri/src/reminder.rs`                         | Modify           | `cfg(not(target_os="ios"))` → `cfg(desktop)`                    |
| `src-tauri/icons/icon.ico`                          | Create           | ImageMagick で .icns から生成                                   |
| `src-tauri/gen/android/`                            | Generate         | `cargo tauri android init`                                      |
| `frontend/src/utils/platform.ts`                    | Modify           | `isWindows` / `isAndroid` 追加                                  |
| `frontend/src/providers/MobileProviders.tsx`        | Modify           | iOS ∪ Android で適用                                            |
| `frontend/src/components/Settings/SyncSettings.tsx` | Modify           | 「Cloud Sync 有効」トグル追加 (default OFF)                     |
| `frontend/src/context/SyncContext.tsx`              | Modify           | 設定 OFF なら起動しない                                         |
| `.github/workflows/build-windows.yml`               | Create           | windows-latest aarch64 + x64                                    |
| `CLAUDE.md`                                         | Modify           | §2 配布方針節を整合修正 (Updater 言及削除)                      |

**変更必須**: 約 13 ファイル / **新規作成**: 約 5 ファイル / **破壊的変更**: なし

---

## Verification

### Phase 1 完了基準

- [ ] `cargo build --target aarch64-apple-darwin` warnings 既存範囲内
- [ ] `cargo test --lib` 全通過
- [ ] macOS 起動 → 全 Section / Cloud Sync ON-OFF トグル / Terminal 動作

### Phase 2 完了基準

- [ ] M3 aarch64 AVD で起動成功 (クラッシュなし)
- [ ] DB が Scoped Storage 内、`journal_mode = DELETE`
- [ ] Mobile 省略 Provider 動作 (Terminal/MCP メニューなし)
- [ ] AAB ビルド + `bundletool validate` で 16KB 警告ゼロ
- [ ] **友達端末で起動成功** (口頭報告)

### Phase 3 完了基準

- [ ] GitHub Actions windows-latest ビルド成功
- [ ] NSIS インストーラ Artifacts 出力
- [ ] **友達 PC で起動成功** (口頭報告)、不要 cmd ウィンドウなし

---

## Risks & Mitigations

### Risk 1 (重大): 実機なし → 友達フィードバックループが遅い

- **影響**: バグ修正 → 再配布のループに 1 日以上かかる
- **回避**: M3 aarch64 AVD で Android は 80% カバー。Windows は CI ビルド成否のみで先送り、致命バグ時に Sentry 導入を別計画 (`distribution-hardening.md`) で起票

### Risk 2 (重大): Google Play 16KB page size 義務化 (将来 Play 配布時)

- **影響**: 違反 AAB は Play Console アップロード拒否
- **回避**: Phase 2-B-4 で必ず NDK r28 + リンカフラグ設定。`bundletool validate` をローカル必須実行

### Risk 3 (高): 友達 PC のアーキテクチャ未把握

- **影響**: x64 のみ対応で配布したが友達が ARM64 PC、または逆
- **回避**: Phase 3-D-4 前に必ず友達に確認。CI で aarch64 + x64 両方ビルドして両方送付するのが安全

### Risk 4 (中): rusqlite bundled でも x86_64 エミュレータで `__extenddftf2` クラッシュ可能性

- **影響**: x86_64 AVD で動作不能
- **回避**: M3 で aarch64 AVD を主検証環境に。x86_64 AVD は使わない

### Risk 5 (中): Cargo.toml の `cfg(not(target_os="ios"))` を `cfg(desktop)` に変更する副作用

- **影響**: Android で巻き込まれてビルド失敗
- **回避**: Phase 1-A-1 で全箇所 grep + `desktop` か `not(mobile)` か個別判定

### Risk 6 (低): Windows ローカル検証なしによる「初回配布時に何も動かない」リスク

- **影響**: 友達に渡したら起動すらしない
- **回避**: 致命的なら UTM + CrystalFetch (UUP 経由 ISO) を後追いで試す or 別マシン借りる

---

## Effort Estimate

| Phase              | セッション数       | 並行可否         |
| ------------------ | ------------------ | ---------------- |
| Phase 1 (共通基盤) | 2-3                | —                |
| Phase 2 (Android)  | 2-3                | Phase 3 と並行可 |
| Phase 3 (Windows)  | 2-3                | Phase 2 と並行可 |
| **合計**           | **6-9 セッション** | —                |

---

## Next Plans (本計画完了後の起票候補)

- `docs/vision/distribution-hardening.md` — Sentry / Tauri Updater / Sync feature flag 分離 / クラッシュ収集 / ローカルログ吸い上げ
- `docs/vision/multi-tenant-sync.md` — Cloudflare Workers + Auth マルチテナント化
- `docs/vision/store-distribution.md` — Microsoft Store / Google Play 正式申請

これらは **友達からの最初のフィードバックを得てから** 必要性を判断する。

---

## Open Questions (実装中に判明したら都度確認)

1. 友達 PC のアーキテクチャ (x64 / ARM64)、Windows バージョン (10 / 11)
2. 友達 Android 端末のバージョン (API レベル)
3. 友達は何人? (1人なら手動配布で十分、複数なら Drive 共有リンクで十分)
4. macOS の AppData は `app_local_data_dir()` で同じパスに解決されるか (Phase 1-B-2 で検証)

---

## References

- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)
- [tauri/issues/14895 — 16KB page size](https://github.com/tauri-apps/tauri/issues/14895)
- [tauri/discussions/7340 — rusqlite bundled on Android](https://github.com/tauri-apps/tauri/discussions/7340)
- [wezterm/issues/6946 — Windows portable-pty cmd window](https://github.com/wezterm/wezterm/issues/6946)
- [Tauri Android Setup](https://v2.tauri.app/start/prerequisites/#android)
- [Tauri Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
