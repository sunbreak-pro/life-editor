# 指示書: クロスプラットフォーム移行 + リリース準備ドキュメントの適用

**Created:** 2026-05-11
**Saved for re-use:** 2026-05-13（次回チャット用に整理）
**Project path:** `/Users/newlife/dev/apps/life-editor`
**Target branch:** 新規ブランチ `docs/cross-platform-release-prep`（推奨派生元: `refactor/web-first-v2`）
**Estimated time:** 15〜30 分
**Total commits:** 5

---

## 0. 次回チャットでの起動指示テンプレート

```
.claude/instructions/2026-05-11-apply-release-docs.md の手順に従って、
3 つのドキュメントを life-editor に適用してください。

入力ファイル (3 つ) は ~/Downloads/ にあります:
- ~/Downloads/requirements.md
- ~/Downloads/release-checklist.md
- ~/Downloads/plan-update-proposal.md

Step 1 から順に実行し、各ステップ完了時に「次のステップに進んでよいか」を確認してください。
Step 4（計画書本体の更新）は変更 1 つごとに git diff を見せてから次へ進んでください。
```

---

## 1. 概要

2026-05-11 の議論で作成した 3 ファイル（ユーザー手元、`~/Downloads/` 配下）を life-editor に取り込み、関連ファイルを更新する。

| 入力ファイル              | 配置先                                                           | 役割                                        |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| `requirements.md`         | `.claude/docs/requirements/2026-05-11-cross-platform-release.md` | 要件定義書（v0.1/v0.5/v1.0 DoD）            |
| `release-checklist.md`    | `.claude/docs/release-checklist.md`                              | リリース検証チェックリスト                  |
| `plan-update-proposal.md` | `.claude/archive/2026-05-11-plan-update-proposal.md`             | 計画書への 12 箇所 diff（適用後アーカイブ） |

### 更新対象の既存ファイル

- `.claude/2026-05-04-cross-platform-migration.md` — 計画書本体（12 箇所更新）
- `.claude/HISTORY.md` — 履歴追記

---

## 2. ⚠️ 実環境との差分（重要 — 元の指示書からの調整点）

元の指示書（2026-05-11 作成）と、現リポジトリ（2026-05-13 時点）の間で以下のズレを確認済み。実行時に注意。

### 2.1 計画書本体のパス

| 元指示書の参照                                                 | 実体パス                                         |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `.claude/feature_plans/2026-05-04-cross-platform-migration.md` | `.claude/2026-05-04-cross-platform-migration.md` |

**対応**: `feature_plans/` ディレクトリは存在しない。Step 2-3 の Related セクション書き換えでも `feature_plans/` ではなく実体パスを使う。CLAUDE.md は将来 `.claude/docs/vision/plans/` への移動を示唆しているが、本作業のスコープ外（別 PR で扱う）。

### 2.2 HISTORY.md の見出しスタイル

- 元指示書の例: `## YYYY-MM-DD — タイトル`
- 実体スタイル: `### YYYY-MM-DD - タイトル`（`###` 開始 + 半角ハイフン）

**対応**: Step 6 のテンプレートは実体スタイルに合わせて変換する。

### 2.3 現在の作業ツリーの未コミット変更

`refactor/web-first-v2` には以下の未コミット変更がある（Calendar データ整合性プランに紐づく作業途中）:

```
M  frontend/src/components/Settings/DataManagement.tsx
M  frontend/src/i18n/locales/en.json
M  frontend/src/i18n/locales/ja.json
M  frontend/src/services/DataService.ts
M  frontend/src/services/data/misc.ts
M  src-tauri/src/commands/data_io_commands.rs
M  src-tauri/src/lib.rs
?? frontend/src/components/Settings/CalendarDataResetDialog.test.tsx
?? frontend/src/components/Settings/CalendarDataResetDialog.tsx
?? .claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md
```

**対応**: 本ドキュメント追加作業は完全に独立したスコープ。以下のいずれかで分離:

- **推奨**: 未コミット変更を `git stash push -u -m "wip: calendar data reset dialog"` で退避 → 新ブランチで作業 → 戻す時は `refactor/web-first-v2` に切り戻してから `git stash pop`
- 代替: 未コミット変更をまず `refactor/web-first-v2` にコミット（calendar 作業として）してから新ブランチを切る

リネーム案（`refactor/web-first-v2` → 別名）は採用しない。未コミット作業と本ドキュメント作業を混在させると PR レビューが煩雑になるため。

---

## 3. 実行前提

### 必要なもの

- [ ] life-editor リポジトリへの読み書き権限
- [ ] 3 つの入力ファイルが `~/Downloads/` に存在
- [ ] §2.3 の未コミット変更を stash/コミットで処理済み（作業ツリーがクリーン）
- [ ] `.claude/skills/git-workflow/Skill.md` のコミット規約遵守（type: `docs:`、scope なし）

