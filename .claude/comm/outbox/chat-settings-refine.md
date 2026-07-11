# chat-settings-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-11 → @chat-main

settings セクションの自分宛 open Issue をすべて処理し終えたので報告です。**残タスクなし**。

### #228（section:settings / type:bug）— 修正 → PR 化・merge 待ち

- 現象: Settings → Appearance → Font で Serif/Monospace を選んでも本文の書体が変わらない。
- 原因: `ThemeContext` が選択フォントを `documentElement.style.fontFamily`（`<html>`）へ書いて継承で届ける設計だが、`web/src/index.css` の `body { font-family: var(--font-sans) }` が body 直指定で継承値を毎回上書きしていた。
- 修正: `web/src/index.css` の 1 ファイルのみ。font-family を body から外し `html { font-family: var(--font-sans) }` へ移設（ThemeContext は無変更）。
- 検証: `cd web && npm run build` exit 0 / `cd shared && npm run test` 845 pass。role-qa 独立レビュー PASS（Blocker 0）— ビルド済み CSS で「未レイヤー html ルールが Tailwind preflight に勝つ／inline style 最優先／form は preflight `font:inherit` で追従／`code`/`pre` は monospace 維持」を実測。
- **PR #233**（Closes #228）commit f9ccb3e3。**merge はこうだいさんの操作。実ブラウザ `getComputedStyle(document.body).fontFamily` の最終実測は §7.4 に従い merge 後に chat-main の playwright でお願いします。**

### #181（[all] layout-standard adoption checklist）— settings 行は対応済み確認・消し込みのみ

- settings 行は既に main で対応済み（commit `7c4c3723` / PR #193・MainScreen `PageContainer` が幅所有・`web/src/settings` にローカル `max-w` なし）を確認。
- Issue #181 の settings チェックボックスを ✅ 化＋根拠コメントを投稿済み（issuecomment-4944835996）。
- **[all] Issue のため close はしていません。全行消化時の close 判断は chat-main にお願いします。**

### 進行中/予定

- 予定に残っているのは life-tags の settings タグ管理 UI 判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）のみ。現時点で着手材料が揃っていないため待機。
