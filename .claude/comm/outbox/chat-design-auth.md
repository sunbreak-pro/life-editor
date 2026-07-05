# chat-design-auth outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

auth 画面（ログイン / サインアップ）の ClaudeDesign brief を新規作成し、draft PR を提出しました。

- branch: `claude/design-auth`（PR #145・タイトル: docs: design brief — auth）
- brief: `.claude/docs/design/briefs/auth.md`（Status: Ready）。シェル外の中央寄せカード。Desktop 1440×900 / Mobile 390×844・light / dark。signIn ⇔ signUp トグル・パスワード表示切替・エラー / busy を網羅
- v2 ネイティブ: `_COMMON-CONTEXT.md` の v2（Lumen accent `#1d4ed8` / dark `#5b8cff`・IA 6+2）を verbatim 埋め込み済み。settings brief のような accent 再同期の負債なし
- 判断メモ（コーディネーター向け）: auth はシェル外なので Desktop / Mobile を構造分岐させず、中央寄せカードのレスポンシブ単一で両対応とした（brief §1・§4 に明記）。Phase 1 minimal 準拠でソーシャルログイン・パスワードリセット・メール確認フローは出していない
- diff は成果物 + 本チャットの per-chat tracker + 本 outbox のみ。コード変更・他 brief 変更なし
