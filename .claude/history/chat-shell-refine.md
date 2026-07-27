# HISTORY (chat-shell-refine)

### 2026-07-27 - #409 タグ編集パネルの新設（PR #425）

#### 概要

タグの CRUD モーダルは前から存在したが配線先が Notes タブ 1 箇所だけで、「タグが一覧で見える画面（Todo の tag view）からは編集できない / 編集できる画面にはタグ一覧の見通しが無い」という捻れが「タグを削除する導線が無い」の正体だった。入口を leftSidebar（パレット直上）に新設してマスタ管理をグローバルなモーダルへ集約し、あわせて各タグに紐づくアイテムの一覧 + 解除を実装した。

#### 変更点

- **入口**: `SidebarNav` / `AppShell` に optional な「タグを編集」フッター行を追加（コマンドパレット行の**直上** = ユーザー確定の配置。タグは分類の軸なのでセクション列に置き、ヘッダー右の「今の画面への操作」群には混ぜない）。ハンドラとラベルの両方が揃った時のみ描画する
- **ホスト**: `web/src/tags/TagEditorHost.tsx` をシェル階層に mount。`WikiTagsUnifiedProvider` は**セクション階層**の Provider で Briefing / Work / Analytics / Settings / Trash には存在しないため、Provider を足さずホストが `useWikiTagsUnifiedAPI` インスタンスを自前で持つ設計にした（DataService は引数注入 = §6.4）。書き込みは Realtime エコー → `syncVersion` 経由で各セクションへ伝播（MCP 編集と同じ経路）。**mount-on-open** なので閉じている間はクエリ 0
- **種類表示の正本**: 新規 `shared/src/components/items/itemRole.ts` + `ItemRoleBadge.tsx`。task / event / note / daily の 4 種 + 中立フォールバックで、アイコンは各種類が既にアプリ内で着ているものを再利用（task/note/daily = Materials タブ、event = Schedule セクション）。色だけに依存させず「アイコンの形 + ラベル文字 + 色」の 3 重で示す。`routine` は Event の実装詳細（CLAUDE.md §4 / #185）で専用タグ面を持たないため設計セットから意図的に除外。**#412 が同じ契約から描画する**
- **アイテム一覧**: `TagEditModal` の件数ピルを開閉ボタン兼用にし、開くと種類バッジ + タイトル + 外すボタンの行が並ぶ。既定は畳んだ状態（タグ数 × アイテム数を全開にするとパネルが壁になる）。一覧は**解決済みアイテムではなく assignment 側**を回すので、routine / dismissed event のように行を特定できない assignment も「その他」バッジで必ず表示され外せる（件数ピルとも件数が一致する）
- **解決フック**: 新規 `shared/src/hooks/useTaggedItemIndex.ts`。assignment は `itemId` / `tagId` しか持たないため、notes / dailies / tasks / events を DataService から引いて `itemId → { role, title }` を作る（`useItemLinkTargets` と同型・`syncVersion` で再取得）。`useWikiTagsUnifiedAPI` の戻り値に `allAssignments` を追加（既存 state の露出のみ）
- **一本化**: Notes タブ側の旧導線は残さず撤去。理由 =（1）シェル側から Notes 表示中でも同じパネルに届くので扉が 2 つになる、（2）一覧が全 role 横断になりパネルの範囲が Notes を超えたため「Notes の機能」という提示が実態と食い違う。撤去箇所は Notes の**デスクトップ用サイドバー内**でモバイル body には元から無いため、モバイルの機能は減らない。未使用化した `materials.tags.editCta` も削除
- **i18n**: en / ja 両 catalog に `nav.tagEditor` / `itemRole.*` / `materials.tags.{itemsToggle,itemsEmpty,unassign,untitledItem}` を追加
- **テスト**: `shared/tests/tagEditModalItems.test.tsx` 新規（開閉 / 4 種バッジ / unassign の assignmentId / 不明 role のフォールバックと除去可能性 / 空状態 / `items` 無し時は静的ピル / 行ごと独立開閉 / 契約の resolve・label・sort）。`sidebarNav.test.tsx` に**配置**テストを追加（パレット行の直上であることを DOM 兄弟関係で検証 — 「あること」ではなく「どこにあるか」が要件のため）
- **検証**: shared test 1191 passed（147 files）/ shared build / web build / web lint / docs-lint すべて exit 0。DDL ゼロ。実ブラウザ実測は §7.4 に従い merge 後 chat-main
- **申し送り**: #368（WikiTags 一覧のソート・フィルタ）へ設計コメントを投下。一覧の所在が本パネルに確定したこと、`SidebarListControls` はサイドバー前提なのでモーダルに流用すると形が合わないこと、必要なら「並び替え」より「名前の絞り込み」1 本を推す旨を記録
- **環境メモ**: `scripts/docs-lint.sh` は Windows Git Bash で `LC_ALL` が UTF-8 系のとき既存ファイル（`2026-06-19-step1-desktop-daily-driver.md`・本件では未変更）の Status 行を誤検知する。`LC_ALL=C` で OK・CI は main でも緑。life-editor のコードを直しても直らない環境系のため Issue 化せず記録に留める（CLAUDE.md §9）

### 2026-07-26 - #304 Epic close: 全 DoD 実測確認 + Issue 完了処理

#### 概要

子 PR 1（PR #316）/ 子 PR 2（PR #380）が両方 merged 済みだったため、main の実コードで Epic #304 の DoD 全項目を実測確認し、Issue の完了処理（body チェックボックス消し込み・完了コメント・close (completed)）を実施した。実装の新規差分はゼロ（per-chat meta のみ・ブランチ = claude/shell-refine-304-ui）。

#### 変更点

