---
Status: IN PROGRESS
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

| 資産 | 状態 | 本計画での扱い |
| --- | --- | --- |
| `automation/`（夜 22 時 Engineer + 朝 6 時 PM ルーチン設計） | **未稼働**（routine-ids.md が PENDING のまま。Mac 時代の Cloud Routine 前提で停止） | Phase 1-2 で現行機能（scheduled tasks）向けに改訂して復活 |
| `scripts/loop-engine/`（PR #106・check.sh + loop.sh） | 実ループ本走が保留 | Phase 2 の検証ゲートとして再利用候補 |
| `comm/`（outbox 単一書込者プロトコル） | 稼働中 | Phase 0 の decisions/ は同じ設計原則で増設 |
| `2026-07-28-post-merge-playwright-verification.md` | Draft | Phase 3 の実行主体にそのまま昇格 |
| briefing（朝刊/夕刊）+ headless claude プロトタイプ（2026-07-16） | 稼働中 / 検証済み | digest の届け先（朝刊「開発」セクション） |

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
  │  routine-night.md 改訂版で plan 1 件/夜 → worktree 実装 → draft PR 止まり
  │  昇格条件: goals.md を現行 Epic ベースに改訂済みであること
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

| ファイル | 書く人 | 読む人 |
| --- | --- | --- |
| `chat-<name>.md` | そのチャットのみ | 全員 |
| `ANSWERS.md` | こうだいさん（または転記を任された chat-main / digest セッション）のみ | 全員 |
| `POLICY.md` | こうだいさん承認の PR のみ | 全員 |

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
   - playwright 検証計画（`plans/2026-07-28-post-merge-playwright-verification.md`）の未消化 V 項目数
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

- **Phase 2**: `automation/routine-night.md` を現行環境向けに改訂（Cloud Routine 前提の除去・worktree/branch 規約の §7.4 追随・iteration cap の bash 計測維持）し、夜 1 plan の実装 → draft PR。**前提 = goals.md の全面改訂**（2026-05 の Goal 1〜3 は陳腐化。現行 Epic #290 / #321 ベースへ）
- **Phase 3**: `2026-07-28-post-merge-playwright-verification.md` の検証セッションを定期実行化。fail は issue-dispatch で起票（既存設計どおり）

---

## 8. Steps

- [x] 1. [chat-main] 本計画書のレビュー（こうだいさん）→ Status: IN PROGRESS 化（2026-07-28 進行指示）
- [x] 2. [chat-main] §5.1〜5.5 を配置する docs PR を作成（一時 worktree 経由・Phase 0 完成）— 本 PR
- [ ] 3. [全チャット] 次回セッション開始時から decision-queue ルール適用（rules/ 配置で自動）
- [ ] 4. [chat-main] dev-digest を手動起動して初回 digest を生成・形式をこうだいさんが確認
- [ ] 5. [chat-main] life-editor MCP（Supabase）疎通確認（既存の予定タスク）→ 朝刊ミラー有効化
- [ ] 6. [判断] Phase 0 が 2 週間回ったら Phase 1 着手を decision キューで確認

## 9. Files

| File | Operation | Notes |
| --- | --- | --- |
| `.claude/comm/decisions/README.md` | Add | §5.1 全文 |
| `.claude/comm/decisions/POLICY.md` | Add | §5.2 全文 |
| `.claude/comm/decisions/ANSWERS.md` | Add | 見出しのみの空ファイル |
| `.claude/rules/decision-queue.md` | Add | §5.3 全文 |
| `.claude/skills/dev-digest/SKILL.md` | Add | §5.4 全文 |
| `.gitignore` | Edit | §5.5 の 1 行 |
| `.claude/CLAUDE.md` | Edit（任意） | §7 に decisions/ への 1 行ポインタ（conflict 回避のため最小限） |

## 10. Verification

- [ ] worktree チャットが判断点で停止せず decisions/chat-<self>.md にエントリを書いて次の Issue へ進む（1 週間で 1 件以上の実例）
- [ ] こうだいさんの回答が ANSWERS.md 1 行 → 依頼側チャットが次セッションで消化する往復が成立する
- [ ] digest が 1 画面に収まり、要判断が 5 件以下に選択肢化されている
- [ ] MCP 疎通後、朝刊に「開発」セクションが出て既存の朝刊/夕刊セクションを壊していない
- [ ] 不可逆操作がキュー経由で流れていない（P-007 違反ゼロ）

## References

- 現状実測: `.claude/memory/INDEX.md` / `.claude/automation/`（README・goals・routine-night・routine-ids）/ `.claude/comm/README.md`
- 兄弟計画: `2026-07-28-open-issue-fanout.md` / `2026-07-28-post-merge-playwright-verification.md` / `2026-07-16-briefing-headless-claude-prototype.md`
- 公式: code.claude.com/docs — goal.md / scheduled-tasks.md / auto-mode-config.md / hooks-guide.md / best-practices.md / headless.md
- 実践事例: ghuntley.com/loop（Ralph ループ原典）/ anthropics/claude-code plugins/ralph-wiggum（公式プラグイン README）/ gh issue #18646（cap 無視 494 回暴走）/ roborhythms.com（承認キュー実装報告）/ Medium: overnight 運用の失敗と対策（context 枯渇・フェーズ分割）
