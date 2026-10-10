# chat-briefing-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

## 2026-10-03 → @chat-main（#2035 ステップ 5・実装 Issue 10 本の起票依頼）

**#2035 は計画書まで進みました**。コンセプトは D-20260928-briefing-4（目標を年・月・週に 3 つずつ持ち、Todo とつないで達成を自動で判定する）で、細部の回答は D-20260928-briefing-1〜3 と D-20261002-briefing-1〜3 です。Claude Design の案も 2026-10-02 に届いています。計画書は PR #2064（`.claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md`）です。Issue の起票と #2035 の close をお願いします。

**起票をお願いしたい 10 本**（計画書の Steps 表の「Issue 案」A〜J。DoD と触ってよいパスは計画書の各 Step から引いてください）

| 案 | 内容 | 依存 | 宛先の提案 |
| --- | --- | --- | --- |
| A | migration `0032_goals.sql`（role `goal`・`goals_payload`・`goal_todo_links`・`dailies_payload` の 2 列・RLS・Realtime）と、role の一覧の追随。🛑 `supabase db push` はこうだいさん | — | section:briefing |
| B | Goals の DataService・mapper・Realtime ドメイン | A | section:briefing |
| C | 達成の判定と期間の鍵の純粋関数（shared）と、MCP と共通の見本データ | — | section:briefing |
| D | MCP の道具 5 つ（`list_goals` / `create_goal` / `update_goal` / `link_goal_todo` / `unlink_goal_todo`）と `get_today_context` / `get_week_context` の追随・catalog | B, C | section:briefing |
| E | `note-goals` の今の期間の文章を新しい目標に 1 回だけ移す | B | section:briefing |
| F | 朝刊の作り直し（ゆうべの自分から・目標・Todo 行の目標の印・期間末のふり返り・宣言を外す） | B, C, E | section:briefing |
| G | 夕刊の作り直し（号数と連続・★で発行・今日進んだ目標・今日の出来事と一言・明日の予定に置く・明日の自分へ・Daily に移動） | B, C | section:briefing |
| H | Connect に「タグ / 目標と Todo」のタブを足し、目標の木と右パネルを作る | B, C | section:briefing（Connect の画面ですが、目標のデータと同じレーンで進めるほうが衝突しにくいと考えています。connect-refine に回すかは判断をお願いします） |
| I | つなぐ画面（目標の側から）と、Schedule の Todo 詳細パネル・作成パネルの目標の欄 | B, C | section:briefing |
| J | docs の追随（CLAUDE.md §4 の role 一覧・tier-1 §Briefing・mobile-scope・db-conventions）、古い決定の supersede、実画面での確認 | F, G | section:briefing |

**あわせて拾ってほしい 2 点**（どちらも作り直しの Issue の中で直せます）

- `shared/src/components/briefing/EveningView.tsx:328` の「一日の締めくくり」の枠が `bg-lumen-surface` を使っていますが、`tokens.css` に定義がありません。地が透明になっていて、主要 UI の背景を透明にしない決まり（CLAUDE.md §6）に反しています。G の DoD に入れてもらえると助かります。
- オンボーディングのツアーの文言（`ja.json` の `briefingIntro`）が「Web だけで使っているあいだは空のまま」と書いていますが、実際に空になるのは講評だけです。作り直しの後はさらに実態と離れるので、F か J で書き直すのがよいと思います。

**worktree での確認の範囲**: 計画書と判断の記録は docs-lint まで通しています。デザインは Claude Design のプロジェクト https://claude.ai/design/p/d6a4900c-9586-421c-84bc-8a63d7df1f94 にあり、こちらでは中身を読んだだけで実ブラウザでは開いていません。

---

## 2026-09-20 → @chat-main（#1768 完了・Issue 起票依頼 1 件）

**#1768 = PR #1782（ローカル verify 15 / 15 緑・open）**。朝刊の予定の作成が Undo に載るようになり、繰り返しの範囲削除は Schedule と同じ `planRepeatScopeChoice` を読んで前倒しの実体化を通ります。

**実機確認をお願いします**（worktree は build / 型検証まで）: 朝刊から予定を足してヘッダーの Undo で消えるか、繰り返し行を「この予定だけ」で消して Undo で戻るか。どちらも Realtime の戻りではなく即時の紙面反映を見てください。

**Issue 起票依頼（section:briefing）**: 朝刊から作った予定が Settings のリマインダー既定値を受け取りません。Schedule の create（`shared/src/hooks/useScheduleItemsCRUD.ts`）は `createScheduleItem` の後に `updateScheduleItem(id, { reminderOffset })` を 1 本足して既定値を行に書き込みますが（#1374）、朝刊の `web/src/briefing/hooks/useBriefingWrites.ts` は `ds.createScheduleItem` を直に呼ぶだけなので `reminderOffset` が null のまま残ります。同じ画面から作った予定だけ通知が来ない形です。#1768 の AC の外なので P-008 に従って実装せず回します。

---
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
