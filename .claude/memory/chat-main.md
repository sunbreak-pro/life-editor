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

- 前回（2026-11-16）: open の Issue 85 件を仕分け、65 件にマイルストーン「完成 2026-12-30」を付けた。範囲と 6 週の予定は計画書 `docs/vision/plans/2026-11-16-completion-scope-and-schedule.md`（PR #2763 と #2764 は 2026-11-16 に merge 済み）
- 現在（2026-11-19 夜）: 計画書の手順 2 の 6 件をすべて merge した。#2754 = PR #2779、#2752 = PR #2780、#2753 = PR #2785、#2759 = PR #2786、#2757 = PR #2787、#2760 = PR #2789。merge のあとの実ブラウザでの確認はすべて PASS。#2754 #2759 #2757 を閉じた。#2752 #2753 #2760 は人の作業待ちで open。main f76fdb95 を公開 Web に手元から配布した（Cloudflare の版 301bd5ed）。手順 1 の #2717 #2720 #2758 も人の作業待ちで open
- 次: こうだいさんの作業を待つ（#2752 = Dashboard でサインアップを止め、サインインと再設定のメールを試す。#2753 = Edge Function `delete-account` を消す。#2760 = スマホのブラウザでサインインが保たれるかを見る）。済んだら閉じる。片付けの Issue #2781 #2782 #2788 #2790 と #2777 を回す。claude-dotfiles の PR #136 は GitHub で merge してもらう。#2762 の前に、送信待ちの箱が空かをこうだいさんに確かめてもらう

### ⏸️ merge 済みで open のままの Issue を確かめて閉じる（Issue #2361）（着手日: 2026-10-28）

**対象**: GitHub Issues（2026-11-16 の実測で 69 件。Issue #2361 が挙げる 22 件を含む）

- 前回: —
- 現在（2026-11-16）: こうだいさんが着地済みの Issue の close を認めたので、50 件を閉じた。目視が済んでいない 43 件と、残りがある 20 件の一覧は、Issue #2361 の 2026-11-16 のコメントにある
- 次: 43 件の目視は、計画書の手順 6（12/21〜12/30）でまとめて行う。Work 画面と実績時間の分（#2553 #2428）は、機能ごと消えるので見ない

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
- 期日までにやる 65 件は、計画書 `docs/vision/plans/2026-11-16-completion-scope-and-schedule.md` の週ごとの予定で進める
- `plans/` に残る古い計画書の Status を今の実態に合わせる。Issue #2714 の仕分けと一緒にやる
- Issue #2360: db-migration スキルに「db push が先、merge が後」と書く
