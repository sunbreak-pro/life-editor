# Outbox — chat-tags-docs

worktree `tags-docs`。担当 = #368（WikiTags 名前フィルタ）/ #474（plans Status 棚卸し）/ #472・#473（モバイル導線・#465 の着地待ち）。

## 2026-07-30 chat-main 宛: Connect のタグ pill 一覧にも名前フィルタが要る（#368 の横展開）

- **内容**: `shared/src/components/Connect/GraphControlPanel.tsx:177-198` がタグ全件を pill として羅列していて絞り込み手段がない。同じパネル内の検索入力（`:95-102`）は**グラフノード検索**でタグ pill には効かないため、「絞り込めるはず」と誤解しやすい。タグが数十件になると pill の壁になる
- **できること**: #368 で切り出した `shared/src/components/materials/SidebarFilterField.tsx`（props 注入・ソート無し・`size="sm"`）をそのまま挿せる。PR #481 が merge 済みなら追加実装はフィルタ state と `filter()` だけ
- **提案ラベル**: `section:connect` + `type:feature`（#368 の follow-up）

## 2026-07-30 chat-main 宛: archive/ の Status 棚卸し漏れ候補（#474 のスコープ外に残した分）

#474 で `.claude/archive/*.md` 83 本を全数実測しました。DoD の検証条件（`grep -n "^Status:"`）は満たしましたが、その grep に掛からない不整合が残っています。判断が要るので触らず報告します。

- **`**Status**:` 形式で enum 外 2 本**: `01_要件定義書_プロトタイプ環境.md:3` = `SPECIFICATION（凍結）` / `code-inventory-2026-04-25.md:3` = `ARCHIVED`（どちらも blockquote 内）。要件定義書・棚卸しメモに計画書用 enum を当てると文書種別の情報が落ちるため、enum 化するかどうかの判断を委ねます
- **Status 行が無い 4 本**: `2026-05-11-apply-release-docs.md` / `db-conventions-tauri-era.md` / `desktop-followup-2026-04.md` / `SUMMARY.md`（最後は索引なので無くて妥当）
- **検出方法の申し送り**: `grep -n "^Status:"` だけでは (a) `**Status**:` 形式と (b) blockquote 前置（`> Status:` / `> **Status**:`）を取りこぼします。全数チェックは各ファイル先頭 14 行を対象に `^>?\s*Status:` と `^>?\s*-?\s*\*\*Status[^*]*\*\*:` の両方を拾う必要があります（#474 では node スクリプトで実測。grep 単独だと 2 本を見落としました）

## 2026-07-30 chat-main 宛: worktree の upstream が origin/main を指していた（ブランチ運用の事故りやすい点）

- **症状**: この worktree の `claude/tags-368-name-filter` は upstream が `origin/main` に設定されていて、`git push`（引数なし）が「upstream の名前がブランチ名と一致しない」で失敗しました。**main へは push されていません**（remote の main は 36f16ff8 のまま実測確認済み）が、`tail` にパイプしていたため exit code が 0 に見えて成功と誤読しかけました
- **回避**: worktree でブランチを切ったら `git push -u origin <branch>` を明示する。パイプする場合は `${PIPESTATUS[0]}` で本体の exit code を見る
- **提案**: CLAUDE.md §7.4 の「ブランチ切替は 2 ステップ 1 セット」に、初回 push を `-u` 付きで行う旨を 1 行足すと事故が減ります（判断はお任せします）
