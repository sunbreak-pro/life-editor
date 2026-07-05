# HISTORY (chat-design-settings-v2)

### 2026-07-05 - Settings brief v2 改訂（IA + Lumen accent 同期）

#### 概要

ClaudeDesign fan-out 計画（`2026-07-04-claudedesign-screen-design-fanout.md`）の work-order `design-settings-v2`（旧 D6'）として、v1 で salvage 済みの settings brief を v2 へ改訂。専有 worktree `.claude/worktrees/design-settings-v2` / branch `claude/design-settings-v2` で単独実行（1 chat = 1 worktree = 1 branch）。

#### 変更点

- **共通前提ブロック v2 差し替え**: §4.1 Desktop / §4.2 Mobile の両プロンプト冒頭に埋め込まれていた v1 共通前提を `_COMMON-CONTEXT.md` の v2（見出し「v2 / 2026-07-05」）へ全文差し替え。両ブロックが byte 一致だったため行範囲コピーで空白まで verbatim に一致させて更新
- **旧 accent hex 一掃**: `#1f4fff`→`#1d4ed8` / `#5b82ff`→`#5b8cff` / `#1a42d9`→`#1e40af` / `#7596ff`→`#7aa2ff` / `#e1e6fb`→`#dbeafe`、task チップ bg `#e3e7ff`→`#dbeafe` / fg `#2330b0`→`#1e40af`。ファイル全体で旧 hex 0 件を機械チェックで確認
- **シェル前提を目標 IA へ**: v1 の「10 フラットセクション」記述を排し、サイドバー本流 5（Schedule / Materials / Connect / Work / Analytics）+ 最下部ユーティリティ枠（Settings / Trash）+ Mobile 固定 4 タブ + More に更新。Settings は「ユーティリティ枠・タブなし縦一列」と Desktop 画面固有部にも明記
- **§6 注記更新 + Status 昇格**: §6 の「accent hex 古い（要 resync）」注記を「対応済み（v2）」へ、frontmatter を Status: Ready / Owner-chat: design-settings-v2 / Branch: claude/design-settings-v2 に更新

#### 検証

- v2 マーカー "v2 / 2026-07-05" 3 件・旧 accent hex 0 件・code fence 内リポジトリパス 0・フェンス開閉釣り合い（text-fence 2 / 全 4）を機械チェックで確認
- diff は `briefs/settings.md` 1 ファイル（+ 本 chat の tracker）に限定・コード変更 0
