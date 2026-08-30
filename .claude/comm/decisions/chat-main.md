# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260830-main-1: Intel Mac 向け x64 `.dmg` を配るか

- 背景: #1301 / 計画書 `docs/vision/plans/2026-08-30-desktop-app-packaging.md` §R3。`macos-latest` は arm64 ランナーなので x64 dmg はクロスビルドになり、**CI では一度も起動できないまま配ることになる**。現行 `desktop/electron-builder.yml` は arm64 + x64 の両方を宣言している
- A: arm64 のみ配る（推奨 — 「検証できないものは配らない」で揃う。Intel Mac の要望が出てから足せばよい）
- B: 両アーキ配る（Intel Mac ユーザーが居るなら初手から届く。ただし壊れていても気付けない）
- 放置時: 現行宣言のまま両アーキをビルドするが、**受け入れ対象は arm64 のみ**。x64 は Release に載せず artifact に留める（安全側）
- 期限感: #1301 の Release 発行前まで

（2026-08-09 昇格分 = D-20260801-main-1 / D-20260801-main-2 / D-20260731-main-2 / D-20260731-main-1。2026-08-11 昇格分 = D-20260809-main-2 / D-20260804-main-1 / D-20260810-main-3。2026-08-12 昇格分 = D-20260811-main-1 / D-20260811-main-2。2026-08-19 昇格分 = D-20260816-main-1（回答 = A・#898 は `status:frozen`）/ D-20260819-main-1（回答 = B・#1100 を close）— いずれも `.claude/decisions/` 台帳へ）