- **実測確認**: ヘッダー `[search][Undo][Redo][rightSidebar]` 配置（`MainScreen.tsx` headerControls）/ `UndoRedoButtons` の履歴空 disabled / `edit:undo`・`edit:redo` の `activeInInput: false` + `resolveShortcut` の contentEditable・IME ガード（エディタ非干渉）/ `UndoRedoHost` の Toast + i18n en·ja 両 catalog / vitest undoRedo 3 ファイル 20 件緑
- **Issue #304**: body チェックボックス全消し込み + 完了確認コメント + close（reason: completed）。見送り = Routine（RoutineScheduleSync との undo 連鎖未設計 — 必要になったら chat-main で別 Issue 起票を判断）
- **outbox**: chat-main へ実ブラウザ実測依頼（ヘッダーボタン / ⌘Z 分離 / Toast / 4 ドメイン代表操作の往復・既知挙動 3 点は Issue コメント参照）を 2026-07-26 (3) で append

### 2026-07-26 - #304 子 PR 2: schedule / daily / note の undoRedo 配線 + 子 PR 1 バグ修正（PR #380）

#### 概要

Epic #304 の子 PR 2。3 ドメインの Provider を TaskTreeProvider と同じ ambient auto-connect で配線し、実装過程の新テストが子 PR 1（merge 済み PR #316）の実バグ — unmount クリア effect が push のたびに cleanup を再発火して履歴を積んだ瞬間に消す（main の taskTree undo が実質無効）— を検出したため、4 Provider 共通で ref ベースの修正を同梱した。Routine は RoutineScheduleSync との連鎖未設計のため見送り（Issue #304 コメントに記録）。

#### 変更点

- **配線（shared/src/context/ の 3 Provider）**: `useUndoRedoOptional()` → API hook へ `options.undoRedo ?? undoRedo ?? undefined`。各フックは Tauri 時代からラベル付きコマンドを push しており配線のみで有効化。web/ 変更ゼロ
- **子 PR 1 バグ修正（TaskTreeContext + 新 3 Provider）**: unmount クリアの deps を context 値 → `hasExplicitUndoRedo`(boolean) に変更し、値は ref 経由で読む。回帰テストあり
- **schedule 日跨ぎ修正（useScheduleItemsAPI）**: undo/redo クロージャの日付比較を dateRef（現在のアンカー日付）読みに変更 — 他日の行が表示リストに混入する不整合を解消（role-qa Important 反映）
- **i18n**: undoRedo.labels に新規 13 キー（en/ja。既存 taskTreeChange と合わせ 14）
- **テスト**: undoRedoDomainWiring.test.tsx 新設 6 件（3 ドメイン + taskTree 回帰 + explicit prop + StrictMode）
- **コメント / docs**: useGlobalShortcuts の「未配線」記述を実態に更新・app-integration plan Worklog に #304 解消を追記
- **検証**: shared tsc -b + vitest 137 files / 1086 passed・web build exit 0・role-qa = PASS with notes（Blocker 0）

### 2026-07-26 - #320 Mobile 基盤配線（PR #358）

#### 概要

`isNativeMobile()` ガードを web ホストに配線し（ShortcutConfigProvider を native 省略・Ambient mixer UI を WorkScreen で native 省略）、`viewport-fit=cover` を追加した。role-qa 独立監査の Blocker 指摘を受け、AudioProvider は native でも維持（完了チャイム = mobile-scope.md #10/#11 のユーザー確定と DoD の矛盾をチャイム維持側に解消）— Issue DoD からの逸脱として #320 コメントに記録済み。

#### 変更点

- **ゲート配線（`web/src/MainScreen.tsx`）**: `ShortcutConfigHost` 新設（native = children 素通し / それ以外 = 従来どおり Provider ラップ）。消費側の null 安全は全箇所実測確認（GlobalShortcuts / SettingsScreen / WorkScreen / AudioChimeBridge / useGlobalShortcuts）
- **チャイム維持（role-qa Blocker 反映）**: AudioProvider は全ホストでマウント維持・WorkScreen の mixer 描画条件に `!isNativeMobile()` を追加
- **viewport（`web/index.html`）**: `viewport-fit=cover` 追加（notched iOS で `env(safe-area-inset-*)` が全て 0 に解決される問題の修正）
- **テスト**: `shared/tests/platform.test.ts` 新設（isNativeMobile の契約 3 ケース）
- **docs 追随**: CLAUDE.md §2 / rules/frontend.md / mobile-scope.md §6 / mobile/README.md / styles.xml コメント / `shared/src/index.ts` の「5 種」参照化 / stale な "always mounted" コメント掃除
- **検証**: shared tsc -b + vitest 137 files / 1083 passed・web build exit 0・role-qa 独立監査（NEEDS REVISION → Blocker / Important 全反映）

### 2026-07-20 - Layout / 操作系 4 Issue（PR #313/#314/#315/#316・全 merge 済み）

#### 概要

（バックフィル記録 — memory「直近の完了」から HISTORY へ移す際の要約。詳細は各 PR 参照）#305 / #307 / #306 / #304 子 PR 1 を 1 Issue = 1 PR で処理し、いずれも merge された。

#### 変更点

- **#305（PR #313）**: メインコンテンツ幅を全セクション max-w-lumen-wide に統一（PageContainer fluid を中央寄せ + 1120px 上限化・MainScreen width マッピング整理）
- **#307（PR #314）**: アイテム操作パネル汎用化
- **#306（PR #315）**: ヘッダー常設コマンドパレット検索フィールド
- **#304 子 PR 1（PR #316）**: Undo/Redo 基盤 + taskTree（UndoRedoManager グローバル 1 本スタック + Provider + Buttons + Toast + ⌘Z 配線 + taskTree auto-connect + 単体 13 件）

