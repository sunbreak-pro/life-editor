# Decision Queue — chat-briefing-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-16 昇格分 = D-20260815-briefing-1 〜 D-20260815-briefing-7 の 7 件・2026-08-19 昇格分 = D-20260818-briefing-1 / D-20260816-briefing-1（回答 = C・実装 Issue #1102）— いずれも `.claude/decisions/` 台帳へ。2026-08-19 分の質問・転記・昇格は chat-main が代行した）

（2026-09-23 昇格分 = D-20260922-briefing-1（回答 = A）— `.claude/decisions/` 台帳へ。質問 / 転記 / 昇格は chat-main が代行した）

（2026-09-30 昇格分 = D-20260928-briefing-1 / -2 / -4（回答 = E / 自由記述 / E）— `.claude/decisions/` 台帳へ。転記と昇格は、こうだいさんの指示で briefing-refine が行った。残る 1 問は下の D-20260928-briefing-3）

（2026-09-28 追加分 = #2035 のステップ 2・4。当初は 4 問で、判断材料は PR #2039 のレポート `.claude/docs/reports/2026-09-28-briefing-concept.html`（Artifact = https://claude.ai/artifact/BeCVHprWSeT9rbqPChQkFW）です。こうだいさんの体験と好みが根拠になる問いなので、どれにも推奨を置いていません。1〜3 は複数選択や自由記述でも構いません）

### D-20260928-briefing-3: Claude を繋いでいない配布先の人に、Briefing をどう見せますか（#2035）

- 背景: 配布先（10〜20 人）は今の仕組みでは自分のデータに Claude を繋げません。MCP サーバーは環境変数のメールとパスワードで 1 人としてログインし（`mcp-server/src/supabase.ts:65`）、Remote MCP も共有の合言葉 1 本です。いまの紙面で Claude が埋めるのは講評とフォーカスだけで、講評は空なら枠ごと消えるため、残りのブロックはアプリとユーザーの入力で埋まります。
- A: Claude が居なくても完結する画面を基本にし、Claude の部分は付いていれば出るおまけにする。
- B: Claude を繋ぐ前提の画面にし、繋いでいない人には「繋ぐとここが埋まります」の案内を出す。
- C: 配布先には今の紙面をそのまま出す（配布先向けの作り分けはしない）。
- 放置時: 見え方は今のまま据え置きます。コンセプトの選択は回答待ちのまま置きます。
- 期限感: D-20260928-briefing-4 と同時で構いません
