---
Status: Draft
Created: 2026-08-29
Branch: feat/claude-launcher-desktop
Owner-chat: main
Parent: (関連) 2026-08-29-ai-integration-visibility.md
---

# Plan: Claude Launcher (Desktop) — Electron から Claude Code を起動する導線（段階 2）

---

## Context

- **動機**: 退役したアプリ内ターミナル（D-20260705-main-1）以降、Claude Code の常設起動導線が無い。Desktop（Electron）から `claude` CLI をプロンプト付きで起動するワンクリック導線を設け、「アプリ内 AI アシスタント」への窓口を $0 で作る
- **制約**: コスト $0（消費されるのは既存 Claude サブスクのみ・アプリから API を呼ばない）。desktop の exposed IPC API は 10 個上限（ipcContract.ts:93 の #529 Risk 1 ガード・現在 7）。`sandbox: true` / `contextIsolation: true` は緩めない（main/index.ts:144-150「Do not loosen」）。CLAUDE.md §5「常設起動導線は生成デザイン確定後に再設計」の再設計そのものに当たるため、**UI の置き場はユーザー確認を経て確定する**（下記 Gate）
- **Non-goals**: `claude -p` ヘッドレス実行の結果をアプリ内に表示するチャット風 UI（v2 候補 — 代替案表）/ Web・Mobile からの起動（CLI が無い）/ ターミナルエミュレータの復活

---

## 検討した代替案（必須）

| 案                                                                                                   | 採否 | 却下理由                                                                                                                     | 復活条件                                                |
| ---------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| IPC 1 チャネル追加 + main プロセスが OS ターミナルで `claude` を起動（プロンプト文字列を引数で渡す） | ✓    | —                                                                                                                            | —                                                       |
| `claude -p` ヘッドレス実行で結果をアプリ内表示                                                       | ✗    | 出力ストリーミング UI・実行中状態管理・エラー系が重く、v1 の「窓口を作る」目的に対し過大。spawn 導線が安定してからで遅くない | v1 が使われ、往復がターミナル側で完結しない不満が出たら |
| xterm.js 等でアプリ内ターミナル復活                                                                  | ✗    | D-20260705-main-1 で機能ごと退役済み。portable-pty 依存の復活は移行方針に逆行                                                | ユーザーが退役決定を supersede したら                   |
| `shell.openExternal` で URL scheme 起動                                                              | ✗    | Claude Code CLI に安定した URL scheme が無く、プロンプト受け渡しができない                                                   | 公式に scheme が提供されたら                            |

---

## Scope (Touchable Paths)

```
desktop/src/shared/ipcContract.ts
desktop/src/main/index.ts
desktop/src/preload/index.ts
desktop/tests/**
shared/src/utils/platform.ts                (isDesktopShell() 追加)
shared/src/components/SettingsAiIntegration.tsx   (段階 1 のカードに起動ボタンを追加)
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
web/src/settings/SettingsScreen.tsx
shared/tests/**  web/tests/**
.claude/docs/vision/plans/2026-08-29-claude-launcher-desktop.md
```