### 開始前の確認コマンド

```bash
cd /Users/newlife/dev/apps/life-editor
git status                                                    # クリーンであること
git branch --show-current                                     # 現在のブランチ確認
ls -la .claude/2026-05-04-cross-platform-migration.md         # 実体プラン存在確認
ls -la ~/Downloads/requirements.md \
       ~/Downloads/release-checklist.md \
       ~/Downloads/plan-update-proposal.md                    # 入力ファイル存在確認
```

---

## 4. 実行手順

### Step 1: ブランチ作成

派生元は `refactor/web-first-v2` を推奨（最新の移行プランがこのブランチで進行しているため）。

```bash
# 未コミット変更がある場合はまず退避（§2.3 参照）
git stash push -u -m "wip: pre-release-docs"

# 新ブランチ作成
git checkout refactor/web-first-v2
git pull origin refactor/web-first-v2
git checkout -b docs/cross-platform-release-prep
```

> **注意:** main 直接 push は禁止（MEMORY: `feedback_branch_protection`）。必ず新ブランチで行う。

---

### Step 2: requirements.md の配置

```bash
# 2-1. ディレクトリは既存（.claude/docs/requirements/）
cp ~/Downloads/requirements.md \
   .claude/docs/requirements/2026-05-11-cross-platform-release.md
```

**2-2. Related セクションのパス調整**（実体パスに合わせる）

配置したファイル冒頭の `Related:` を以下に書き換え:

```diff
**Related:**
-- `.claude/feature_plans/2026-05-04-cross-platform-migration.md` — 実装計画書（本書から派生）
+- `.claude/2026-05-04-cross-platform-migration.md` — 実装計画書（本書から派生）
- `.claude/archive/2026-04-29-web-first-migration.md` — 旧プラン（統合済）
-- `release-checklist.md` — リリース時の検証チェックリスト
+- `.claude/docs/release-checklist.md` — リリース時の検証チェックリスト
```

**2-3. 検証**

```bash
head -20 .claude/docs/requirements/2026-05-11-cross-platform-release.md
```

タイトル「要件定義書: life-editor クロスプラットフォーム移行 + 無料公開リリース」が表示されること。

**2-4. コミット**

```bash
git add .claude/docs/requirements/2026-05-11-cross-platform-release.md
git commit -m "docs: add requirements doc for cross-platform release"
```

---

### Step 3: release-checklist.md の配置

```bash
cp ~/Downloads/release-checklist.md .claude/docs/release-checklist.md
```

**Related セクションの調整**:

```diff
**Related:**
-- `requirements.md` — 要件定義書
+- `.claude/docs/requirements/2026-05-11-cross-platform-release.md` — 要件定義書
-- `.claude/feature_plans/2026-05-04-cross-platform-migration.md` — 実装計画書
+- `.claude/2026-05-04-cross-platform-migration.md` — 実装計画書
```

**検証**:

```bash
head -20 .claude/docs/release-checklist.md
grep -c "^- \[ \]" .claude/docs/release-checklist.md   # 95 以上を期待
```

**コミット**:

```bash
git add .claude/docs/release-checklist.md
git commit -m "docs: add release checklist for v0.1/v0.5/v1.0"
```

---

### Step 4: 計画書本体への 12 箇所適用（最も慎重に）

**ターゲットファイル: `.claude/2026-05-04-cross-platform-migration.md`**（`feature_plans/` ではない）

**4-1. 更新提案を一時配置**

```bash
cp ~/Downloads/plan-update-proposal.md /tmp/plan-update-proposal.md
```

**4-2. 変更 1〜12 を順次適用**

`/tmp/plan-update-proposal.md` の `【変更 1】` 〜 `【変更 12】` を順に処理:

```
for 変更番号 in 1..12:
  a. /tmp/plan-update-proposal.md から該当変更の [BEFORE] / [AFTER] ブロックを抽出
  b. .claude/2026-05-04-cross-platform-migration.md 内で [BEFORE] と完全一致する箇所を検索
     （改行・空白・インデント完全一致）
  c. 一致が 0 件または 2 件以上 → 即座に停止、ユーザーに報告
  d. 一致が 1 件 → 変更内容を git diff として提示し、適用してよいか確認
  e. 承認されたら Edit ツールで置換
  f. 次の変更へ
```

**4-3. 鉄則**

- BEFORE ブロックは完全一致が必要（改行 / 空白含む）
- 見つからない / 複数一致は **即座に停止**
- 変更ごとに diff をユーザーに見せる
- 12 件すべて完了するまで commit しない（部分適用は不可）

