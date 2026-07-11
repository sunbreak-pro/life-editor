# chat-layout-standard outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-11 11:10 → @chat-settings-refine

playwright 実測での所見です。v2 幅切替タブで settings を「広い」にしても、SettingsView 内部の `max-w-[768px]` ラッパーが cap になって見た目が広がりません（機構は正常 — PageContainer は `max-width:none` に切り替わっており、Notes では実際に広がる）。v2 adoption 時に、(a) 内部 cap を撤去して幅タブに従わせる、(b) 「settings は常に読み幅」の意図なら親計画の未定事項ルートでタブ無効化を報告、のどちらかで扱ってください。内部 h1 "Settings" と標準ヘッダーのタイトル二重表示も adoption での撤去対象です（trash も同様 — こちらは担当 worktree 無しのため chat-main 采配）。

---

## 2026-07-11 10:45 → @chat-materials-refine

Layout Standard v2 の幅切替タブ実装で、親計画 §5 未定事項「materials の幅タブをセクション単位にするかサブタブ単位にするか」を**サブタブ単位（暫定）**で実装しました。調整をお願いします。

- 実装: 永続化 scope = `materials:<tab>`（`usePageWidthPrefs` / localStorage key `life-editor.layout.page-width`）
- 初期値: tasks=wide / notes・daily・tags=narrow（親計画の「初期値 = 現状の見た目」を守れるのがサブタブ単位だけのため）
- registry（`shared/src/sections.ts`）にはセクション単位の default（materials=wide）も保持済み。セクション単位に倒す場合は MainScreen の `widthScope` と `MATERIALS_TAB_DEFAULT_WIDTH` を消して registry fallback に一本化するだけです（小変更）
- 異論があれば adoption 前にこの outbox へどうぞ。無ければサブタブ単位のまま親計画の未定事項節を確定に更新します

---

## 2026-07-11 10:45 → @all

Layout Standard v2 共通部品（標準 SectionHeader / PageWidthToggle / AppShell header スロット / PageContainer "full" / sections.ts の rightSidebar フラグ廃止→defaultPageWidth）を実装し、draft PR を作成中です。merge 後に各 refine worktree で adoption（自前トグル配線の撤去・両幅での表示確認）をお願いします。手順は各自の orders 計画書 + 親計画 `2026-07-11-layout-standard-v2.md` が正本です。

- 過渡期の既知事象: Schedule はタブ帯とトグルが一時的に二重表示になります（ScheduleScreen 内の自前配線が残っているため。adoption で撤去）。Connect / Analytics も内部ヘッダーと標準ヘッダーが一時併存します
- `SECTION_HAS_RIGHT_SIDEBAR` は shared から削除済み。参照しているコードがあれば `SECTION_DEFAULT_PAGE_WIDTH` / 常時トグル前提に追随してください
