---
Status: Draft # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: YYYY-MM-DD
Branch: <branch-name>
Owner-chat: <chat-name> # .claude/comm/.session-name の値
Parent: (任意) 親計画書パス
Previous: (任意) 前フェーズ完了計画書パス
---

# Plan: <title>

> 本テンプレートの目的: 「人手で止まる箇所」と「自律で流れる箇所」を計画書段階で可視化し、Claude が
> 暴走できない構造を作る。Stop hook (`.claude/hooks/stop-check.sh`) と組で使う。
> 既存計画書は新規作成または大改訂時に本テンプレートへ移行する（既存をまとめて書き換えない）。

---

## Context

- **動機**: なぜこれをやるのか（1〜3 行）
- **制約**: 既存仕様 / コスト $0 / 他チャットとの依存
- **Non-goals**: あえてやらないこと

---

## Worktree 分担（fan-out 計画のみ・単一 worktree の計画では本節を削除）

作業の分配・進捗追跡の正本は **GitHub Issues**（起票 = chat-main の `issue-dispatch` スキル・宛先 = `section:<id>` / `shared-fix` ラベル — CLAUDE.md §7.4 / §9）。計画書は仕様詳細と分担の全体像だけを持ち、**台帳としての作業オーダー .md は作らない**（2026-07-11〜。旧 orders 台帳 fan-out は retire）。

| worktree | 担当（1 行）        | 対応 Issue | 触ってよいパス |
| -------- | ------------------- | ---------- | -------------- |
| `<slug>` | <担当範囲を 1 行で> | #NNN       | `<パス>`       |

- 完了条件（DoD）は各 Issue の body に機械検証可能な形で書く（表には Issue 番号だけを置き、内容を転記しない — 数値の非複製原則）
- 常設 worktree へはラベル付き起票だけでタスクが届く（boot 不要）。新規・休眠チャットを起こす場合のみ 1 行 boot: 「`gh issue list -R sunbreak-pro/life-editor --label section:<id> --state open` と `--label shared-fix --state open` で自分宛 open Issue を確認し、順に実装して close まで担うこと」
- 各 worktree は着手前に `git pull --ff-only` → `git fetch origin && git merge origin/main --no-edit` の 2 段階で main との差分を取り込む（コンフリクトは手動解消・迷ったら停止して報告 — CLAUDE.md §7.4）
- 自分宛 open Issue が 0 件なら「担当なし」と報告して停止する

---

## Scope (Touchable Paths)

このプランで変更してよいパスを宣言する。git diff の範囲と照合して宣言外パスへの変更を scope drift
として警告する仕組みは **未実装（将来・#173 で機械化予定）**。現状は人手で Scope を守る前提で使う。

```
frontend/src/services/tasks/**
frontend/src/components/Tasks/**
cloud/db/migrations/000N_*.sql
.claude/docs/vision/plans/<this-file>.md
```

スコープ外の変更が必要になった場合は、計画書を更新してから手を付ける（更新せず広げない）。

---

## Steps

各ステップに Gate と Acceptance を明示する。

| #   | Step                       | Gate    | Acceptance                            |
| --- | -------------------------- | ------- | ------------------------------------- |
| 1   | DB スキーマ追加            | 🛑 人手 | `supabase db push` 通過               |
| 2   | DataService に method 追加 | 🤖 自律 | `cd frontend && npm run build` exit 0 |
| 3   | UI に CRUD ボタン          | 🤖 自律 | vitest 該当 test 緑                   |
| 4   | E2E 動作確認               | 👀 目視 | golden path を手で 1 周               |
| 5   | PR 作成 → main merge       | 🛑 人手 | PR レビュー & merge ボタン            |

### Gate 凡例

- **🤖 自律** — Claude が完結。後追い検証（type check / test）で品質担保。Stop hook で型崩壊を検出
- **👀 目視** — Claude では検証不能（UI / 体感 / レイアウト）。ユーザーが画面で確認
- **🛑 人手** — ユーザー操作必須（DDL push / シークレット投入 / 本番デプロイ / PR merge）

「人手」を減らすために減らさない。1 コマンドで通せる形に圧縮する（=「ボタン 1 つ押すだけ」）。

---

## Acceptance Criteria (機械検証可能)

PR/タスク完了の必要条件。すべて自動で yes/no が判定できる形で書く。

- [ ] `cd frontend && npm run build` exit 0（型エラー 0）
- [ ] `cd frontend && npx vitest run <該当 test>` 全 pass
- [ ] PR diff が ±<N> 行以内（scope creep ガード。目安: 機能追加 500 / 修正 200 / リファクタ 1000）
- [ ] (該当する場合) Supabase の `<table>` に `<column>` が存在
- [ ] (該当する場合) `supabase db diff` で local↔remote 差分 0
- [ ] 完了・退役・supersede 時: 対応 plan・per-chat memory の Status を更新した（DoD。PR merge / Issue close と docs Status の非連動を防ぐ）

---

## DB Migration Notes

DDL を含む場合のみ記入。空なら削除可。

**ローカルファイル先行ルール（MANDATORY）**:

1. `supabase migration new <name>` でローカルファイル作成（Claude 実行可）
2. Claude が SQL をそのファイルに記入
3. **ユーザーが** `supabase db push` 実行（apply_migration MCP の単独使用禁止 = schema drift 確定する）
4. 適用後、Claude が `list_tables` で確認しレポート

ロールバック手順:

- 失敗時は逆向き migration を別ファイルで作成（既存ファイル編集禁止）

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/NNN-<slug>.md` で類似事例を確認
- 新規 known issue 化候補があれば末尾に記録

---

## References

- vision: `.claude/docs/vision/<file>.md`
- 親計画書 / 前フェーズ: frontmatter `Parent` / `Previous` 参照
- related skills: `<skill-name>` (例: `db-migration`, `add-ipc-channel`)

---

## Worklog (任意)

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。
完了後に Known Issue 化すべき知見はここから docs/known-issues/ へ移送。
