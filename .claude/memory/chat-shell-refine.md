# MEMORY (chat-shell-refine)

## 進行中

（なし）

## 直近の完了

- #172 PostgREST list read ページネーション（PR #243・Closes #172。postgrestFetchAll.ts 新設・全 Supabase サービス適用・sync-auditor PASS with notes・Medium 2 件反映済み・db-conventions §11 新設。ブランチ = claude/shell-refine-172）✅（2026-07-11）
- #173 docs-lint 機械検査（PR #241・Closes #173。scripts/docs-lint.sh 4 検査 + CI ジョブ + 既存違反 8 件修正 + 完了プラン 3 本 archive 移動。ブランチ = claude/shell-refine-173）✅（2026-07-11）
- #197 Tauri 残骸除去 Stage B+C（PR #236 merged 2026-07-11・#197 closed）✅（2026-07-11）

## 予定

- PR #241 / #243 の merge はこうだいさん操作。merge 後の実ブラウザ実測（+ #172 は 1000 行超データでの実測）は §7.4 に従い chat-main 側
- 未移植機能の移植再開時は #197 コメントのインベントリ + git tag `pre-tauri-removal` を参照元にする