**4-4. 全 12 変更完了後の整合性検証**

```bash
wc -l .claude/2026-05-04-cross-platform-migration.md     # 元から 50〜100 行増
grep -c "terminal-division" .claude/2026-05-04-cross-platform-migration.md   # 1〜2（履歴的言及）
grep -c "Remote MCP" .claude/2026-05-04-cross-platform-migration.md          # ≥10
grep -c "capabilities.ts" .claude/2026-05-04-cross-platform-migration.md     # ≥2
grep -c "device_id" .claude/2026-05-04-cross-platform-migration.md           # ≥3
grep -c "Day 19" .claude/2026-05-04-cross-platform-migration.md              # ≥2
```

**4-5. コミット**

```bash
git add .claude/2026-05-04-cross-platform-migration.md
git commit -m "docs: update migration plan for Remote MCP design"
```

---

### Step 5: 更新提案ファイルのアーカイブ

```bash
cp /tmp/plan-update-proposal.md .claude/archive/2026-05-11-plan-update-proposal.md
rm /tmp/plan-update-proposal.md
```

**ステータス追記**（ファイル冒頭メタデータ直後）:

```diff
# 実装計画書 更新提案: Remote MCP 対応への切替

+**Status:** APPLIED — 2026-05-11
**Created:** 2026-05-11
+**Applied to:** `.claude/2026-05-04-cross-platform-migration.md` (12 changes)
-**Target file:** `.claude/feature_plans/2026-05-04-cross-platform-migration.md`
+**Target file:** `.claude/2026-05-04-cross-platform-migration.md`
**Reviewer:** こうだい (sunbreak-pro)
```

**コミット**:

```bash
git add .claude/archive/2026-05-11-plan-update-proposal.md
git commit -m "docs: archive applied plan update proposal"
```

---

### Step 6: HISTORY.md 更新

実体の HISTORY.md は `### YYYY-MM-DD - <title>` スタイル。先頭の `# HISTORY.md - 変更履歴` の直下、最新エントリの上に以下を追加:

```markdown
### 2026-05-11 - クロスプラットフォーム移行プランの Remote MCP 対応更新

#### Added

- 要件定義書: `.claude/docs/requirements/2026-05-11-cross-platform-release.md`
- リリースチェックリスト: `.claude/docs/release-checklist.md`

#### Changed

- 実装計画書 `.claude/2026-05-04-cross-platform-migration.md` を Remote MCP 設計へ更新（12 箇所）
  - terminal-division 別リポジトリ連携を廃止
  - Phase 5 を Remote MCP Server 構築中心に再定義
  - Phase 0 に Day 19 (MCP Server 素振り) を追加
  - Capability Flags システムを §2 重要原則に追加
  - device_id による Realtime ループバック対策を Phase 1 に追加
  - Risk R-007 〜 R-009 を追加

#### Archived

- `.claude/archive/2026-05-11-plan-update-proposal.md` — 適用済み更新提案
```

> **注意**: 既存スタイルが `### YYYY-MM-DD - タイトル` + `#### 概要 / 詳細` 系なので、上記の `Added / Changed / Archived` 構成は既存スタイルとは異なる。実体に合わせて `#### Added` → `#### 追加` 等に調整してもよい（task-tracker スキルが既存スタイルを優先する場合はそちら採用）。

**コミット**:

```bash
git add .claude/HISTORY.md
git commit -m "docs: log Remote MCP design pivot in history"
```

---

### Step 7: 最終確認

**全コミットの確認**:

```bash
git log --oneline refactor/web-first-v2..HEAD
```

期待: 5 コミット、最新が上

```
xxxxxxx docs: log Remote MCP design pivot in history
xxxxxxx docs: archive applied plan update proposal
xxxxxxx docs: update migration plan for Remote MCP design
xxxxxxx docs: add release checklist for v0.1/v0.5/v1.0
xxxxxxx docs: add requirements doc for cross-platform release
```

**ファイル配置**:

```bash
ls -la .claude/docs/requirements/2026-05-11-cross-platform-release.md
ls -la .claude/docs/release-checklist.md
ls -la .claude/archive/2026-05-11-plan-update-proposal.md
ls -la .claude/2026-05-04-cross-platform-migration.md
ls -la .claude/HISTORY.md
```

**プラン整合性**:

```bash
grep -n "Remote MCP Server" .claude/2026-05-04-cross-platform-migration.md | head -5
grep -n "capabilities.ts" .claude/2026-05-04-cross-platform-migration.md | head -3
grep -n "device_id" .claude/2026-05-04-cross-platform-migration.md | head -3
grep -n "Day 19" .claude/2026-05-04-cross-platform-migration.md | head -2
grep -n "Risk 7" .claude/2026-05-04-cross-platform-migration.md
```

