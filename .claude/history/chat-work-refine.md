# HISTORY (chat-work-refine)

### 2026-08-13 - #781 残り 3 箇所の window.confirm / alert を ConfirmDialog へ

#### 概要

裁定 D-20260811-refactor-2 = B に従い、main `da8993dd` 時点で残っていたブラウザ標準ダイアログ 3 箇所（Kanban の変換確認 / 子持ち Todo の拒否 / Settings のリセット確認）をアプリ内 `ConfirmDialog`（#707）へ載せ替えた。PR #810 open（Closes #781・merge = 人手 P-001）。

#### 変更点

- **KanbanView の変換 2 箇所**（`web/src/tasks/KanbanView.tsx`）: 確認は `itemConvert.toEvent` / `common.cancel`、子持ち拒否は **cancel ラベル無しの acknowledge 形**（`common.ok`）。Schedule 側（`CalendarTab.tsx` の同名フロー）と同じ形に揃えた — alert を Toast にしなかった理由はこれ（P-006 として PR 本文にも記載）
- **Settings のリセット**（`web/src/settings/SettingsScreen.tsx`）: `danger` 指定 + 新規 `settings.reset.confirmButton`（en / ja lockstep）。`resetLocalPreferences()` は `.then` の中だけに置いた
- **非同期化の罠を明示的に固定**: 標準 confirm はその場で答えが返るが ConfirmDialog は 1 tick 後。旧形のまま書くと「開いた瞬間に変換 / 設定全消し」が走る。`beginConvert`（#434 の in-flight 主張）は答えが返った直後に同期で立てる形を維持
- **テスト**: `web/tests/kanbanView.test.tsx` の変換 describe を全面更新（`window.confirm` spy 撤去・キャンセルで変換 0 件を含む 6 件）/ `web/tests/settingsScreen.test.tsx` 新規 3 件（質問中は未呼び出し・拒否で 0 回・確定で 1 回）
- **grep 0 件化**: 説明文として `window.confirm` を含んでいたコメント 5 ファイル分を言い換え（`ConfirmDialog.tsx` / `components/index.ts` / `TagEditModal.tsx` / `CalendarTab.tsx` / `unsavedCloseGuard.ts`）。禁止が grep で機械的に確認できる状態にするため。挙動変更なし
- **検証**: shared lint（0 error）/ build / test 1980、web lint / build / test 275、`scripts/docs-lint.sh` OK — すべて exit 0。実ブラウザ確認（リセットのキャンセルで何も消えない）は merge 後 chat-main（§7.4）

### 2026-08-10 - #590 Layout Standard v2 adoption（work）

#### 概要

work セクションの Layout Standard v2 採用。Issue の前提「WorkScreen に SectionHeader 参照がゼロ」は見るファイルが違っただけで、標準ヘッダーは既に出ていた（`web/src/MainScreen.tsx:312` の既定分岐がタブ帯を持たないセクション全部に `title=section.work` 付き `<SectionHeader>` を渡している）。残っていた「タイマー面との縦の余白・視覚的な重複の調整」だけを実施し PR #641 で提出（open・merge = 人手 P-001）。

#### 変更点

- **カードスタックのリズム統一**: wide 分岐の `gap-4` → `gap-6`。先に v2 を採用した Settings（`SettingsScreen.tsx:160`）/ Trash（`TrashScreen.tsx:174`）と同値で、work だけが孤立値だった（P-006 = 余白のミクロ判断は既存パターン踏襲）。スタック自身は最初のカードの上に padding を足さないため、ヘッダー行と PageContainer の `py-6` が二重取りにならないことを確認
- **stale コメント解消**: ファイル冒頭の `width="reading"` 中央寄せの記述が #210/#305 の wide 統一で古くなっていた分（v2 計画 Worklog が「adoption で解消」と明記していた宿題）
- **テスト新規 3 件**（`web/tests/workScreenLayout.test.tsx`）: body がセクション名をどこにも出さない（画面上の heading は shell の 1 つだけ）/ `PomodoroSettings` が detail panel で開閉し body 側に出ない / 768px 未満でタスクピッカーと設定が両方到達可能。timer は Sync Provider 依存を避けるためローカル stub（#590 のスコープが `TimerContext.tsx` 非接触のため）
- **非変更の確認**: `SectionHeader` 本体・`AppShell.tsx` の diff ゼロ（DoD）。i18n 差分ゼロ
- **検証**: shared lint（0 error）/ test 1512 / build、web lint / build / test 127 — すべて exit 0。余白の見た目確認は jsdom にレイアウトが無いため merge 後 chat-main（§7.4）

### 2026-07-11 - #181 work 行消化（Layout Standard v1 adoption）

#### 概要

WorkScreen の独自レイアウトフレームを撤去し、MainScreen 側 PageContainer（width="reading", #180）へ幅・gutter・スクロールの所有権を移譲した。draft PR #192 で提出（merge = 人手ゲート）。

#### 変更点

- **WorkScreen desktop 分岐**: `max-w-[720px]` + `px-8` + `pb-6 pt-2` を撤去し `flex flex-col gap-4` のみに（commit 910af963）
- **WorkScreen mobile 分岐**: `px-6 pb-4 pt-3` を撤去（fullscreen タイマーは `min-h-[72dvh]` 自己完結・横は標準 gutter で充足）
- **検証**: shared build + test（94 files / 768 tests）+ web build pass。role-qa 独立レビュー PASS（ポータル/モーダルの clipping・stacking 影響なし実測確認）
- **docs**: orders 台帳に消化記録を追記（commit cc1833b0）。#181 は本文編集権限が無かったためコメントで代理チェックを依頼

### 2026-07-11 - #181 work 行の消し込み（PR #192 merged 確認）+ orders sync

#### 概要

セッション開始時に origin/main を取り込み（merge 成功・衝突は orders ファイル 1 行のみ・解消済み）。自分宛 Issue を確認: `section:work` 0 件 / `shared-fix` は #181 `[all]` のみ。#181 の work 行は PR #192 が既に merged だったため消し込みのみ。

#### 変更点

- **#181 消し込み**: main 上で WorkScreen が PageContainer 移譲済み（独自フレーム撤去・残 `max-w-full` はチップ用）を実測確認 → #181 本文 work 行を `[x]` にチェック（前回は merge 前で権限問題により代理依頼だった）+ 確認コメント（issuecomment-4944633540）。close は残行あり（schedule/settings/trash）のため chat-main 判断
- **orders sync = PR #232**（docs-only・claude/work-refine → main, commit 02689d5e）: #181 行を「完了」へ更新 + 未コミットの merge 衝突解消を同梱。orders .md ledger 方式は retire 済みのため chat-main 判断で archive 可の旨を PR body / outbox に明記
- **予告**: work の幅 wide 統一 + 標準ヘッダー新設後の余白調整は v2 adoption（Issue 未起票・起票は chat-main）で追随
