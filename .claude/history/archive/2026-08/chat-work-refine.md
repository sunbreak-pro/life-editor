# HISTORY ARCHIVE (chat-work-refine, 2026-08)

ローリングアーカイブ: `history/chat-work-refine.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-10 - #590 Layout Standard v2 adoption（work）

#### 概要

work セクションの Layout Standard v2 採用。Issue の前提「WorkScreen に SectionHeader 参照がゼロ」は見るファイルが違っただけで、標準ヘッダーは既に出ていた（`web/src/MainScreen.tsx:312` の既定分岐がタブ帯を持たないセクション全部に `title=section.work` 付き `<SectionHeader>` を渡している）。残っていた「タイマー面との縦の余白・視覚的な重複の調整」だけを実施し PR #641 で提出（open・merge = 人手 P-001）。

#### 変更点

- **カードスタックのリズム統一**: wide 分岐の `gap-4` → `gap-6`。先に v2 を採用した Settings（`SettingsScreen.tsx:160`）/ Trash（`TrashScreen.tsx:174`）と同値で、work だけが孤立値だった（P-006 = 余白のミクロ判断は既存パターン踏襲）。スタック自身は最初のカードの上に padding を足さないため、ヘッダー行と PageContainer の `py-6` が二重取りにならないことを確認
- **stale コメント解消**: ファイル冒頭の `width="reading"` 中央寄せの記述が #210/#305 の wide 統一で古くなっていた分（v2 計画 Worklog が「adoption で解消」と明記していた宿題）
- **テスト新規 3 件**（`web/tests/workScreenLayout.test.tsx`）: body がセクション名をどこにも出さない（画面上の heading は shell の 1 つだけ）/ `PomodoroSettings` が detail panel で開閉し body 側に出ない / 768px 未満でタスクピッカーと設定が両方到達可能。timer は Sync Provider 依存を避けるためローカル stub（#590 のスコープが `TimerContext.tsx` 非接触のため）
- **非変更の確認**: `SectionHeader` 本体・`AppShell.tsx` の diff ゼロ（DoD）。i18n 差分ゼロ
- **検証**: shared lint（0 error）/ test 1512 / build、web lint / build / test 127 — すべて exit 0。余白の見た目確認は jsdom にレイアウトが無いため merge 後 chat-main（§7.4）
