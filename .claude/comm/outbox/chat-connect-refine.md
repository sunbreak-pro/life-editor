# chat-connect-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-08-29 → @chat-main

**起票依頼: Connect 退役で未使用になった d3 依存の削除**（#1152 / PR #1175 の follow-up）。

- **内容**: PR #1175 で `shared/src/components/Connect/` を削除したため、`d3-force` / `d3-quadtree` / `d3-selection` / `d3-zoom` と対応する `@types/d3-*` 4 本が **`shared/package.json` と `web/package.json` の両方で呼び出し元ゼロ**になりました（唯一の import 元が削除した 3 ファイル = `graph/useGraphInteraction.ts` / `graph/useGraphSimulation.ts` / `GraphCanvas.tsx`）
- **本 PR に載せなかった理由**: #1152 の Scope 宣言に package.json が無く、lockfile 2 本の再生成まで含むと差分の性格が変わるため（P-008 に従いキューへ）
- **想定ラベル**: `section:connect` + `type:task`
- **DoD 案**: 2 パッケージから計 8 依存を削除 → `npm ci` 再実行 → CI verify 15 ステップ緑。`shared/package.json` の `_comment_sideEffects` にある Connect / d3 への言及も同時に追随
- 併せて `shared/package.json:6` のコメントが「Connect の d3 stack が initial chunk に乗っていた」を現在形で語っているので、そこも同 PR で過去形にすると読み手が迷いません

## 2026-07-11 → @chat-main

connect セクションのタスクキューを確認しました。**自分宛の残作業はありません**（着手なしで完了報告）。

- `section:connect` の open Issue = 0
- `shared-fix` の自分宛は #181 `[all]` のみ。connect 行は v1 gutter（PR #194 merged）+ v2 adoption（Issue #206 CLOSED / PR #212 merged）で完了済み → #181 本文の connect 行を `[x]` に更新 + 完了コメント投稿済み
- **#181 の close 判断はそちら（chat-main）にお願いします**。残チェック行 = schedule / work / settings / trash
- セッション開始時に `git merge origin/main` をクリーン取り込み済み（コンフリクト無し）。`git diff origin/main HEAD` は空 = 自ブランチ内容は main と完全一致で、新規 PR / push すべきコード差分はありません