段階 1（`2026-08-29-ai-integration-visibility.md`）の `SettingsAiIntegration.tsx` が先行して merge されている前提。未 merge なら本計画は BLOCKED とし追い越さない。スコープ外の変更は **P-008** に従いキューへ。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                                                                                               | Gate    | Acceptance                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| 0   | 起動 UI の置き場と挙動の確定（Settings カード内ボタンのみで開始 / 起動形態 = OS の新規ターミナルウィンドウで `claude "<prompt>"`）を ask-user で確認                                                                                                                                                                                               | 🛑 人手 | ユーザー回答が decisions キューに記録される               |
| 1   | `ipcContract.ts` に `claude:launch` チャネル追加（引数 = `{ prompt?: string }`・戻り = `{ ok: boolean; error?: string }`）。exposed count 7→8 のコメント更新                                                                                                                                                                                       | 🤖 自律 | `cd desktop && npm run build` exit 0・ipcContract.test 緑 |
| 2   | main 側 handler: プロンプトを検証（長さ上限・制御文字除去 — theme allowlist 検証:367-377 の作法に倣う）し、`child_process.spawn` を **shell 補間なし（配列引数・`shell: false` 相当の安全形）** で OS 別に起動（win32 = `cmd /c start` 系 / darwin = `open -a Terminal` 系 / linux = `$TERMINAL` fallback）。`claude` 不在時はエラーを戻り値で返す | 🤖 自律 | desktop vitest（引数検証・OS 分岐のユニット）緑           |
| 3   | preload に API 追加 + `shared/src/utils/platform.ts` に `isDesktopShell()`（`window.desktop` 存在チェック — supabaseAuthStorage.ts:69-85 の作法）を追加                                                                                                                                                                                            | 🤖 自律 | `cd shared && npm run build` exit 0                       |
| 4   | `SettingsAiIntegration.tsx` に起動ボタン追加（`isDesktopShell()` が false なら「Desktop 版で利用可」の説明にフォールバック）。en/ja キー追加                                                                                                                                                                                                       | 🤖 自律 | shared / web build + i18nKeys.test 緑                     |
| 5   | CI 全ゲート（shared → web → desktop → mcp-server + docs-lint）                                                                                                                                                                                                                                                                                     | 🤖 自律 | 全ステップ exit 0                                         |
| 6   | Windows 実機で Electron 起動 → ボタンからターミナルが開き `claude` が立つことを確認（macOS は後日ユーザー確認）                                                                                                                                                                                                                                    | 👀 目視 | golden path 1 周                                          |
| 7   | PR 作成 → main merge                                                                                                                                                                                                                                                                                                                               | 🛑 人手 | ユーザーが merge                                          |

---

## Acceptance Criteria (機械検証可能)

- [ ] CI `verify` ジョブの全ステップ exit 0（shared → web → desktop → mcp-server）
- [ ] `desktop/tests/ipcContract.test.ts` が新チャネル込みで緑・exposed API 数 8（<=10 ガードコメントも 8 に更新済み）
- [ ] spawn 呼び出しにユーザー入力の shell 文字列連結が存在しない（プロンプトは配列引数 or 一時ファイル経由 — grep で `exec(` 不使用を確認）
- [ ] `isDesktopShell()` false 環境（web / mobile）でボタンが出ず build も緑
- [ ] en.json / ja.json キーパリティ緑
- [ ] PR diff ±500 行以内
- [ ] 完了時: 本 plan Status 更新 + archive 移動 + per-chat memory 更新 + CLAUDE.md §5 の「常設起動導線は再設計待ち」記述を更新（D 参照付き）

---

## Risks / Known Issues 参照

- **セキュリティ**: renderer からの文字列を OS コマンドへ渡す唯一の経路になる。IPC 境界での検証（Step 2）と shell 補間禁止（AC 3 行目）を必須とし、実装後に `security-reviewer` を通す
- **Windows のターミナル起動系は環境差が大きい**（Windows Terminal 有無 / PowerShell vs cmd）。v1 は既定シェルで妥協し、挙動差は Worklog に記録
- `claude` の PATH 解決が Electron の GUI 起動時に shell profile を経由しない問題（macOS で頻出）。`which` 相当の事前チェックとエラー表示で受ける

---

## References

- vision: CLAUDE.md §5 AI Integration（ターミナル退役 = D-20260705-main-1・導線再設計はその積み残し）
- 段階 1: `2026-08-29-ai-integration-visibility.md`（Settings カードの土台）
- 実測根拠: desktop/src/shared/ipcContract.ts:39-52, 93 / desktop/src/main/index.ts:144-150, 363-478 / shared/src/services/supabaseAuthStorage.ts:69-85 / shared/src/utils/platform.ts:38
- related skills: `frontend-react-designer`・agent: `security-reviewer`

---

## Worklog

（実装中に記録）
