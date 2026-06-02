---
Status: Active
Created: 2026-05-26
Branch: feat/autonomous-dev-routine
Owner-chat: chat-main
Parent: (none)
Previous: (none)
Goal: 0 (meta — Routine 機構自体の構築)
---

# Plan: Autonomous Development Routine (夜 22:00 / 朝 06:00 JST)

> Anthropic Cloud Routine を 2 本登録し、life-editor の開発作業を半自律で前進させる仕組みを構築する。
> ユーザーの責務は draft PR レビュー・方針調整・承認のみに圧縮する。
> 既存の `project_weekly_learning_routine` / `project_commute_mobile_dev_routine` と同じ Cloud Routine 機構を再利用する。

---

## Context

- **動機**: 開発時間の確保が物理的に難しい。Claude が深夜帯に plan を 1 件進め、朝に draft PR を 1〜2 本残しておけば、人間の作業は「読んで merge / コメント」だけで済む。逐次調整可能な目標体系を持たせ、Mobile 本番準備 → 健全性監査 → UI 改善の順に押し進める
- **制約**:
  - コスト $0 厳守は変わらず（Cloud Routine 自体は Anthropic 課金枠内）。実行は Opus 系 xhigh + 軽処理 Sonnet 4.6
  - main 直 push 禁止 / 破壊的 git 禁止（既存ルール継承）
  - §7.4 worktree 規約準拠（1 chat = 1 worktree = 1 branch）
  - `.mcp.json` の token 平文化禁止（commit 前必須チェック）
  - 並行チャットの作業中ファイルへの干渉禁止（自レーン SSOT 化）
- **Non-goals**:
  - life-editor アプリへの通知機能追加（不要）
  - 本番リリース実行そのもの（Goal 1 は「準備」までで止める）
  - リファクタの一括実施（Goal 2 は計画書化までで止める）

---

## Scope (Touchable Paths)

このプラン本体（Routine 機構の構築）が触ってよいパス:

```
.claude/automation/**                                # 新規ディレクトリ。Routine 用 SSOT
.claude/docs/vision/plans/2026-05-26-autonomous-dev-routine.md
.claude/settings.json                                # deny list 強化のみ
.claude/settings.local.json                          # 必要に応じて
.claude/memory/chat-main.md                          # task-tracker 経由
.claude/history/chat-main.md                         # task-tracker 経由
```

**Routine 自身が走る際**に触ってよいパスは Routine が選定する個別 plan の Scope 宣言に従う（Routine プロンプト内でこの規約を強制する）。

---

## Goal Roadmap (Routine の最終達成目標)

`.claude/automation/goals.md` を SSOT として保持し、各 Goal は ACTIVE / DONE / BLOCKED を持つ。

| #   | Goal                                            | 完了条件                                                                                      | BLOCKED 条件                                                             |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Mobile アプリ本番環境移行の **準備**            | Capacitor iOS/Android の本番 build 経路整備、署名・配布パス文書化、CI スクリプト雛形          | Apple Developer 登録 / 証明書 / キーチェーン等ユーザー介入必須項目に到達 |
| 2   | コード健全性監査 + リファクタリング計画書群作成 | `.claude/docs/vision/plans/` に重複・脆弱性・拡張性の各観点別計画書が揃う（実装本体は対象外） | 監査範囲確定後、計画書 PR が draft で揃った時点                          |
| 3   | Desktop / Mobile UI 課題発見 + 改善実装         | 各プラットフォーム別の課題 issue/plan 化 + 段階的 UI 改善 PR の積み上げ                       | 設計判断が割れた箇所はユーザー承認待ち                                   |

- Goal 1 で BLOCKED に到達したら、outbox に詳細レポートを残し、次回 Routine 起動時に自動で Goal 2 へ遷移
- Goal 2 完了後はユーザー承認を経て Goal 3 へ（個別リファクタ実装は Goal 2 とは別フェーズ扱い）
- Goal 状態は朝 Routine が更新、夜 Routine は読み取り専用で「現在 ACTIVE な Goal」のみを参照

---

## Components

### A. Anthropic Cloud Routine × 2 本

| Routine | 発火時刻       | 役割     | 主モデル      | 委譲先                                     |
| ------- | -------------- | -------- | ------------- | ------------------------------------------ |
| Night   | 22:00 JST 毎日 | Engineer | Opus 系 xhigh | lead-pipeline 重ティア（role-engineer 主） |
| Morning | 06:00 JST 毎日 | PM       | Opus 系 xhigh | role-pm + 軽処理は Sonnet 4.6              |

