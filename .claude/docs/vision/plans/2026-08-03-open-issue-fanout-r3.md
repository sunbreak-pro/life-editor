---
Status: IN PROGRESS
Created: 2026-08-03
Branch: main # docs のみ。commit する場合は一時 worktree 経由（main 直 push 禁止）
Owner-chat: main
---

# Plan: Open Issue 一斉消化 fan-out ラウンド 3（2026-08-03）

> **意図的に緩い計画書**。方向性・担当レーン・触ってよいパスだけを固定し、手順と DoD は各 Issue body を正本とする（転記しない — 数値の非複製原則）。
> 前ラウンド = [`2026-07-30-open-issue-fanout-r2.md`](./2026-07-30-open-issue-fanout-r2.md)（13 件全消化・COMPLETED 化と archive 移動は本ラウンドの #591 で実施）

---

## Context

- **動機**: 2026-08-03 時点で **open PR ゼロ・open Issue 7 件のうち 4 件が schedule-refine 担当**で、**他 8 レーンは全員手待ち**だった。既存の文書資産（`mobile-scope.md` / outbox の起票依頼 / known-issues）を全数照合したところタネが枯れていたため、chat-main がコード実測から起票し直したのが本ラウンド
- **実測で分かった負債の所在**（2026-08-03）:
  - web 側のテストが **14 ファイル**しかない（shared は 177）。`NotesView.tsx` 925 行 / `DailyView.tsx` 690 行 / `KanbanView.tsx` 581 行はどれも直接のテストを持たない
  - `shared/eslint.config.js` の baseline 隔離が **13 ファイル**、#421 から 1 行も減っていない
  - 神ファイル: `CalendarTab.tsx` 2185 / `useScheduleMutations.ts` 1020 / `useNotesUnifiedAPI.ts` 967 / `WeekTimeGrid.tsx` 943 / `NotesView.tsx` 925 / `SupabaseNotesUnifiedService.ts` 842
  - 一方で**色ハードコードは 2 箇所のみ**（どちらも正当）、a11y ラベルはボタン数を上回る。規約系の粗はほぼ無い
- **制約**: 実ブラウザ検証は merge 後に chat-main（CLAUDE.md §7.4）。各 worktree は build / 型検証 / vitest まで
- **Non-goals**: Windows 実機・配布（#530 / #512 — 2026-08-03 のユーザー選択で今回の方向性から外れた）/ schedule レーンへのプロンプト配布（稼働中のため Issue 起票のみ）

---

## 方向性（2026-08-03 ユーザー確定）

UI/UX の細かい改善 ／ リファクタ・技術的負債 ／ Mobile 追随 の 3 本立て。起票は chat-main が一元で行い、中身が確定した Issue を各レーンへ配る。

---

## レーン分担

| worktree（実パス）                                                                      | 方向              | Issue       | 触ってよいパス（目安）                                                                        |
| --------------------------------------------------------------------------------------- | ----------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `orca/workspaces/life-editor/workspaces/life-editor/settings-refine`                    | UI/UX（新規要望） | **#585**    | `shared/src/components/briefing/**` `web/src/briefing/**` i18n の briefing 節                 |
| `orca/workspaces/life-editor/refactor-core`                                             | 負債              | **#586**    | `shared/eslint.config.js` + baseline 対象 10 ファイル                                         |
| `orca/workspaces/life-editor/shared-fix`                                                | 負債              | **#587**    | `shared/src/hooks/useNotesUnifiedAPI.ts` `shared/src/services/SupabaseNotesUnifiedService.ts` |
| `orca/workspaces/life-editor/materials-refine`                                          | UI/UX + 負債      | **#588**    | `web/src/notes/**` `web/src/daily/**` `web/src/tasks/**` `shared/src/components/materials/**` |
| `orca/workspaces/life-editor/mobile-refine`                                             | Mobile            | **#589**    | `docs/requirements/mobile-scope.md` `shared/src/components/mobile/**` 各セクションの幅分岐    |
| `orca/workspaces/life-editor/workspaces/life-editor/workspaces/life-editor/work-refine` | UI/UX             | **#590**    | `web/src/work/**`                                                                             |
| `orca/workspaces/life-editor/tags-docs`                                                 | docs              | **#591**    | `.claude/docs/vision/plans/**` `.claude/archive/**`                                           |
| `orca/workspaces/life-editor/schedule-refine`（稼働中・プロンプト無し）                 | UI/UX             | #592 / #593 | 既存の担当範囲                                                                                |

