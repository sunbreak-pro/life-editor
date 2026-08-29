---
Status: Draft
Created: 2026-08-29
Branch: feat/ai-integration-visibility
Owner-chat: settings-refine
---

# Plan: AI Integration Visibility — アプリ内に Claude / MCP 連携を可視化する（段階 1）

---

## Context

- **動機**: アプリの UI/UX に Claude / AI 連携の要素・情報がゼロで、MCP Server が同一 DB を操作している事実がユーザーから見えない。「連携が存在すること自体の見える化」を全プラットフォーム（Desktop / Web / Mobile）で行う
- **制約**: コスト $0 厳守（アプリから Claude API を呼ばない = CLAUDE.md §1 Non-Goals「Claude API 直課金」）。DDL 追加なし（🛑 人手ゲートを増やさない）。既存データからの導出のみで実現する
- **Non-goals**: アプリ内チャット UI / Claude API 呼び出し / Briefing 行への author メタデータ追加（DDL が要るため段階 1 では見送り — 下記代替案表）/ Claude Code の起動導線（段階 2 = `2026-08-29-claude-launcher-desktop.md` に分離）

---

## 検討した代替案（必須）

| 案                                                                                                              | 採否 | 却下理由                                                                                                                                                                                                                                                                                           | 復活条件                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Settings に「AI 連携」カード新設 + ビルド時生成のツールカタログ JSON + 最終 Briefing 書き込み時刻からの活動表示 | ✓    | —                                                                                                                                                                                                                                                                                                  | —                                                              |
| MCP Server に heartbeat（DB テーブル or ファイル）を書かせてリアルタイム接続状態を表示                          | ✗    | DDL or ファイル配布経路が要り、Web/Mobile からファイルは読めない。stdio 接続は Claude Code セッション中しか生きておらず「接続中」表示の価値が薄い                                                                                                                                                  | 常駐型 MCP 運用（HTTP transport 等）へ移行したら               |
| shared/web から mcp-server の `TOOLS` を直接 import してカタログ表示                                            | ✗    | `tools/<domain>.ts` が handler 経由で Supabase クライアントを引き込み、フロントのバンドルに混入する（mcp-server/src/tools.ts:39-60 実測）                                                                                                                                                          | ツール定義が handler 非依存の純データに分離されたら            |
| Briefing 行に author メタデータを持たせてデータ由来の「Claude 生成」表示                                        | ✗    | `dailies_payload` / `items_meta` への新フィールド = DDL + `writeCommentIntoDaily`（mcp-server/src/handlers/briefingHandlers.ts:482-532）と `extractBriefing.ts` の両側改修が要る。既存の静的ラベル `briefing.aiSource`（ja.json:884「Claude ・ 朝刊セクションより」）強化で目的の 9 割が達成できる | ユーザー手書きと Claude 書き込みの判別が実運用で必要になったら |

---

## Scope (Touchable Paths)

```
mcp-server/scripts/**                       (カタログ JSON の生成スクリプト新設)
mcp-server/package.json                     (生成スクリプトの npm script 追加)
shared/src/generated/mcpToolCatalog.json    (生成物・git 追跡)
shared/src/components/SettingsAiIntegration.tsx
shared/src/components/index.ts
shared/src/components/briefing/BriefingView.tsx
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
web/src/settings/SettingsScreen.tsx
web/src/briefing/BriefingScreen.tsx
shared/tests/**  web/tests/**               (該当テスト)
.claude/docs/vision/plans/2026-08-29-ai-integration-visibility.md
```

スコープ外の変更が必要になった場合は **P-008**: 実装せずキュー（`comm/decisions/chat-<self>.md`）or Issue 起票依頼へ積み、現計画を続行する。

---

## Steps

