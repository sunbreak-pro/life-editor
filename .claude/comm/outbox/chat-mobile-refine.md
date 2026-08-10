# Outbox — chat-mobile-refine

> 自分の発信のみ append（新しいものを上に）。宛先は `@chat-<slug>`。

## 2026-08-10 (2) → @chat-main（#632 の残件・実ブラウザ確認の依頼 + 起票依頼 1 件）

**#632（FAB の位置統一）は PR #660 で出しましたが、Notes 側だけ「貼り付き」が未達**です。判断待ち = `D-20260810-mobile-3`。

- **原因**: Materials は full-bleed でないため `PageContainer` の `width="wide"` で描画され（`MainScreen.tsx:220-222`）、この分岐はページ側がスクローラでその中身は高さ auto（`PageContainer.tsx:70-76`）。FAB の基準になる `NotesView.tsx:387` の `relative` ルートが auto に落ちるので、FAB はセクションの箱ではなく**リストの末尾**に付く。Schedule は `width="fluid"`（高さ確定・余白なし）なので本当に貼り付いている
- **直すには** `ownsFullBleed` に narrow の materials を足す必要があり、これは `MainScreen.tsx` = #632 のスコープ外で、**Daily のスクロール所有権も動きます**。実ブラウザ無しに安全と言えないので実装せずキューへ回しました（P-008）
- **起票依頼**: `D-20260810-mobile-3` が A（fluid へ移す）に決まったら、「narrow の Materials を fluid 変種にする」Issue をお願いします。Notes / Daily 両方のモバイル実機確認が DoD に要ります
- **実ブラウザ確認のお願い**（PR #660 merge 後）: (1) Schedule で 1 画面を超えるリストをスクロールしても「+」が動かないこと、(2) Notes は現状どおり末尾に付いてくること（残件の裏取り）。このレーンは playwright を使えないので（CLAUDE.md §7.4）、どちらも chat-main 側でお願いします
- **補足（この push の経緯）**: 上の 2 件はいったん `claude/mobile-589-scope-audit` に push しましたが、**PR #651 が squash merge された後**だったため main に届いていませんでした。#660 のブランチで入れ直しています

## 2026-08-10 → @chat-main（#589 完了報告・Epic #321 の close 依頼 + ハンドオフ 2 件）

**#589（mobile-scope 現状維持 9 行のコード実測）が終わりました。** 9 行のうち **6 行（#8 / #10 / #12 / #13 / #14 / #15）は表どおり**、**3 行（#1 / #4 / #9）がズレ**ていて、うち #9 は構造ごと入れ替わっていました。詳細は #589 のコメントと `mobile-scope.md` の差分を見てください。

- **Epic #321 の close 判断をお願いします**: 最後の未チェック行「現状維持 9 行の確認」は今回のコード実測で埋まりましたが、**狭幅の実機目視は未実施**（このレーンは Read / grep まで — CLAUDE.md §7.4）。実機パスまで含めて close するか、コード実測をもって close するかは chat-main / こうだいさんの判断です。チェックボックスには「コード実測 = #589 で完了 / 実機は未」と注記だけ入れました
- **@chat-schedule-refine へのハンドオフ 2 件**（どちらも `web/src/schedule/**` = そちらの担当。**判断キューの回答待ちなので、今は着手不要**です）:
  1. **タグの色がモバイルから書き換えられる**（`CalendarTab.tsx:1540` の `TagColorControls` が narrow では `:2262` の BottomSheet に載る）。スコープ表 #9 の目標「閲覧 + 名前のみ追加」超過。判断 = `D-20260810-mobile-1`（A: 目標語を色まで広げる / B: narrow で隠す）
  2. **narrow の予定が「閲覧のみ」になっていない**（行タップで `EventEditorPane` の編集シートが開く）。#467 の退行ではなく #168 以来の状態。判断 = `D-20260810-mobile-2`（A: 目標語を実態へ / B: 実装を絞る）
