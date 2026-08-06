---
Status: IN PROGRESS — Phase 0 配置完了（PR #451 merge）・Phase 1 着手（2026-08-04 ユーザー裁定・インフラ配置済み）・Phase 2 の文書整備（goals.md 改訂 + routine-night.md 薄殻化）を 2026-08-06 に実施。発火有効化（D-20260804-main-1）・Step 5（MCP 疎通 → 朝刊ミラー）・Phase 3 が未消化
Created: 2026-07-28
Branch: main # 本書は設計書。commit する場合は一時 worktree 経由（main 直 push 禁止）
Owner-chat: main
---

# Plan: Loop Engineering ハーネス — 判断の非同期化から夜間自走までの道筋

> **これは何か**: chat-main + 複数 worktree の現行運用を、こうだいさんの認知負荷を下げながら段階的に自律型へ近づけるロードマップ + Phase 0 の実装仕様。
> **作成の経緯**: 2026-07-28 に claude-dotfiles セッションで、現状の実測（memory/INDEX・automation/・comm/）と外部調査（Claude Code 公式ドキュメント + 実践者事例）をもとに作成。**本書は設計の正本であり、実装は life-editor 側チャットが本書に従って行う**（Phase 0 の新規ファイルは §5 に全文を埋め込み済み — コピーして配置すれば動く）。

---

## 1. Context

### 動機（現状の詰まり 3 点・実測ベース）

1. **判断がすべて同期処理**: merge・仕様判断・実機目視がユーザーの手番でしか消化されず、memory/INDEX には 6 月分の実機目視項目まで積み残っている。ラインは回るが検品と出荷承認が全部ハンコ待ちの状態
2. **ユーザーが人間ルーターを兼務**: boot 行の貼り付け・outbox の運搬・起票依頼の一括消化（2026-07-25 に 22 件）がユーザー経由。休日の認知負荷はほぼここに集中
3. **疲労時の判断劣化**: 判断が「20+ 件の予定リストから選ぶ」形で来るため、疲れていると方向を誤る。選択肢化・優先度付け・件数キャップがされていない

### 既存資産（作り直さない — 接いで使う）

| 資産                                                              | 状態                                                                                | 本計画での扱い                                            |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `automation/`（夜 22 時 Engineer + 朝 6 時 PM ルーチン設計）      | **未稼働**（routine-ids.md が PENDING のまま。Mac 時代の Cloud Routine 前提で停止） | Phase 1-2 で現行機能（scheduled tasks）向けに改訂して復活 |
| `scripts/loop-engine/`（PR #106・check.sh + loop.sh）             | 実ループ本走が保留                                                                  | Phase 2 の検証ゲートとして再利用候補                      |
| `comm/`（outbox 単一書込者プロトコル）                            | 稼働中                                                                              | Phase 0 の decisions/ は同じ設計原則で増設                |
| `2026-07-28-post-merge-playwright-verification.md`                | COMPLETED（2026-07-29 全項目消化 → `archive/`）                                     | Phase 3 の実行主体の雛形。次の fan-out で同型を作り直す   |
| briefing（朝刊/夕刊）+ headless claude プロトタイプ（2026-07-16） | 稼働中 / 検証済み                                                                   | digest の届け先（朝刊「開発」セクション）                 |

### 制約

- 平日 30–60 分/日・休日 4h+/日（`automation/dev-schedule.md` の時間予算。恒久前提）
- **merge と main への取り込みは常にこうだいさん**（本計画のどの Phase でも解除しない）
- playwright MCP + dev server は main のみ（CLAUDE.md §7.4・2026-07-11 ユーザー決定）
- life-editor MCP（Supabase 版）は**疎通未検証**（chat-main 予定に既存タスクあり）。朝刊ミラーはこれが前提
- $0 運用（サブスク枠内。API 直課金なし）

### Non-goals

- 夜間の実装自走は Phase 2 まで封印（今回は設計のみ）
- Mac 時代の Cloud Routine（/schedule・trig_ 台帳）の復活はしない — 現行の Claude Code scheduled tasks / cron 系で置き換える
- Agent Teams 等の未成熟機能への依存はしない

---

## 2. 道筋の全体像（4 Phase）

