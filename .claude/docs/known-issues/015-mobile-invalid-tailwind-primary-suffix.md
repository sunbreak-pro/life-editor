# 015: Mobile で `notion-*-primary` サフィックスを誤用、27 箇所でバックグラウンドが透明化

**Status**: Fixed
**Category**: Bug/Styling/Structural
**Severity**: Important（UI 可読性の致命的劣化）
**Discovered**: 2026-04-24
**Resolved**: 2026-04-24

## Symptom

iOS 実機で以下のような画面で背景が透明になり、後ろの UI が透けて読めない:

- ハンバーガー → 左ドロワー（MobileLeftDrawer）
- Note 新規作成シート（MobileActionSheet）
- Materials のタグピッカー（MobileTagPicker）
- パスワード入力ダイアログ（NumericPadPasswordDialog）
- Mobile グローバルヘッダー / ボトムタブバー（MobileLayout）
- Daily ビューのエディタ背景

同時にテキスト色も既定色（フォールバック）になって、primary テキストのテーマ配色が効かない現象も併発。

## Root Cause

Tailwind v4 CSS-variables テーマ（`@theme` ディレクティブ）で定義されているトークンは:

```css
/* frontend/src/index.css */
--color-notion-bg: var(--color-bg-primary);
--color-notion-bg-secondary: var(--color-bg-secondary);
--color-notion-text: var(--color-text-primary);
--color-notion-text-secondary: var(--color-text-secondary);
```

つまり **primary は `-primary` サフィックス抜き** で参照する（`bg-notion-bg` / `text-notion-text`）。
一方 Mobile 系コンポーネントは **存在しない `bg-notion-bg-primary` / `text-notion-text-primary` / `bg-notion-text-primary`** を 27 箇所で使用していた。Tailwind v4 は未定義クラスに対して CSS を生成しないため、結果は:

- `bg-*-primary` → 背景なし → 透明（祖先の背景が見える）
- `text-*-primary` → `color` プロパティ未設定 → ブラウザ既定色にフォールバック

Desktop 側は正しく `bg-notion-bg` / `text-notion-text` を使用しており、Mobile 系コードだけが「`-secondary` があるから `-primary` もあるだろう」という推測で誤用していた。

### 影響範囲（修正前）

| ファイル                                                    | 誤用箇所 |
| ----------------------------------------------------------- | -------- |
| `src/MobileApp.tsx`                                         | 2        |
| `src/components/Layout/MobileLayout.tsx`                    | 3        |
| `src/components/Mobile/materials/MobileNoteTreeItem.tsx`    | 1        |
| `src/components/Mobile/materials/MobileTagPicker.tsx`       | 4        |
| `src/components/Mobile/MobileTaskView.tsx`                  | 2        |
| `src/components/Mobile/MobileDailyView.tsx`                 | 4        |
| `src/components/Mobile/shared/MobileLeftDrawer.tsx`         | 1        |
| `src/components/Mobile/shared/NumericPadPasswordDialog.tsx` | 7        |
| `src/components/Mobile/shared/MobileActionSheet.tsx`        | 2        |
| `src/components/Mobile/MobileNoteView.tsx`                  | 2        |
| **合計**                                                    | **27**   |

## Fix

以下の一括置換:

- `bg-notion-bg-primary` → `bg-notion-bg`
- `text-notion-text-primary` → `text-notion-text`
- `bg-notion-text-primary` → `bg-notion-text`

実行コマンド（参考）:

```bash
grep -rlE "(bg|text)-notion-(bg|text)-primary" frontend/src \
  | xargs sed -i '' \
    -e 's/bg-notion-bg-primary/bg-notion-bg/g' \
    -e 's/text-notion-text-primary/text-notion-text/g' \
    -e 's/bg-notion-text-primary/bg-notion-text/g'
```

検証:

```bash
grep -rnE "notion-[a-z]+-primary" frontend/src --include="*.tsx" --include="*.ts"
# → 0 件
cd frontend && npx tsc -b && npx vitest run  # tsc green, 231 tests passed
```

## Lessons Learned

1. **Tailwind v4 は invalid class を silent にスキップする**: TypeScript も ESLint も検出できないため、UI レビューか実機目視でしか気づけない。同種のバグは将来も発生しうる。
2. **`-secondary` が存在するからといって `-primary` が存在するとは限らない**: `@theme` ブロックで primary 側はサフィックス抜きで定義することが多い（このリポの規約）。命名で迷ったら `grep "color-notion-"` で index.css を引く。
3. **Desktop と Mobile でスタイルトークン規約が揃っているかを PR 時に確認**: Desktop に `bg-notion-bg` は多数ある一方、Mobile だけ `-primary` 付きを使うのは明確な乖離シグナル。
4. **検索キーワード**: `bg-notion-bg-primary`, `text-notion-text-primary`, `Tailwind v4 @theme`, `invalid tailwind class silent`

## References

- 修正コミット: （本セッションの fix: commit ハッシュ）
- 正典ファイル: `frontend/src/index.css` の `@theme` ブロック（line 66-77）
- 関連: Mobile 限定の UI 問題だが、将来 Desktop で同様パターンが発生しうる構造的教訓
