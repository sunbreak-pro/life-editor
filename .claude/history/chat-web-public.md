# HISTORY (chat-web-public)

### 2026-08-13 - #791 iOS safe-area 修正 と #676 (a) AppProviders 切り出し

#### 概要

iPhone の PWA standalone で上下が崩れる #791 を直し（PR #805）、続けて #676 の唯一の未着手ステップだった (a) 前半 = グローバル Provider 鎖の切り出しを実施した（PR #811）。どちらも shared / web / desktop の lint・build・test・typecheck が exit 0、merge は未（P-001）。

#### 変更点

- **#791 上（PR #805）**: `AppShell.tsx` narrow 根に `pt-[env(safe-area-inset-top)]` を追加。`viewport-fit=cover` + `black-translucent` で Web ビューが画面最上端から始まるのに、根が左右 inset しか持っておらず、ヘッダー行がステータスバーに直接描かれていた
- **#791 下（PR #805）**: `BottomTabBar` の `pb-[env(safe-area-inset-bottom)]` → `pb-[max(0px,calc(env(safe-area-inset-bottom)_-_0.5rem))]`。タブの `py-2` が既にラベル下 0.5rem を占めており、そこへ inset を丸ごと足して二重になっていた。`max(0px, …)` により inset=0 の環境は出力 CSS 不変・タップ領域も不変
- **実測の内訳**: 生成 CSS を grep して Tailwind が `max(0px, calc(env(safe-area-inset-bottom) - .5rem))` へ正しく展開することを確認（`_` → 空白）。**実機の数値測定は未実施**（worktree からは実機・dev server に触れない = CLAUDE.md §7.4）ため、PR 本文に測定スクリプトと「どの値が出たらどう対応するか」の判定表を書いて chat-main へ渡した
- **#676 (a)（PR #811）**: `web/src/AppProviders.tsx` を新設し、グローバル Provider 鎖（Toast → Sync → UndoRedo → ShortcutConfig → Audio → Timer → RightSidebar）と headless 2 本・`isNativeMobile()` の Mobile 省略ゲートを移設。`MainScreen.tsx` 531 → 434 行。index チャンク 1,438.66 → 1,438.83 kB（中立）
- **テスト**: `shared/tests/appShell.test.tsx` に safe-area 宣言のガード 2 本（jsdom は `env()` を解決しないのでクラス名で「どの要素がどの inset を持つか」だけ固定）／ `web/tests/appProvidersOrder.test.tsx` に Provider 入れ子順の実行時ガード 3 本（マーカー Provider 方式・`timerHostChime.test.tsx` に倣う）
- **スコープ外に送った発見（P-008）**: `BottomSheet.tsx` が `pb-6` 固定で bottom inset を持たない（iOS standalone で最終行がホームインジケータに食い込む）／ `black-translucent` の白文字が朝刊テーマで読めない懸念。どちらも実装せず outbox の起票依頼へ
