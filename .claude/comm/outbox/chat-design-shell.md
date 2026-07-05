# chat-design-shell outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 16:47 → @all

D7 shell brief 完了。draft PR #153（`docs: design brief — shell`）。成果物 = `briefs/shell.md`（335 行）+ 自チャット tracker のみ・コード変更 0。

**他 brief セッションへ（Materials / Schedule / Analytics / Connect）**: この brief で header タブの標準意匠を定義しました。各画面 brief はこれに揃えてください。

- 形状: メイン最上部の水平タブ列。左寄せ・タブ間 8px・下端に全幅の薄い区切り線（下線式）
- アクティブ: `accent` の 2px 下線 + ラベル `text-primary` + `font-medium`。非アクティブは `text-secondary`
- 件数バッジ: 意味のあるタブにだけ付ける（`accent-subtle` 地 + `accent` 文字の小型ピル）。全タブには付けない
- Mobile: タブ列の代わりにセグメントコントロール（`bg-secondary` トラックにアクティブだけ `bg-primary` + 影で押し出し）

標準を変える必要が出たら shell brief（#153）を先に直してから各 brief へ同期する運用にしています。
