# Mobile 機能限定スコープ — 画面別の取捨（SSOT）

> **Status**: ユーザー確定（2026-07-25 / Issue #319）。本文書が「画面別 Mobile スコープ」の正本。
> CLAUDE.md §2「Mobile = Consumption + Quick capture」は大方針、本文書がセクション内機能の取捨の正本（数値の非複製原則: 一覧はここが正）。
> 実測日: 2026-07-23（全 file:line は Read / grep で確認済み）。後続 UI/UX Epic = #321（本表から子 Issue を分解する）。

## 1. 分類の定義

- **Full**: デスクトップと同等の全機能
- **Consumption**: 閲覧・確認のみ（編集不可）
- **Quick capture**: 素早い新規作成・簡易入力のみ（詳細編集は不可）
- **省略**: モバイルで非表示 / 非提供

## 2. 実装フェーズの方針（2026-07-25 ユーザー確定）

目標スコープ（下表「目標」列）は確定。ただし実装は段階的に進める。

- **Phase 1**: 各機能を簡潔に実装し、モバイル全体の**方向性（UX の一貫性）を揃える**ことを優先する。重い機能（詳細編集等）はこの段階では現状のまま据え置く。
- **Phase 2**: 大枠（Phase 1）が固まった後、詳細編集・Notes 編集拡充・Routines 閲覧・Undo/Redo・コマンド検索などを**アップデートとして追加**する。

## 3. 前提（実測で判明した SSOT の実態）

- セクションは 8 つ（`shared/src/sections.ts:68-131`）: briefing / schedule / materials / connect / work / analytics / settings / trash
- `SectionDef` に「mobile 可視 boolean」は無い。全セクションが `mobileOrder` を持ち、モバイルのボトムバー（固定4 + More）から**全て到達可能**（`sections.ts:147`）。**モバイルで削られるのはセクション単位ではなく「各セクション内の機能」**（Issue #319 本文の「tasks」「database」セクションや「MOBILE_SECTIONS の取捨」は実態と不一致。tasks は materials 配下、database セクションは存在しない）
- レスポンシブ判定は単一ブレークポイント 768px（`shared/src/components/AppShell.tsx:115` `(min-width: 768px)` / `useMediaQuery`）。各画面が個別に `isWide` を読む
- モバイルのヘッダー行（`header` prop）は narrow で描画されない（`AppShell.tsx` wide 分岐のみ）→ ヘッダーに載る機能はモバイルで軒並み消える

## 4. 確定スコープ表

