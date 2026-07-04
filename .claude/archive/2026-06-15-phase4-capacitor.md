---
Status: COMPLETED — Capacitor 包装 scaffold merged（#88）（archive 2026-07-04）。ネイティブ検証（iOS Simulator / Android AVD / 実機）は 🛑 ユーザー Mac ハンドオフ
Created: 2026-06-15
Branch: claude/phase4-capacitor-scaffold-p93dex
Owner-chat: chat-phase4-capacitor
Parent: ../../../2026-05-04-cross-platform-migration.md（§Phase 4 が一次仕様）
Previous: ./2026-06-14-phase3-electron-packaging.md（Phase 3 = Electron 包装。薄い包装の先例）
---

# Plan: Phase 4 — Capacitor 包装（iOS / Android シミュレータまで）

> 一次仕様は移行 SSOT `2026-05-04-cross-platform-migration.md` の Phase 4 節。本レーンは Phase 3（Electron）と同じく「薄い包装・業務ロジックは shared/ のみ」。Capacitor は `web/` の Vite ビルド出力（`web/dist`）を包む。実機配布は完成後・$0 厳守（無料 Apple ID + 7 日署名・シミュレータのみ）。Apple Developer Program 不加入 / Apple Sign-in 不実装（Email+Password 流用）。

---

## Context

- **動機**: Phase 3 で Electron（Desktop）包装が完了。Phase 4 は同じ `shared/`（= `web/` ビルド）を Capacitor 8 で包み、iOS / Android プロジェクトを生成して Mobile（従）配布の土台を作る。
- **制約**:
  - **$0 厳守**: 無料 Apple ID + 7 日署名・シミュレータのみ。Apple Developer Program / Supabase Pro は完成後判断。
  - **Apple Sign-in 不実装**: Email + Password で代用（移行 SSOT §3 認証）。
  - **薄い包装**: 業務ロジックは `shared/` のみ。mobile 固有差は `Capacitor.isNativePlatform()` 等の小アダプタで吸収。
  - **並行ストリーム非干渉**: A 監査 / C initplan / D bcrypt / **E web S8-S9** / phase3-electron のファイルに触れない。特に `web/src/`（stream E 領域）は **参照のみ・改変しない**。
- **Non-goals**:
  - iOS / Android のネイティブ **ビルド・実機検証**（Linux 環境では不可。Xcode / Android Studio / CocoaPods は Mac 専用 → 🛑 ユーザー Mac へハンドオフ）。
  - 実機配布 / TestFlight / Apple Developer Program 加入。
  - Capacitor プラグインの本格導入（通知 / 共有シート等は完成後に別 Plan）。
  - **Mobile 省略 Provider の MainScreen 配線**（`web/src/MainScreen.tsx` は stream E 領域。本レーンはアダプタ `isNativeMobile()` の提供までで、配線は stream E と調整する申し送り — ユーザー判断 2026-06-15）。

---

## Scope (Touchable Paths)

```
mobile/**                                   ← 新設（capacitor.config.ts / ios/ / android/ / package.json）
shared/src/utils/platform.ts                ← isNativeMobile() 追加（公認の小アダプタ・mobile 固有 import なし）
.gitignore                                  ← mobile/ のビルド成果物除外（node_modules / Pods / build 等）
.claude/docs/vision/plans/2026-06-15-phase4-capacitor.md  ← 本計画書
.claude/memory/chat-phase4-capacitor.md , .claude/history/chat-phase4-capacitor.md  ← task-tracker
.claude/comm/.session-name , .claude/comm/outbox/**       ← セッション宣言・要約
```

**対象外（明示・触らない）**:

- `frontend/`（FROZEN）/ `src-tauri/` / `cloud/`
- `web/src/`（stream E 領域・参照のみ）/ `desktop/`（参照のみ）
- `shared/` の業務ロジック（services / components / context / hooks）— 例外は `utils/platform.ts` の小アダプタのみ
- `supabase/`（本 Phase に DDL なし）

---

## Steps

| #   | Step                                                                | Gate    | Acceptance                                                            |
| --- | ------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| 0   | 本計画書作成（Plan Gate）                                           | 🤖 自律 | `_TEMPLATE.md` ベースで Scope / Gate / AC 記載                        |
| 1   | `web` ビルドで `web/dist` 生成（Capacitor が包む成果物）            | 🤖 自律 | `cd web && npm run build` exit 0                                      |
| 2   | `mobile/` 作成 + Capacitor 8 install + `npx cap init`               | 🤖 自律 | `mobile/package.json` に @capacitor/{core,cli,ios,android}            |
| 3   | `capacitor.config.ts`（webDir=`../web/dist` / appId / appName）     | 🤖 自律 | config が web ビルド出力を指す・appId=com.lifeeditor.app              |
| 4   | `npx cap add ios` / `npx cap add android`（生成物コミット）         | 🤖 自律 | `mobile/ios/` `mobile/android/` 生成                                  |
| 5   | `npx cap sync`（copy + update パイプライン整備）                    | 🤖 自律 | `cap sync android` 完走（iOS は pod install を Mac へ skip 申し送り） |
| 6   | `isNativeMobile()` 小アダプタを `shared/utils/platform.ts` に追加   | 🤖 自律 | `cd shared && npm run build` exit 0・mobile 固有 import 0             |
| 7   | Android safe-area inset / iOS スプラッシュ・アイコン（placeholder） | 🤖 自律 | 生成テンプレの inset 対応確認・プレースホルダ整備                     |
| 8   | 🛑 ネイティブ検証（iOS Simulator / Android AVD / 実機 7日署名）     | 🛑 人手 | ユーザー Mac で起動 → ログイン → Tasks golden path                    |

