# 015: Mobile で `notion-*-primary` サフィックス誤用、27 箇所で背景透明化

**Status**: Fixed
**Category**: Bug / Styling / Structural
**Severity**: Important（UI 可読性の致命的劣化）
**Discovered**: 2026-04-24
**Resolved**: 2026-04-24

## Symptom

iOS 実機で背景透明化（後ろの UI が透ける）+ primary テキスト色がブラウザ既定にフォールバック:

- 左ドロワー（MobileLeftDrawer）/ Note 新規作成シート（MobileActionSheet）
- Materials のタグピッカー（MobileTagPicker）/ パスワード入力（NumericPadPasswordDialog）
- グローバルヘッダー / ボトムタブバー（MobileLayout）/ Daily ビュー

## Root Cause

Tailwind v4 `@theme` ディレクティブで定義されているのは **primary サフィックス抜き**:

```css
/* frontend/src/index.css */
--color-notion-bg: var(--color-bg-primary);
--color-notion-bg-secondary: var(--color-bg-secondary);
--color-notion-text: var(--color-text-primary);
--color-notion-text-secondary: var(--color-text-secondary);
```

正しい使い方は `bg-notion-bg` / `text-notion-text`。Mobile 系 27 箇所が **存在しない `bg-notion-bg-primary` / `text-notion-text-primary` / `bg-notion-text-primary`** を使用。Tailwind v4 は未定義クラスに CSS を生成しないため:

- `bg-*-primary` → 背景なし → 透明
- `text-*-primary` → color 未設定 → ブラウザ既定にフォールバック

Desktop は正しく `bg-notion-bg` 使用。Mobile だけ「`-secondary` があるから `-primary` もあるだろう」で誤用。

### 影響範囲（修正前）

`MobileApp.tsx`(2) / `MobileLayout.tsx`(3) / `MobileNoteTreeItem.tsx`(1) / `MobileTagPicker.tsx`(4) / `MobileTaskView.tsx`(2) / `MobileDailyView.tsx`(4) / `MobileLeftDrawer.tsx`(1) / `NumericPadPasswordDialog.tsx`(7) / `MobileActionSheet.tsx`(2) / `MobileNoteView.tsx`(2) — **計 27 箇所**

## Fix

一括置換:

```bash
grep -rlE "(bg|text)-notion-(bg|text)-primary" frontend/src \
  | xargs sed -i '' \
    -e 's/bg-notion-bg-primary/bg-notion-bg/g' \
    -e 's/text-notion-text-primary/text-notion-text/g' \
    -e 's/bg-notion-text-primary/bg-notion-text/g'
```

検証: `grep -rnE "notion-[a-z]+-primary" frontend/src --include="*.tsx" --include="*.ts"` → 0 件 / `tsc -b` green / Vitest 231 pass。

## Lessons Learned

1. **Tailwind v4 は invalid class を silent skip**: TypeScript も ESLint も検出不可 → UI レビュー or 実機目視でしか気づけない
2. **`-secondary` 存在 ≠ `-primary` 存在**: `@theme` の primary はサフィックス抜きが本リポ規約。命名で迷ったら `grep "color-notion-"` で index.css を引く
3. **Desktop と Mobile でスタイルトークン規約が揃っているかを PR 時に確認**
4. 検索: `bg-notion-bg-primary`, `text-notion-text-primary`, `Tailwind v4 @theme`, `invalid tailwind class silent`

## References

- `frontend/src/index.css` `@theme` ブロック（line 66-77）
