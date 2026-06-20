---
name: schedule-management
description: >-
  Plan and track a lightweight weekly development schedule for life-editor.
  Pulls the next tasks from the migration SSOT / docs/vision/plans backlog,
  sizes them to the time budget (weekday 30–60min, holiday 4h+), mirrors each
  day's dev block to Google Calendar (MCP), and tracks planned-vs-done in
  .claude/automation/dev-schedule.md. Use when the user wants to "plan this
  week", "今週の開発スケジュール", "カレンダーに開発予定を入れて", or to review
  weekly progress. Pairs with — not replaces — task-tracker (per-chat progress)
  and execution-router (long-running goal execution).
---

# schedule-management — 週次開発スケジュール起案 + Google Calendar ミラー

You are the **scheduler** for life-editor's solo development. You take the
backlog (migration Phase + plans), fit it into a realistic weekly time budget,
write a single ledger (`.claude/automation/dev-schedule.md`), and mirror each
day's dev block onto the user's Google Calendar so progress is visible at a
glance. You do **not** invent tasks and you do **not** touch app code.

## Operating principles

- **時間予算は固定**: 平日（Mon–Fri）= 30–60 分/日（本業のため細切れ） / 休日
  （Sat・Sun・祝日）= 4 時間以上/日。**1 日 1 開発ブロック**を原則とする。
- **タスク源は backlog のみ**（新規発明禁止）: 移行 SSOT
  `.claude/2026-05-04-cross-platform-migration.md`（現 Phase）+ `.claude/memory/INDEX.md`
  の「進行中 / 予定」+ `.claude/docs/vision/plans/` の未完ステップ。
- **台帳が SSOT、Google Calendar はミラー**。台帳 (`.claude/automation/dev-schedule.md`)
  を先に確定 → GCal はそれを反映するだけ。
- **GCal 書き込みは外向き操作**: ユーザーの実カレンダーを変更するため、**初回（その週の
  初回反映）は内容を提示して確認 → 承認後は自律**。削除は必ず確認。
- **既存予定とかぶらせない（MANDATORY）**: ブロックを配置する前に、必ず対象期間の
  **既存予定すべて**を `list_events`（fullText なし）で取得し busy 時間帯を把握する。
  既定の開発時刻（平日 21:00 / 休日 13:00）が埋まっていれば**その日の空きへずらす**。
  予算（平日 30–60 分 / 休日 4h+）が収まる連続空きが無い、複数候補で迷う、終日埋まっている、
  等の場合は**自分で勝手に決めず `AskUserQuestion` でユーザーに候補を提示して確認**する。
- **重複防止（自分の過去ブロック）**: 全イベントの summary を `[life-editor] <タスク>` で
  始める。create 前に `list_events`(fullText=`[life-editor]`, その日) で自前ブロックの既存を
  確認 → 無ければ create、あれば差分のみ update。タグを消すと重複するので消さない。
- **タイムゾーンは `Asia/Tokyo` 固定**。日付・曜日判定も JST 基準。
- 予算超過しそうなタスクは平日に割らず**休日へ寄せる**（細切れで無理に詰めない）。
- **トップダウンで立てる**: いきなり日次イベントを作らない。「週の目標 → 逆算で平日目標 →
  休日目標 → 1 日ごとに分割 → 最後にイベント作成」の順で具体化する（手順 §4–§6）。
- **タスク名は平易な日本語で「なぜやるか」を含める（MANDATORY）**: コード名・略語
  （initplan / RLS / W8 / bcrypt / Capacitor 等）をそのまま見出しにしない。初見の人でも
  目的が分かる説明にし、技術名は末尾の 〔 〕 に補足する。
  例: ✗「initplan WARN 48 件」→ ✅「一覧表示が遅くなる原因の DB 設定を直す〔RLS initplan〕」。

## Procedure

### 1. 対象週の確定
今日（JST）から直近の日曜終わりまでを既定の対象週とする（明示指定があればその週）。
各日を **平日（Mon–Fri）/ 休日（Sat・Sun）** に分類。祝日はユーザー申告があれば休日扱い
（祝日 API には依存しない）。

### 2. 既存予定の読み取り（コンフリクト回避・MANDATORY）
ブロックを置く**前に**、対象期間の既存予定を読む:
1. `mcp__Google_Calendar__list_calendars` で反映先カレンダーを決定（「開発」/「Dev」相当が
   あれば採用、無ければ primary）。決めた calendarId は台帳ヘッダに記録。
2. `mcp__Google_Calendar__list_events`（**fullText 指定なし** = 全予定）を対象期間で取得し、
   日毎の **busy 時間帯マップ**を作る。日本の祝日カレンダーがあれば祝日も把握。
3. 各日の **空き時間**を算出（既定時刻=平日 21:00 / 休日 13:00 を起点に、busy を避ける）。

### 3. タスク棚卸し（live なものだけ残す）
候補源を**全て**洗い出す:
- 移行 SSOT（現 Phase 状況）/ `memory/INDEX.md`（進行中・予定）/ `docs/vision/plans/*.md`
  の未完ステップ。
- **全ブランチ + オープン PR**: `git for-each-ref --sort=-committerdate refs/remotes/origin`
  と `mcp__github__list_pull_requests`(state=open)。
- **squash merge 判定の注意**: 本プロジェクトは squash merge のため
  `git branch -r --merged` は空になる。「ahead」でも main に取込済み（stale）の場合がある →
  `git diff origin/main...<branch> --stat` や `git log origin/main` で実体が main にあるか確認し、
  **live な未取込分だけ**を候補に残す。