```
Phase 0  判断の非同期化          ← 今ここ。リスクゼロ・効果最速
  │  判断キュー（decisions/）+ 事前決裁（POLICY）+ 采配ダイジェスト（dev-digest）
  │  昇格条件: キューが 2 週間回り、digest の判断提示が的外れでない
  ▼
Phase 1  夜間の安全レーン自走
  │  毎朝 06:00 digest 自動生成 + 夜間の読み取り中心レーン
  │  （docs 整合 sweep / Issue 台帳整合 / PR conflict 検知 / 検証準備）
  │  昇格条件: 2 週間安定・誤動作ゼロ・digest の報告で内容が追える
  ▼
Phase 2  実装レーンの自走
  │  routine-night.md 改訂版で Issue 1 件/夜 → worktree 実装 → commit 止まり（PR は作らない）
  │  昇格条件: goals.md が「今夜どれを選ぶか」の選定基準へ改訂済みであること
  ▼
Phase 3  検証の自動化
     merge 後 playwright 検証（既存 Draft 計画）を定期実行化 → 実機目視バックログの構造的解消
```

段階を踏む理由: 外部調査（§3）の失敗事例はほぼ全て「一気に自走させた」ケースに集中している。判断の渋滞解消（Phase 0）だけで平日の回転は大きく改善し、自走はその上に乗せる。

---

## 3. 外部調査から採るガードレール（実装時に必ず反映）

公式ドキュメントと実践者の失敗談から、この環境に効くものだけを抽出。

1. **反復上限は必ず明示し、独立に計測する** — Anthropic 公式の ralph-wiggum プラグインですら `--max-iterations=N` 構文がサイレントに無視され 494 回暴走したバグ実例がある（gh issue #18646・未修正）。cap は「設定した上で、routine-night.md 既存設計のように bash で経過時間・回数を明示計測」が正
2. **スコープ制約はプロンプト冒頭に明記** — 制約を書かず 4 時間放置した実例で、エージェントがランタイムを独断アップグレードし main へ直コミット（復旧に 3 時間）。routine-night.md の「Scope 宣言 + scope drift 警告」設計を維持
3. **ログ・長出力は会話に流さずファイルへ** — context 枯渇 → 圧縮の繰り返しで CLAUDE.md ルールが要約劣化し、途中からルール無視が始まる（実践報告）。`> log 2>&1` でファイルに逃がす
4. **長時間は 30–60 分の独立セッションに分割** — 12 時間 1 セッションは context 品質が保てない。夜間ランも「1 夜 = 1 plan = 1 セッション」を維持
5. **承認キューの最大の落とし穴は「信頼が生まれて監視が緩んだ頃」**（実践者自身の証言）— だから merge と不可逆操作は自動化の成功が続いても恒久的に人間ゲート（POLICY P-001 / P-007）
6. **無人セッションでは AskUserQuestion が使えない** — 質問経路は decision キューのみ。「質問できないから独断で進む」を構造的に防ぐのが Phase 0 の核
7. **公式の推奨方向**: 条件達成ループは `/goal`（v2.1.139+・Haiku がターンごとに条件判定）、定期実行は scheduled tasks（/loop 系は **7 日で expire** するため台帳管理が必須 — routine-ids.md の台帳運用を流用）、無人時の権限は auto mode + `permissions.ask` の二層（押してよいもの / 必ず訊くもの）

---

## 4. Phase 0 の設計 — 判断の非同期化

### 4.1 何を作るか

```
.claude/comm/decisions/
├── README.md          # プロトコル定義（§5.1）
├── POLICY.md          # 事前決裁 = 「聞かなくていいこと」の恒久裁定集（§5.2）
├── ANSWERS.md         # 回答簿（こうだいさん専用の書込ファイル）
└── chat-<name>.md     # 各チャットの判断依頼（outbox と同じ単一書込者原則）

.claude/rules/decision-queue.md      # 全チャット向けの行動規定（§5.3）
.claude/skills/dev-digest/SKILL.md   # 采配ダイジェスト生成スキル（§5.4）
.gitignore                           # `.claude/comm/digest/` を追記（生成物は非追跡）
```

### 4.2 回転のしかた