- 登録手段: `/schedule` skill 経由
- 取得した `trig_<id>` は `.claude/automation/routine-ids.md` に記録（後から `/schedule` で update 可能にするため）
- Morning は MVP では後追い登録（Night が安定運用に乗ったあと）

### B. Routine プロンプト（ファイル化）

Cloud Routine の起動プロンプトはインライン展開すると差分管理ができないため、ファイル化して `@.claude/automation/routine-{night,morning}.md` で参照する形にする。

- `.claude/automation/routine-night.md` — 夜 Engineer プロンプト
- `.claude/automation/routine-morning.md` — 朝 PM プロンプト
- `.claude/automation/goals.md` — Goal Roadmap SSOT
- `.claude/automation/routine-ids.md` — Cloud Routine trig_ID 台帳
- `.claude/automation/README.md` — 全体構造の入口

### C. Plan Picker ロジック（プロンプト内ルール）

夜 Routine 内で次の手順を踏む:

1. `.claude/automation/goals.md` を読み、現在 ACTIVE な Goal を 1 つ確定
2. `.claude/docs/vision/plans/` を走査し、当該 Goal に紐づく Status != COMPLETED の plan を列挙
3. **優先順位**: (a) Status: In-Progress > (b) Owner-chat: chat-auto-\* > (c) 日付の古い順
4. 該当 plan がない場合は **Plan を自分で起票**（テンプレート使用、Goal 直下に紐付け）→ 起票だけで終了し outbox 報告
5. plan が決まったら worktree を作成して着手

### D. Iteration Loop（夜 Routine の核）

```
START_TS = $(date +%s)               # 明示的に bash で時刻計測
iteration = 0
while iteration < 5:
    ELAPSED = $(date +%s) - START_TS
    if ELAPSED >= 5400: break        # 90 min cap

    iteration += 1
    engineer → session-verifier → role-qa
    if all Acceptance Criteria green:
        commit + draft PR (auto/<slug>) + outbox 成功報告
        break
    else:
        qa NG レポートを engineer に注入 → continue
else:
    WIP commit + draft PR (auto-wip/<slug>, label "wip,auto-incomplete") + outbox 未完了報告
```

- iteration / 時間制限到達は **失敗ではなく次回継続**として扱う
- Acceptance Criteria を満たすまで反復するが、暴走防止の cap は厳守
- 各 iteration の qa feedback は plan の Worklog 欄に追記
- **WIP PR と成功 PR は branch prefix で構造的に分離**（`auto/` vs `auto-wip/`）し、誤 merge を防ぐ
- **時間計測は Claude 任せにせず `date +%s` で bash 明示**（tool call 間で時刻を自動追跡できないため）

### E. 安全則（構造的防御）

`.claude/settings.json` の `permissions.deny` に **17 項目**を追加。Claude Code matcher は prefix-match のため `Bash(git push origin main*)` 単体では `git push -u origin main` や `git push origin HEAD:main` を取り逃がす。glob を多角的に並べて抜け道を塞ぐ。

```jsonc
"deny": [
  // main/master 直 push — 各種コマンド形を網羅
  "Bash(git push origin main*)",
  "Bash(git push origin master*)",
  "Bash(git push * main*)",            // -u origin main, origin main:main 等
  "Bash(git push * master*)",
  "Bash(git push * HEAD:main*)",
  "Bash(git push * HEAD:master*)",
  // force push — 位置不問
  "Bash(git push --force*)",
  "Bash(git push -f*)",
  "Bash(git push * --force*)",         // trailing position の --force
  "Bash(git push * -f *)",
  "Bash(git push --force-with-lease*)",
  // 破壊的 git
  "Bash(git reset --hard*)",
  "Bash(git branch -D*)",
  "Bash(git checkout main)",           // メイン worktree からの feature 切替防止
  "Bash(git checkout master)",
  // その他
  "Bash(rm -rf .git*)",
  "Bash(supabase db reset*)"
]
```

加えて `.claude/hooks/pre-commit-mcp-check.sh` を新設し、PreToolUse hook で `Bash` 呼び出しを横取り。`git commit` 系コマンドを検知したら `.mcp.json` 内のトークン平文化（`sbp_` / `sk-` / `ghp_` / `github_pat_` / `gho_` / `ghu_` / `ghs_` / `xoxb-` / `xoxp-` 等）を grep し、検出時 exit 1 で commit を構造的にブロック（Claude のプロンプト遵守任せにしない）。

