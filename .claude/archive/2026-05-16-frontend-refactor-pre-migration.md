# Plan: Frontend 脆弱性リファクタ（移行前安全網 + コンパクト化）

- **Status**: COMPLETED — Phase 0/0+/1/2 完了 & committed（c25a7d3/5e67b77/d62a2dc・origin 取込済）/ Phase 3-1・3-2 完了 / Phase 3-3・3-4 は取り下げ。全 Phase 消化済みでクローズ
- **Created**: 2026-05-16
- **Task**: MEMORY.md `project_web_first_migration.md` 関連（移行前の負債清算レーン）
- **Project path**: /Users/newlife/dev/apps/life-editor

## Context

### 動機

6 並列エージェント監査（read-only）で `frontend/src/` + `web/` の脆弱性・整合性・可読性・可用性を再洗い出し。Tauri→Electron+Capacitor+Web+Supabase 移行で **削除予定の `src-tauri/` `cloud/` は対象外**（生存コードのみ）。

### 制約（厳守）

- **テスト追加が唯一許可された新規要素**。それ以外は「削除 / 統合 / 既存への集約」= 行数が減る方向のみ。
- 新ライブラリ・新抽象レイヤー・新機能・新デザインシステムの追加禁止（コンパクト性・複雑性を増やさない）。
- 共有プリミティブ新設（Modal シェル等）は「重複を 1 つに寄せて正味削減」になる場合のみ、かつ **Phase 5 として要ユーザー承認で隔離**。

### Non-goals

- `src-tauri/` `cloud/` `mcp-server/` のリファクタ（移行で消滅）。
- 巨大コンポーネントの「分割」による新ファイル純増（責務抽出は既存 shared/既存フックへの集約のみ）。
- A4/A5（`TitleBar` の `@tauri-apps/api/window` 直 import / Settings Claude 系 `tauriInvoke` 直呼び）= **移行作業そのもの**。本計画スコープ外、移行 Phase で `isTauri()` 分離。

### 監査で確認できた良好点（触らない）

- データ CRUD は 100% `getDataService()` 経由（抽象漏れは TitleBar/Settings Claude 系のみ）。
- Provider 順序・循環参照は規約準拠。`any` 濫用ほぼ皆無。
- `dataServiceFactory.ts` は Supabase 切替の単一スイッチ点として良好。

---

## Steps

### Phase 0 — 安全網テスト（リファクタ前提・唯一の追加要素）

- [x] 0-1. `utils/dateKey.ts` 残り6関数の JST/年跨ぎ境界テスト（+24件）
- [x] 0-2. `utils/getDescendantTasks.ts`（17 pass / 4 skip = OOM 既存バグ記録）
- [x] 0-3. `utils/timeGridUtils.ts` 全9 export（32件）
- [x] 0-4. `utils/buildCompletedTree.ts`（11件、循環は内部 visited guard で安全終了確認）
- [x] 0-5. `utils/folderProgress.ts`（9件、bench とは別の正当性検証）
- [x] 0-6. `utils/databaseFilter.ts`（26件。`evaluateFilter` は private のため `applyFilters` 経由）
- [x] 0-7. `hooks/useScheduleItemsCore.ts` ソート不変条件（5件）
- 完了: 計134テスト追加（519 pass / 4 skip / 0 fail）、`npm run build` PASS。QA 判定 PASS-with-fixes

### Phase 0+ — QA 指摘の安全網補強（テスト追加のみ・制約内）

- [x] 0+1. (Mid) `useScheduleItemsCore.test.ts` toggleComplete events 伝播テスト（+1、create 非呼出も固定）
- [x] 0+2. (Low) `timeGridUtils.test.ts` NaN 伝播 characterization（+1）
- [x] 0+3. (Low) `databaseFilter.test.ts` 未知 operator フォールスルー（+1）
- [x] 0+4. (Low) `folderProgress.test.ts` 循環 parentId 記録（+2 skip）
- [x] 0+5. (Low) `vitest.config.ts` `test.env.TZ='Asia/Tokyo'` 固定（既存テスト落ちなし）
- [x] 0+6. KI **016** `016-task-tree-traversal-cycle-oom.md` 作成 + `INDEX.md` 更新（Status=Active）
- 完了: 522 pass / 6 skip / 0 fail、`npm run build` PASS