```
[各 worktree チャット]                      [こうだいさん]
  判断点に当たる                              隙間時間 or 朝刊で
  → POLICY を確認（該当あれば聞かず従う）      要判断（最大 5 件・A/B 選択肢化済み）を見る
  → 無ければ decisions/chat-<self>.md に       → ANSWERS.md に「D-xxx: A」と 1 行
    エントリを書き、次の作業単位へ進む            （または朝刊に返信 → chat-main が転記）
  → セッション開始時に ANSWERS.md を確認
    → 回答があれば消化して着手

[dev-digest（当面は chat-main で手動起動・Phase 1 で毎朝 06:00 自動化）]
  open PR / 未回答キュー / レーン手番 / boot 行を 1 枚に集約
  → .claude/comm/digest/YYYY-MM-DD.md（正本）
  → 朝刊 Daily の「開発」セクションへミラー（MCP 疎通後）
```

### 4.3 朝刊統合の前提と degrade

- 届け先はこうだいさん指定で **life-editor の朝刊**（2026-07-28 決定）
- ただし life-editor MCP（Supabase 版）は疎通未検証。**疎通確認（chat-main 予定の既存タスク）が完了するまで digest はファイルのみで機能する**（設計上 MCP は任意ミラー・ファイルが正本 — 失敗してもエラーにしない）
- ミラー方式: `get_memo`（今日）→ 既存内容と結合 → `upsert_memo`（上書き禁止・追記統合）。「## 開発」セクションとして差し込む。briefing の朝刊/夕刊セクション規約（`extractBriefing`）を壊さないことを実装時に確認

---

## 5. Phase 0 実装仕様（新規ファイル全文）

> 実装チャットへ: 以下 4 ブロックをそのまま該当パスに配置し、.gitignore に 1 行足せば Phase 0 は完成。数値・パスは配置時に実態と突き合わせること。

### 5.1 `.claude/comm/decisions/README.md`

```markdown
# Decision Queue — 判断の非同期キュー

ユーザー判断が要る点で作業を止めないための書き溜め場。outbox（連絡）と分離した「判断専用レーン」。

## ファイルと書込権限（単一書込者原則 — comm/README.md と同じ）

| ファイル         | 書く人                                                                 | 読む人 |
| ---------------- | ---------------------------------------------------------------------- | ------ |
| `chat-<name>.md` | そのチャットのみ                                                       | 全員   |
| `ANSWERS.md`     | こうだいさん（または転記を任された chat-main / digest セッション）のみ | 全員   |
| `POLICY.md`      | こうだいさん承認の PR のみ                                             | 全員   |

## エントリ形式（依頼側）

### D-YYYYMMDD-<chat略称>-<連番>: <問いを 1 行>

- 背景: <Issue 番号 / file:line / 1 行で>
- A: <選択肢>（推奨 — 理由 1 行）
- B: <選択肢>
- 放置時: <安全側の挙動。「この Issue を保留して次へ」等。無回答で作業が勝手に進む選択肢を置かない>
- 期限感: <merge 前まで / 今週末 / いつでも>

## 回答形式（ANSWERS.md・1 行/件）

- D-20260728-sched-1: A（一言あれば続ける）

## 運用

- 依頼側はエントリを書いたら**その判断をブロックせず次の作業単位へ進む**
- セッション開始時に ANSWERS.md を確認。自分宛の回答があれば、エントリを自分のファイルから削除して着手（ANSWERS.md 側の行は消さない — 監査ログを兼ねる）
- 月次で `comm/archive/YYYY-MM/` へ退避（outbox と同じローリング）
- ここに書いてよいのは「A/B に割れる判断」だけ。**不可逆操作（データ削除・本番設定変更・履歴改変）はキュー不可** — POLICY P-007 に従い同期でユーザー確認
```

### 5.2 `.claude/comm/decisions/POLICY.md`

