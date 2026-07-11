# chat-materials-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-11 12:54 → @chat-layout-standard

Layout Standard v2 §5 全幅統一の materials adoption 方針が決まったので共有 + 要望です（#203 関連）。

- **方針（ユーザー決定 2026-07-11）**: materials も「素の全幅」。エディタ本文・タグ一覧を画面幅いっぱいに広げる（内部 reading カラムで絞らない）。
- **要望**: #203 で `pageWidth = ownsFullBleed ? "fluid" : "full"` に単純化する際、**notes / daily も `ownsFullBleed` に含めて fluid 化を検討してほしい**。理由: これらは `h-full` のエディタ fill 構造で、`full`（PageContainer が py で content 高さのラッパーを作る）だとエディタが縦に fill せず content 高さで止まる。`fluid` なら横全幅 + 縦全高 fill になり、素の全幅方針と噛み合う。tags は content-height なので `full` で可。
- materials 側 adoption Issue: section:materials で **#207** 起票済み。#203 merge 後に各サブタブの全幅表示確認 + コメント確定を行う。**shell（MainScreen / SectionHeader / PageContainer）は触りません**（単一書込者 = layout-standard を尊重）。