### Phase 1 — ゼロリスク削除・1行安全化（即効）

- [x] 1-1. `hooks/useScreenLockContext.ts` 削除（必須版 production 参照0を再検証）
- [x] 1-2. `formatRelativeDate.ts` `formatTime` 削除 + `index.ts` export 除去 + 当該 test 削除
- [x] 1-3. `index.ts` `formatDateKey` barrel 再export 削除
- [x] 1-4. `.ChaosContext.tsx.swp` 削除（gitignore 済・git 無影響）
- [x] 1-5. `createContextHook.ts` `if (!value)` → `if (value == null)`（17 Context 全 null 統一を確認）
- [x] 1-6. `ThemeContext`/`ToastContext` value useMemo 化（依存配列 1:1、toggleTheme/setLanguage を useCallback 化）。`useLocalStorage` 改修はスコープ外として据え置き（QA 妥当判定）
- [x] 1-7. `useCalendars`/`useTemplates`/`useFileExplorer` return useMemo 化（useFileExplorer は breadcrumbs も useMemo 化）
- 完了: 521 pass / 6 skip / 0 fail（−1 = formatTime test 削除のみ）、`npm run build` PASS。QA 判定 **PASS**（挙動完全不変・Blocker ゼロ）

### Phase 2 — 重複ロジック統合（純粋関数・Phase 0 で保護済み）

- [x] 2-1. TaskID 統合（R1）: `generateTaskId(type="task")` に拡張、`useTaskTreeAPI` ローカル削除。挙動不変（QA 確認）
- [x] 2-2. 時刻変換統合（R2/R3）: `timeToMinutes` に `m||0` ガード吸収（`"12"`→NaN から 720 へ意図的変更、`"HH"` 経路は型コントラクト上不在を QA 立証＝実害ゼロ）。`mobileSnapTime` 重複2関数削除
- [x] 2-3. `HH:MM` 手書き 12箇所→`formatTime`（TimerContext MM:SS 2箇所は意味的にスキップ）
- [x] 2-4. `useScheduleItemsCore` today キー→`getTodayKey()`（出力完全一致）
- [x] 2-5. ID ヘルパ集約（R6）: `useAttachments`/`useSidebarLinks` → `generateId`(uuid)。形式依存箇所ゼロを QA grep 立証、既存データ不変・衝突確率改善
- [x] 2-6. OOM 欠陥修復: 4関数に visited ガード追加（非循環パス副作用ゼロを QA 論理検証）。skip 6件→循環安全終了の回帰テスト化。KI 016 → Fixed（§9 準拠）
- 完了: **525 pass / 0 skip / 0 fail**、`npm run build` PASS。QA 判定 **PASS**（意図的変更3件すべて実害ゼロ立証・Blocker ゼロ）
- 残課題(Low/将来 Phase 3): `useRoutineGroupComputed.ts` のローカル `timeToMinutes`(string|null 版) は計画スコープ外で未統合

### Phase 3 — 型単一ソース化（移行の本丸 / 論理バグ予備軍の解消）

