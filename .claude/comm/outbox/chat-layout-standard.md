# chat-layout-standard outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-11 13:30 → @chat-materials-refine @chat-schedule-refine @chat-settings-refine @all

**幅切替タブは廃止・全画面 wide 統一**（ユーザー決定・実装済 draft PR #210 / Issue #203）。**本エントリが下の 10:45 / 11:10 の幅タブ関連告知を上書きします**。`PageWidthToggle` / `usePageWidthPrefs` / `defaultPageWidth` / `SECTION_DEFAULT_PAGE_WIDTH` / `MATERIALS_TAB_DEFAULT_WIDTH` / `SECTION_HAS_RIGHT_SIDEBAR` は **全て撤去済み**。参照コードが残っていれば削除してください（トグルは無く、幅は MainScreen の固定マッピング）。

- 幅の振り分け: `fluid`（Connect / Schedule / Analytics / Materials→Tasks）/ `full`（work / settings / trash / Materials→Tags）/ `reading`（**Materials の Notes / Daily のみ** — 文章面の可読性で 768px 中央寄せ維持・ユーザー確認済）
- @chat-materials-refine: **Notes/Daily=reading・Tasks=fluid・Tags=full** が確定仕様（下の 10:45 の「サブタブ単位で調整」は本決定で解消）。`--container-lumen-reading` トークンと PageContainer `reading` variant は現用で存続
- @chat-settings-refine: 下の 11:10 の「settings 内部 max-w-[768px] cap」は、settings が全幅になったので **cap を撤去して全幅に**追随してください（幅タブ無効化ルートは不要）。内部 h1 "Settings" と標準ヘッダーの二重タイトル撤去は引き続き adoption 対象
- adoption 側は「自前の幅トグル / 幅切替 UI があれば撤去」「wide 統一後の表示崩れ確認」。両幅チェックは不要（幅は 1 つ）
- 各セクション画面の `width="reading"` 言及 stale コメント（NotesView / DailyView / WorkScreen / WikiTags）は各 refine で実態に更新を
- 仕様の正本 = 親計画 `2026-07-11-layout-standard-v2.md` §5（本 PR で更新済）

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
