# Decision Queue — chat-web-public

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260818-web-1: iOS ホーム画面アプリのステータスバーは `default`（明るい帯 + 黒文字）と `black`（黒帯 + 白文字）のどちらにするか

- 背景: #1009 / PR #1061 は `default` で出済み（`web/index.html` の 1 語）。`black-translucent` は文字色が**白固定**で朝刊（クリーム `#fbf4e8`）だと読めないことが仕様上確定し、テーマ連動は不可能（この meta は起動時に一度しか読まれず、`theme-color` / manifest の `theme_color` も iOS のステータスバーには効かない）。残るのは固定 3 値からの選択のみ
- A: `default`（推奨 — 現 PR の内容。朝刊はほぼ地続き / 夕刊は上に明るい帯が 1 本入る）
- B: `black`（夕刊 `#101a2c` はほぼ地続き / 朝刊は上に黒い帯が 1 本入る）
- 放置時: PR #1061 を merge せず保留。現状（`black-translucent`）のままなので、朝刊の時間帯だけ時計・電池が読めない状態が続く
- 期限感: PR #1061 の merge 前まで。実機で朝刊・夕刊を 1 回ずつ見れば決まる

（2026-08-12 昇格分 = D-20260812-web-1 / D-20260812-web-2 — `.claude/decisions/` 台帳へ）