- [x] 3-1. WikiTag entityType 衝突解消（D3）: `WikiTagAssignment.entityType`→`WikiTagEntityType` 統一、`memo` リテラル排除。副産物で V64 取り残し論理バグ2件修正（analytics dailyCount 常時0 / ConnectSidebar dailyTagMap 常時空 → V64 で DB は `daily` を書くため `==="memo"` は永遠 false だった死にコード）。i18n ラベル `byEntityType.memo`→`daily`（メモ→デイリー/Daily）も是正。回帰テスト2件追加。QA: V64 migration の決定的証拠で DB 残存 `memo` は構造的に存在しない（実害ゼロ完全立証）
- [x] 3-2. 型重複集約（挙動完全不変・QA 契約完全同一確認）: `ScheduleItemUpdate` を `types/schedule.ts` に集約し3箇所参照(D2、部分集合2箇所は別 shape で非集約) / `TaskNode.priority`→`Priority|null`(D4) / `SyncChangesResponse extends SyncFullResponse`(D5)
- 完了: **527 pass / 0 skip / 0 fail**、`npm run build` PASS、正味 -71行。QA 判定 **PASS-with-fixes**（Blocker ゼロ、i18n Low は本タスク内で是正済）
- 申し送り(将来/migration Phase): DataService 層 `entityType: string` を `WikiTagEntityType` に締めると将来 `"memo"` 混入を型で防げる（現状は全呼出元実値が安全だが型強制は無い）
- ~~3-3. shared/src/types SSOT 化~~ **取り下げ（2026-05-16）**: migration Phase 2 がドメイン単位（Tasks S1 / Daily S2 …）で shared 移植を有機的に実施中。本タスクでやると全面衝突するため migration に委譲
- ~~3-4. DataService shared 一本化~~ **取り下げ（同上）**: A1/A3 は migration の SupabaseDataService 構築でカバーされる。重複作業回避

### Phase 4 — 規約準拠の最小整合（Mobile Optional バリアント）

- [x] 4-1. `useFileExplorerContextOptional` 追加（既存 `createOptionalContextHook` 利用、手本=useAudioContextOptional 等と完全同形・5行）
- [x] 4-2. `useShortcutConfigOptional` 追加（同上。§6.3 準拠の予防的防護層、ゼロ参照は意図的=ユーザー承認済。Layout.tsx は Desktop 専用のため非改変）
- 完了: **527 pass / 0 fail**（ロジックゼロのため pass 数不変が正常）、`npm run build` PASS。新規2ファイル(各5行)・既存改変ゼロ。手本と barrel 非登録範囲も一致

### Phase 5 — 巨大コンポーネント整理（要ユーザー承認・複雑性トレードオフあり）

> **次回チャットへ持ち越し（2026-05-16）**。独立計画書に分離していた `2026-05-16-phase5-giant-component-decomposition.md` は **PR #17 で廃案・削除済み**（frontend/ FROZEN 化で対象消滅）。以下の 5-1 共有 ModalShell 等の記述は歴史参照。

---

## Files

