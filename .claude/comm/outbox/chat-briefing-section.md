# chat-briefing-section outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-26 → @chat-main（#318 実装完了 — PR #357・実機確認依頼 + 起票依頼 1 件）

**Issue #318（Mobile 幅で朝刊/夕刊タブが切替不能）の修正が完了し、PR #357 を提出しました**（Closes #318・merge はこうだいさん）。両紙面ビューに optional な `tabSwitcher` スロットを足し、MainScreen が狭幅のときだけ shared の `SegmentedControl` を流し込む構成です。wide は `undefined` を渡すので SectionHeader のタブ挙動は据え置き（tablist の二重存在なし）。

- 検証済み: shared tsc -b / shared vitest **1087/1087**（#318 用 8 件追加）/ web build / web eslint 全 green。role-qa 独立監査 PASS（BLOCKING 0・指摘の null ガードは取り込み済み）
- **依頼 1（merge 後の実機確認）**: Issue 記載どおり DevTools 狭幅 + iOS Simulator での確認は貴レーン担当です。見どころは (a) 狭幅で朝刊 ⇔ 夕刊を往復できるか (b) wide でタブ帯が二重に出ないか (c) 帯が紙面と一緒にスクロールする挙動の是非。(c) は Materials 方式（`PageContainer` の header 行に載せて常時固定）へ寄せることも可能なので、実機で違和感があれば起票してください
- **依頼 2（起票依頼・横断タスク）**: `(min-width: 768px)` のリテラルが `shared/src/components/AppShell.tsx:115`（`wideQuery` 既定値）と `web/src/MainScreen.tsx:181` に二重定義されています。片方だけ動かすと「狭幅なのに切替 UI が出ない」「wide で二重表示」に化ける構造です。shared から `WIDE_QUERY` を export して両者が同じ定数を読む形に寄せる `shared-fix` 起票をお願いします（既存の `materialsMobileSwitcher` も同じ構造のため、briefing 単独では直しません）

## 2026-07-18 → @chat-main（#256 実装完了 — PR #273・手動 1 周の実測依頼）

**Issue #256（朝刊ループ Step 2: MCP schedule handler の Supabase 化 + `get_today_context` / `write_briefing`）の実装が完了し、PR #273 を提出しました**（Closes #256・DDL ゼロ・`mcp-server/` のみ変更で shared / web 非接触）。

- 検証済み: mcp-server tsc + vitest 14/14（shared `extractBriefing` との往復検証 = 「書いた朝刊を紙面表示できる」の機械チェック込み）/ shared vitest 917/917 + tsc -b / web build 全 green。briefing-loop 計画書 Step 2 チェック + Worklog 追記済み
- **依頼 1（merge 後の手動 1 周）**: DoD の「vitest + 手動 1 周」のうち手動 1 周は貴レーン担当です。MCP server 環境に `LIFE_EDITOR_SUPABASE_URL` / `LIFE_EDITOR_SUPABASE_ANON_KEY`（`VITE_*` でも可）+ `LIFE_EDITOR_SUPABASE_EMAIL` / `LIFE_EDITOR_SUPABASE_PASSWORD` を設定 →（DB path は省略可）→ `get_today_context` → `write_briefing` → Briefing 紙面表示、の 1 周をお願いします（手順の要点は README と PR 本文に記載）
- **依頼 2（Issue クローズ確認）**: PR merge で #256 は自動 close されます。close 時に briefing-loop Step 2 の「手動 1 周」実測結果を Worklog に 1 行追記してもらえると DoD が完結します
- 補足: schedule-refine レーンとの重なりは PR 本文に明記済み（mapper 非 import・規約 §10.2/§10.5 を mcp-server 内で実装のためコード衝突なし）。`generate_content` / `format_content` の schedule 経路は旧 SQLite のまま（残 handler の Supabase 化タスクのスコープ — 必要なら起票をお願いします）
