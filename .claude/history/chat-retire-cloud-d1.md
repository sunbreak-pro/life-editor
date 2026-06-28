# HISTORY (chat-retire-cloud-d1)

### 2026-06-28 - cloud/ (Cloudflare Workers + D1) 退役

#### 概要

移行 SSOT Phase 5 の dead stack だった cloud/（Cloudflare Workers + D1 sync エンジン）を先行撤去。現行は Supabase 直結で実行経路から外れていたため、依存ゼロを検証したうえで物理削除した。

#### 変更点

- **事前検証**: 生存コード（shared/src・web/src・mcp-server/src）への cloud/ 依存ゼロ / root package.json に cloud workspace・script なし / .github にヒットなし を確認。他レーン（docs/structure-notes）は CLAUDE.md のみ編集で本レーンの編集対象（SSOT・.gitignore・.ignore）と非重複
- **削除**: `git rm -r cloud/` で 22 ファイル削除（Worker `src/` + D1 `schema.sql` + migrations 0001-0008 + `wrangler.toml` 等）
- **SSOT 更新**: `.claude/2026-05-04-cross-platform-migration.md` の Phase 5「cloud/ 削除」を [x] 化（400 行）、並立期間「維持」表記（191・261 行）を 2026-06-28 撤去済に更新（413 行は frontend/src-tauri を含む複合条件のため据え置き）
- **設定**: `.gitignore`（cloud/node_modules・cloud/.wrangler）と `.ignore`（cloud/）の cloud 参照を除去
- **検証**: shared vitest 512 passed（46 files）/ shared `tsc -b` 緑 / web `tsc -b --force && vite build` 緑