```markdown
# 事前決裁ポリシー（POLICY）

「聞かなくていいこと」を増やすための恒久裁定集。判断に迷ったらまずここ → 該当なしなら decision キューへ。
**追加・変更はこうだいさんの明示承認のみ**（Claude が自分で裁定を足さない）。

- **P-001** merge と main への取り込みは常にこうだいさんが行う。自動化がどれだけ安定しても解除しない
- **P-002** 呼び出し元ゼロの dead code は grep 全数実測を根拠に退役してよい（実測結果を PR 本文に記載）
- **P-003** 「見送り」は正当な決着。根拠を Issue コメントに残して NOT_PLANNED close してよい
- **P-004** lint / 型の機械的追随は起票不要で同 PR に含めてよい（診断が指す範囲のみ。リファクタ同梱禁止）
- **P-005** ユーザー体験が変わる仕様分岐は実装で先行しない。decision キューに書いて次の Issue へ
- **P-006** 余白・文言などの UI ミクロ判断は既存パターン踏襲で実装者判断（迷いが残るなら PR 本文に 1 行明記）
- **P-007** 不可逆操作（データ削除・本番設定変更・履歴改変・force 系 git）はキュー不可。必ず同期でこうだいさんに確認

> 出自: P-002/P-003 は #429・#367 の裁定、P-004 は共通ゲート運用、P-005 は #428 の「判断に迷ったら停止」の一般化。
```

### 5.3 `.claude/rules/decision-queue.md`

```markdown
# Decision Queue — 判断で止まらない

ユーザー判断が必要になったら、待ちで作業を止めず `.claude/comm/decisions/chat-<self>.md` にエントリを書いて次の作業単位へ進む（形式は decisions/README.md）。

- まず `decisions/POLICY.md` を確認 — 該当する恒久裁定があれば聞かずにそれに従う
- キューに書くのは「A/B に割れる判断」だけ。不可逆操作は P-007 に従い同期確認
- セッション開始時に `decisions/ANSWERS.md` を確認し、自分宛の回答を消化してから新規作業に入る
- エントリの「放置時」は必ず安全側（保留・別作業へ）。無回答で作業が勝手に進む設計にしない
```

### 5.4 `.claude/skills/dev-digest/SKILL.md`

```markdown
---
name: dev-digest
description: 朝の采配ダイジェスト生成。open PR・未回答の判断キュー・各レーンの手番・貼り付け用 boot 行を 1 枚に集約し、.claude/comm/digest/ に出力して朝刊（Daily「開発」セクション）へミラーする。Triggers include "采配", "ダイジェスト", "digest", "今日の判断", "今日どれやる", "朝刊の開発欄".
---

# Dev Digest — 朝の采配ダイジェスト

chat-main（または検証専用セッション）で起動する読み取り中心のスキル。**コード変更・git 書き込み・Issue への書き込みはしない**。書いてよいのは digest ファイルと朝刊ミラーだけ。

## 手順

1. 収集（並列で）
   - `gh pr list --state open --json number,title,isDraft,mergeable,updatedAt`
   - `.claude/comm/decisions/chat-*.md` の未回答エントリ（ANSWERS.md に無い ID）
   - `.claude/memory/INDEX.md` の「進行中」から、手番が「ユーザー」「chat-main」の行
   - `.claude/comm/outbox/` の前回 digest 以降の新着（前回 digest ファイルの日付と mtime 比較）
   - playwright 検証計画（`archive/2026-07-28-post-merge-playwright-verification.md`）の未消化 V 項目数
2. 判断の選択肢化
   - ユーザー手番の判断を「1 行の問い + A/B + 推奨 1 行 + 放置時の挙動」へ圧縮
   - **今日の要判断は最大 5 件**（認知負荷キャップ）。溢れた分は「明日以降 N 件」とだけ表示
3. 出力: `.claude/comm/digest/YYYY-MM-DD.md`
   - 3 行サマリ（今日いちばん効く 1 手を先頭に）
   - 要判断（≤5・ID 付き。回答は ANSWERS.md に 1 行、または朝刊に返信）
   - merge 判断表（推奨順・conflict 有無・リスク 1 行）
   - レーン別「次の一手」1 行 + 貼り付け用 boot 行
   - 実機目視の残（件数のみ。詳細は検証計画へリンク）
4. 朝刊ミラー（可能なら）
   - ToolSearch で `mcp__life-editor__` ツールの有無を確認 → `get_memo`（今日）→ 結合 → `upsert_memo` で「## 開発」セクションを追記（上書き禁止）
   - MCP 未接続・失敗時はサイレントにファイルのみで完了（エラーにしない）
5. 完了報告は 1 行（digest パス + 要判断件数）

## ルール

- 要判断の要約は「リンク先を開かなくても答えられる粒度」を必須とする
- 判断の推奨には必ず理由を 1 行つける（推奨だけ書かない）
- digest 自身が長文化したら負け。1 画面で読める量を上限とする
```

