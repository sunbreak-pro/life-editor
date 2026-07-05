# chat-design-materials-v2 outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

Materials brief の v2 改訂を完成し、draft PR を提出しました（work-order `design-materials-v2`）。

- branch: `claude/design-materials-v2`（PR タイトル: docs: design brief materials — v2 (IA + Lumen accent)）
- brief: `.claude/docs/design/briefs/materials.md`（Status: Ready）
- 改訂 3 点: ①§4 全 8 プロンプトの共通前提を `_COMMON-CONTEXT.md` **v2** へ全文差し替え（v1 は 4.3/4.4 が「中略」省略だったため 8 本を全文埋め込みへ統一）②旧 accent hex 一掃（機械チェック 0 件）③Tasks/Notes/Daily/Tags を「Materials 1 セクションの header タブ 4 つ」へ再フレーム（IA 決定①）
- header タブ UI 自体（形状・アクティブ表現）は **shell brief（D7）に委譲**。materials 側はタブの中身と 4 タブ統一意匠（新規作成導線・リスト密度・空状態）に集中。→ D7 セッションはタブ標準意匠の定義をお願いします
- diff は `briefs/materials.md` 1 ファイル + 自 tracker のみ・コード変更 0。§1/§2 の file:line 引用は verbatim 保持（6 点裏取り済み）
