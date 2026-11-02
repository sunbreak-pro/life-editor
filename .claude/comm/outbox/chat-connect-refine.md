# chat-connect-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-09-16 → @chat-main

**報告: #1643（PR #1657）が Issue の差分目安 1,200 行を超えました**。分割せずに 1 本で出しています。

- **実測**: `+2,205 / −3,551`。削除 3,551 行の内訳は タグ編集モーダル本体 1,013 / そのテスト 1,182 / `TagEditorHost` 261 / `useTaggedItemIndex` 236 で、残りが i18n と docs です
- **分割しなかった理由**: 「モーダルを消す」と「Connect で編集できるようにする」を別 PR に割ると、間に**タグを編集する手段が無い commit** ができます。退役と置換は同じ変更の表裏なので 1 本にまとめました
- **実装の新規行**は `TagHubEditBlock.tsx` 276 行 + レール / View / ホストの差分で、それ以外の増分はテストと docs です
- **判断が要る点**: 今後の #1644 / #1645 / #1646 も同じ目安（900 行）を持っていますが、こちらは退役を伴わないので収まる見込みです。目安を「新規行で数える」に読み替えてよいか、計画書側の表現を直すかはそちらの判断にお任せします

---

## 2026-08-29 → @chat-main（2 件目）

**起票依頼: `web/tests/briefingEveningLazyMount.test.tsx` がフル実行時にだけ落ちる flake**。

- **内容**: #1171 の PR #1230 を出す前の最終確認（`cd web && npm run test`）で、「mounts the editor when the reflection is pressed」が `expected null to be truthy` で 1 度だけ失敗しました。**単体実行では 7/7 緑、直後のフル再実行でも 91 files / 865 tests 全緑**なので、変更由来ではなくフル実行の負荷でだけ出る flake です
- **切り分け済み**: #1171 の差分は Briefing に触れていません（`web/src/briefing/**` の diff ゼロ）。対象は #1115 で lazy 化した夕刊リフレクションのエディタで、`lazy()` の解決を待つ箇所が負荷時に間に合っていない形に見えます
- **なぜ起票したいか**: CI は 1 回勝負なので、この確率で落ちると**無関係な PR が赤くなって原因調査に時間を取られます**（実際こちらも「rebase で壊れたか」を疑って再実行しています）
- **想定ラベル**: `section:briefing` + `type:bug`
- **DoD 案**: 待機を `findBy*` / `waitFor` 側に寄せるか、当該 suite の lazy 解決を決定論的にして、フル実行 10 回連続で緑

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

## 2026-11-02 → @chat-main

13 Issue の PR 化が終わりました。こちらから merge はしていません。open は #2438 #2440 #2449 #2451 #2452 #2456 #2459 の 7 本です。実ブラウザの確認と Issue の close をお願いします。起票の依頼は次のとおりです。どれも作業の範囲外で見つけたものです。

- **上の目標の select が過去期間の親を「なし」と表示する**: `goalParentOptions`（`GoalsTodosScreen.tsx:437`）。
- **親候補の文字列が i18n の外にある**: `GoalDetailPanel.tsx:146`。
- **`assertParent` が素の Error を投げる**: `mcp-server/src/handlers/goalHandlers.ts`。code が `failed` になる（CLAUDE.md §5）。
- **親の規則をゆるめた決定が台帳にない**: 2026-10-31 の回答。古い記述は D-20260928-briefing-4、`plans/2026-10-03-briefing-goals-redesign.md:116`、`docs/design/briefs/briefing.md:34,372`、`tier-1-core.md`、`mobile-scope.md:18` に残っている。
- **目標の行のアイコンがスマホで常時表示でない**: `iconClass`。タブレット幅のホバーも同じ。
- **Todo の操作の失敗で「目標を保存できませんでした」と出る**: `connect.goals.writeFailed`。
- **時刻の候補一覧の Esc がパネルごと閉じる**: `TimeRangeField`。`useEscapeLayer` で直せるはず。
- **`GoalPickerField` の見出しが過去の週にも「今週」と出る**。
- **`role="switch"` の共有部品がない**、**Esc のあと + ボタンへフォーカスが戻らない**、**`lumen-bg-secondary` がダークで右パネルの背景と同じ色になる**（`ItemRoleBadge`）。
- **カレンダーのチップの吹き出しで日またぎの Todo の時刻を変えると 15 分に縮むはず**: `ItemPanelHost` / `CalendarTab` の `onRetime` → `handleTodoChipMove`。コードを読んだだけで未実行。
- **ノートの子孫の削除が同時送信で、途中の失敗で親だけ消える可能性がある**: `useNotesUnifiedCRUD.ts:302`。未確認。#2388 で Todo は順次に直した。
- **朝刊の目標の削除は #2405 の選ぶダイアログを通らない**。
- **過去期間の目標の「＋」は今の期間に作る**: 仕様として確かめる。
- **`web/tests/dailyBodyPending.test.tsx` が全件並列で 1 度だけ落ちた**: 単独 3 回は緑。原因は未確認。
