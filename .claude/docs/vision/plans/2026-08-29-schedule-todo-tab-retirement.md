---
Status: IN PROGRESS
Created: 2026-08-29
Branch: claude/sched-1153-retire-todo-tab
Owner-chat: schedule-refine
---

# Plan: Schedule の Todo タブ（カンバン）を退役し、未スケジュール Todo をサイドバーへ縮退統合する

> Issue #1153（2026-08-27 ユーザー確定）の実装計画。**完全廃止ではなく縮退** — Todo ドメイン自体は Briefing・Work・MCP が読むので不変。

---

## Context

- **動機**: 毎朝毎晩 5 分の動線に要るのは「今日やる分の確認と配置」で、それは Calendar の右サイドバーでほぼ完結している。status / tag 列 + DnD のカンバン（`web/src/todos/` ≈ 1,800 行）は N=1 の日常用途に対して過剰
- **制約**: Todo の作成 / ステータス変更 / 詳細編集 / `[[` リンク着地が新導線で動くこと。Desktop / narrow の両方で成立すること。DDL ゼロ
- **Non-goals**: Todo ドメイン・`tasks_payload`・MCP ツールには触らない。Briefing / Work / Analytics の Todo 参照は不変。カンバンの「列 + DnD」を別の形で作り直さない（退役であって移設ではない）

### 実装前に判明していた地形（この計画の前提）

コードを読んで確かめた事実で、Issue 本文からは読み取れないもの:

- **サイドバー「本日の Todo」タブは既に “未スケジュール Todo 一覧” を持っている**。`useScheduleTodoChips` の `todoAddable` = `pickAddableTodos(todoNodes)`（`shared/src/utils/todayTodo.ts`）は「未削除 / `scheduledAt == null` / 未完了 / 子を持たない」Todo で、Issue が言う「未スケジュールの Todo を眺めて今日に載せる」そのもの。`onAddCandidate` が今日へ置く導線も既にある
- **Schedule は既に自前の Todo 詳細面を持っている**（`ScheduleTodoDetail.tsx`・#626 / #761）。ただし中身は `TodoDetailPanel`（タイトル / ステータス / タグ / 変換 / 削除）で、**本文リッチテキストと `[[` リンクが無い**。それを持っているのはカンバン側の `TodoDetailContent`（`web/src/todos/`）
- **トレイの行タップは今、カンバンへ飛ぶ**（`ScheduleSidebar` が `onOpenTodo` に 0 引数の `onOpenTodos` を渡している）。退役後はここが宙に浮く
- **サイドバーの todo タブは narrow で flow に畳まれる**（`activeScheduleSidebarTab`）。つまり退役すると **narrow から Todo に触る手段が消える**

---

## 検討した代替案（必須）

| 案                                                                  | 採否 | 却下理由                                                                                                                                                                                                       | 復活条件                                                |
| ------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A: 既存の「本日の Todo」タブを Todo のホームに育てる**（採用）    | ✓    | —                                                                                                                                                                                                              | —                                                       |
| B: flow タブに未スケジュール一覧を足し、todo タブごと畳む           | ✗    | 「今日の流れ」は時刻順の 1 本の帯で、未スケジュール＝時刻を持たない群を同じ帯に混ぜると並び順の意味が壊れる。#1148 で narrow の flow タブが選択日追従になった直後でもあり、2 つの軸を 1 タブに重ねることになる | flow が「時刻順」をやめたとき                           |
| C: `ScheduleTodoDetail` の軽い `TodoDetailPanel` のまま本文を諦める | ✗    | Issue の DoD が「本文 / `[[` リンクを存続」と明記。カンバンを消して編集能力が落ちるなら、それは縮退ではなく機能削除                                                                                            | ユーザーが本文編集を Notes 側だけで足りると裁定したとき |
| D: タブは残してカンバンだけ差し替える                               | ✗    | タブ帯が 1 個になった時点で帯自体が無意味（#408 が同じ理由で Routines タブを畳んだ前例）                                                                                                                       | Schedule に 3 つ目の面が生まれたとき                    |
| E: narrow の Todo 導線を諦める（Desktop 専用に戻す）                | ✗    | 退役前は narrow にも `MobileTodoList` があった。導線を消すのは縮退ではなく後退で、mobile-scope #6 の目標（詳細編集も可）を無断で下げることになる                                                               | —                                                       |

**AddPill の置き場（#1148 と同じ論点）**: トレイの見出し行に置く。理由は `D-20260827-sched-1` と同じ — スクローラの外の見出しに置き、浮かせない。

---

## Scope (Touchable Paths)

```
web/src/schedule/**
web/src/todos/**                      （退役 + 生き残る部品の移設）
web/src/shared/todoTrayDeleteGuard.ts （import 元が動くため）
shared/src/components/Kanban/**       （使い手が消えたら削除）
shared/src/components/materials/TodoListPanel.tsx（+ 同 index.ts）
web/src/sectionDescriptors.tsx
web/src/MainScreen.tsx
web/src/hooks/useShellNavigation.ts
web/src/hooks/useShellChrome.tsx
shared/src/i18n/locales/{en,ja}.json
web/tests/** / shared/tests/**
.claude/docs/requirements/mobile-scope.md
.claude/docs/vision/plans/2026-08-29-schedule-todo-tab-retirement.md
```

