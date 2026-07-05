# HISTORY (chat-design-work-v2)

### 2026-07-05 - work brief v2 改訂（design-work-v2 / D4'）

#### 概要

ClaudeDesign fan-out 計画（2026-07-04-claudedesign-screen-design-fanout.md）の作業オーダー design-work-v2 を実行。`.claude/docs/design/briefs/work.md` を v1 → v2 化し、Lumen accent + 目標 IA に準拠させた。差分は work.md 1 ファイルのみ（コード変更 0）。

#### 変更点

- **共通前提 v2 化**: §4 Desktop / Mobile 両プロンプト冒頭の共通前提ブロックを `_COMMON-CONTEXT.md` v2（見出し `v2 / 2026-07-05`）へ全文差し替え
- **accent hex 一掃**: 旧 accent 系（`#1f4fff` / `#1a42d9` / `#e1e6fb` / `#5b82ff` / `#7596ff` / task チップ `#e3e7ff` `#2330b0`）を Lumen blue 系（`#1d4ed8` / `#1e40af` / `#dbeafe` / `#5b8cff` / `#7aa2ff`）へ置換。呼称も「電撃コバルト」→「Lumen blue」に統一
- **シェル記述を目標 IA へ**: 旧 10 フラットセクション列挙を、サイドバー本流 5（Schedule / Materials / Connect / Work / Analytics）+ ユーティリティ枠（Settings / Trash）+ Mobile 固定 4 タブ + More へ差し替え。Work はタブなし単画面として明記
- **メタ更新**: §6 の resync 注記を「v2 同期済み」へ、Status を Draft → Ready、frontmatter の Owner-chat / Branch を design-work-v2 / claude/design-work-v2 へ更新
- **機械チェック**: v2 マーカー 3 件（≥1）/ 旧 hex 0 件（OK）/ §4 コードフェンス内にリポジトリパス・内部参照なし
