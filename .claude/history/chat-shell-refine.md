# HISTORY (chat-shell-refine)

### 2026-07-26 - #320 Mobile 基盤配線（PR #358）

#### 概要

`isNativeMobile()` ガードを web ホストに配線し（ShortcutConfigProvider を native 省略・Ambient mixer UI を WorkScreen で native 省略）、`viewport-fit=cover` を追加した。role-qa 独立監査の Blocker 指摘を受け、AudioProvider は native でも維持（完了チャイム = mobile-scope.md #10/#11 のユーザー確定と DoD の矛盾をチャイム維持側に解消）— Issue DoD からの逸脱として #320 コメントに記録済み。

#### 変更点

- **ゲート配線（`web/src/MainScreen.tsx`）**: `ShortcutConfigHost` 新設（native = children 素通し / それ以外 = 従来どおり Provider ラップ）。消費側の null 安全は全箇所実測確認（GlobalShortcuts / SettingsScreen / WorkScreen / AudioChimeBridge / useGlobalShortcuts）
- **チャイム維持（role-qa Blocker 反映）**: AudioProvider は全ホストでマウント維持・WorkScreen の mixer 描画条件に `!isNativeMobile()` を追加。#320 DoD の「Audio Provider 省略」は mobile-scope.md #10（work タイマー Full）/#11（Desktop 専用は mixer のみ）と矛盾するため採らず
- **viewport（`web/index.html`）**: `viewport-fit=cover` 追加（notched iOS で `env(safe-area-inset-*)` が全て 0 に解決される問題の修正）
- **テスト**: `shared/tests/platform.test.ts` 新設（isNativeMobile の契約 3 ケース）
- **docs 追随**: CLAUDE.md §2 / rules/frontend.md / mobile-scope.md §6 / mobile/README.md / styles.xml コメント / `shared/src/index.ts` の「5 種」参照化 / stale な "always mounted" コメント掃除（数値の非複製原則 sweep）
- **検証**: shared tsc -b + vitest 137 files / 1083 passed・web build exit 0・role-qa 独立監査（NEEDS REVISION → Blocker / Important 全反映）

### 2026-07-20 - Layout / 操作系 4 Issue（PR #313/#314/#315/#316・全 merge 済み）

#### 概要

（バックフィル記録 — memory「直近の完了」から HISTORY へ移す際の要約。詳細は各 PR 参照）#305 / #307 / #306 / #304 子 PR 1 を 1 Issue = 1 PR で処理し、いずれも merge された。

#### 変更点

- **#305（PR #313）**: メインコンテンツ幅を全セクション max-w-lumen-wide に統一（PageContainer fluid を中央寄せ + 1120px 上限化・MainScreen width マッピング整理）
- **#307（PR #314）**: アイテム操作パネル汎用化
- **#306（PR #315）**: ヘッダー常設コマンドパレット検索フィールド
- **#304 子 PR 1（PR #316）**: Undo/Redo 基盤 + taskTree（UndoRedoManager グローバル 1 本スタック + Provider + Buttons + Toast + ⌘Z 配線 + taskTree auto-connect + 単体 13 件）

### 2026-07-11 - chat-main 采配 2 件: #173 docs-lint（PR #241）/ #172 PostgREST pagination（PR #243）

#### 概要

chat-main 采配で自分宛となった #173（docs-lint 機械検査）と #172（sync delta pull の client 側 pagination = 現行スタックでは PostgREST max-rows 無音切り捨て対策）を 1 Issue = 1 PR で処理した。両 PR とも CI 全緑・merge はユーザーゲート待ち。

#### 変更点