スコープ外が必要になったら **P-008** に従いキューへ積んで現計画を続行する。

---

## Steps

| #   | Step                                                                                            | Gate    | Acceptance                                                                      |
| --- | ----------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| 1   | 詳細パネルの中身を `TodoDetailContent` に差し替える（`ScheduleTodoDetail` の枠は残す）          | 🤖 自律 | 本文 / `[[` / タグ / ステータス / 削除 / 変換が Schedule の詳細から動く（test） |
| 2   | サイドバー todo タブを Todo のホームにする（行タップ → 詳細 / 未スケジュール見出し / 作成ピル） | 🤖 自律 | `web/tests/scheduleSidebar.test.tsx` 緑                                         |
| 3   | todo タブを narrow でも出す（`activeScheduleSidebarTab` の畳み込みを外す）                      | 🤖 自律 | 同上 + narrow の描画テスト                                                      |
| 4   | タブ帯・`ScheduleTab`・`scheduleTab` state・パレットコマンドを撤去                              | 🤖 自律 | `web` build + typecheck:tests 緑                                                |
| 5   | nav intent の付け替え（`nav:tasks` / `global:new-task` / `[[` 着地 / Briefing）                 | 🤖 自律 | `web/tests/useShellNavigation*` 緑                                              |
| 6   | `web/src/todos/` のカンバン一式と `shared/src/components/Kanban/` を削除                        | 🤖 自律 | 参照ゼロ（grep）+ build 緑                                                      |
| 7   | i18n / docs 追随（mobile-scope #6 行）                                                          | 🤖 自律 | `docs-lint` 緑                                                                  |
| 8   | CI `verify` 全ステップ + `docs-lint` をローカルで回す                                           | 🤖 自律 | 全緑                                                                            |
| 9   | 実機での目視（サイドバーが Todo のホームとして成立しているか）                                  | 👀 目視 | merge 後・chat-main / こうだいさん                                              |
| 10  | PR merge                                                                                        | 🛑 人手 | P-001                                                                           |

---

## Acceptance Criteria (機械検証可能)

- [ ] CI `verify` の全ステップ（shared → web → desktop → mcp-server）と `docs-lint` がローカルで exit 0
- [ ] `grep -rn "KanbanView\|components/Kanban" shared/src web/src` が 0 件
- [ ] `grep -rn "scheduleTab\|ScheduleTab" web/src` が 0 件
- [ ] Schedule セクションにタブ帯が無い（`SECTION_DESCRIPTORS.schedule.tabBand` が undefined）
- [ ] 未スケジュール Todo の閲覧・今日への配置・作成・完了・詳細編集・`[[` 着地が Calendar 画面内で完結する（各々テストで固定）
- [ ] 完了時: 本計画の Status を COMPLETED にし `archive/` へ移動（PR merge 後・DoD）

---

## Risks / Known Issues 参照

- **`[[` リンクの着地が無音で死ぬ**: `ITEM_NAV_TARGET.task` が `{section:"schedule", tab:"todo"}` を指したまま tab を消すと、着地は section だけ合って詳細が開かない。#370 / #507 の経路はテストで固定する
- **`pendingNewTodo` の消費者が消える**: 今は KanbanView がマウント時に消費している。消費者不在のまま残すとフラグが立ちっぱなしになる
- **#1148（PR #1178）と `ScheduleSidebar.tsx` / `CalendarTab.tsx` で衝突する**。#1148 が flow タブに `onAdd` / `dayflow` / `nowMinutes: null` を足しているので、後発（本計画）が main 取り込み時に解消する
- **#1124（PR #1168）のツアーアンカー 3 本が本計画で消える面に付いている**（`scheduleTodoTab` / `scheduleTodoAdd` / `scheduleTodoBoard`）。**本計画で新しい面へ付け替える**（タブ → サイドバーの todo タブ / 追加ピル / トレイ本体）。両 PR の merge 順に関わらず、後着地側で anchors を実在させる

---

## References

- Issue: #1153（親の分析 = chat-main 2026-08-27）
- 前例: #408（Routines タブを畳んで rightSidebar へ縮退した同型の判断）/ #411（Todo を Materials から Schedule のタブへ移した回）
- 判断: `D-20260827-sched-1`（作成ピルはスクローラ外の見出し行に置く）
- rules: `.claude/rules/frontend.md`（Provider 順序 / テスト環境の制約）

---

## Worklog

- 2026-08-29: 計画作成。実装前調査で「トレイが既に未スケジュール一覧と配置導線を持つ」「Schedule に既に Todo 詳細面がある（本文だけ無い）」の 2 点が分かり、作業の中心が **新規作成ではなく差し替えと撤去** になった