| File                                                          | Operation           | Notes                                       |
| ------------------------------------------------------------- | ------------------- | ------------------------------------------- |
| `frontend/src/utils/dateKey.test.ts`                          | Add tests           | 0-1（既存ファイル拡張）                     |
| `frontend/src/utils/getDescendantTasks.test.ts`               | Create (test)       | 0-2                                         |
| `frontend/src/utils/timeGridUtils.test.ts`                    | Create (test)       | 0-3                                         |
| `frontend/src/utils/buildCompletedTree.test.ts`               | Create (test)       | 0-4                                         |
| `frontend/src/utils/folderProgress.test.ts`                   | Create (test)       | 0-5（bench とは別）                         |
| `frontend/src/utils/databaseFilter.test.ts`                   | Create (test)       | 0-6                                         |
| `frontend/src/hooks/useScheduleItemsCore.test.ts`             | Create (test)       | 0-7                                         |
| `frontend/src/hooks/useScreenLockContext.ts`                  | Delete              | 1-1 デッド                                  |
| `frontend/src/utils/formatRelativeDate.ts`                    | Edit (削除)         | 1-2 `formatTime` 除去                       |
| `frontend/src/utils/index.ts`                                 | Edit (削除)         | 1-2/1-3 export 行除去                       |
| `frontend/src/context/.ChaosContext.tsx.swp`                  | Delete              | 1-4 ゴミ                                    |
| `frontend/src/hooks/createContextHook.ts`                     | Edit (1行)          | 1-5 null 安全化                             |
| `frontend/src/context/ThemeContext.tsx`                       | Edit                | 1-6 useMemo                                 |
| `frontend/src/context/ToastContext.tsx`                       | Edit                | 1-6 useMemo                                 |
| `frontend/src/hooks/useCalendars.ts`                          | Edit                | 1-7 return useMemo                          |
| `frontend/src/hooks/useTemplates.ts`                          | Edit                | 1-7 return useMemo                          |
| `frontend/src/hooks/useFileExplorer.ts`                       | Edit                | 1-7 return useMemo                          |
| `frontend/src/hooks/useTaskTreeAPI.ts`                        | Edit (削除)         | 2-1 ローカル generateId 除去                |
| `frontend/src/utils/generateTaskId.ts`                        | Edit (1行拡張)      | 2-1 type 接頭辞対応                         |
| `frontend/src/utils/mobileSnapTime.ts`                        | Delete or 縮小      | 2-2 重複除去                                |
| `frontend/src/utils/timeGridUtils.ts`                         | Edit                | 2-2 統合先（ガード移植）                    |
| `frontend/src/components/**`（R4 8+箇所）                     | Edit                | 2-3 formatTime 置換                         |
| `frontend/src/hooks/useScheduleItemsCore.ts`                  | Edit                | 2-4 getTodayKey                             |
| `frontend/src/hooks/useAttachments.ts` / `useSidebarLinks.ts` | Edit (削除)         | 2-5 generateId 集約                         |
| `frontend/src/types/wikiTag.ts`                               | Edit                | 3-1 entityType 統一                         |
| `frontend/src/types/schedule.ts` `taskTree.ts` `sync.ts`      | Edit                | 3-2 型集約                                  |
| `frontend/src/types/*.ts`（23ファイル）                       | Replace → re-export | 3-3 SSOT スタブ化                           |
| `frontend/src/services/DataService.ts`                        | Replace → re-export | 3-4                                         |
| `frontend/package.json`                                       | Edit                | 3-4 `@life-editor/shared` 依存追加          |
| `frontend/src/hooks/useFileExplorerContextOptional.ts`        | Create              | 4-1（規約準拠の最小追加、新抽象なし）       |
| Phase 5 関連                                                  | 要承認後に確定      | backdrop 28 / Escape 53 / RichTextEditor 等 |

---

## Verification

- [ ] Phase 0: `cd frontend && npm run test` 全 green（新規テストが既存挙動を pass = 安全網確立）
- [ ] 各 Phase 後: `cd frontend && npm run build`（`tsc -b` 相当、`--noEmit` は solution-style で無効なので不可）+ `npm run test` green
- [ ] Phase 1: バンドル/挙動不変。React DevTools で Theme/Toast 変更時の不要再描画が消えること（任意）
- [ ] Phase 2: 重複統合後、削除関数の参照ゼロを grep で再確認
- [ ] Phase 3-3/3-4: `frontend/src/types` re-export 化後も型エラーゼロ（shared と現時点バイト一致が前提条件）。`@life-editor/shared` 接続で循環参照が出ないこと
- [ ] Phase 3-1: `memo` リテラル全消滅を grep（`entityType.*memo` 0 件）
- [ ] 全 Phase: `git diff --stat` で正味行数が**減少**（テスト追加分を除く）= 制約「コンパクト化」の客観信号
- [ ] Phase 5: 着手前にユーザー承認。承認後、置換ファイル全てで a11y（`role="dialog"`）が付与され手書き backdrop がゼロになること

---

## 依存順・並列性メモ

- Phase 0 → 1 → 2 は厳密な依存（テスト無しにロジック統合しない）。Phase 1 内 1-1〜1-5 は相互独立で並列可。
- Phase 3 は Phase 0-2 と独立（型レイヤーのため別レーンで並行可）。ただし 3-3/3-4 は移行 Phase 2 の `shared` 接続作業と衝突しうるため、**移行担当チャットと調整**してから着手（並行チャット競合の温床）。
- Phase 5 は他と独立だが工数 L かつ要承認。最後 or 別ブランチ。
