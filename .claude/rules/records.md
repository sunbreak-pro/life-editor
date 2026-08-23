---
paths:
  - ".claude/**"
---

# Records — 記録グラフ層の規約（どこに書くか・ノードとエッジ）

> 設計の正本 = [`docs/vision/plans/2026-08-09-record-graph-layer.md`](../docs/vision/plans/2026-08-09-record-graph-layer.md)（採用 = [`D-20260809-main-1`](../decisions/D-20260809-main-1.md)）。入口 = [`.claude/INDEX.md`](../INDEX.md)。

## 1. 記録型ごとの正本（一枚表）

| 記録型            | 正本（SSOT）                                               | 書き手                    | 派生ビュー（手書き禁止）                       |
| ----------------- | ---------------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| 判断（未決）      | `comm/decisions/chat-<n>.md`                               | 当該チャットのみ          | `decisions/INDEX.md` §Open（git 非追跡）       |
| 判断（確定・Why） | `decisions/D-*.md`（1 決定 1 ファイル）                    | 起票チャット・昇格時 1 回 | `decisions/INDEX.md`（git 非追跡）             |
| 恒久裁定 1 行     | `comm/decisions/POLICY.md`                                 | ユーザー承認 PR のみ      | —                                              |
| 進行中 / 履歴     | `memory/` + `history/` の `chat-<n>.md`                    | 当該チャットのみ          | 派生 INDEX（hook 生成・git 非追跡）            |
| 計画              | `docs/vision/plans/*.md`                                   | Owner-chat                | `.claude/INDEX.md` §進行中の計画（git 非追跡） |
| 障害知見          | GitHub Issue（プロダクト）/ `docs/known-issues/`（環境系） | chat-main                 | known-issues/INDEX.md                          |
| 恒久の事実・規約  | CLAUDE.md / `rules/`                                       | PR                        | —                                              |
| 連絡              | `comm/outbox/chat-<n>.md`                                  | 当該チャットのみ          | digest                                         |

- **派生ビューにしか存在しない情報を作らない**。索引・INDEX・digest への手書きは禁止（正本を書いて再生成する）
- **同じ事実の 2 箇所目以降は本文転記でなく ID 参照**（`D-…` / `#NNN` / plan ファイル名 / `P-NNN`）にする — 数値の非複製原則（`docs-consistency.md` §1）の一般化。CLAUDE.md 等へ決定のインライン注記を新規に書くときも `D-…` の ID を必ず添える

## 2. どこに書くか — 1 分判定

```
不可逆操作の可否?              → 書かない。同期でユーザー確認（P-007）
恒久裁定にしたい?              → POLICY.md（ユーザー承認 PR のみ）
A/B に割れるユーザー判断?      → comm/decisions/chat-<self>.md → 回答後 decisions/D-*.md へ昇格
計画横断で効く設計判断（自裁）? → decisions/D-*.md（status: recorded。ただし UX が変わる分岐は P-005 = キュー必須）
計画スコープ内の設計判断?      → その plan の決定録 / Worklog（横断化したら台帳へ昇格し ID 参照に置換）
やったこと（事実）?            → history/chat-<self>.md（実装ブランチに載せない — D-20260801-main-1）
今やってる / 次やること?       → memory/chat-<self>.md（3 件枠）
再発しうる障害知見?            → プロダクト = GitHub Issue / 環境系 = docs/known-issues/
恒久の事実・規約?              → CLAUDE.md（「消したら Claude が間違うか」基準）or rules/
他チャットへの連絡?            → comm/outbox/chat-<self>.md
上のどれでもない?              → 書かない
```

- **`docs/known-issues/` に書く条件 = 常時ロードされる場所（CLAUDE.md / `rules/` / `memory/`）から ID 参照を張れること**（[`D-20260823-shared-fix-1`](../decisions/D-20260823-shared-fix-1.md)）。知見の価値は「書いてあること」ではなく「必要な瞬間に視界へ入ること」で決まる — 実測で 30 本中 5 本が参照 0、最多の 2 本すら自発参照ではなく常時ロード面からの注入だった（計測 = `scripts/known-issue-usage.mjs`・[#1086](https://github.com/sunbreak-pro/life-editor/issues/1086)）。**入口を張れないときは、先に `rules/` へ 1 行足してから書く**（足せないなら、その知見は書かない）

## 3. グラフ意味論（ノードとエッジ）

- **ノード** = D ファイル / plan / known-issue / GitHub Issue（外部）/ POLICY 行
- **エッジ型** = `supersedes` / `superseded-by`（裁定の置換 — 双方向。`records.mjs check` が欠落を検証）・`refs`（根拠・関連）・`implemented-by`（決定 → 実装）・`promoted-to`（決定 → POLICY）・`Parent` / `Previous`（plan 系譜 — 既存 frontmatter）・`topics`（逆引き）
- **鮮度** = supersede 連鎖の末端 + `answered` 日付で判定する。**古くなった記録は書き換えず、後継ノードを追加して繋ぐ**（INDEX が Active だけを表に出す）
- **無人セッションの読む順**（O(1) 状態把握・grep なし）: CLAUDE.md（自動）→ `.claude/INDEX.md` → `decisions/INDEX.md` §Open + `ANSWERS.md` → `memory/chat-<self>.md` → 自分宛 open Issue

## 4. 索引の再生成

- **索引 4 本はすべて git 非追跡の派生ビュー**（`.claude/INDEX.md` / `decisions/INDEX.md` = 2026-08-12 #735 で追跡解除・`memory/INDEX.md` / `history/INDEX.md` = 従来から）。commit に載らないので **merge 衝突が起きない**（#735 以前は「plans か decisions を変えた PR と同一コミットで再生成」を機械強制していて、判断を 1 件足すだけで並行レーンが必ず衝突していた）
- 再生成 = SessionStart hook が自動実行（`.claude/settings.json`: `records.mjs index` + `hooks/regen-index.sh` の 2 本立て。後者は hooks-lib → vendor `scripts/hooks-lib/` の fallback chain）。手元で古いと感じたら `node .claude/scripts/records.mjs index` をいつ回してもよい（追跡外なので `git status` に出ない）
- `records.mjs check`（docs-lint 経由で CI ゲート）が見るのは**正本側だけ** — frontmatter スキーマ・supersede 双方向リンク・`ANSWERS.md` との突合。索引の鮮度は検査しない
- **frontmatter の配列は 1 行に保つ**（`refs: ["#1", "#2"]`）。PostToolUse formatter が 80 桁超の flow 配列を折り返すと、行単位で読む `records.mjs` のパーサが `refs は配列にする` で落ちる（[known-issues 030](../docs/known-issues/030-posttooluse-formatter-wraps-frontmatter-arrays.md)。現在は `records.mjs` 側に折り返しを畳む前処理が入っている）