### 衝突しないための縄張り（重要）

同じ Notes 系に 2 レーンが入るので、**層で分ける**:

- **shared-fix (#587)** = `shared/src/hooks/**` `shared/src/services/**`（共有フック / サービス層）
- **materials-refine (#588)** = `web/src/notes/**` ほか画面層

`shared/src/context/TimerContext.tsx` は **refactor-core (#586)** の領分。work-refine (#590) は触らない。
`web/src/schedule/**` `shared/src/components/schedule/**` は **schedule-refine 専有**。他レーンは読み取りのみ。

---

## 貼り付けプロンプト（各 worktree チャットの冒頭にそのまま貼る）

> 各 worktree で `claude` を起動し、以下を最初のメッセージとして貼る。ブランチ切替の 2 ステップ（`git checkout -b` + `.session-branch` 更新）を**プロンプト側に埋め込んである**ので省略しないこと。

### settings-refine（#585 — briefing の削除導線・最優先）

```text
あなたは worktree settings-refine（chat-settings-refine）です。今回は settings ではなく briefing セクションの担当で、Issue は #585 の 1 件です。こうだいさんの新規要望なので最優先で着地させます。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/briefing-585-row-delete origin/main
   echo claude/briefing-585-row-delete > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/briefing-585-row-delete と明示すること。origin/main から切ると upstream が origin/main のまま残り、引数なしの git push が失敗します）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #585 [briefing] 朝刊の予定 / Todo 行に削除ボタンを追加 + 「今日の予定」→「今日のスケジュール」へ改称

方向:
- やることは 3 つだけです。(1) i18n の scheduleTitle を「今日のスケジュール」/ "TODAY'S SCHEDULE" へ改称 (2) 「今日のスケジュール」「今日の Todo」両セクションの各行に、既存の「編集」ジャンプボタンの横に削除ボタンを追加 (3) ルーチン由来の行は Schedule 側の既存 RepeatScopeDialog を流用して「この予定のみ / これ以降 / すべて」を選ばせる
- 「編集」ボタンの振る舞いは変えません。別日に回すのは従来どおりジャンプ先で行う、というのがユーザーの明示指定です
- その場編集パネルは作りません。スコープを広げないこと
- RepeatScopeDialog は import して使うだけで、中身は変更しないこと。変更が要ると判明したら止めて .claude/comm/decisions/chat-settings-refine.md に書き、outbox で chat-main へ報告してください（schedule-refine が稼働中で衝突します）
- web/src/schedule/** と shared/src/components/schedule/** は読み取りのみ。書き換え禁止
- BriefingView は props 注入型です。DataService を直接触らず、削除も BriefingScreen 側からコールバックで渡してください（CLAUDE.md §3.1）
- 削除ボタンは既存の EditJumpButton と同じく可視ラベル + aria-label を持たせること。同ファイルのコメントに「13px のアイコンだけでは読めず押せない」という経緯が書いてあります
- 削除は既存の削除経路を呼ぶこと。新しい削除 API を作らない。Undo に乗るかを実測してから合わせる

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #585）。PR merge はこうだいさんのゲートなので、提出したら待たずに次の指示を待ってください。A/B に割れる判断は .claude/comm/decisions/chat-settings-refine.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-settings-refine.md に append（自分で Issue を立てない）。tracker（memory/ + history/）の更新は実装ブランチに載せず、merge 後にまとめてください（D-20260801-main-1）。
```

### refactor-core（#586 — eslint baseline の解消）

```text
あなたは worktree refactor-core（chat-refactor-core）です。担当は Issue #586 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/refactor-586-eslint-baseline origin/main
   echo claude/refactor-586-eslint-baseline > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/refactor-586-eslint-baseline と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #586 [refactor-core] eslint baseline の隔離 10 ファイルを解消する（テスト先行）

方向:
- shared/eslint.config.js は #421 で「既存の違反をファイル単位で off にして隔離」しています。設定ファイル自身のコメントが "Do not append to these lists; fix the file instead." と書いており、リストから 1 行消すことが「直した」の記録になる設計です
- 順序が肝心です。先にテストで今の挙動を固定してから直すこと。隔離されているのは render のタイミングに関わるルール（render 中の ref 読み書き / effect 内の setState）なので、テストが無い状態で触ると壊れたかどうか誰にも分かりません
- 対象は 10 ファイル。schedule 系 3 本（useCalendarsAPI.ts / useRoutinesAPI.ts / useScheduleItemsAPI.ts）は schedule-refine が稼働中なので今回は対象外で、リストに残したまま触らないこと
- 全部を 1 PR に詰めないこと。1 PR = 数ファイルにして、難しい 1 本のために他が止まらないようにする
- 直せないと判断したファイルは、リストに残したまま理由を Issue にコメントして次へ進む。リストへの追記は禁止
- TimerContext.tsx（work 系）と TagEditModal.tsx（tags 系）は他レーンが触る可能性があります。着手前と作業の区切りごとに git fetch origin して main の先端を確認してください

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #586。分割する場合は最後の PR にだけ Fixes を書く）。A/B に割れる判断は .claude/comm/decisions/chat-refactor-core.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-refactor-core.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

### shared-fix（#587 — Notes 系共有神ファイルの分割）

```text
あなたは worktree shared-fix（chat-shared-fix）です。担当は Issue #587 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/shared-fix-587-notes-split origin/main
   echo claude/shared-fix-587-notes-split > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/shared-fix-587-notes-split と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #587 [shared-fix] Notes 系の共有神ファイル 2 本を分割する（useNotesUnifiedAPI 967 行 / SupabaseNotesUnifiedService 842 行）

方向:
- 挙動変更ゼロの構造改善のみ。機能追加・UI 変更・文言変更・DDL・依存追加は禁止です
- 先例が 3 つあります。web/src/briefing/hooks/（#462）/ web/src/notes/hooks/（#463）/ web/src/MainScreen.tsx（#465）。同じ型・同じ粒度に揃えてください
- 公開インターフェース（useNotesUnifiedAPI が返す value の形、DataService のメソッドシグネチャ）は無改変。import パスが変わるなら shared/src/index.ts の barrel で吸収する
- 切る前に呼び出し元を全数 grep して、影響範囲を Issue にコメントしてから着手すること。useNotesUnifiedAPI は Notes と Daily の両方から使われている可能性があります
- 2 本を同じ PR に詰めないこと。1 ファイル = 1 PR
- web/src/notes/NotesView.tsx（925 行）の分割は materials-refine レーンが #588 で担当します。同じ Notes 系ですが層が違うので、web/src/notes/** は触らないでください

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #587）。A/B に割れる判断は .claude/comm/decisions/chat-shared-fix.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-shared-fix.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

### materials-refine（#588 — NotesView 分割 + テスト整備）

```text
あなたは worktree materials-refine（chat-materials-refine）です。担当は Issue #588 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/materials-588-notesview-split origin/main
   echo claude/materials-588-notesview-split > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/materials-588-notesview-split と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #588 [materials] NotesView 925 行の分割 + materials 3 画面のテスト整備

方向:
- やることは 2 つ。(1) web/src/notes/NotesView.tsx（925 行）を責務ごとに分割 (2) NotesView / DailyView / KanbanView に web/tests/ のテストを敷く
- 順序は「テストを先に書いて、緑に保ったまま切る」。テストが無い状態で 925 行を動かすと壊れたか分かりません
- 分割は先例と同じ型で。web/src/briefing/hooks/（#462）/ web/src/notes/hooks/（#463）/ web/src/MainScreen.tsx（#465）
- 挙動変更ゼロ。機能追加・UI 変更・文言変更は禁止
- web/tests/ の jsdom にはレイアウトがありません（要素の座標が全部 0）。ProseMirror の posAtCoords のような画面座標依存の経路は検証できないので、テストは DOM イベント + closest() のような座標非依存の形で書いてください（CLAUDE.md §7.1）
- IME の gotcha は .claude/rules/frontend.md を先に読むこと
- shared/src/hooks/useNotesUnifiedAPI.ts と shared/src/services/SupabaseNotesUnifiedService.ts は shared-fix レーンが #587 で分割中です。同じ Notes 系ですが層が違うので触らないでください
- web/src/schedule/** は schedule-refine 専有。読み取りのみ

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #588）。テストと分割を別 PR に分けても構いません（その場合 Fixes は最後の PR に）。A/B に割れる判断は .claude/comm/decisions/chat-materials-refine.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-materials-refine.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

### mobile-refine（#589 — mobile-scope の実測照合）

```text
あなたは worktree mobile-refine（chat-mobile-refine）です。担当は Issue #589 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/mobile-589-scope-audit origin/main
   echo claude/mobile-589-scope-audit > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/mobile-589-scope-audit と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #589 [mobile-refine] Epic #321 の残り — mobile-scope 現状維持 9 行のコード実測と追随

方向:
- Epic #321 の実装項目は全部終わっています。残っているのは「現状維持で確定した 9 行（mobile-scope.md #1 / 4 / 8 / 9 / 10 / 12 / 13 / 14 / 15）が本当にスコープ表どおりか」の確認だけです
- 2026-07-30 以降、mobile と無関係な PR が 30 本以上 main に入っています。「現状維持のはず」の行が他レーンの変更で静かにズレている可能性があるので、表に書かれた file:line が今も実在し、書かれた条件分岐が今もその形かを Read / grep で全数確認してください
- 文書同士の突き合わせでは stale を検出できません。必ずコードと突き合わせること（rules/docs-consistency.md §4）
- ズレていたら、表の記述が古いだけなら mobile-scope.md を追随させる。実装が要件から外れているなら直せる範囲で直し、大きければ decisions に書いて outbox で chat-main へ報告する
- 実ブラウザ / 実機での確認は chat-main の担当です。このレーンはコード実測（Read / grep + テスト）まで
- 単一ブレークポイントは 768px（shared/src/components/AppShell.tsx:115）。narrow の見え方は isWide の分岐を読めば機械的に分かります
- web/src/schedule/** は schedule-refine 専有。#4 行（schedule カレンダー）は実測と表の追随までにして、実装のズレは outbox 経由で回してください
- 確認できた行から Epic #321 のチェックボックスを更新。全行終わっても Epic 自体の close はしないで、outbox で chat-main へ依頼してください

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実測 → 追随修正 → session-verifier → PR 作成（本文に Fixes #589）。行ごとの OK / ズレの結果は Issue にコメントで残してください。A/B に割れる判断は .claude/comm/decisions/chat-mobile-refine.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-mobile-refine.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

### work-refine（#590 — Layout Standard v2 adoption）

```text
あなたは worktree work-refine（chat-work-refine）です。担当は Issue #590 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/work-590-section-header origin/main
   echo claude/work-590-section-header > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/work-590-section-header と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #590 [work] Layout Standard v2 adoption — 標準 SectionHeader の導入と余白調整

方向:
- work セクションだけ標準 SectionHeader が入っていません（WorkScreen.tsx に SectionHeader の参照がゼロ）。settings は SettingsScreen.tsx:31 のコメントどおり適用済みなので、そちらを見本にしてください
- あなたの per-chat memory に「v2 共通部品の main merge 待ち + work 用 Issue 未起票」と残っていますが、共通部品はとっくに main にあります。待ち条件は解消済みで、起票されていなかっただけです
- やることは 3 つ。(1) 標準 SectionHeader を入れる (2) ヘッダーが増えた分の縦余白の二重取りを潰す (3) PomodoroSettings の開閉が壊れていないか確認（WorkScreen.tsx:230）
- 他セクションの採用箇所を先に読んで、同じ props・同じ余白の取り方に揃えること。work だけ独自の型にしないでください
- narrow（768px 未満）ではヘッダー行が描画されません（AppShell.tsx の wide 分岐のみ）。ヘッダーに載せた機能が narrow で消えないか確認し、消えるならモバイル側の導線を残してください（mobile-scope.md #10 で work タイマーは Full と確定しています）
- #550 で nav 行に出るようになったタイマー動作中の表示が壊れないこと
- shared/src/components/AppShell.tsx と SectionHeader 本体は他セクションと共有です。変更が要るなら decisions に書いて outbox で chat-main へ
- shared/src/context/TimerContext.tsx は refactor-core レーンが #586 で触ります。触らないでください

共通ゲート: DDL ゼロ / lumen-* トークンのみ / DataService 境界維持 / i18n は en・ja 両 catalog / cd shared && npm run lint・npm run test・npm run build、cd web && npm run lint・npm run build・npm run test がすべて exit 0 / 実ブラウザ検証はしない（merge 後に chat-main が実施）

進め方: task-tracker で開始を記録 → 実装 → session-verifier → PR 作成（本文に Fixes #590）。A/B に割れる判断は .claude/comm/decisions/chat-work-refine.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-work-refine.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

### tags-docs（#591 — plans/ Status 棚卸し第 2 弾）

```text
あなたは worktree tags-docs（chat-tags-docs）です。担当は Issue #591 の 1 件です。

まず着手前の同期とブランチ切替を済ませてください:
1. git pull --ff-only
2. git fetch origin && git merge origin/main --no-edit
3. git checkout -b claude/tags-docs-591-plans-status origin/main
   echo claude/tags-docs-591-plans-status > .claude/comm/.session-branch
   （初回 push は git push -u origin claude/tags-docs-591-plans-status と明示）

担当 Issue（body が正本・DoD はそちらを読むこと）:
- #591 [tags-docs] plans/ の Status 棚卸し第 2 弾 — fanout-r2 の COMPLETED 化と archive 移動

方向:
- 前ラウンドの計画書 2026-07-30-open-issue-fanout-r2.md が IN PROGRESS のまま plans/ に残っています。中身の 13 件は全件 close 済みなので、COMPLETED 化して archive へ移してください
- あわせて plans/ の残りも Status を再実測。特に IN PROGRESS の 3 本（2026-06-19-step1-desktop-daily-driver / 2026-07-14-schedule-redesign / 2026-07-28-loop-engineering-harness）
- 判定の正は gh issue list --state all / gh pr list --state all の state です。git diff / git log / git cherry でのマージ判定は禁止（squash merge は未マージに見えます — CLAUDE.md §7.4）
- 文書同士の突き合わせでは stale を検出できません。必ず git・コード・Issue state と突き合わせること
- 全数チェックは grep -n "^Status:" では足りません。各ファイル先頭 14 行に ^>?\s*Status: と ^>?\s*-?\s*\*\*Status[^*]*\*\*: の両方を当ててください（#474 で 2 本見落とした実測があります）
- enum を当てるのは plans/ 由来の文書だけ。archive/ に同居する要件定義書・棚卸しメモの SPECIFICATION / ARCHIVED は文書種別を表す語なので enum 化しない（D-20260801-main-2）
- 迷ったものは動かさず、Issue にコメントして chat-main へ回してください
- archive へ移動したら参照側の相対リンクを追随させること（#528 で 6 本壊れた実績あり）
- 対象外: 2026-05-04-cross-platform-migration.md（移行 SSOT・生きている）/ 2026-08-03-open-issue-fanout-r3.md（本ラウンドの計画書）/ .claude/CLAUDE.md（他レーンと衝突しやすいので outbox 経由）
- scripts/docs-lint.sh をローカルで回すときは LC_ALL=C を付けてください（Git Bash の grep 3.0 + UTF-8 locale では日本語を含む Status 行が偽陽性になります）

共通ゲート: DDL ゼロ / diff が .claude/ 配下に限られること / LC_ALL=C scripts/docs-lint.sh が exit 0 / 実ブラウザ検証は不要

進め方: task-tracker で開始を記録 → 実測 → 更新 → session-verifier → PR 作成（本文に Fixes #591）。plans/ 全ファイルの照合結果は Issue にコメントで残してください。A/B に割れる判断は .claude/comm/decisions/chat-tags-docs.md に書いて進む。起票が必要な発見は .claude/comm/outbox/chat-tags-docs.md に append。tracker の更新は実装ブランチに載せず merge 後にまとめる（D-20260801-main-1）。
```

---

## chat-main の担当（このラウンド中）

- 7 レーンの PR 進捗の追跡と、各レーンの outbox / decisions の回収 → Issue 起票・回答転記
- **merge 後の実ブラウザ検証**（本ラウンド用の検証計画を別途作成）
- schedule-refine が #564 / #573 / #572 を終えたら #592 / #593 を渡す
- PR merge そのものはこうだいさんの手番（🛑）

---

## Acceptance Criteria（ラウンド完了の条件）

- [ ] 9 件（#585 / #586 / #587 / #588 / #589 / #590 / #591 / #592 / #593）がすべて close または「不要と判断 + 根拠コメント」で決着
- [ ] Epic #321 の残り 1 行にチェックが入り、Epic 自体が close できる状態になっている
- [ ] `2026-07-30-open-issue-fanout-r2.md` が COMPLETED で archive にある
- [ ] merge 後の実ブラウザ検証が chat-main で完了している
- [ ] 本計画書を COMPLETED にして `.claude/archive/` へ移動

---

## 別件（本ラウンドの対象外・chat-main が処理）

- **worktree のパスが入れ子になっている**: `settings-refine` は `workspaces/life-editor/` を 2 回、`work-refine` は 3 回繰り返したパスにある。`git worktree add` を相対パスで実行した結果と見られる。動作に支障は無いが、パスが長くなり `git worktree list` も読みにくい。作り直すならブランチを空にしてから
- **merge 済みブランチが origin に 60 本以上残っている**: 掃除の要否はユーザー判断
- **tmp-claudemd-slim / tmp-tap-target**: どちらも PR #578 / #580 が merge 済みの一時 worktree。用済みなら削除
- **win-verify**: `.claude/comm/.session-branch` と `.session-name` が空。#530（Windows 実機起動確認）を回すならここが受け皿になる

---

## References

- CLAUDE.md §7.4（worktree / ブランチ運用）・§9（Issue dispatch / decision queue）
- 前ラウンド: [`2026-07-30-open-issue-fanout-r2.md`](./2026-07-30-open-issue-fanout-r2.md)
- Epic: #290（Schedule redesign・schedule-refine）/ #321（Mobile UI/UX 追随）
- 関連 memory: `push-after-merge-strands-commits` / `stacked-pr-base-retarget-race` / `all-label-issue-collision`

---

## Worklog

- 2026-08-03: 現状実測（open PR ゼロ / open Issue 7 件のうち 4 件が schedule-refine / 他 8 レーン手待ち）→ 既存文書資産のタネ枯渇を確認（mobile-scope 全行完了・outbox 依頼はほぼ起票済み）→ コード実測から 9 件を起票 → 7 レーン分の貼り付けプロンプトを作成。方向性 3 本立てと起票主体は 2026-08-03 のユーザー選択
- 2026-08-03: briefing の削除導線（#585）と schedule の 2 件（#592 旧名称統一 / #593 Todo チップのアクセント）はこうだいさんからの新規要望。#585 のルーチン行の扱いは「Schedule のパネルを流用して選択可能にする」で確定
