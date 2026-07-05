# HISTORY (chat-design-auth)

### 2026-07-05 - design brief — auth (D8)

#### 概要

ClaudeDesign fan-out（計画 `2026-07-04-claudedesign-screen-design-fanout.md`）の作業オーダー design-auth を実行し、ログイン / サインアップ画面（シェル外・未ログイン時の入口）の design brief を新規作成した。

#### 変更点

- **新規 brief**: `.claude/docs/design/briefs/auth.md` を `_TEMPLATE.md` 準拠（§1〜§6）で作成
- **共通前提 v2**: `_COMMON-CONTEXT.md` の v2（Lumen accent `#1d4ed8` / dark `#5b8cff`・サイドバー 6+2 IA）を Desktop / Mobile 両プロンプト冒頭に verbatim 埋め込み
- **画面設計**: シェル外の中央寄せカード。Desktop 1440×900 / Mobile 390×844・light / dark。signIn ⇔ signUp セグメントトグル・パスワード表示切替・エラー / busy 状態を網羅。Desktop / Mobile は構造分岐なしのレスポンシブ単一である旨を明記（オーダーの押さえどころに準拠）
- **機械チェック**: v2 見出しあり / 旧 accent hex 0 件 / §4 code fence 内リポジトリパス 0 件 を確認。§1-2 の `file:line` 引用は `web/src/AuthScreen.tsx`・`tier-1-core.md` の実在行と一致
