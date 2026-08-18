# chat-briefing-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

## 2026-08-18 → @chat-main（#1048 の follow-up Issue 起票依頼: write_briefing の focus 引数）

#1048 でフォーカス行の読み取りを Daily の朝刊セクションから外し、専用ノート `note-focus`（日付キー付きセクション・#872 の目標ノート方式）へ移しました。shared の `extractBriefing` は朝刊セクションの**全段落を AI コメント**として読む形になっています。

これに伴い **MCP `write_briefing` の `focus` 引数が宙に浮いています**: ツールは今も focus を先頭段落として Daily に書きますが、朝刊はそれをフォーカス行としては読まず、AI コメントの 1 段落目として表示します（Issue #1048 の Scope が shared + web だったため、mcp-server 側の API は温存しました。round-trip テストだけ新契約に追随済み）。follow-up として「write_briefing から focus 引数を外す（または note-focus へ書くよう変える）」の Issue 起票をお願いします。宛先は section:briefing が妥当です。

---

## 2026-08-16 → @chat-main（#892 完了・CLAUDE.md §7.1 の記載漏れ 1 件）

**#892 = PR #924（CI 緑・merge 待ち）**。Briefing のデータ層 2 本にテスト 50 本を足し、その足場の上で `useBriefingData`（830 行）を fetch / aggregation / writes の 3 本へ分けました。返り値は 1 キーも変えていません。tracker は PR #925。

**実機確認の重点**（merge 後にお願いします — #892 DoD の残り 1 項目）: 朝刊 / 夕刊の表示・Todo 追加・持ち越し。UI に見える変更はありませんが Tier 1 画面のデータ層を丸ごと組み替えたので、取得が空振りしていないか（朝刊が静かに空にならないか）を実画面で 1 度見ていただきたいです。

**CLAUDE.md §7.1 の記載漏れ（要更新）**: 開発コマンドのブロックに **`npm run typecheck:tests`（`tsc -p tsconfig.test.json --noEmit`）が shared / web とも載っていません**。これは `.github/workflows/ci.yml` にある独立した CI ゲートで、`npm run build`（`tsconfig.app.json` / `include: ["src"]`）では**テストファイルを一切見ない**ため、ローカルで lint / build / test を全部緑にしても CI だけが落ちます。実際に今回それで PR #924 の 1 回目が落ちました（`TodoNodeType` が `"task"` 単値なのにテストが `type: "folder"` を渡していた — vitest は型を見ないので通ってしまう）。

§7.1 は「PR 前は上のブロックの lint / build / test をすべて回す」と書いてあり、その通りにしても足りない状態です。同じ節が既に「web の lint は web/ 配下しか歩かない」「TypeScript の版が web だけ違う」という同種の罠を明文化しているので、そこに 2 行足すのが自然だと思います:

```
cd shared && npm run typecheck:tests   # テストファイルの型検査（CI ゲート・build では見ない）
cd web && npm run typecheck:tests      # 同上
```

CLAUDE.md は全レーンが触る共有ファイルで、並行 PR で必ず衝突するため自分では編集していません。判断と反映をお願いします。

なお `cd shared && npm run typecheck:tests` はこの Windows 機のローカルでは `error TS2688: Cannot find type definition file for 'node'` で落ちます（`shared/node_modules` に `@types/node` が無い）。CI では通っているので環境差です。ローカル手順として書くなら一言添えるか、`npm ci` のやり直しが要るかもしれません。

**2026-08-16 追記（同じ罠で 2 回目）**: 上の記載漏れ、本日 PR #980（#955）でもう一度踏みました。ローカルで shared / web の lint・build・test を全部緑にして push したのに、CI の `web — typecheck tests` だけが落ちています（`DailyNode` に存在しない `type` フィールドをテストの fixture が渡していた）。`npm run build` が `web/tests/` を見ないという同じ理由です。1 日に 2 本の PR が同じ穴に落ちているので、§7.1 への 2 行追加の優先度を上げてもらえると助かります。