| #   | Step                                                                                                                                                                                                                                                                                                    | Gate    | Acceptance                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| 1   | カタログ生成スクリプト: `mcp-server/scripts/dump-tool-catalog.mjs` が `TOOLS`（tools.ts:54）から `{name, description, inputSchema}` の配列 JSON を `shared/src/generated/mcpToolCatalog.json` へ吐く。`npm run build` に組み込まず独立 script（ツール追加時に手動再生成 + 鮮度テストで担保）            | 🤖 自律 | script 実行で JSON 再生成・ツール件数がレジストリと一致するテスト緑 |
| 2   | `SettingsAiIntegration.tsx` 新設: (a) MCP 連携の説明（同一 DB を Claude Code が操作する構図）(b) ツールカタログ一覧（name / description、折りたたみ）(c) 最終 AI 活動 = 当日 Daily の朝刊セクション有無から導出した「Claude が最後に朝刊を書いた日」。i18n は labels props 注入・`lumen-*` トークンのみ | 🤖 自律 | `cd shared && npm run build` exit 0・vitest 緑                      |
| 3   | `SettingsScreen.tsx` にカード 1 枚追加（既存 cardClass パターン）+ en/ja 両 catalog にキー追加                                                                                                                                                                                                          | 🤖 自律 | `cd web && npm run build` exit 0・i18nKeys.test 緑                  |
| 4   | Briefing 帰属強化: `BriefingView.tsx:459-473` の AI コメントブロックに AI バッジ（アイコン + 既存 `aiTitle`/`aiSource` ラベルの視覚強化）。文言は静的のまま                                                                                                                                             | 🤖 自律 | vitest 該当 test 緑                                                 |
| 5   | CI 全ゲート（shared → web → desktop → mcp-server + docs-lint）を上から全部回す                                                                                                                                                                                                                          | 🤖 自律 | 全ステップ exit 0                                                   |
| 6   | 見た目確認（Settings カード / Briefing バッジ / Mobile 幅での表示）                                                                                                                                                                                                                                     | 👀 目視 | ユーザーが画面で確認                                                |
| 7   | PR 作成 → main merge                                                                                                                                                                                                                                                                                    | 🛑 人手 | ユーザーが merge                                                    |

---

## Acceptance Criteria (機械検証可能)

- [ ] `node mcp-server/scripts/dump-tool-catalog.mjs` 実行後、`git diff --exit-code shared/src/generated/mcpToolCatalog.json` が 0（生成物が最新）
- [ ] カタログ件数 = `TOOL_DEFINITIONS` 由来の `TOOLS.length` と一致するテストが緑（数値をテストにハードコードしない — 数値の非複製原則）
- [ ] CI `verify` ジョブの全ステップ exit 0（shared → web → desktop → mcp-server）
- [ ] en.json / ja.json のキーパリティ（i18nKeys.test）緑
- [ ] `SettingsAiIntegration.tsx` に色ハードコードなし（`lumen-*` トークンのみ）・`useTranslation()` 直呼びなし
- [ ] PR diff ±500 行以内（機能追加の目安）
- [ ] 完了時: 本 plan Status 更新 + archive 移動 + per-chat memory 更新

---

## Risks / Known Issues 参照

- `shared/src/generated/` は新設ディレクトリ。lint / tsconfig の include 範囲に JSON import が通るか初手で確認する（`resolveJsonModule`）
- カタログ JSON の鮮度は script 手動実行に依存 — AC 1 の diff テストを CI に載せられない場合は mcp-server 側 vitest で件数一致のみ担保し、その旨を Worklog に残す
- Briefing の「最終 AI 活動」は朝刊セクション有無からの推測であり、ユーザー手書きと区別できない（代替案表 4 行目の通り許容。UI 文言も断定を避ける）

---

## References

- vision: `.claude/docs/vision/core.md`・CLAUDE.md §5 AI Integration
- 段階 2（起動導線）: `2026-08-29-claude-launcher-desktop.md`
- 実測根拠: mcp-server/src/tools.ts:39-60（レジストリ）/ mcp-server/src/handlers/briefingHandlers.ts:430-559（write_briefing の書き込み先）/ shared/src/components/briefing/BriefingView.tsx:459-473 / shared/src/i18n/locales/ja.json:884
- related skills: `frontend-react-designer`

---

## Worklog

（実装中に記録）
