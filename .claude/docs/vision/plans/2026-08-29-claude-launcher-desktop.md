---
Status: IN PROGRESS
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
desktop/src/main/claudeLauncher.ts          (新規 — 検証 / OS 分岐。electron 非依存でテスト可能にするため分離)
desktop/src/preload/index.ts
desktop/tests/**
shared/src/utils/platform.ts                (isDesktopShell() 追加)
shared/src/utils/claudeLauncher.ts          (新規 — renderer 側 bridge。supabaseAuthStorage.ts と同じ再宣言 + pin)
shared/src/components/SettingsAiIntegration.tsx   (段階 1 のカードに起動ブロックを追加)
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
web/src/settings/SettingsScreen.tsx
web/src/hooks/useClaudeLauncher.ts          (新規 — 失敗コード → 文言の変換をホスト側に置く)
shared/tests/**  web/tests/**
.claude/docs/vision/plans/2026-08-29-claude-launcher-desktop.md
```

**Step 0 の回答（D-20260831-settings-1）で Scope を拡張した** — サイドバー常設行のため以下を追加:

```
shared/src/components/SidebarNav.tsx        (footer 行 onLaunchClaude + labels.launchClaude)
shared/src/components/AppShell.tsx          (wide 分岐へ委譲)
web/src/MainScreen.tsx                      (desktop shell のときだけ handler を渡す)
web/src/hooks/useShellChrome.tsx            (nav.launchClaude ラベル)
```

段階 1（`2026-08-29-ai-integration-visibility.md`）の `SettingsAiIntegration.tsx` が先行して merge されている前提。**2026-08-31 時点で #1210 は closed・PR #1307 merged なので解除済み**。それ以外のスコープ外の変更は **P-008** に従いキューへ。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                                                                                               | Gate    | Acceptance                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| 0   | 起動 UI の置き場と挙動の確定を ask-user で確認 → **回答 = D-20260831-settings-1**（置き場 = カード内 + サイドバー常設 / プロンプトは渡さず素の `claude` / 起動フォルダ = Settings のパス欄）                                                                                                                                                       | 🛑 人手 | ✅ 2026-08-31 回答済・`decisions/D-20260831-settings-1.md` |
| 1   | `ipcContract.ts` に `claude:launch`（引数 = `{ projectPath?: string }`・戻り = `{ ok, error? }`）と `claude:getProjectPath` を追加。exposed count 7→**9** のコメント更新（Q3 の回答でパス保存が要るため 1 本増。上限 10 は維持）                                                                                                                   | 🤖 自律 | `cd desktop && npm run build` exit 0・ipcContract.test 緑 |
| 2   | main 側 handler: **フォルダパス**を検証（絶対パス限定・長さ上限・制御文字拒否 — Q2 の回答でプロンプトが無くなり、検証対象はパス 1 本になった）し、`child_process.spawn` を `shell: false` + 配列引数で OS 別に起動（win32 = `cmd /c start` に cwd / darwin = `open -a Terminal` + 一時スクリプト / linux = `$TERMINAL` に cwd）。`claude` 不在時はエラーを戻り値で返す | 🤖 自律 | desktop vitest（引数検証・OS 分岐のユニット）緑           |
| 3   | preload に API 追加 + `shared/src/utils/platform.ts` に `isDesktopShell()`（`window.desktop` 存在チェック — supabaseAuthStorage.ts:69-85 の作法）を追加                                                                                                                                                                                            | 🤖 自律 | `cd shared && npm run build` exit 0                       |
| 4   | `SettingsAiIntegration.tsx` に起動ブロック追加（bridge が無ければ「Desktop 版で利用可」の説明にフォールバック）+ `SidebarNav` の footer 行。en/ja キー追加                                                                                                                                                                                         | 🤖 自律 | shared / web build + i18nKeys.test 緑                     |
| 5   | CI 全ゲート（shared → web → desktop → mcp-server + docs-lint）                                                                                                                                                                                                                                                                                     | 🤖 自律 | 全ステップ exit 0                                         |
| 6   | Windows 実機で Electron 起動 → ボタンからターミナルが開き `claude` が立つことを確認（macOS は後日ユーザー確認）                                                                                                                                                                                                                                    | 👀 目視 | golden path 1 周                                          |
| 7   | PR 作成 → main merge                                                                                                                                                                                                                                                                                                                               | 🛑 人手 | ユーザーが merge                                          |

---

## Acceptance Criteria (機械検証可能)

- [ ] CI `verify` ジョブの全ステップ exit 0（shared → web → desktop → mcp-server）
- [ ] `desktop/tests/ipcContract.test.ts` が新チャネル込みで緑・exposed API 数 **9**（<=10 ガードコメントも 9 に更新済み・数はテストが実測）
- [ ] spawn 呼び出しにユーザー入力の shell 文字列連結が存在しない（フォルダは `cwd` か一時ファイル経由 — grep で `exec(` 不使用を確認）
- [ ] bridge の無い環境（web / mobile）でボタンが出ず build も緑
- [ ] en.json / ja.json キーパリティ緑
- [x] ~~PR diff ±500 行以内~~ → **達成できず・約 1,300 行**（Worklog 参照）。内訳 = テスト 3 本で約 450 行 / Step 0 の回答による Scope 拡張（サイドバー行 + パス欄 + `claude:getProjectPath`）で約 250 行。行数を守るために削れるのはテストしかなく、OS コマンド起動経路の検証を落とすのは本末転倒と判断した
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

### 2026-08-31 — Step 0〜5（settings-refine / PR は #1211 参照）

**Step 0 の回答が計画を 3 点動かした**（D-20260831-settings-1）:

1. **起動フォルダという論点が計画に無かった**。`claude` は起動ディレクトリの `.mcp.json` から MCP サーバーを読むため、フォルダを決めずに起動すると「Claude Code は立つが life-editor のデータに繋がらない」状態になる。ask-user の 3 問目として足し、Settings のパス欄 + 保存（`claude:getProjectPath`）を採用した。exposed count は 7→8 ではなく 7→9（#529 の上限 10 内）
2. **プロンプトを渡さない**選択により、renderer からの自由文字列が OS コマンド経路に乗らなくなった。Step 2 の「プロンプト検証」は消え、同じ役割をパス検証が負う
3. **サイドバー常設行**（Q1-B）で Scope を 4 ファイル拡張。ユーザーが「Scope 外」と明記された選択肢を選んでの拡張

**実装上の判断**:

- **`desktop/src/main/claudeLauncher.ts` を分離**。`index.ts` は `electron` をモジュールスコープで import するため、OS 分岐や検証をそこに書くと Electron を起動しないとテストできない。分離した結果 win32 / darwin / linux の 3 分岐が CI（1 プラットフォーム）で全部検証できる
- **darwin だけ一時スクリプト経由**。`open` は LaunchServices に投げるので Terminal.app は自分の環境で起動し、`cwd` オプションが効かない。フォルダを Terminal が実行するファイルの中に入れるしかなく、POSIX の単一引用符エスケープ（`'` → `'\''`）で包んでいる。win32 / linux はフォルダが `cwd` に乗るので引数列にユーザー入力が一切現れない
- **`claude` 探索は PATH + 既定インストール先**。GUI 起動の Electron は login shell を通らず PATH が OS 既定のままなので、PATH だけ見ると「未インストール」と誤報告する（ターミナルからは一瞬で見つかるのに）。macOS / Linux では `~/.local/bin` `~/.claude/local` `/usr/local/bin` `/opt/homebrew/bin` を足している
- **保存はローンチ成功後**。`spawn` の失敗は throw ではなく `error` イベントで来るので handler は Promise を返し、`spawn` イベントで初めて `store.set` する。失敗したパスを覚えるとサイドバー行が「動かないと分かっているパス」を使い続ける
- **サイドバー行の失敗は toast ではなく Settings への遷移**。`MainScreen` は `AppProviders` が張る ToastProvider の**外側**にいる（`bottomBarActions` がノードでなくコールバックなのと同じ理由）。加えて一番多い失敗は「フォルダ未設定」で、その答えは文言よりも設定欄そのもの

**残（このブランチでは未消化）**:

- Step 6（👀 Windows 実機の golden path）は worktree では回せない — 実ブラウザ検証・dev server は chat-main 専有（CLAUDE.md §7.4）。merge 後に chat-main 側で実測
- macOS の実機確認は計画どおり後日
- 完了時タスク（plan の archive 移動 / CLAUDE.md §5 の「再設計待ち」記述の更新）は Step 6 通過後