```jsonc
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/pre-commit-mcp-check.sh"
        }
      ]
    }
  ]
}
```

### F. Worktree 自動運用

- Routine が作成する worktree は `auto-<YYYYMMDD>-<HHMM>-<slug>/` 命名（同日複数実行時の衝突回避のため HHMM 必須）
- `.claude/comm/.session-name` には `chat-auto-<YYYYMMDD>-<HHMM>` を書き込む
- `.claude/comm/.session-branch` には作業 branch 名を書き込む（成功 PR: `auto/<slug>` / WIP PR: `auto-wip/<slug>`）
- 完了後は worktree を残したまま draft PR で報告（cleanup は朝 Routine が merged PR の branch に対応する worktree を `git worktree remove`）
- **メイン worktree (`/Users/newlife/dev/apps/life-editor`) の `.session-name` への書き込みは絶対禁止**（ユーザーの chat-main を上書きしない）

### G. Outbox 規約

`.claude/comm/outbox/chat-auto-<YYYYMMDD>-<HHMM>/` に以下を追記:

- `night-report.md` — 実装結果 / iteration ログ / 成功 or 未完了理由
- `goal-transition.md` — Goal 遷移が発生した場合のみ
- `blockers.md` — 人手必須項目が発生した場合のみ

### H. 並行チャット干渉 active 検出（夜 Routine plan picker 内）

候補 plan が決まったら commit/着手前に 3 観点を検査し、ヒットしたら別 plan に再 pick:

1. **`.session-name` mtime**: 候補 worktree の `.claude/comm/.session-name` が過去 24h 以内更新 → 弾く
2. **draft PR 検査**: 候補 branch に直近 24h 更新の draft PR がある → 弾く
3. **Owner-chat**: plan frontmatter Owner-chat が `chat-main` で過去 12h 以内更新 → 弾く（ユーザー作業中の可能性）

3 回連続で弾かれたら起票だけ行い終了。

### I. Goal BLOCKED 例外フロー（夜 Routine 内）

朝 Routine が MVP では DEFERRED のため、夜 Routine 自身が Goal 遷移を行う例外を許可:

- 実装中に「ユーザー手動介入必須」を検知したら iteration loop を即中断
- `.claude/automation/goals.md` を編集（ACTIVE→BLOCKED、次の PENDING→ACTIVE、History 追記）
- **goals.md のみの単独 commit**（実装と混ぜず、`chore/goal-transition-<YYYYMMDD>` 別 branch + 別 PR）
- `outbox/.../blockers.md` に詳細レポート → セッション終了

---

## Steps

| #   | Step                                                 | Gate    | Acceptance                                                          |
| --- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| 1   | feature branch + worktree 作成                       | 🤖 自律 | `.claude/worktrees/autonomous-dev-routine/` に worktree が存在      |
| 2   | `.claude/automation/` ディレクトリ + 5 ファイル作成  | 🤖 自律 | README / goals / routine-night / routine-morning / routine-ids 揃う |
| 3   | `.claude/settings.json` deny list 追加               | 🤖 自律 | JSON valid + 期待 deny entries 存在                                 |
| 4   | 計画書本体（このファイル）の最終化                   | 🤖 自律 | Status: Active へ更新                                               |
| 5   | session-verifier 通過                                | 🤖 自律 | type check / lint / 構造 review 緑                                  |
| 6   | draft PR 作成                                        | 🤖 自律 | PR URL 取得                                                         |
| 7   | ユーザーが内容確認                                   | 👀 目視 | 計画書とプロンプト雛形に対する指示出し                              |
| 8   | `/schedule` で Night Routine 登録 → trig_ID 記録     | 🛑 人手 | Cloud Routine API に登録、`routine-ids.md` 更新                     |
| 9   | 翌朝の dry-run 結果確認 → Morning Routine 後追い登録 | 👀 目視 | Night の 1 回目成果を見て Morning プロンプト調整 → 登録             |
| 10  | MEMORY (per-chat) に Routine 運用メモを残す          | 🤖 自律 | `.claude/memory/chat-main.md` に追記                                |
| 11  | PR merge                                             | 🛑 人手 | main へ merge                                                       |