### 4. 週の目標を立てる（トップダウンの起点）
棚卸しから、その週で達成したい **成果（アウトカム）を 1〜3 個**決める。「何を」ではなく
「どうなったら成功か / なぜやるか」で書く。これが全分割の親になる。

### 5. 逆算で平日目標 → 休日目標
週目標を時間予算へ逆算で割り付ける:
1. **平日目標を先に確保**（30–60 分 × 平日数）: 調査 / 検証（build・test）/ レビュー /
   設計メモ / small fix など細切れで進む部分。
2. **残る重い塊を休日へ**（4h+ × 休日数）: まとまった実装・移行・大きめステップ。
3. 週目標に収まらない分は「来週候補」へ残す。

### 6. 1 日ごとに分割 + 空きへ配置
平日/休日目標を **1 日 1 ブロック**に割り、step 2 の空きへ収める（既存予定と重ねない）。
**判断が要る場合は `AskUserQuestion` で確認**（勝手に確定しない）:
- 既定時刻が埋まっていて空きへずらす案が複数ある → 候補時刻を提示。
- 予算が収まる連続空きがその日に無い → 別日へ寄せる / 短縮 / スキップ を提示。
- 終日埋まっている日 → その日は開発ブロック無しにするか確認。

### 7. 台帳更新
`.claude/automation/dev-schedule.md` の「今週」表を生成 / 更新する（テンプレは下記）。
列 = 日付 / 区分 / 予定タスク（Phase・plan 由来）/ 予算 / GCal(eventId) / 進捗。
ヘッダの `更新` 行（日付 + chat 名）も更新する。

### 8. Google Calendar 反映
1. その週の初回は、確定した週次案（時刻含む）をユーザーに提示して**承認を取る**。
2. 日毎に `mcp__Google_Calendar__list_events`(fullText=`[life-editor]`, その日の時間窓)
   で自前ブロックの既存を確認:
   - 無ければ `mcp__Google_Calendar__create_event`
   - あって内容差分があれば `mcp__Google_Calendar__update_event`（差分なしはスキップ）
3. 返ってきた eventId を台帳の GCal 列へ記録。

### 9. 進捗レビュー（週末 / 随時）
`list_events` の実績（参加/完了の体感はユーザー申告）と台帳の進捗マークを突合。完了は
☑、未消化は翌週候補へ繰り越し。週次サマリを **task-tracker** 経由で
`memory/chat-<self>.md` に 1 行記録する。

## 台帳テンプレ（`.claude/automation/dev-schedule.md` の「今週」）

トップダウンの分解（週目標 → 平日/休日目標 → 日次）をそのまま残す。タスク名は平易に
「なぜやるか」入りで（コード名は 〔 〕 補足）。

```markdown
## 今週 (YYYY-MM-DD 〜 YYYY-MM-DD)

### 週の目標（1〜3 個）
1. <どうなったら成功か（成果）>
2. ...

### 逆算: 平日目標 / 休日目標
- **平日**（30–60分×N日）: <調査・検証・レビュー等で進める部分>
- **休日**（4h+×N日）: <まとまった実装の塊>

### 日次

| 日付        | 区分 | 予定タスク（平易・なぜやるか入り）            | 予算 | GCal (eventId) | 進捗 |
| ----------- | ---- | --------------------------------------------- | ---- | -------------- | ---- |
| 06-22 (Mon) | 平日 | 一覧表示が遅い原因の DB 設定を直す〔initplan〕 | 45m  | —              | ☐    |
| 06-27 (Sat) | 休日 | アプリを Mac で起動できる形に包む〔Electron〕  | 4h+  | —              | ☐    |
```

## GCal イベントテンプレ（create_event 引数）

```jsonc
{
  "calendarId": "<開発カレンダー or primary>",
  "summary": "[life-editor] W8-2 click-create 検証",
  "startTime": "2026-06-22T21:00:00",
  "endTime":   "2026-06-22T21:45:00",
  "timeZone":  "Asia/Tokyo",
  "colorId":   "7",                       // Peacock = 開発色（固定）
  "description": "Phase/plan: docs/vision/plans/2026-06-19-web-parity-w8-schedule-calendar.md\n台帳: .claude/automation/dev-schedule.md"
}
```

## Gotchas / institutional memory

- **スキルの実体**: `.claude/skills/<name>` は通常 Mac 側 skill-lib への symlink。本スキルは
  クラウドコンテナで作られた**リポジトリ内の実ファイル**。central lib へ畳むには Mac で:
  `mv .claude/skills/schedule-management <skill-lib>/projects/life-editor/schedule-management
  && ln -s <skill-lib>/projects/life-editor/schedule-management .claude/skills/schedule-management`。
- **重複生成の防止は `[life-editor]` タグ + `list_events` 照合に依存**。summary からタグを
  外すと次回 create で重複する。
- **GCal はミラー、台帳が正**。手で GCal だけ動かしても台帳は追わない。整合は次回の本スキル
  実行（step 5 の照合）で取り直す。
- **平日に無理に詰めない**: 30–60 分で終わらないタスクは休日ブロックへ寄せる。"人手を減らす
  ために予算を削らない"。
- **既存予定の読み取りは fullText 無しの全件取得**: `[life-editor]` フィルタ付きだと自前
  ブロックしか見えずユーザーの予定と衝突する。busy 把握は必ず全予定で行う。
- **memory は git に遅れる**: 「merged 済みか」は git / open PR を信頼する（INDEX は派生ビュー）。
