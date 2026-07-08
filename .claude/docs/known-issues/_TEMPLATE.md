# NNN: 短いタイトル（症状を要約）

**Status**: Active / Fixed / Workaround / Monitoring
**Category**: Bug / Structural / Schema / Performance / Security / Tooling
**Severity**: Blocking / Important / Minor
**Discovered**: YYYY-MM-DD
**Resolved**: YYYY-MM-DD （Fixed の場合のみ）

## Symptom

何が起きていたか。エラーメッセージは原文のまま引用する。ユーザー/開発者から見える挙動を書く。

## Root Cause

原因の本質。コードのどこで何が壊れていたか。ファイルパス + 行番号 + 該当コード抜粋。

## Impact

放置 / 再発した場合:

- 誰が困るか（ユーザー / 開発者 / 運用）
- どのデータ / 機能が影響を受けるか
- どのくらいの頻度で遭遇するか

## Fix / Workaround

- 今回採った対応（コミット参照、変更ファイル）
- 応急処置か恒久対応かの区別
- 残課題（あれば）

## References

- 関連ファイル: `path/to/file.ts:LINE`
- 関連 plan: `.claude/docs/vision/plans/YYYY-MM-DD-*.md`
- 関連 history: `.claude/history/chat-<self>.md` の該当セッション
- 関連 GitHub Issue: #NNN（プロダクトバグは Issue が追跡の正）

## Lessons Learned

次に似たコード・似た症状に出くわしたときのチェックポイント。検索で引っかかるキーワードも残す。

## Close-out Checklist（Fixed 化・PR merge 時）

- [ ] 対応 plan・per-chat memory の Status を更新した（PR merge 時の docs 追随）
