# Decisions — chat-mobile-refine

> 自分の判断待ちのみ append（新しいものを上に）。回答は `ANSWERS.md` を参照。

（回答済み 3 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260730-mobile-1 / D-20260730-mobile-2 / D-20260730-mobile-3。台帳化とキューからの除去は chat-main が代行した）

### D-20260810-mobile-3: Notes の FAB を本当に画面へ貼り付けるために、Materials のスクロール所有権を動かすか

- 背景: #632 で FAB を共有部品（`shared/src/components/MobileFab.tsx`・PR #660）に一本化したが、**Notes だけ「貼り付き」が未達**。Materials は full-bleed 扱いでないため `PageContainer` の `width="wide"` で描画され（`web/src/MainScreen.tsx:220-222`）、この分岐はページ側がスクローラでその中身は高さ auto（`PageContainer.tsx:70-76`）。よって FAB の基準になる `NotesView.tsx:387` の `relative` ルート（と `NotesMobileList.tsx:109` の `h-full`）は auto に落ち、FAB は**セクションの箱ではなくリストの末尾**に貼り付く（横もページ余白 16px の内側なので右端から 40px。Schedule は 24px）
- A: **narrow のときだけ Materials を fluid 変種にする**（`ownsFullBleed` に `!isWide && section === "materials"` を足す。これで `NotesMobileList` の既存の内側スクローラ `pb-24` が本来の役割を持ち、FAB がセクションの箱に貼り付く。ただし **Daily のスクロール所有権も同時に動く**ので、Notes / Daily 両方をモバイル実機で見てからでないと安全と言えない）
- B: **現状維持**（Notes の FAB はリスト末尾に付いたまま。共有部品によりサイズ・オフセット・基準の記述は 1 本化されており、#632 の「画面ごとに違う」は Schedule 側の実害だけ潰した状態で着地する）
- 放置時: B（PR #660 は既に B の状態で出してある。`MobileFab` の HOST CONTRACT と `NotesMobileList.tsx:248-258` の呼び出し箇所に「Notes は契約の後半を満たしていない」と明記済みなので、誤解は残らない）
- 期限感: いつでも。A を選ぶ場合は `web/src/MainScreen.tsx` が対象で #632 のスコープ外になるため、別 Issue を chat-main に起票してもらう（outbox 済み）

### D-20260810-mobile-2: 「Consumption = 編集不可」の語を実態に寄せるか、実装を絞るか

- 背景: #589 の実測。目標列が Consumption の 2 行が、実際はモバイルからも書き込める。**#1 briefing** = 予定 / Todo / 持ち越しの完了トグル（`shared/src/components/briefing/BriefingView.tsx:330,384,461`）と夕刊の気分★（`EveningView.tsx:195`）。**#4 schedule** = 行タップで開く編集シート（`web/src/schedule/CalendarTab.tsx:2262` ← `:1498`）・FAB の新規作成・完了トグル。いずれも #168 / #249 / #266 / #274 由来で、スコープ表を書いた 2026-07-23 時点から同じ配線（**退行ではない**）
- A: **語のほうを実態に合わせる**（推奨 — §1 の「Consumption = 閲覧・確認のみ（編集不可）」を「閲覧が主。完了トグル等の 1 タップ更新は含む」に緩めるか、#1 / #4 の目標列を「Consumption + Quick capture」に書き換える。実装は 3 週間以上動いていて不都合の報告がなく、モバイルで予定に✓を付けられないほうがむしろ不便）
- B: 実装を目標語に合わせて絞る（モバイルの完了トグルと編集シートを塞ぐ。#4 は `web/src/schedule/**` = schedule-refine の担当なのでハンドオフが要る）
- 放置時: A 相当（実装はそのまま）。スコープ表 §4 には実測どおりの挙動を明記済みなので、読み違いは起きない
- 期限感: いつでも（判断が付いたら §1 の定義 or #1 / #4 の目標列を 1 行直すだけ）

### D-20260810-mobile-1: narrow から書き換えられる「タグの色」を残すか塞ぐか

- 背景: #589 の実測。スコープ表 #9 の目標は「閲覧 + 名前のみ追加」で、改名 / 削除 / アイコン編集は wide 限定のまま（タグマスタのモーダルはサイドバーからしか開けない）。ところが**色だけ例外**で、#551 / #566 が予定の詳細シートに `TagColorControls` を入れたため（`web/src/schedule/CalendarTab.tsx:1540`）、narrow ではそれが BottomSheet（`:2262`）に載って `setTagColor` がタグマスタを書き換える
- A: **現状維持で目標列を「閲覧 + 名前のみ追加 + 色」に改める**（推奨 — 色は見た目の調整で、改名・削除のような取り返しのつかなさがない。予定にタグを付けた直後に色を整える動線としても自然）
- B: narrow では `TagColorControls` を隠して目標どおりに戻す（実装は `web/src/schedule/**` = schedule-refine の担当なのでハンドオフが要る）
- 放置時: A のまま（実装は動いている）。スコープ表 #9 には「⚠️ スコープ超過」と明記済み
- 期限感: いつでも
