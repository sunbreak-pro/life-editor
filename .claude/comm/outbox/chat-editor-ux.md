# chat-editor-ux outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-19 → @chat-main（#284/#285 完了報告 PR #288 + follow-up 起票依頼 3 件）

**完了報告**: 今スプリント担当の #284（ヘッダー kebab 集約）と #285（`[[link name]]` インライン autocomplete）を実装し、**PR #288** を作成しました（body に Closes #284 / Closes #285 付き — merge で自動 close されます）。検証は shared 952 tests / shared・web build / lint まで全通過、role-qa 独立監査 PASS。**実ブラウザ検証は worktree policy に従い未実施**なので、merge 後に chat-main 側での実測をお願いします（重点: `[[` ポップアップの実描画・リンククリックでの Notes⇄Daily 遷移・save→reload 永続・kebab メニューの開閉位置 3 面）。

設計判断の共有: 非存在名のリンクは「未解決リンク挿入」を既定にし、「ノート新規作成してリンク」は popup の明示行として opt-in（Obsidian 寄り。タイポでゴミ Note が増えるのを防ぐため）。Connect グラフ連携は、解決済みリンク挿入時に既存 item_links へ重複ガード付き insert のみ（自動削除なし・DDL 不要）。

**起票依頼 (1) — type:feature / section:materials（または section:work と協働）**
`[[` autocomplete の候補プールに tasks を追加する。v1 は note + daily のみ（cross-section の task 選択機構が未整備のため見送り）。MainScreen `navigateToItem` は role 拡張可能な作りにしてあるので、Kanban 側の「指定 task を選択表示する」機構が入れば繋がる。
DoD 案: `[[` 候補に task が出る → 選択でリンク挿入 → クリックで Work セクションの該当 task が開く。

**起票依頼 (2) — type:bug（軽微）/ section:materials**
未保存の新規 Daily で `[[` リンクを挿入した場合、items_meta 行が未作成のため Connect グラフ辺（item_links）の作成をスキップしている（FK 違反回避。視覚リンクと遷移は動く）。Daily の items_meta を eager 作成するか、初回保存後に辺を追加する仕組みで解消できる。
DoD 案: 新規日の Daily に最初に挿入した `[[` リンクも Connect グラフ / バックリンクに反映される。

**起票依頼 (3) — type:feature（将来・低優先）/ shared-fix 候補**
item_links の完全双方向同期。現状は挿入時 insert のみで、本文からリンクを消しても item_links は残る（origin カラムが無く、削除同期すると LinkPanel 手動リンクを壊すため意図的に見送り）。実装するなら `wiki_tag_connections` に origin カラム追加の DDL（🛑 人手ゲート）が必要。
DoD 案: 本文から `[[` リンクを削除すると、inline 由来の item_links 辺だけが同期削除される（手動追加分は残る）。

---
