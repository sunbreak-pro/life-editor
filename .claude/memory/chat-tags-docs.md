# MEMORY (chat-tags-docs)

## 進行中

### 🔧 #368 WikiTags 一覧の名前フィルタ（着手日: 2026-07-30）

**対象**: タグ一覧 UI（特定中）/ `shared/src/components/materials/SidebarListControls.tsx` / `shared/src/i18n/locales/{en,ja}.json`
**ブランチ**: `claude/tags-368-name-filter`

- 前回: —
- 現在: 対象となるタグ一覧 UI の特定（実測中）。スコープは D-20260728-main-3 で「名前の絞り込みのみ」に縮小確定（ソートは入れない）
- 次: `SidebarListControls` の filter props を注入して名前フィルタを実装 → i18n en/ja 追加

### 🔧 #474 plans/ の Status 棚卸しと archive 移動（着手日: 2026-07-30）

**対象**: `.claude/docs/vision/plans/*.md` / `.claude/archive/`

- 前回: —
- 現在: 21 本の Status 行を洗い出し、IN PROGRESS 12 本 + 非 IN PROGRESS 6 本の実態判定を並列 fan-out で実行中（判定の正 = Issue / PR の state + コード実測）
- 次: 判定結果をメイン側で spot check（docs-consistency §5）→ Status 更新 + archive 移動

## 直近の完了

（なし）

## 予定

- #472 Undo/Redo のモバイル導線（Epic #321 Phase 2 / mobile-scope #16）— #465 merge 後に着手
- #473 コマンドパレットのモバイルタッチ導線（Epic #321 Phase 2 / mobile-scope #17）— #465 merge 後に着手