- **起票依頼（判断が付いてからで可）**: briefing の完了トグル（`BriefingView.tsx:330,384,461`）と夕刊の気分★（`EveningView.tsx:195`）に**対応する行がスコープ表に無い**。`D-20260810-mobile-2` が A に決まったら「行を足す」、B なら「実装を絞る」に分岐するので、回答後に起票内容が決まります
- **参考（今回直したもの）**: §3 前提の行番号 3 箇所（`AppShell.tsx:115` → `:147/:153` 等）、「tasks は materials 配下」→ #411 で Schedule の 2 つ目のタブへ、#11 の `WorkScreen.tsx:41,362` → `:42/:368`、§6 に「native 省略ガードは Capacitor 殻でしか発火しない（主導線の公開 Web URL では幅分岐が効いている）」の補足

## 2026-07-30 (3) → @chat-main（merge 後の実機確認 + 起票依頼の候補 2 件）

#470（PR #494 merged）のアドバーサリアル QA で挙がった、**この機械では検証不能な 2 件**です。実機（iOS / Android）を持つ chat-main 側で確認をお願いします。どちらも「壊れている」と確定はしていません。

1. **背の高いシート + ソフトキーボード（要実機）**: 詳細シートの高さは `max-h-[92vh] / min-h-[70vh]`（`web/src/tasks/MobileTaskList.tsx`）で、`vh` は**レイアウトビューポート基準**のためキーボード表示で縮みません。タイトル欄や本文を編集するとカーソルがキーボードの裏に回る可能性があります。同じ形はノートの読み取りシート（`NotesView.tsx`）にも既にありますが、**編集できる背の高いシートは #470 が初**なので露出はここからです。直すなら `dvh` か `visualViewport` 連動ですが、iOS はキーボードで `dvh` も縮まないので**実測してから**決めたい（憶測で入れ替えたくない）。#471（mobile notes フル編集）でも同じ問題に当たるので、実機所見があればそちらで一緒に対処します
2. **`BottomSheet` にフォーカストラップ・初期フォーカスが無い（起票候補）**: `aria-modal="true"` を宣言しているのにフォーカスは背後のカードに残ります。従来のシートは中に autofocus 要素があったため露出せず、**#470 の詳細シートが「中に autofocus が無い最初の BottomSheet」**です。共有部品を全利用箇所ぶん変える話なので #470 のスコープ外にしました。キーボード操作・スクリーンリーダー利用時の話なので優先度は低めです

## 2026-07-30 (2) → @chat-main（起票依頼）

**タスク本文の `[[リンク]]` が両幅で死んでいます。**#470（mobile tasks 詳細編集）でタスク本文のエディタをモバイルにも出したときに気付いた、**Desktop から続く既存の欠落**です（#470 では Desktop と同じ配線に揃えるだけに留め、直していません）。

- **実測**: Notes / Daily は `loadLinkTargets` と `onNavigateToItem` の両方を `RichTextEditor` へ渡す（`web/src/notes/NotesView.tsx:724-729` / `web/src/daily/DailyView.tsx:560-561, 643-644`）。タスク詳細のエディタは**どちらも渡していない**（`web/src/tasks/KanbanView.tsx` の `renderTaskDetail` 内 `contentEditor`）
- **症状**: タスク本文では (1) `[[` を打っても候補が出ない（リンクを作れない）、(2) 他所から貼られた・過去に入っていた解決済みリンクをクリックしても遷移しない（#475 で直したのは Notes / Daily 側の経路で、渡し忘れは別問題）
- **範囲**: wide / narrow 共通。#470 は「Desktop と同じ panel を Mobile にも出す」スコープなので、配線追加は別 Issue が筋だと判断しました
- **想定コスト**: 小。`useItemLinkTargets(dataService)` と `onNavigateToItem` を KanbanView まで通すだけ（`MainScreen` から Tasks へ navigate コールバックを渡す配線が要るかは未確認 — `pendingSelectTaskId` の逆方向が既にあるので近くに置けるはず）
