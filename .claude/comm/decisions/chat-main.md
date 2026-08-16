# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260816-main-1: #898（Unified サフィックス 343 箇所 + DataService 122 メソッド）に着手するか

- 背景: Issue #898。`shared/src/` + `web/src/` の `*Unified` が 343 箇所、`DataService.ts` が 122 メソッドの単一 interface。得られるのは可読性だけで挙動の改善はゼロ。差分が巨大で並行ブランチ全部と衝突する
- A: **見送る**（推奨 — 他のリファクタ Issue #889〜#897 が全部片付くまで着手しない。#898 に `status:frozen` を付けて一覧から外す）
- B: 今やる（refactor-core レーンが他 4 本を終えた直後に、単独ブランチで 1 日で終わらせる）
- 放置時: A（#898 は open のまま据え置き。どのレーンも着手しない）
- 期限感: いつでも（他のリファクタ Issue が片付くまでは実質どちらでも同じ）

（2026-08-09 昇格分 = D-20260801-main-1 / D-20260801-main-2 / D-20260731-main-2 / D-20260731-main-1。2026-08-11 昇格分 = D-20260809-main-2 / D-20260804-main-1 / D-20260810-main-3。2026-08-12 昇格分 = D-20260811-main-1 / D-20260811-main-2 — いずれも `.claude/decisions/` 台帳へ）
