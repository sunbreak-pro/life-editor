# HISTORY ARCHIVE (chat-briefing-refine, 2026-08)

ローリングアーカイブ: `history/chat-briefing-refine.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-10 - 朝刊の操作導線 3 件（#585 / #623 / #609）

#### 概要

朝刊を「読むだけの紙面」から「今日を確定できる場所」にする 3 件を順に実装した。行を消せるようにし（#585）、その場で足せるようにし（#623）、スマホから詳細パネルに手が届くようにした（#609）。いずれも既存の Schedule 部品を読み取り流用し、朝刊専用の UI を新造していない。

#### 変更点

- **#585（PR #662・merged）**: 「今日の予定」→「今日のスケジュール」へ改称し、スケジュール行と Todo 行の「編集」の横に削除ボタンを追加。右端固定と負マージンをボタンから `RowActions` クラスタへ移し、編集ボタンの描画位置を 1 アクション時と同一に保った。ルーチン由来行は Schedule の `RepeatScopeDialog` を diff ゼロで流用（この予定のみ = dismiss / これ以降 = detach / すべて = ルーチンのソフトデリート — 単純削除は known-issue 017 でジェネレータに復活させられる）。手動イベントと Todo の削除はグローバル undo スタックへ push。持ち越し行は対象外（朝刊が編集していない日に作用するため）。
- **#623（PR #663・open / CI green）**: 予定節ヘッダと rightSidebar に「+」を置き、Schedule の `ItemCreatePanel` を読み取り流用して開く（`schedule/` 配下の diff ゼロ・文言も既存 `scheduleScreen.*` キーを再利用）。追加先は朝刊が見ている日に固定で日付ピッカーなし。新規 Event / 新規 Task / 既存 Task の配置の 3 経路を `ds` 経由で配線し、結果を取得済み state に畳み込んで即時反映。ノート添付は create を await した後（`wiki_tag_connections` の FK を RLS が再チェックするため — #371）。夕刊はスコープ外。
- **#609（PR #666・open）**: narrow の 朝刊/夕刊 帯の左端に `RightSidebarToggle variant="hamburger"` を置き、「今日の Todo」トレイの wide ガードを外した。ハンバーガー不在はバグではなく「開く手段が無いパネルは置かない」という意図的保留だったので、開き口のほうを用意して解除した形。`docs/requirements/mobile-scope.md` #1 を同一 PR で更新（あちらが朝刊のモバイルスコープの正本）。
- **テスト**: `shared/tests/briefingView.test.tsx` に削除・「+」の routing と a11y（可視ラベル優先の accessible name・当たり判定）を追加。`web/tests/` に 3 ファイル新規（`briefingRowDelete` 6 件 / `briefingCreate` 5 件 / `briefingNarrowTray` 2 件）。いずれも座標非依存（jsdom にレイアウトが無い — CLAUDE.md §7.1）。
- **テスト基盤**: `web/vitest.config.ts` で `recharts` を dedupe。shared を source alias で読むため `recharts` が shared/node_modules 側に解決され、そこから shared 自身の React を読み込んで React が 2 コピーになっていた（vitest では externalize されるので既存の react dedupe が効かない）。Analytics ウィジェットを描画する web 側テストが `Cannot read properties of null (reading 'useContext')` で全滅する状態だったのを解消。ブラウザビルドは既存 dedupe で単一インスタンスのままなのでテスト専用の対処。
- **衝突処理**: #623 の作業中に #585 が main へ merge されたため、`origin/main` を #623 ブランチへ取り込んで 7 ファイル分のコンフリクトを解消（両者を残し、新メンバは delete → add の順に統一。「+」の日本語ラベルは main の改称に追随して「今日のスケジュールに追加」へ）。
