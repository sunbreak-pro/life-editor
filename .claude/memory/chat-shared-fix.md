# MEMORY (chat-shared-fix)

## 進行中

（なし）— /goal の 7 件は全件 PR まで到達済み。merge はこうだいさんの手番（P-001）

## 直近の完了

- **/goal 7 件一括（2026-08-23 着手 → 2026-08-24 完了）**: #1103 / #993 / #1086 / #1102 / #992 / #1087 / #1079 のすべてに「origin/main から切ったブランチ + CI verify 15 ステップ緑 + PR」。**うち 5 本は既に merged**（#1111 / #1117 / #1119 / #1126 / #1127）、#1128（#1087）と #1129（#1079）が open ✅（2026-08-24）
- #1079 テストを threads に載せた（**Issue の「設定 1 行」は踏めない** — `test.env` の TZ pin は threads で無効になり、`TZ=UTC` で mcp-server の localDate が 3 件落ちる。もっと悪いのは `getTimezoneOffset() < 0` で自分をガードしている 2 本で、UTC ではアサーションごと消えて緑になる。pin を config モジュールの代入へ移してメインプロセスで ICU を張り直した。DOM を触らない shared の 86 本は node 環境へ = jsdom 生成 226s → 147s CPU。実測 = 同一ブランチで pool だけ入れ替えて 68s → 59s — PR #1129 open）✅（2026-08-24）
- #1087 known-issues の採否条件を「入口を張れるか」に絞った（D-20260823-shared-fix-1 = C / -2 = A。**参照 0 は Issue の 7 本ではなく実測 5 本**で、内訳は「前提が消えた 2 本 = 007 / 010 削除」「今日も再現する 2 本 = 030 / 032 に入口を張る」「検証不能 1 本 = 023 凍結」。`records.mjs check` が ANSWERS 行を要求するので同 PR に転記も含めた — PR #1128 open）✅（2026-08-24）
- #992 Kanban のカード droppable を無効化（**Issue の前提が誤り** — Notes の `useDroppable` は起票時点から「タグ見出しごと 1 個」で集約済み、行ごとの登録は Kanban のカードだけだった。`useDraggable` への置換は `sortableKeyboardCoordinates` が active id を droppable マップに探すため**キーボード DnD が無言で死ぬ**ので、`disabled: { droppable: true }` で droppable 半分だけ止めた。この経路はテストが 0 本だったので 2 本追加 — PR #1127 **merged**）✅（2026-08-24）
- #1102 週の始まりを日曜固定（純関数の `weekStartsOn` 引数は残し、配線層だけ畳んだ。**Monday ケースは #860 がドリフトした演算を唯一検証しているテスト資産**なので消せない。新テストが localStorage に古い "1" を書いた上で境界が動かないことと、`shared/src` / `web/src` に退役シンボルが残っていないことを走査する — PR #1126 **merged**）✅（2026-08-24）

## 予定

- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測 ② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（手順は PR #967 本文）
- **chat-main の手番（実機確認）**: #992 = PR #1127 merged 後の Kanban ドラッグの当たり判定（カードが drop target でなくなったので、カード上に落としたときカラムへ吸われるかを目視）。#947 / #874 / #880 の実機確認も未消化のまま
- **判断キューに 1 件積んだ**: `mcp-server/src/utils/localDate.ts:49` の `localWeekStart` が月曜始まりのままで、#1102 後はアプリ（日曜）と `get_week_context`（月曜）が 1 日ずれる
- 自分宛の新しい open Issue: **#1114**（tagIcon.ts の icons レジストリ参照をやめる = 初回 JS gzip −28%）/ **#1115**（Briefing がエディタを即時マウントして RichTextEditor chunk が初回ロードに入る）/ **#1122**（チュートリアルのツアー基盤・Epic #1121 の子）。#1114 / #1115 はどちらも #994 の実測由来
- #1079 の残り 2 レバーは着手していない（PR 本文に実測付きで記載）: バレル import の deep path 化は **web 側が config を触らないと 1 行も置換できない**（`exports` にサブパス無し / alias がファイル指し / `paths` にワイルドカード無し）。薄いテストファイルの統合は効果が小さい
- outbox に積んだ起票依頼の消化は chat-main の手番（2026-08-13 の 4 件 + 2026-08-16 の 3 件は決着済み。2026-08-23 の #992 close 推奨は**こうだいさんが B = 実装を指定したため失効**）
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 が却下案を復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #700（MCP 検証用ツール）— chat-main 側で進行済みの形跡。着手前に重複確認
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き