### Gate 凡例

- **🤖 自律** — 本セッションで完結（Linux でファイル生成・web/shared/android sync まで）。
- **🛑 人手** — ユーザー Mac 必須（Xcode / Android Studio / CocoaPods。iOS pod install・Simulator・AVD・実機 7 日署名）。

---

## Acceptance Criteria (機械検証可能・セッション完結範囲)

- [ ] `cd web && npm run build` exit 0（Capacitor が包む成果物 `web/dist` 生成）
- [ ] `cd mobile && npx cap sync android` がエラーなく完走（iOS は CocoaPods 不在のため Mac へ申し送り）
- [ ] `mobile/capacitor.config.ts` の `webDir` が web ビルド出力（`../web/dist`）を指す / `appId`・`appName` 設定済み
- [ ] `mobile/ios/` `mobile/android/` プロジェクトが生成・コミットされている
- [ ] `shared/` に mobile 固有 import（`@capacitor/*`）が漏れていない（DataService 境界不変）
- [ ] `cd shared && npm run build` exit 0（`isNativeMobile()` 追加後も型崩れなし）
- [ ] `frontend/` 変更 0 / `web/src/` 変更 0（stream E 非干渉）

---

## DB Migration Notes

DDL なし（本 Phase は包装のみ）。

---

## 🛑 ローカル検証ハンドオフ（ユーザー Mac で実施）

本セッションは Linux のため iOS/Android ネイティブツールチェーンが無い。以下は **Phase 4 完了判定**（移行 SSOT §Phase 4）でユーザーの Mac へハンドオフ:

1. `cd web && npm run build`（最新の `web/dist` を生成）
2. `cd mobile && npx cap sync`（iOS の `pod install` がここで走る。CocoaPods 要 `sudo gem install cocoapods` or `brew install cocoapods`）
3. **iOS Simulator**: `npx cap open ios` → Xcode で Simulator 起動 → アプリ操作可能
4. **iOS 実機**（自分の iPhone のみ）: 無料 Apple ID + 7 日署名で Run
5. **Android AVD**: `npx cap open android` → Android Studio で AVD 起動
6. **golden path**: iOS / Android から Supabase 接続 → ログイン（Email+Password）→ Tasks CRUD
7. **Mobile 省略 Provider 配線**: stream E（web S8-S9）と調整し、`web/src/MainScreen.tsx` で `isNativeMobile()` を使って Audio / ShortcutConfig Provider を出し分け（現行 web 実在は 2 種のみ。CalendarTags は DU-F 削除済 / ScreenLock / FileExplorer は web 未実装）

---

## Risks / Known Issues 参照

- **Risk（移行 SSOT Risk 3）**: Capacitor で iOS native 機能が必要になる → 初期は通知のみに絞る。本 Phase はプラグイン未導入。
- **Linux で iOS sync の `pod install` 不可**: 想定内。iOS の native 部分は Mac ハンドオフ。`cap add ios` のファイル生成自体は Linux でも可能（pod install のみ skip）。
- **Apple Developer Program 不加入**: 7 日署名運用。完成後に友達配布需要が出たら $99/年判断。

---

## References

- 一次仕様: `.claude/2026-05-04-cross-platform-migration.md` §Phase 4
- 薄い包装の先例: `.claude/docs/vision/plans/2026-06-14-phase3-electron-packaging.md`（Electron / renderer=web 戦略）
- Platform: CLAUDE.md §2（Mobile 省略 Provider 5 種 / WikiTag・SidebarLinks は Mobile 有効）
- DataService 境界: CLAUDE.md §3.1

---

## Worklog

- 2026-06-15（chat-phase4-capacitor 起草・lead-pipeline）: origin/main(056c506 = AppShell #87 merged) から `claude/phase4-capacitor-scaffold-p93dex` で着手。偵察で Phase 3 が renderer=web 戦略（web/dist を包む）と判明 → Capacitor も同型に `webDir=../web/dist`。Provider 配線は stream E 衝突回避のためユーザー判断で「アダプタのみ・配線は申し送り」確定。
</content>

</invoke>
