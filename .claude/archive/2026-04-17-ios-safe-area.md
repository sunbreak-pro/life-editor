# Plan: iOS Safe Area 対応（ステータスバー・ホームインジケーター）

**Status:** COMPLETED (2026-04-18)
**Created:** 2026-04-17
**Task:** iOS Safe Area 対応（MEMORY.md）
**Project:** /Users/newlife/dev/apps/life-editor

**完了メモ:** Step 1-3（MobileLayout の header/nav safe area padding + FAB mb）を実装し、iOS シミュレータで全タブ + ダーク/ライトモードの表示確認完了。Step 4 (CSS 変数フォールバック) は未発生のため不要と判断し Skip。

---

## Context

iOS シミュレータで Life Editor を表示した際、iPhone のステータスバー（Wi-Fi・時刻・バッテリー等）がアプリのヘッダーと重なり、画面下部のホームインジケーターがタブバーと重なっている。`viewport-fit=cover` は `index.html` に設定済みだが、CSS で `env(safe-area-inset-*)` を使った余白処理が未実装。

**現状:**

- `MobileLayout.tsx`: header `h-12` + content `flex-1` + bottom nav の3層構造
- `index.html`: `viewport-fit=cover` 設定済み（safe area まで描画範囲を拡張）
- `index.css`: safe area 関連のスタイルなし
- タブバーの FAB ボタン（MobileCalendarView）が `bottom-20` で配置されており、ホームインジケーターと干渉の可能性あり

**Why:** iOS デバイス（ノッチ/Dynamic Island 搭載機）では、ステータスバー領域（上部約47px）とホームインジケーター領域（下部約34px）にコンテンツが重なると操作性と視認性が著しく低下する。

---

## Steps

### [ ] Step 1: MobileLayout.tsx に safe area padding 追加

ヘッダーとフッター（タブバー）に `env(safe-area-inset-*)` の padding を追加する。Tailwind CSS の arbitrary values を使用し、追加 CSS ファイルは不要。

**変更ファイル:** `frontend/src/components/Layout/MobileLayout.tsx`

```tsx
// 変更前
<div className="flex h-dvh flex-col bg-notion-bg-primary">
  {/* Header */}
  <header className="flex h-12 shrink-0 items-center border-b border-notion-border px-4">

// 変更後
<div className="flex h-dvh flex-col bg-notion-bg-primary">
  {/* Header — ステータスバー分の余白 */}
  <header className="flex h-12 shrink-0 items-center border-b border-notion-border px-4 pt-[env(safe-area-inset-top)]"
    style={{ minHeight: `calc(3rem + env(safe-area-inset-top, 0px))` }}>
```

```tsx
// 変更前
<nav className="flex shrink-0 border-t border-notion-border bg-notion-bg-primary">

// 変更後 — ホームインジケーター分の余白
<nav className="flex shrink-0 border-t border-notion-border bg-notion-bg-primary pb-[env(safe-area-inset-bottom)]">
```

**設計ポイント:**

- `pt-[env(safe-area-inset-top)]`: ヘッダーの上部にステータスバー分のパディング
- `minHeight: calc(3rem + safe-area-inset-top)`: ヘッダーの高さをステータスバー分だけ拡張
- `pb-[env(safe-area-inset-bottom)]`: タブバーの下部にホームインジケーター分のパディング
- Desktop ブラウザでは `env()` が `0px` にフォールバックするため、デスクトップ表示に影響なし

### [ ] Step 2: ステータスバー背景色の統一

ステータスバー領域の背景色がアプリと統一されるよう、最外層の div にも対応。

**変更ファイル:** `frontend/src/components/Layout/MobileLayout.tsx`

```tsx
// 最外層に safe area の左右も考慮
<div className="flex h-dvh flex-col bg-notion-bg-primary
  pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
```

**Why:** 横向き（landscape）時に左右のノッチ領域をカバーするため。縦向き専用でも将来の互換性のために追加。

### [ ] Step 3: MobileCalendarView の FAB ボタン位置調整

**変更ファイル:** `frontend/src/components/Mobile/MobileCalendarView.tsx`

FAB（Floating Action Button）の `bottom-20` を safe area 対応に修正:

```tsx
// 変更前
className = "... bottom-20 ...";

// 変更後
className = "... bottom-20 mb-[env(safe-area-inset-bottom)] ...";
```

ただし FAB は MobileLayout のタブバーの上に配置されるため、タブバーに `pb-[env(safe-area-inset-bottom)]` を追加済みなら `bottom-20` のままで十分な可能性がある。実機確認で判断。

### [ ] Step 4: index.css にフォールバック定義（オプション）

Tailwind の `env()` arbitrary values が一部のビルドツールで警告を出す場合の対策として、CSS カスタムプロパティで抽象化する方法。Step 1 で問題なければスキップ。

**変更ファイル:** `frontend/src/index.css`

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

使用側: `pt-[var(--safe-top)]`, `pb-[var(--safe-bottom)]`

---

## Files

| File                                                    | Operation          | Notes                                                  |
| ------------------------------------------------------- | ------------------ | ------------------------------------------------------ |
| `frontend/src/components/Layout/MobileLayout.tsx`       | 変更               | header に pt + minHeight、nav に pb、外枠に pl/pr 追加 |
| `frontend/src/components/Mobile/MobileCalendarView.tsx` | 変更（条件付き）   | FAB ボタン位置を実機確認後に調整                       |
| `frontend/src/index.css`                                | 変更（オプション） | CSS 変数定義（Step 1 で問題あれば）                    |

---

## Verification

- [ ] iOS シミュレータで起動 → ステータスバー（時刻・Wi-Fi等）がヘッダーと重ならない
- [ ] タブバーがホームインジケーターと重ならない
- [ ] 4タブ（Materials / Calendar / Work / Settings）全てで表示確認
- [ ] MobileCalendarView の FAB ボタンがタブバーと重ならない
- [ ] MobileSettingsView の最下部（App info テキスト）が見切れない
- [ ] Desktop（`cargo tauri dev`）で表示崩れがない（safe area = 0px にフォールバック）
- [ ] ダークモード/ライトモードでステータスバー領域の背景色が統一されている
