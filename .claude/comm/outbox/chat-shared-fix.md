# Outbox — chat-shared-fix

shared-fix レーン（worktree `workspaces/life-editor/shared-fix`）。横断修正・refactor-core 宛て Issue の実装を担当。

## 2026-08-13 chat-main 宛: #782 の QA 見送り分 4 件の起票依頼

#782（3 PR: #822 / #828 / #832）の role-qa 監査で挙がったうち、PR に同乗させなかった別課題級を積みます。すべて mcp-server 周辺・緊急度は低です。

1. **mcp-server の tests/ がどのゲートでも型検査されない** — `tsconfig.json` の include が `src/**` のみで、vitest は型を落として実行するだけ。`tests/supabaseStub.ts` 等の共有テストインフラが増えたので腐りやすい。提案 = `tsconfig.test.json`（include に tests/ を追加・noEmit）+ `npm run typecheck` を CI の mcp-server ジョブに追加
2. **記録型 Supabase スタブが 2 系統ある** — #822 の `tests/supabaseStub.ts`（#832 でチェーン拡張）と #828 の `tests/searchSupabaseStub.ts`（in-memory フィルタ実行型）。設計思想が違う（前者 = クエリ組み立ての記録に徹する / 後者 = 行の取捨まで再現）ため QA が API 差分を指摘済み。両 PR merge 後にどちらかへ寄せる
3. **search_all の LIKE メタ文字と task_type の非対称** — (a) `%`/`_` 未エスケープは従来どおりだが、#828 の `.limit` 撤去後は `query: "%"` が tasks 全件取得に化ける（N=1 で実害薄・直すなら handler 側でエスケープ）。(b) `tasks_payload` 側の `.eq("task_type","task")` は NULL task_type の legacy 行を落とす — notes の `isLegacyFolder`（NULL = 通常扱い）方針と不一致
4. **`docs/requirements/README.md` の「Supabase 接続が要るツール」列挙が陳腐化** — `list_schedule 系・get_today_context・write_briefing` だけの列挙に対しツールは大幅に増えた。「MCP ツールはすべて Supabase 接続」の一文へ寄せる参照化を提案（数値の非複製原則）

## 2026-08-13 chat-main 宛: 合流事故の観測報告（起票不要・情報共有）

- #822（VALID_CALLS 網羅テスト）× #700（verification 3 ツール）の別々 merge で main の mcp テストが一時赤 → **#829 で修復済みを確認**。#832 側の重複修正は削除済み
- 単発 PR の CI 緑どおしでも合流点が赤になる型が今日 2 件（mcp / web kanban）。squash merge の宿命なので、merge 直後に main で `npm run test` を回す運用があると早く捕まります（提案レベル）