- **#173 docs-lint（PR #241・ブランチ claude/shell-refine-173）**: `scripts/docs-lint.sh` 新設（(a) 相対リンク実在 / (b) 旧トークン notion-\*・ink-\* 残存（known-issues/ + 歴史注記行除外）/ (c) plans Status enum / (d) 完了プラン残置）+ ci.yml に docs-lint ジョブ追加。新 lint が検出した既存違反 8 件を同一 PR で解消（壊れリンク 2 / IN_PROGRESS 正規化 3 / merge 済みプラン 3 本 = shell-implementation・connect-implementation・materials-impl を COMPLETED + archive/ 移動）。CI 初回失敗（git 非追跡の派生 INDEX への CLAUDE.md リンク）は派生ビュー除外で修正。gotcha: `git mv` は index の旧 blob のまま rename を stage するため sed 後の内容が commit から漏れる — 追いコミットで是正
- **#172 PostgREST pagination（PR #243・ブランチ claude/shell-refine-172）**: `shared/src/services/postgrestFetchAll.ts` 新設（fetchAllPages = 一意 order + range の追い pull / chunkIds・fetchByIdChunks・forEachIdChunk = .in() の 200 件分割）。SupabaseDataService + Notes/Dailies/WikiTags Unified + Timer + Audio の全「全件 read」と id 収集 → .in() write 経路に適用（シグネチャ不変）。テスト 14 件新設 + 既存スタブ 3 ファイルに .order/.range 追加。life-editor-sync-auditor 監査 = PASS with notes → Medium 2 件（bulkCreate pre-check の直積 .in().in() 未 paginate / R2 cleanup DELETE 未チャンク）を同 PR で修正、db-conventions に §11（ページ分割規約 + max-rows 運用注意）新設。検証 = shared tsc -b + vitest 865/865（フル 2 回）/ web build 緑

#### 概要

shell-refine レーン（セクション横断の共通 UI・chore + 担当 worktree のないセクション）の初回セッション。自分宛 open Issue 3 件（#229 / #181 trash 行 / #197）を処理した。

#### 変更点

- **#229 trash Layout Standard v2 adoption（PR #234）**: shell の標準 SectionHeader とタイトルが二重表示になっていた本文内 h1 + 説明文を撤去。`shared/src/components/TrashView.tsx`（header ブロック + labels 3 フィールド）・`web/src/trash/TrashScreen.tsx`（loading/error フレームの自前ヘッダー）・孤立 i18n キー 3 個（en/ja）・テスト 2 ファイルを v2 契約に追随。検証 = shared build + vitest 845/845（既知 flaky 6 件は `--testTimeout=30000` で pass）/ web build + lint / role-qa PASS（Blocker 0）
- **#181 trash 行**: ローカル max-width / gutter ハードコード無しを実測確認し、Issue コメントで消し込み（チェックは PR #234 merge 後に代理依頼）
- **#197 Stage B**: 移植完全性検証をサブエージェント 2 体で実施（生きたビルドグラフからの frontend/ 参照 0 / 未移植機能インベントリ作成・主要 claim は grep で spot check 済み）→ `frontend/`（688 ファイル）+ 死んだ旧 Tauri CI `.github/workflows/build.yml` + 検索除外 `.ignore` を削除。復元 = git tag `pre-tauri-removal`
- **#197 Stage C（docs sweep）**: README.md 全面書き換え（Tauri → 現行スタック）/ ai-context.md 生死マップ更新 / CLAUDE.md §3.1・§6・§7.1 の FROZEN → 削除済み注記 / rules/frontend.md path スコープ（frontend→web）+ 配置表を shared/ へ / coding-principles §1 retired 注記 / requirements 4 ファイル + README の退役スタック注記更新 / known-issues 10 ファイル + INDEX に retired 注記 / 移行 SSOT Phase 5-C チェックボックス 4 項目更新 / deletion-targets Status 更新 / step1 計画書に削除済み注記 / `scripts/loop-engine/check.sh` を shared+web へ付け替え・TODO.md 例文更新
- **#197 Stage C（repo 外・git 非管理のため直接編集）**: agents-lib `subagent-coordinator.md` の旧 Tauri/D1 routing 行 8 本を撤去 + 注記 / `life-editor-ipc-validator.md` に RETIRED マーカー追記（skill-lib はヒット 0）
