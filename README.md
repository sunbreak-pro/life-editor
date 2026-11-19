# Life Editor

Life Editor は、作者が自分の生活を回すために作っている個人用の「生活の OS」です。Todo・予定・ノート・デイリー・目標と、朝と夜のまとめ（朝刊・夕刊）を 1 つのワークスペースに集め、Claude が MCP（AI がアプリのデータを読み書きするための接続の仕組み）を通じてそれらを読み書きします。作者が自分で使う道具で、製品として配布するものではありません。ほかの方からの Issue と Pull Request は受け付けていません。

ソースコードは参考のために公開しています。利用の条件は [ライセンス](#ライセンス) の節に書いています。

## 機能

画面のセクション一覧の元は `shared/src/sections.ts` です。

- **朝刊・夕刊**: 起動すると最初に開くホーム画面です。朝刊は今週の目標を進み具合つきで出し、今日の予定と Todo を並べます。夕刊はその日を閉じる画面で、気分を 5 段階で残せます。朝刊の講評は Claude が MCP 経由で書き込みます。
- **予定**: カレンダーで予定を組みます。繰り返しの予定と Todo の一覧もこのセクションにあります。
- **素材**: ノートとデイリーを書く場所です。本文は TipTap のエディタで書き、ノートには添付ファイルとテンプレートを使えます。
- **つながり**: タグを入口にノート・Todo・予定・デイリーを種類別に読めます。「目標と Todo」のタブでは、目標の木の下に Todo をぶら下げて見られます。
- **分析**: Todo や予定の記録を集計し、グラフで見られます。
- **設定**: Claude に渡すルール・メモリー・スキルの編集、ゴミ箱からの復元、データの書き出し、ショートカット、テーマ、日本語と英語の切り替えがあります。
- **Claude Code の起動**: Desktop 版では、サイドバーと設定の画面から、指定したフォルダで `claude` を起動できます。

## 構成

画面は 1 つの React のコードベース（`shared/` と `web/`）で書き、Web と Desktop の 2 つの形で動かします。スマホでは、公開 Web URL をブラウザで開いて使います。データは Supabase（Postgres・認証・Realtime・Storage）に置きます。画面の部品はバックエンドを直接呼ばず、`getDataService()` を経由してデータを読み書きします。

| ディレクトリ  | 中身                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `shared/`     | 画面の部品・データアクセス層・型です。React 19、TypeScript、react-i18next、Recharts で書いています。                         |
| `web/`        | ブラウザで動く画面の本体です。Vite、Tailwind CSS v4、TipTap、dnd-kit を使い、Cloudflare Workers の静的配信で公開しています。 |
| `desktop/`    | `web/` の画面を包む Electron の殻です。electron-vite でビルドし、electron-builder で配布用にまとめます。                     |
| `mcp-server/` | MCP サーバーです。Node.js と `@modelcontextprotocol/sdk` で書いています。                                                    |
| `supabase/`   | データベースのマイグレーションと、行単位のアクセス制御（RLS）の検査スクリプトがあります。                                    |

公開 Web URL は `https://life-editor.sunbreak-pro.workers.dev` です。

### MCP の設計

MCP のツールの処理（ハンドラ）は 1 つで、それを 2 つの入口が共有します。どちらの入口もツールの定義・引数の検査・Supabase への書き込みに同じコードを使い、入口ごとに違うのは見せるツールの範囲と認証だけです。

| 入口                             | 使う側                                                  | コード                     | ツール数 |
| -------------------------------- | ------------------------------------------------------- | -------------------------- | -------- |
| stdio                            | 手元の Claude Code                                      | `mcp-server/src/index.ts`  | 56       |
| Remote MCP（Cloudflare Workers） | スマホと Web の Claude アプリ（カスタムコネクタで接続） | `mcp-server/src/worker.ts` | 53       |

- どこでも動くツールの一覧の元は `mcp-server/src/remoteTools.ts` で、Remote MCP はこの一覧をそのまま出します。
- stdio はこの一覧に、手元のファイルを使う検証用のツール 3 本を足します（`mcp-server/src/tools.ts`）。

ツール数は 2026-11-16 に `mcp-server/src/tools/` の定義を数えた値です。最新の一覧はコードを見てください。

## 開発のしかた

作者が Claude Code を使って開発しています。設計の判断と実装の規約の元になる文書は [`.claude/CLAUDE.md`](.claude/CLAUDE.md) です。確定した判断は `D-YYYYMMDD-<作業名>-<番号>` の ID を付け、1 件 1 ファイルで [`.claude/decisions/`](.claude/decisions/) に残しています。作者自身の課題は GitHub Issues で追っています。

## ローカルでの開発

CI は Node.js 22 で動かしています。Web の画面は次の手順で起動します。

```bash
cd shared && npm install && npm run build
cd ../web && npm install && npm run dev
```

`web/.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を書く必要があります。リポジトリ直下の `npm run dev` と `npm run build` は、`web/` の同名のスクリプトを呼びます。

| 場所               | コマンド                                                                      | 内容                                                                                     |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| リポジトリ直下     | `node scripts/local-ci.mjs`                                                   | `.github/workflows/ci.yml` の全ステップを手元で順に回し、結果を表にします。              |
| リポジトリ直下     | `bash scripts/docs-lint.sh`                                                   | `.claude/` の文書のリンク切れと書式を検査します。                                        |
| `shared/` / `web/` | `npm run build` / `npm run lint` / `npm run test` / `npm run typecheck:tests` | 型検査とビルド、lint、テスト、テストコードの型検査をします。                             |
| `desktop/`         | `npm run dev` / `npm run build` / `npm run dist`                              | Electron 版を開発モードで起動し、ビルドし、配布用にまとめます。                          |
| `mcp-server/`      | `npm run build` / `npm run test` / `npm run catalog`                          | MCP サーバーをビルド・テストし、設定画面用のツール一覧を作り直します。                   |
| `mcp-server/`      | `npm run deploy`                                                              | Remote MCP を Cloudflare Workers に配ります。                                            |
| `supabase/`        | `npm run db:check-rls` / `npm run db:push`                                    | RLS の設定を検査し、マイグレーションをデータベースに反映します。                         |

stdio の MCP サーバーは、環境変数 `LIFE_EDITOR_SUPABASE_URL`・`LIFE_EDITOR_SUPABASE_ANON_KEY`・`LIFE_EDITOR_SUPABASE_EMAIL`・`LIFE_EDITOR_SUPABASE_PASSWORD` で Supabase に本人としてログインします。`.mcp.json` のサーバーの起動パスは、環境変数 `LIFE_EDITOR_MCP_ENTRY` で上書きできます。

## ライセンス

All rights reserved です。ソースコードは参考のために公開しています。書面での許可がない限り、使用・複製・改変・再配布は認めていません。全文は [LICENSE](./LICENSE) にあります。
