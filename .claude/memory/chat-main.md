# MEMORY (chat-main)

## 進行中

### 🔧 共通のハーネスの取り込み（Issue #2715）（着手日: 2026-11-15）

**対象**: `.claude/skills/`・`.claude/agents/`・`.claude/rules/`・`.claude/settings.json`・`.claude/CLAUDE.md`・`.claude/issue-workflow.md`
**計画書**: `.claude/archive/2026-11-15-align-with-shared-rules.md`（archive 済み）

- 前回: 2026-11-15 に、merge・worktree・Issue の道具と hook を claude-dotfiles の共通のものへ切り替えた（PR #2721〜#2742）。計画書は archive へ移した
- 現在（2026-11-16）: ハーネスを点検し、直しを PR 3 本にした。PR #2743（並列で作る PR の本文に「確かめたこと / 確かめていないこと」と「読む順」を足す）・PR #2744（定時の実行が空のフォルダで止まるのを直す）・claude-dotfiles の PR #119（main の checkout で名前の古さの警告を出さない）。報告書 = `docs/reports/2026-11-15-harness-check-and-issue-prompts.html`
- 次: 3 本を merge する（PR #119 は merge のあと `node install.mjs`、PR #2744 は merge のあと main で `git pull`）。次の 12:13 の定時の実行が `automation/logs/runs.log` に `exit=0` を書くかを見る。Issue #2715 の「中身が届いたときに確かめること」を今の main と照らし、close をこうだいさんに聞く

### 🔧 2026-12-30 に完成させる範囲と予定を決める（Issue #2714・最優先）（着手日: 2026-11-12）

**対象**: `.claude/docs/requirements/`・`.claude/docs/vision/plans/`・GitHub Issues（#2714 #2716 #2717 #2718 #2719 #2720）

- 前回: —
- 現在: 親の Issue #2714 と、要らない機能の候補を洗い出す Issue #2716、削除がほぼ決まった 4 件（Work 画面 #2717・Todo の実働時間 #2718・コマンドパレット #2719・拡張アプリとの接続 #2720）が open。open の Issue は 124 件、open の PR は 0 本だった（2026-11-15 実測）
- 次: Issue #2716 の手順 1（セクションごとに機能を書き出し、「残す / 削除の候補 / 迷う」に分ける）を進めて、こうだいさんに見せる。そのあと open の Issue を「期日までにやる / あとに回す / 閉じる」に分け、計画書にする。範囲が決まるまで、新しい機能の実装の回は回さない

### ⏸️ merge 済みで open のままの Issue を確かめて閉じる（Issue #2361）（着手日: 2026-10-28）

**対象**: GitHub Issues（2026-11-16 の実測で 69 件。Issue #2361 が挙げる 22 件を含む）

- 前回: —
- 現在（2026-11-16）: 69 件を、変更したファイルから振り分けた。画面に見える変更が 57 件、画面のファイルを触っていないものが 9 件、データベースの変更を含むものが 3 件。閉じ方は「振り分けてから閉じる」に決まった（2026-11-16 こうだいさん）。一覧は報告書にある
- 次: 画面のファイルを触っていない 9 件を 1 件ずつ読み、close の候補をこうだいさんに出す（#2542 と #2428 はテストだけの PR で、画面の確認が残る）。画面に見える 57 件は、削除が決まりかけている機能（Work 画面・コマンドパレット・拡張アプリ）の分を外してから、新しい順に 10 件ずつ実ブラウザで確かめる

## 直近の完了

- [chat-main] **ハーネスの点検と進捗メモの棚卸し** ✅（2026-11-16）— 13 の見出しを実測して履歴へ移し、進行中を 3 件に絞った。定時の実行が 2026-11-02 から止まっていた原因を突き止めた。詳細 = history 2026-11-16
- [chat-main] **共通の道具への切り替えと、CLAUDE.md・ルール・スキルの語の言い換え** ✅（2026-11-15）— PR #2721〜#2742。計画書 = `archive/2026-11-15-align-with-shared-rules.md`
- [chat-main] **worktree の片付け・並列 PR の重なり検査（#2492）・PR 46 本の merge・main の CI 修理** ✅（2026-11-03）— 詳細 = history 2026-11-03

## 予定

### こうだいさんの作業（Claude Code は実行できない）

- **Windows 実機で、実アカウントのログインと Todo の追加・編集・削除を確かめる。** Desktop 配布の計画書（`plans/2026-08-30-desktop-app-packaging.md`）に残る最後の 1 項目。済んだら Claude Code が計画書を閉じて archive へ移す
- **Release の下書き `desktop-v0.1.0` を消すか決める。** v0.2.1 が公開済みで、下書きだけが残っている
- **iPhone の実機で 3 点を見る。** URL バーの出入りで本文がボトムタブバーに潜らないか、Schedule の編集シートの上端が隠れないか、背の高いシートでカーソルがキーボードの裏に回らないか
- **検証用の MCP を使うなら、検証アカウントの値を環境変数に入れ、`.mcp.json` に `life-editor-verify` を足す。** 今は無く、検証用の 3 つの道具は動かない。要らなければこの行を消す
- **ローカルブランチ 349 本を片付ける。** `git branch -D` は Claude Code に禁止されている。消してよい一覧は `finished-work` スキルで Claude Code が出す
- **`workspaces/life-editor/` の直下に残る作業ログ約 130 個（2026-11-02〜08 の `ci-*.log` など）を消すか決める**

### Claude Code の作業

- Issue #2664: GitHub Actions を止め、Web の配布を手元から打てるスクリプトに移す。PR #2667 は merge 済みで、残りは確認と close
- 削除の 4 件（Issue #2717 #2718 #2719 #2720）は、Issue #2714 で範囲が決まってから着手する。拡張アプリの残り（Issue #2163 #2167 #2168）は、#2720 が決まったら閉じる
- `plans/` に残る古い計画書の Status を今の実態に合わせる。Issue #2714 の仕分けと一緒にやる
- Issue #2360: db-migration スキルに「db push が先、merge が後」と書く