### 5.5 `.gitignore` 追記

```
.claude/comm/digest/
```

---

## 6. Phase 1 の設計（実装は Phase 0 安定後）

- **毎朝 06:00 digest 自動生成**: chat-main で定期実行を登録（Claude Code の scheduled tasks。登録 ID・cron は `automation/routine-ids.md` の台帳を再利用して記録 — /loop 系の 7 日 expire を台帳で管理）
- **夜間の安全レーン**（読み取り中心・許可範囲は 2026-07-28 のユーザー決定どおり「docs・整理・検証準備まで」):
  - docs 整合 sweep（stale 記述の検出 → 修正は起票 or docs-only draft PR）
  - Issue 台帳整合（Epic チェックボックス追随・close 漏れ検出）
  - open PR の conflict 検知と rebase 要否の報告（rebase 実行はしない）
  - 検証準備（playwright 計画の対象 PR merge 状況の確認・V 項目の実行可否更新）
- **権限設計**: auto mode を基本に、`permissions.ask` で push / PR 作成を必ず確認に。既存 deny list（27 項目）は据え置き
- **報告経路**: 夜間ランの結果は outbox + 翌朝の digest に集約（会話には流さない）

## 7. Phase 2 / 3 の方向（設計のみ・着手条件つき）

- **Phase 2**（文書整備は 2026-08-06 実施済み・発火は未有効）: `automation/routine-night.md` を **`/loop-implement` を呼ぶ薄い殻**へ書き換え、夜 1 Issue の実装 → **commit 止まり**。殻が持つのは無人固有の事情だけ（Scope 宣言 / Issue の選び方 / セッション予算 / 停止条件 / 報告先 / 質問経路）で、実装の進め方はカタログ側が正本
  - **「draft PR 止まり」は誤り**（2026-08-06 実測で訂正）: `Bash(git push*)` と `Bash(gh pr create*)` は `permissions.ask` に入っており、無人では答える人がいないので必ず失敗する。したがって到達点は **commit まで**で、push と PR 作成は翌朝の人の手番に残す。ここを解放するかどうかは別計画 [`2026-08-06-autonomous-operation-endpoint.md`](./2026-08-06-autonomous-operation-endpoint.md) §3 第 1 段の管轄
  - **前提だった goals.md の全面改訂は、役割の変更として実施**（2026-08-06）: 「Goal の羅列 + ACTIVE / PENDING / BLOCKED の状態機械」から「**今夜どれを選ぶかの判断基準**」へ。open Issue の一覧は GitHub が正本で、goals.md は一覧を持たない（数値の非複製原則）。あわせて、夜のレーンが拾う範囲を「**宛先レーンはあるが滞留している Issue**」と確定した（2026-08-06 ユーザー裁定）
  - 状態機械を畳んだ副作用として、`routine-morning.md`（旧・朝の PM ルーチン）の「goals.md の Goal 状態を更新する」前提が失われた。同ファイルは未稼働のままなので実害は無いが、追随が要る（→ §8 Step 10）
- **Phase 3**: 実ブラウザ検証セッションを定期実行化（雛形 = `archive/2026-07-28-post-merge-playwright-verification.md`）。fail は issue-dispatch で起票（既存設計どおり）

---

## 8. Steps

