# HISTORY (chat-lumen-shared)

### 2026-07-02 - Lumen UI 出荷部品移植 + デザイントークン橋渡し

#### 概要

ClaudeDesign(Lumen) カタログの Toast / Sheet / Sidebar / Menu を出荷 UI として `shared/src/components/` に新規実装。前段で `tokens.css` に不足していた機能色・サーフェス・テキスト階調・寸法スケールを橋渡しした。独立 QA（role-qa）は Blocking 0 で PASS。

#### 変更点

- **トークン(tokens.css)**: 機能色 `info`(#2563eb/#60a5fa) / `warning`(#b45309/#fbbf24)、`surface-sunken`(#ececef/#101013)、第3テキスト階調 `text-tertiary`(#767680/#74747e) を :root(light) + [data-theme=dark] 両方に生値追加し `@theme` で `ink-*` にマッピング。`radius-ink-*`(6/8/12/16/full) と `spacing-ink-*`(4〜24) スケールを @theme に単一定義（テーマ不変のため）。shadow は既存 `shadow-ink-*` を流用
- **Toast.tsx (新規)**: Toast カード（3px セマンティックバー + ドット + dismiss、variant=info/success/warning/danger を静的 Record マップで解決）+ ToastViewport（6 方向固定スタック、click-through）
- **Sheet.tsx (新規)**: 多方向ドロワー（bottom/top/left/right）。portal + backdrop + focus trap + Esc(IME ガード) + scroll lock + focus 復元。既存 BottomSheet は据え置き
- **Sidebar.tsx (新規)**: Sidebar + SidebarItem。Lumen の default/hover/selected(accent-subtle + 3px 左インジケータ)/mint 状態。既存 SidebarNav/NavItem は据え置き
- **Menu.tsx (新規)**: Menu + MenuItem ドロップダウン。roving focus(Arrow/Home/End)・Tab で閉じる・Esc(IME ガード)・outside-pointerdown close・danger/disabled variant
- **barrel/tests**: index.ts に 7 export 追加。components.test.tsx に describe 追加（テスト 524→525、46 files 全緑）
- **検証**: `shared` build exit 0 / test 525 passed、`web` build exit 0。新部品に hex ハードコード 0（色は全て ink-*）。生成 CSS に新トークンの light+dark 生値が出力されることを実測
