# HISTORY ARCHIVE (chat-materials-refine, 2026-08)

ローリングアーカイブ: `history/chat-materials-refine.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-13 - #776 inline `[[` リンク配線の 3 つ写しを 1 実装へ（PR #808）

#### 概要

「本文の `[[ ]]` リンクを item_links のエッジにし、保存時に本文から消えたエッジを畳む」という配線が Notes / Tasks / Daily に 3 実装あったのを、`web/src/hooks/useInlineItemLinks.ts` 1 本に畳んだ。Notes と Tasks は逐語コピーで差は `console.error` のタグ 1 文字列だけ、Daily は同じ 3 手が park / flush の中に埋まっていた。PR #808 提出（Closes #776・merge = こうだいさん）。挙動変更なし。

#### 変更点

- **共有 hook**: 新規 `web/src/hooks/useInlineItemLinks.ts` が 3 手（`getLinksForItem` の重複ガード / `createItemLink(..., "inline")` / 保存後の `syncInlineLinks`）を持つ。置き場は 3 面が等距離で届く `web/src/hooks/`。`useItemLinkTargets` の `web/src/notes/` からの移動は見送った — `RichTextEditor` も同じく notes 配下から 3 面が横断 import しており、動かすなら一緒に動かす話になってスコープが膨らむ
- **写し痕の解消**: `console.error` のタグをホスト名の引数にした（`useInlineItemLinks("NotesView")` / `("KanbanView")` / `("DailyView")`）。`useTaskLinking.ts` の中に `[KanbanView]` が焼き付いていたのが Issue の指摘どおりコピー元の痕跡だった（Kanban はタスク詳細エディタの唯一のホストなので、呼び出し側が渡す名前としては正しい）
- **Daily**: park / flush（`pendingItemLinks`）は Daily 固有として残し、flush の内側だけ差し替え。`targetId === saved.id` の自己リンク判定は共有ガードに吸収（両方 skip なので結果同値）。`useWikiTagsUnifiedContext` の直接参照は DailyView から消えた
- **テスト +16 本**: `web/tests/useInlineItemLinks.test.tsx` 新設（8 本 = エッジ作成 / 生きた重複を書かない / soft-delete 済みなら書き直す / 自己リンク / 未保存 from / delete-sync / 失敗時タグが呼び出し元の名前になる×2）。`useNoteLinking.test.tsx` +3、`dailyView.test.tsx` +5（候補プールの受け渡し / park は保存着地で初めて書く #371 / 保存前に消したリンクは書かない / 既存エッジを触らない / 保存で消えたリンクの fold #372）。**Daily はエッジ作成も fold もこれが初カバー**。`useTaskLinking.test.tsx` は assertion 無変更で緑（DoD 要件）
- **jsdom 制約への当て方**: レイアウトが無く実サジェストのポップアップは駆動できない（CLAUDE.md §7.1）ため、Daily は stub エディタのボタンで「候補を選ぶ」「本文を保存する」を DOM イベントとして起こす形にした。ポップアップ自体は既存 `web/tests/itemLinkMenu.test.tsx` がカバー済み
- **検証**: shared lint（0 error / 既存 warning 3）・build・test 1980、web lint・build・test 285、shared / web の `typecheck:tests` — 8 ゲートすべて exit 0

### 2026-08-11 - #680 Notes の i18n 取りこぼし 3 点を catalog へ（PR #693）

#### 概要

ゴミ箱行の aria-label・本文エディタの placeholder・en の件数表記という、ja 設定でも英語のまま出ていた 3 点を i18n catalog に載せた。表示のみで機能影響はなかったが、アイコンだけのボタンでは aria-label が読み上げの全部なので、スクリーンリーダー利用者には英語しか届いていなかった。PR #693 提出（Closes #680・merge = こうだいさん）。

#### 変更点

- **catalog**: `materials.notes` に `bodyPlaceholder` / `untitled` / `restoreNote` / `permanentDeleteNote` を en/ja 両方へ追加。`materials.tasks.taskCount` は i18next の複数形（en = `_one` + `_other`、ja = `_other` のみ）に置換。呼び出し側 `KanbanView.tsx:252` は `t(key, { count })` のままで無改修（三項演算子を足していない）
- **ラベルの形**: ゴミ箱行の 2 ラベルは文字列でなく `(title) => string` のビルダーで渡す。ja は題名が文頭・en は文末に来るので、題名の置き場所は翻訳側の裁量にした
- **placeholder の持ち主**: `NoteBodyEditor` の中で `t()` を読む形にした（prop にすると Desktop 本文とモバイルシートの 2 箇所で渡し忘れが起きる — このファイルが存在する理由そのもの）。`RichTextEditor` の既定値も翻訳経由に変え、唯一まだ placeholder を渡していない Kanban 本文（#680 のスコープ外）も英語を出さなくなった
- **テスト**: `web/tests/notesI18n.test.tsx` を新設し、本物の i18next シングルトンを ja に切り替えて描画結果を読み戻す。既存 `notesView.test.tsx` は `t` をキーのエコーに差し替えるため、ハードコード英語も翻訳済み文字列も同じように通る = この種のバグに構造的に無反応で、3 点が描画対象なのに生き残った理由
- **lockstep 検査**: `shared/tests/i18n.test.ts` に en/ja のキー集合照合を追加。比較は**複数形サフィックスを剥いだ base key** で行う（en = one + other、ja = other なので、素のキー集合一致を要求すると i18next が決して読まない `taskCount_one` を ja に置く羽目になる）。`_other` は両側に必須。追加時点で既存キーの欠落はゼロ
- **検証**: shared lint / build / test（192 files・1623 tests）・web lint / build / test（25 files・190 tests）・`LC_ALL=C bash scripts/docs-lint.sh` すべて exit 0

### 2026-08-10 - #588 NotesView 925 行の分割 + materials 3 画面のテスト整備（PR #646）

#### 概要

`web/src/notes/NotesView.tsx`（925 行）を責務ごとに 5 ファイルへ分割し、NotesView / DailyView / KanbanView に web/tests のテスト 36 本を新設した。テストを先に敷いてから分割し、同じテストが分割の前後で緑であることを挙動不変の根拠にした。PR #646 提出（Closes #588・CI 緑・merge = こうだいさん）。

#### 変更点

- **テスト先行（commit ba05c3ab）**: `web/tests/{notesView,dailyView,kanbanView}.test.tsx` を新設（14 + 11 + 11 = 36 本）。ホストの配線だけを固定 = どの幅でどちらの面が出るか / クリックが何に届くか / 各面が何をマウントしてよいか。合成する shared の部品（`buildTagGroups` / column builders / list・sheet・panel）は本物のまま残し、派生リストの回帰がここで落ちるようにした。TipTap とタグピッカーのみスタブ
- **分割（commit ee2c2fc1）**: `NotesSidebarList`（Desktop 側リスト）/ `NotesMobileList`（Mobile ヘッダ + グループ + FAB）/ `NoteDetailSurface`（両面が載せる詳細パネル + パスワードゲート）/ `NoteBodyEditor`（配線済みエディタ 1 つ — 手写しコピー 2 箇所を廃止）/ `hooks/useNotePassword`。ホスト 925 → 469 行
- **ホストに残した判断**: 派生リストとシート対象は両面が読むため（面の内側で計算すると各ブレークポイントが同じ状態の別コピーを持つ）。Links / Trash の開閉も同じ理由（側リストは narrow で unmount するため、下ろすとリサイズで開閉を忘れる）
- **挙動不変の根拠**: `t()` キー集合が分割前後で完全一致（機械照合・i18n catalog 追加なし）／分割前に緑だった NotesView 14 本が無修正で緑／`git diff origin/main -- shared/` が空
- **検証**: shared lint 0 error・test 1512・build 緑／web lint 0・build 緑・test 160（18 files）。CI（typecheck + test + build / docs-lint）緑
- **#587 との調整**: `useNotesUnifiedAPI` / `SupabaseNotesUnifiedService`（shared-fix レーン担当）には触っていない。着手前・PR 前に `git fetch` 済みで origin/main は動いていなかった
- **環境**: 未追跡の `AGENTS.md` / `.agents/` / `.codex/`（main が 2026-08-09 にポインタ化した旧全文コピー版）が checkout を塞いだため `git stash push -u` で退避（stash@{0}・同種の退避は stash@{1} にも既存）