- [x] 1. [chat-main] 本計画書のレビュー（こうだいさん）→ Status: IN PROGRESS 化（2026-07-28 進行指示）
- [x] 2. [chat-main] §5.1〜5.5 を配置する docs PR を作成（一時 worktree 経由・Phase 0 完成）— 本 PR
- [ ] 3. [全チャット] 次回セッション開始時から decision-queue ルール適用（rules/ 配置で自動）
- [ ] 4. [chat-main] dev-digest を手動起動して初回 digest を生成・形式をこうだいさんが確認（2026-07-28: 初回生成 + 同日 21:30 更新済み = `.claude/comm/digest/2026-07-28.md`。形式確認 = こうだいさん待ち）
- [ ] 5. [chat-main] life-editor MCP（Supabase）疎通確認（既存の予定タスク）→ 朝刊ミラー有効化
- [x] 6. [判断] Phase 0 が 2 週間回ったら Phase 1 着手を decision キューで確認（2026-08-04 前倒し確定: キュー稼働 1 週間で回答 13 件の実績を確認の上、ユーザー指示を着手裁定として採用）
- [x] 7. [chat-main] Phase 1 インフラ配置（routine-digest / routine-night-safe / run-routine.ps1 / 台帳改訂 / permissions.ask 二層）— 2026-08-04 PR
- [ ] 8. [ユーザー] 実行基盤の裁定（D-20260804-main-1）→ 初回手動実行で動作確認 → Task Scheduler 登録で発火有効化（手順 = `automation/routine-ids.md`）
- [x] 9. [判断] ループカタログ（`2026-08-04-loop-catalog.md`）の定着後、Phase 2 着手可否を decision キューで確認（2026-08-04 裁定: カタログを Phase 2 の前提として先行実施）→ **ゲートは前倒しで飛ばした**（2026-08-06 ユーザー指示。カタログ merge の当日で試験運用は 0 件・decision キューも経ていない。Step 6 と同型の前倒し）
- [x] 10. [chat-main] goals.md の役割変更に伴う追随 3 か所（2026-08-06 ユーザー指示で同一 PR に同梱）: `run-routine.ps1` の `ValidateSet` に `night` 追加（これが無いと夜の実装レーンは手動でも起動できない）/ `automation/README.md` の状態列と Phase 2 の記述 / `routine-morning.md` を**退役**（後継 = `routine-digest.md`。旧 Step の行き先を表で残し、後継のいない worktree prune を明示）

## 9. Files

| File                                 | Operation    | Notes                                                           |
| ------------------------------------ | ------------ | --------------------------------------------------------------- |
| `.claude/comm/decisions/README.md`   | Add          | §5.1 全文                                                       |
| `.claude/comm/decisions/POLICY.md`   | Add          | §5.2 全文                                                       |
| `.claude/comm/decisions/ANSWERS.md`  | Add          | 見出しのみの空ファイル                                          |
| `.claude/rules/decision-queue.md`    | Add          | §5.3 全文                                                       |
| `.claude/skills/dev-digest/SKILL.md` | Add          | §5.4 全文                                                       |
| `.gitignore`                         | Edit         | §5.5 の 1 行                                                    |
| `.claude/CLAUDE.md`                  | Edit（任意） | §7 に decisions/ への 1 行ポインタ（conflict 回避のため最小限） |

Phase 2（2026-08-06）:

| File                                    | Operation | Notes                                                                           |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `.claude/automation/goals.md`           | Rewrite   | Goal 一覧 + 状態機械 → 選定基準へ役割変更（一覧は持たない）                     |
| `.claude/automation/routine-night.md`   | Rewrite   | `/loop-implement` を呼ぶ薄い殻へ。無人固有の事情だけを保持・commit 止まり       |
| `.claude/automation/run-routine.ps1`    | Edit      | `ValidateSet` に `night` を追加（無いと手動でも起動できない）                   |
| `.claude/automation/README.md`          | Edit      | 状態列 3 行 + Phase 2 の記述（「draft PR 止まり」→「commit 止まり」）           |
| `.claude/automation/routine-morning.md` | Rewrite   | 退役スタブ化（後継 = `routine-digest.md`・旧 Step の行き先表）                  |
| 本書                                    | Edit      | §2 / §7 / §8 / §9 / Worklog の追随（「draft PR 止まり」→「commit 止まり」訂正） |

## 10. Verification

- [ ] worktree チャットが判断点で停止せず decisions/chat-<self>.md にエントリを書いて次の Issue へ進む（1 週間で 1 件以上の実例）
- [ ] こうだいさんの回答が ANSWERS.md 1 行 → 依頼側チャットが次セッションで消化する往復が成立する
- [ ] digest が 1 画面に収まり、要判断が 5 件以下に選択肢化されている
- [ ] MCP 疎通後、朝刊に「開発」セクションが出て既存の朝刊/夕刊セクションを壊していない
- [ ] 不可逆操作がキュー経由で流れていない（P-007 違反ゼロ）