---

## Acceptance Criteria (機械検証可能)

- [ ] `.claude/automation/README.md` / `goals.md` / `routine-night.md` / `routine-morning.md` / `routine-ids.md` の 5 ファイルが存在（`ls .claude/automation/*.md | wc -l` >= 5）
- [ ] `.claude/settings.json` が JSON valid（`python3 -m json.tool .claude/settings.json > /dev/null` exit 0）
- [ ] `.claude/settings.json` に `permissions.deny` キーが存在し、**17 項目以上**を含む（main/master push variants × 6 + force variants × 5 + reset/branch/checkout × 4 + rm -rf .git + supabase db reset = 17）
- [ ] `.claude/hooks/pre-commit-mcp-check.sh` が executable で存在（`test -x .claude/hooks/pre-commit-mcp-check.sh`）
- [ ] `.claude/settings.json::hooks.PreToolUse` に MCP check hook が登録（`pre-commit-mcp-check.sh` を含む）
- [ ] hook 自己テスト pass: safe `.mcp.json` で exit 0、平文トークン入りで exit 1
- [ ] `cd frontend && npm run build` exit 0（影響範囲外だが既存壊さない確認。frontend 変更 0 の場合はスキップ可）
- [ ] PR diff が **±1500 行以内**（plan + automation スクリプト中心。計測: `gh pr view <#> --json additions,deletions --jq '.additions + .deletions'`）
- [ ] `git log -1 --format=%s` が `feat:` プレフィックス
- [ ] Cloud Routine `trig_<id>` が `.claude/automation/routine-ids.md` に少なくとも Night 1 本記録

---

## DB Migration Notes

該当なし。本プランは DB スキーマに触らない。

---

## Risks / Known Issues 参照

- **暴走リスク**: iteration cap (5 / 90min) と deny list + scope 宣言で 3 重防御
- **Cost overrun**: ~~Opus xhigh が高単価。Night 1 回 $1〜3 を想定上限、超過時は cap 短縮を検討~~ → **2026-05-31 訂正**: Anthropic Max plan 枠内で実行され、追加 API 課金は発生しない（$0 維持）。iteration cap はコスト制限ではなく暴走防止が目的。本項は無効
- **Plan picker の誤選択**: 当該 Goal に紐づかない plan を拾うリスク → plan frontmatter に `Goal: 1|2|3` を追記する規約を Goal 2 以降で導入検討
- **並行チャット干渉**: Routine が `chat-main` の作業中に発火する可能性 → Night 22:00 / Morning 06:00 の選択でユーザー稼働時間外を狙う
- 類似事例: `feedback_destructive_git_confirmation.md` / `feedback_mcp_json_token_placeholder.md` / `feedback_task_tracker_parallel_chat_override.md`

---

## References

- vision: `.claude/CLAUDE.md` §7.3 Plan Gate Convention / §7.4 Multi-chat Worktree Policy
- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`（Goal 1 の参照元）
- 既存 Routine: `project_weekly_learning_routine` / `project_commute_mobile_dev_routine`
- related skills: `schedule` / `lead-pipeline` / `execution-router` / `git-orchestrator`

---

## Worklog

- 2026-05-26: Draft 起票（chat-main、ユーザー要件確定後）
- 2026-05-26: role-qa 監査 NEEDS-REVISION（BLOCKING 1 / IMPORTANT 5 / MINOR 4）→ 全件反映
  - deny list を 11→17 項目に拡張（glob 抜け道修正、`git push * main*` 等の wildcard 追加）
  - `.claude/hooks/pre-commit-mcp-check.sh` 新設 + PreToolUse hook 登録（`.mcp.json` 平文化を構造防御。Claude プロンプト遵守任せにしない）
  - routine-night.md: WIP PR 構造的差別化 (`auto-wip/` prefix + `--label "wip,auto-incomplete"`) / 並行チャット active 検出 (Section H) / 時間 cap の bash 明示計測 (`date +%s`) / BLOCKED 検知時 goals.md 単独 commit 例外 (Step 3.5 / Section I)
  - goals.md Goal 1 完了境界に「workflow 構文 valid + secrets 不要 dry-run pass」を明記
  - worktree / chat-name 命名に `<HHMM>` 追加（同日複数実行衝突回避）
  - メイン worktree の `.session-name` への書き込み禁止を明示
  - AC に hook 関連 + 計測コマンド追加