すべて 1 回以上ヒットすること。

---

### Step 8: プッシュと PR 作成

```bash
git push -u origin docs/cross-platform-release-prep
```

```bash
gh pr create \
  --title "docs: prep for cross-platform release with Remote MCP" \
  --base refactor/web-first-v2 \
  --body "$(cat <<'EOF'
## 概要

2026-05-11 の要件議論を反映し、リリース準備ドキュメントを整備:

1. 要件定義書を新規作成 (`.claude/docs/requirements/2026-05-11-cross-platform-release.md`)
2. リリースチェックリスト v0.1/v0.5/v1.0 を新規作成 (`.claude/docs/release-checklist.md`)
3. 実装計画書を Remote MCP 設計へ更新 (12 箇所)

## 主要な設計変更

- terminal-division 別リポジトリ連携 → **Remote MCP Server (Cloudflare Workers)** に置換
- Phase 5 を再定義: Remote MCP Server 構築中心へ
- Phase 0 に Day 19 (MCP Server 素振り) を追加
- Capability Flags システム + device_id を導入

## 影響

- 累計タイムライン: 3-4.5 ヶ月 (変更なし、Phase 0 のみ +1 日)
- 既存コードへの影響なし (ドキュメントのみの変更)

## 関連

- 要件定義書 §7 の DoD とリリースチェックリストが整合
- 計画書本体への適用は `.claude/archive/2026-05-11-plan-update-proposal.md` にアーカイブ済
EOF
)"
```

> **PR base ブランチ**: 派生元が `refactor/web-first-v2` の場合は `--base refactor/web-first-v2`。main 派生の場合は `--base main`。

---

## 5. 完了判定

以下すべて満たされたら完了:

- [ ] 5 つのコミットが新規ブランチに積まれている
- [ ] PR が作成され、レビュー待ち
- [ ] `.claude/docs/requirements/2026-05-11-cross-platform-release.md` 存在
- [ ] `.claude/docs/release-checklist.md` 存在
- [ ] `.claude/archive/2026-05-11-plan-update-proposal.md` 存在（Status: APPLIED）
- [ ] `.claude/2026-05-04-cross-platform-migration.md` の Phase 5 が Remote MCP Server 構築中心
- [ ] `.claude/HISTORY.md` に 2026-05-11 エントリ追記

---

## 6. ロールバック

### Step 1〜3 失敗時（配置のみ）

```bash
git reset --hard HEAD~N    # N = 失敗時点までのコミット数
# または
git checkout refactor/web-first-v2
git branch -D docs/cross-platform-release-prep
```

### Step 4（計画書更新）失敗時

```bash
git reset --hard HEAD~1
git checkout refactor/web-first-v2 -- .claude/2026-05-04-cross-platform-migration.md
```

### Step 4 で部分適用してしまった場合

```bash
git checkout HEAD -- .claude/2026-05-04-cross-platform-migration.md
# Step 4 を最初からやり直す
```

### 全工程失敗時

```bash
git checkout refactor/web-first-v2
git branch -D docs/cross-platform-release-prep
# リモートにプッシュ済みなら
git push origin --delete docs/cross-platform-release-prep
```

> **破壊的 git 操作の確認義務**: MEMORY: `feedback_destructive_git_confirmation` — `reset --hard` / `branch -D` / force push 等は実行直前に必ず branch 状態を確認すること。

---

## 7. 補足

### 7.1 配置の根拠

| ファイル                  | 配置先                                           | 根拠                                                   |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `requirements.md`         | `.claude/docs/requirements/{日付}-{タイトル}.md` | CLAUDE.md §8 が「機能要件 `docs/requirements/`」と明記 |
| `release-checklist.md`    | `.claude/docs/release-checklist.md`              | 継続更新するため日付なし                               |
| `plan-update-proposal.md` | `.claude/archive/{日付}-{タイトル}.md`           | 一度限りの変更指示書、適用後アーカイブ                 |

### 7.2 コミット粒度

各ステップ独立コミット → 部分ロールバック可能。`docs:` scope なし（git-workflow Skill 規約）。

### 7.3 将来の Skill 化

本パターン（ドキュメント追加 + 計画書 diff 適用 + HISTORY.md 更新 + PR 作成）を 3 回程度実行したら `.claude/skills/apply-plan-update/Skill.md` への昇格を検討。

### 7.4 派生元の選択肢

- **推奨**: `refactor/web-first-v2`（移行プランがこのブランチ上で進行中）
- 代替: `main`（最もクリーンだが、移行関連のレビュー文脈は失われる）

ブランチ名 `docs/cross-platform-release-prep` は変更可。例えば `docs/release-prep-2026-05` など、リリースサイクルを反映する名前でもよい。
