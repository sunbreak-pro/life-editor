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

## 運用ランブック（想定）

### 初回セットアップ

1. macOS で `cargo tauri ios init`（未実施なら）
2. Xcode で `gen/apple/life-editor.xcworkspace` を開く
3. `Signing & Capabilities` → Team で **Personal Team**（Apple ID 名）を選択
4. Bundle Identifier を `com.<personal>.lifeeditor` 等 個人用に変更（他アプリと衝突しないもの）
5. iPhone を USB 接続 → Window > Devices and Simulators で認識確認
6. 実機スキームを選び Run → iPhone の 設定 > 一般 > VPN とデバイス管理 で「このデベロッパを信頼」
7. 起動確認

### 通常運用（週次）

- 毎週月曜など曜日固定で `cargo tauri ios build --target aarch64-apple-ios` → Xcode から Run して 7 日の署名を更新
- 更新を忘れても Cloud Sync に push 済みなら iOS 側ローカル DB が壊れても復旧可（§同期設計参照）

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
