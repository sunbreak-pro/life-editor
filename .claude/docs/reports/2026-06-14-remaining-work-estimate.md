---
Title: Web / Desktop / Mobile 残タスク量と開発期間の試算
Date: 2026-06-14
Author: chat (analysis only — コード変更なし)
Sources: 移行 SSOT (2026-05-04-cross-platform-migration.md) / memory/INDEX.md / GitHub PR 履歴 (82 PR)
Note: 派生・参考レポート。SSOT は移行プラン + per-chat chat-*.md。数値は 2026-06-14 時点のスナップショット
---

# Web / Desktop / Mobile 残タスク量と開発期間の試算

## 1. 速度の実測（PR / merge 履歴）

`sunbreak-pro/life-editor` の全 PR を集計（82 PR / 81 merged / 1 closed 未 merge）。

| 指標 | 値 |
|---|---|
| 移行作業の起点 | PR #3 = **2026-05-11**（Refactor/web first v2） |
| 直近マージ | 2026-06-14 |
| 移行期間 | **34 日（約 5 週間）** |
| 期間中のマージ | **79 本**（≈ 2.3 本/日、16 本/週） |
| うち実装系（feat/fix/work/prototype/other） | **54 本**（≈ 11 本/週） |
| docs/chore/tracker | 27 本（約 1/3 が記録・整備系） |

週次マージ数:

```
05/11週  7   ← Phase1 立ち上げ
05/18週 20   ← Data Unification 集中
05/25週 10
06/01週 21   ← Phase2 完了 + parity W0-W2
06/08週 21   ← W3〜W4 + Phase3 scaffold
```

AI 支援で計画書の想定より速いペース。ただし約 1/3 がドキュメント PR で、純実装の実効速度は週 11 本程度。

## 2. 現在地（3 アプリ × Phase）

| Phase | 内容 | 状態 | 根拠 PR |
|---|---|---|---|
| 1 | 新スタック土台（Supabase/Auth/RLS） | ✅ 完了(05-16) | #3-9 |
| 2 | コア機能移植（Tasks/Schedule/Notes/Daily/WikiTags） | ✅ 完了(06-05)+Realtime/レスポンシブ | #43,#44,#47,#49 |
| (追加) | Web/Desktop parity W0〜W4（計画外スコープ） | ✅ ほぼ完了(06-14) | #59,#63,#64,#68-70,#75,#78 |
| 3 | Electron 包装 | 🔧 scaffold のみ merged | #79 |
| 4 | Capacitor 包装（Mobile） | ❌ 未着手（`mobile/` ディレクトリ不在で確認） | — |
| 5 | 周辺機能+terminal 連携+旧スタック削除=**完成** | ❌ 未着手 | — |

成熟度の差:

- 🟢 **Web** — 最も成熟。Phase2 + parity 完了。残りは実機目視・S9 レスポンシブ詰め・Cloudflare Pages デプロイ
- 🟡 **Desktop(Electron)** — scaffold(#79) 着地直後。macOS golden path 検証・Win/Linux CI ビルド・Tray/自動起動/グローバルショートカット・electron-updater・terminal-division MCP ブリッジが残
- 🔴 **Mobile(Capacitor)** — 本番未着手。`frontend/` の prototype 群（#10〜#46 の 10 本）は設計探索で本番 shared/ スタックには未搭載。Phase4 一式が丸ごと残

## 3. 残タスク

### Web（残小）
- W1〜W4 の実機目視（INDEX に 👀 多数）
- S9 モバイルレスポンシブ pass2 以降
- Cloudflare Pages デプロイ（Phase 5-B）
- 任意: initplan WARN 48 件 / ハードコード色のトークン化

### Desktop（残中）
- macOS golden path 実機検証 + Win/Linux CI ビルド確認（Step 10）
- Phase 5-A: Tray / 自動起動 / グローバルショートカット / Settings Electron 版再実装
- Phase 5-B: electron-updater + GitHub Releases
- terminal-division: `mcp-server` を Postgres 版に書き換え + 起動ブリッジ
- セキュリティ Medium: CSP / window bounds / permission handler / 署名連動 autoUpdater

### Mobile（残大）
- `mobile/` 作成、Capacitor install + init、capacitor.config
- iOS 生成→シミュレータ→無料 Apple ID 7 日署名実機
- Android 生成→AVD、safe-area 対応、splash/icon
- prototype UI の本番 shared/ への取り込み判断

### 横断（Phase 5-C / 完成条件）
- 旧スタック削除（`frontend/` `src-tauri/` `cloud/`）
- CLAUDE.md / vision / db-conventions の新スタック全面改訂

## 4. 期間試算

**(a) 計画書ベース** — Phase 3 残 0.5〜1.5週 + Phase 4 1.5〜2.5週 + Phase 5 2〜3週 = **合計 4〜7週**

**(b) 速度ベース** — 残実装 ≈ 26 本前後。週 11 本なら理論 2.5 週だが非現実的。律速は人手ゲート（merge 判断・実機目視が N=1 作者集中、iOS 実機署名/署名運用/デプロイは並列化不可、「毎日少しずつ」運用、parity のような計画外スコープ追加の実績）。

### 結論

| シナリオ | Phase 4 の方針 | Mobile残 | 完成までカレンダー期間 |
|---|---|---|---|
| 下振れ | Capacitor ラップのみ | 2〜3週 | **約 6週（1.5ヶ月）** |
| 中央値（推奨前提） | 主要画面のみ本番 shared/ へ整理 + シミュレータ/7日署名 | 3〜5週 | **6〜10週（1.5〜2.5ヶ月）** |
| 上振れ | prototype 全機能を本番化 + 追加スコープ | 6週超 | **10週超** |

アプリ別の体感配分:
- **Web: 残り 1〜2週**（ほぼデプロイと検証）
- **Desktop: 残り 3〜5週**（well-trodden な Electron 構成）
- **Mobile: 残り 2〜6週**（着手ゼロだが shared/ 完成によりラップは速い。リスクは実機署名と prototype 取り込み判断）

Desktop と Mobile は並行可能なため合計は単純加算より短縮可能。

### 参考: 計画 vs 実績
当初見積は全体 2.5〜3.5ヶ月（累計 9〜14週）。起点 05-11 から 34 日で Phase 1+2+追加 parity+Phase3 scaffold（累計 6-9週相当）を消化し、Web 側は計画を約 1.3〜1.8 倍上回るペース。残りは Mobile 実機・署名・デプロイなど人手ゲート比率が高く、速度低下を織り込むのが安全。

**総括: 完成（Phase 5 まで）の現実的着地は「あと約 6〜10週・1.5〜2.5ヶ月」。Web はほぼ完了、Desktop は折返し、Mobile が最大の残量かつ最大の不確定要因。**
