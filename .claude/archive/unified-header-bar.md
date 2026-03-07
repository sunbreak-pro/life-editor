# Unified Header Bar Implementation Plan

**Status**: COMPLETED
**Date**: 2026-03-07

## Context

現在、ウィンドウのドラッグ領域がLeftSidebarのヘッダー部分のみに限定されており、サイドバー閉じ時はドラッグ不可。SectionHeaderの各セクション内タブもメインコンテンツ内にあり統一感がない。ウィンドウ最上部に統合ヘッダーバーを新設し、ドラッグ操作・ナビゲーション・セクションタブを一箇所に集約する。

## Target Layout

```
+---------------------------------------------------------------+
| [● ● ●]  life-editor  [◧]  |  Tasks  | Schedule | Routine    |  <- TitleBar (全体drag)
+--------+------------------------------------------------------+
| [Tasks]|                                                       |  <- sidebar closed = icon-only
| [Memo] |  main content                                        |
| [Work] |                                                       |
| [Stats]|                                                       |
|        |                                                       |
| [Set]  |                                                       |
| [Tips] |                                                       |
+--------+------------------------------------------------------+
| Terminal                                                       |
+---------------------------------------------------------------+
| StatusBar                                                      |
+---------------------------------------------------------------+
```

## Requirements

1. **統合ヘッダーバー**: ウィンドウ最上部に全幅ヘッダー。全体がドラッグ領域
   - 左: macOS traffic lights -> "life-editor" ラベル -> PanelLeft トグル
   - 右: セクション毎のタイトル + タブ + アクション (Portal経由で注入)
2. **ラベル・トグル固定**: サイドバー開閉に関わらず "life-editor" と PanelLeft は同じ位置に固定
3. **サイドバー閉じ時**: アイコンのみナビゲーション (ラベルなし縦並び)
4. **LeftSidebar**: ヘッダー部分 (Life Editor + PanelLeft + titlebar-drag) を削除

## Implementation Steps

### Step 1: HeaderPortal Context

**New file**: `frontend/src/components/Layout/HeaderPortalContext.ts`

セクションがヘッダーにコンテンツを注入するためのPortalターゲットを共有するContext。

### Step 2: TitleBar Component

**New file**: `frontend/src/components/Layout/TitleBar.tsx`

- 構成: `titlebar-drag` の全幅バー
  - 左エリア: macOS用padding -> "life-editor" ラベル -> PanelLeft トグルボタン (`titlebar-nodrag`)
  - 右エリア: `<div ref={portalRef}>` - セクションがPortalでコンテンツを注入するターゲット
- macOS: traffic lights用に左側に約70px分のpadding (`pl-[70px]`)
- 高さ: `h-12` (48px) 程度、`border-b border-notion-border`
- `isMac` (`frontend/src/utils/platform.ts`) で条件分岐

### Step 3: Layout.tsx 修正

**File**: `frontend/src/components/Layout/Layout.tsx`

1. TitleBarを`<div className="flex flex-col h-screen">`の最初の子として追加
2. TitleBar内でportalTarget refを管理し、HeaderPortalContext.Providerで子をラップ
3. サイドバー閉じ時のw-12バー（L179-186）を**アイコンのみナビゲーション**に変更
   - mainMenuItems + Settings/Tips のアイコンを縦並びで表示
   - クリックでセクション切替、アクティブセクションのハイライト
4. leftSidebarOpen のトグル操作はTitleBarのPanelLeftボタンから行う

### Step 4: LeftSidebar.tsx 修正

**File**: `frontend/src/components/Layout/LeftSidebar.tsx`

1. ヘッダー部分（L49-61: "Life Editor" + PanelLeft + `titlebar-drag`）を削除
2. `onToggle` prop削除
3. macOS用の `pt-10` 削除（TitleBarが担当）

### Step 5: SectionHeader をPortal対応に修正

**File**: `frontend/src/components/shared/SectionHeader.tsx`

1. `HeaderPortalContext` を使い、portalTargetが存在する場合は `createPortal` でヘッダーにコンテンツを注入
2. portalTargetが無い場合は従来通りin-placeレンダリング（フォールバック）
3. 元の位置には何もレンダリングしない（`return null`）

### Step 6: インラインSectionHeader使用箇所の修正

以下のファイルの inline header を `<SectionHeader>` に置換:

- `frontend/src/components/Work/WorkScreen.tsx` (L101-116)
- `frontend/src/components/Settings/Settings.tsx` (L62)
- `frontend/src/components/Tips/Tips.tsx` (L53)

### Step 7: trafficLightPosition 調整

**File**: `electron/main.ts`

- y値をTitleBarの高さに合わせて中央配置に調整

### Step 8: MainContent padding 調整

- SectionHeaderが上部から消えるため padding を確認・微調整

## Key Files

| File                                                    | Action |
| ------------------------------------------------------- | ------ |
| `frontend/src/components/Layout/HeaderPortalContext.ts` | NEW    |
| `frontend/src/components/Layout/TitleBar.tsx`           | NEW    |
| `frontend/src/components/Layout/Layout.tsx`             | MODIFY |
| `frontend/src/components/Layout/LeftSidebar.tsx`        | MODIFY |
| `frontend/src/components/shared/SectionHeader.tsx`      | MODIFY |
| `frontend/src/components/Work/WorkScreen.tsx`           | MODIFY |
| `frontend/src/components/Settings/Settings.tsx`         | MODIFY |
| `frontend/src/components/Tips/Tips.tsx`                 | MODIFY |
| `electron/main.ts`                                      | MODIFY |

## Verification

1. `npm run dev` でアプリ起動
2. ヘッダーバーをドラッグしてウィンドウ移動を確認
3. PanelLeftボタンでサイドバー開閉を確認
4. サイドバー閉じ時: アイコンのみナビが表示されセクション切替可能
5. サイドバー開閉時: "life-editor" ラベルとPanelLeftの位置が不変
6. 全セクションで正しいタブがヘッダーに表示される
7. タブクリックが正常に動作（titlebar-nodrag）
8. macOSでtraffic lightsが正しい位置に表示
