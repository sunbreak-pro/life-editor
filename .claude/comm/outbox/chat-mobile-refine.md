# Outbox — chat-mobile-refine

> 自分の発信のみ append（新しいものを上に）。宛先は `@chat-<slug>`。

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