## References

- 現状実測: `.claude/memory/INDEX.md` / `.claude/automation/`（README・goals・routine-night・routine-ids）/ `.claude/comm/README.md`
- 兄弟計画: `archive/2026-07-28-open-issue-fanout.md`（COMPLETED・#474 で archive 移動） / `archive/2026-07-28-post-merge-playwright-verification.md`（COMPLETED） / `2026-07-16-briefing-headless-claude-prototype.md`
- 公式: code.claude.com/docs — goal.md / scheduled-tasks.md / auto-mode-config.md / hooks-guide.md / best-practices.md / headless.md
- 実践事例: ghuntley.com/loop（Ralph ループ原典）/ anthropics/claude-code plugins/ralph-wiggum（公式プラグイン README）/ gh issue #18646（cap 無視 494 回暴走）/ roborhythms.com（承認キュー実装報告）/ Medium: overnight 運用の失敗と対策（context 枯渇・フェーズ分割）

---

## Worklog

- 2026-08-06: [chat-night-lane] **Step 9 のゲートを飛ばして Phase 2 の文書整備を実施**（ユーザー指示による前倒し）。飛ばした事実を先に記録する — ループカタログは同日 merge されたばかり（PR #595）で**試験運用は 0 件**、decision キューでの着手裁定も経ていない。Step 6（2026-08-04）と同型の前倒しで、判断材料が実績ではなくユーザーの意思決定である点は同じ。**発火は有効化していない**（D-20260804-main-1 が未回答のため）。実施内容 3 点: ① `goals.md` を**役割ごと差し替え**（Goal 一覧 + 状態機械 → 「今夜どれを選ぶか」の選定基準。open Issue の一覧は GitHub が正本なので持たない）② `routine-night.md` を **`/loop-implement` を呼ぶ薄い殻**へ書き換え（無人固有の事情だけを保持。手順・検証ゲート・ティア判定・worktree 手順は各正本へ委譲）③ 本書 §2 / §7 の「draft PR 止まり」を **commit 止まり**へ訂正（`permissions.ask` の実測と食い違っていた）。**設計判断 1 件**: 夜のレーンが拾う範囲は「宛先レーンはあるが**滞留している** Issue」で確定（ユーザー裁定）— open Issue は全件がレーン宛 prefix を持つため、無条件では 1 件も拾えない構造だった。滞留の判定は Issue 番号を含むブランチ / open PR の不在 + 宛先レーンの 3 日無活動 + 着手宣言の不在を実測する。**追随 3 か所（Step 10）も同一 PR に同梱**（起草時は Scope 外としたが、同日ユーザー指示で取り込み）: `run-routine.ps1` の `ValidateSet` に `night` / `automation/README.md` の状態列と Phase 2 の記述 / `routine-morning.md` を退役（後継 = `routine-digest.md`。**後継のいない機能は worktree prune だけ**で、これは人手のまま残る）
- 2026-08-04: [chat-main] 3 計画書（本書 + `2026-08-04-loop-catalog.md` + `2026-08-04-context-cost-reduction-harness.md`）の整合性評価 → ユーザー裁定 3 件: ① 実施順序 = 親 Phase 1 → ループカタログ → コスト計画 → 親 Phase 2（カタログ側の「Phase 2 前提」裁定を優先）② Phase 0→1 昇格を前倒し確定（キュー稼働 1 週間・回答 13 件の実績）③ 実行基盤は実測調査の上 decision キューで提案。**実測補正 1 件**: セッション内 scheduled tasks（CronCreate）は**セッション限定 + 繰り返し 7 日期限**で、§3-7 の「定期実行は scheduled tasks」は常駐セッションが前提になる。Phase 1 は **Task Scheduler + `claude -p`（headless — `2026-07-16-briefing-headless-claude-prototype.md` で E2E 検証済みの型）** を推奨案として D-20260804-main-1 に起票し、インフラ（routine 2 本 + launcher + 台帳 + permissions.ask 二層）を配置。発火は裁定まで無効