| #   | セクション / 機能            | 目標スコープ（確定）                                      | 実装フェーズ                                                      | モバイル現状（実測 file:line）                                                                                                                                    |
| --- | ---------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | briefing 紙面閲覧            | Consumption                                               | Phase 1（現状維持）                                               | 朝刊/夕刊の本体は幅共通で表示                                                                                                                                     |
| 2   | briefing 朝刊/夕刊 切替      | **モバイルでも手動切替あり**                              | Phase 1 で追加                                                    | 現状は wide 専用ヘッダーのタブ帯のみ → モバイルは時計依存の初期タブに固定（`MainScreen.tsx:174` `defaultBriefingTab()`）                                          |
| 3   | briefing 宣言(intention)入力 | **いつでも入力可（Quick capture 正式機能）**              | Phase 1 で追加                                                    | 入力欄は出るが朝刊タブ着地時のみ編集可・夕刊は read-only（`shared/src/components/briefing/BriefingView.tsx:256-268` / `web/src/briefing/BriefingScreen.tsx:639`） |
| 4   | schedule カレンダー          | Consumption                                               | Phase 1（現状維持）                                               | モバイルは Calendar 固定表示                                                                                                                                      |
| 5   | schedule Routines            | **モバイルは閲覧のみ**                                    | Phase 2 で追加                                                    | 到達不能（`ScheduleScreen.tsx:35` `effTab = isWide ? tab : "calendar"`、代替導線なし）                                                                            |
| 6   | materials / tasks(Kanban)    | **目標=詳細編集も可**（DnD・カラムは Desktop 専用のまま） | Phase 1 はクイック（status+title）のまま → **Phase 2 で詳細編集** | status変更 + title追加のみ（`web/src/tasks/MobileTaskList.tsx`、詳細は `web/src/tasks/KanbanView.tsx:468` で wide 限定）                                          |
| 7   | materials / notes            | **フル編集可**                                            | Phase 1 は簡潔実装 → **Phase 2 で編集拡充**                       | 閲覧のみ。`RichTextEditor editable={false}`（`web/src/notes/NotesView.tsx:1089`）、[[ 補完も無効                                                                  |
| 8   | materials / daily            | Full                                                      | Phase 1（現状維持）                                               | フル編集可（`web/src/daily/DailyView.tsx`、RichTextEditor 既定 editable=true）                                                                                    |
| 9   | materials / tags             | 閲覧 + 名前のみ追加                                       | Phase 1（現状維持）                                               | グループ管理・色編集・改名・削除は wide 限定（`web/src/wikitag/WikiTagsManagementView.tsx:570,574`）                                                              |
| 10  | work タイマー                | Full                                                      | Phase 1（現状維持）                                               | 単一フルスクリーンタイマー + タスク選択シート                                                                                                                     |
| 11  | work Ambient mixer           | **Desktop 専用で確定**                                    | 対象外                                                            | Desktop 専用（`web/src/work/WorkScreen.tsx:41,362`）。完了チャイム自体は幅非依存で鳴る                                                                            |
| 12  | analytics                    | Consumption                                               | Phase 1（現状維持）                                               | `MobileAnalyticsView` に縮約。4タブ無・heatmap/timeline無・30日固定・単一スクロール                                                                               |
| 13  | connect(グラフ)              | Full                                                      | Phase 1（現状維持）                                               | 専用モバイルシートでほぼ Full。ノード詳細 + リンク追加/削除可（`shared/src/components/Connect/mobile/NodeDetailSheet.tsx`）                                       |
| 14  | settings                     | Shortcuts のみ省略                                        | Phase 1（現状維持）                                               | Shortcuts カードのみ wide 専用（`SettingsScreen.tsx:219`）。他は表示                                                                                              |
| 15  | trash                        | Full                                                      | Phase 1（現状維持）                                               | モバイル到達可・復元機能する（`shared/src/components/TrashView.tsx`）                                                                                             |
| 16  | 横断: Undo/Redo              | **モバイル導線あり**（要 web 側配線）                     | Phase 2 で追加                                                    | ボタン(`HeaderUndoRedo`)は header=wide 専用で非表示。かつ web では undo/redo が未配線 no-op（`MainScreen.tsx:706-711`）                                           |
| 17  | 横断: コマンド検索(palette)  | **モバイル導線あり**                                      | Phase 2 で追加                                                    | タッチ導線ゼロ。開けるのは物理キーボード Cmd/Ctrl+K のみ（`MainScreen.tsx:712-717`）                                                                              |

## 5. フェーズ別の作業まとまり（#321 子 Issue 分解の種）

### Phase 1 — 簡潔実装で方向性を揃える

- briefing: モバイルに朝刊/夕刊の手動切替導線を追加（#2）
- briefing: 宣言(intention)入力をモバイルでいつでも編集可にする（#3）
- 現状維持で確定する行（#1, 4, 8, 9, 10, 12, 13, 14, 15）は Phase 1 でスコープ表どおりであることを確認するのみ（追加実装なし）
- tasks / notes は Phase 1 では現状の簡潔実装のまま据え置き（#6, #7 の Phase 1 側）

### Phase 2 — 大枠完成後の拡充

- tasks: モバイルで詳細パネル・リッチテキスト編集を可能に（DnD・カラムは Desktop 専用のまま）（#6）
- notes: モバイルでフル編集可に（`editable` 化 + [[ 補完のモバイル対応）（#7）
- schedule: Routines をモバイルで閲覧のみ表示（#5）
- 横断: Undo/Redo のモバイル導線（**前提: web 側の undo/redo 配線が先に必要** — 現状 no-op）（#16）
- 横断: コマンド検索(palette) のモバイルタッチ導線（#17）

## 6. 別枠メモ（本スコープ表の対象外・別 Issue で処理）

- 規約（`.claude/rules/frontend.md`）の「Mobile 省略 Provider（Audio / ScreenLock / FileExplorer / ShortcutConfig 等）」は、実測では web ホストで省略ロジック未実装（該当 Provider の一部はコードに存在せず、Audio/ShortcutConfig は無条件マウント）。Tauri 時代の名残。**規約を実装実態に合わせて直す作業は別 Issue**（本スコープ表の対象外）。
- 上記に合わせ、CLAUDE.md §2 の「Mobile 省略 Provider（4 種）」行も実態確認のうえ別 Issue で追随する。
