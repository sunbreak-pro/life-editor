---
Status: EXECUTED（Phase 5 のみ保留） — 2026-07-04 フェーズB 実施済（labels / templates / Issues #117–#131 / バックリンク / CLAUDE.md）。Phase 5 Project 作成は `gh auth refresh -s project` 後に実施
Created: 2026-07-04
Owner-chat: main
Type: 要件定義 + 実装計画（移行計画書）
Repo: sunbreak-pro/life-editor（個人アカウント）
Related:
  - 移行元①: .claude/docs/known-issues/INDEX.md（+ NNN-*.md, _TEMPLATE.md）
  - 移行元②: .claude/docs/vision/plans/*.md, .claude/*.md（親子ロードマップ）
  - 連携: Orca ADE（Issue ドロワー / worktree 動線）
Decisions:
  - D1: GitHub Issues を SSOT にする
  - D2: Active/Monitoring のみ移行、Fixed はファイル凍結アーカイブ
  - D3: 詳細 .md は repo 残置、追跡用 Issue から link
  - D4: 個人アカウントのため種別は label `type:*`（issue type は不使用）
  - D5: ロードマップ初回移行は生きている親計画1本のみ / Severity は label のみ
---

# Plan: known-issues + ロードマップ → GitHub Issues 移行

> 課題管理（バグ）と機能ロードマップを、ファイルベースから GitHub Issues + Projects へ移す。
> Claude Code / Orca が `gh` 経由で課題を直接読み書きできる状態を到達点とする。

---

## 1. Context（なぜやるか）

- 現状、課題は2系統のファイルで管理されている。①バグ = `.claude/docs/known-issues/`（INDEX + 個別 `NNN-*.md`）、②ロードマップ = `.claude/docs/vision/plans/` と `.claude/` 直下の親子計画書。
- これらは AI（Claude Code）がファイルとして読める利点がある一方、(a) PR/コミットとの自動リンクが無い、(b) 進捗の一覧・フィルタ・ボード表示が無い、(c) Orca の「Issue → worktree」動線に乗らない、という制約がある。
- GitHub Issues は `gh` CLI で課題を JSON 露出するため、AI エージェントがそのまま課題を操作できる。これを SSOT に据えることで、人間・AI・Orca の3者が同じ課題台帳を共有できる。

## 2. Goals / Non-Goals

**Goals**

- Active/Monitoring のバグを GitHub Issues 化し、以後の新規バグも Issues で起票する。
- 生きているロードマップ（親計画書1本）を Epic Issue + sub-issue で追跡層化し、Projects でロードマップ表示する。
- `gh` を AI の標準課題インターフェースにし、CLAUDE.md に運用ルールを明記する。

**Non-Goals**

- Fixed 済み約24件を Issue 化すること（→ ファイル凍結。§4-D2）。
- 計画書 .md の全文を Issue 本文へ移すこと（→ .md 残置。§4-D3）。
- FROZEN 計画・その他 plan の起票（初回対象外。後続で判断）。
- dev-schedule.md（Google Calendar ミラー）の統合（今回スコープ外）。
- CI/Actions 連携や `@claude` 自動起票（将来の拡張。§9 に候補）。

## 3. 現状の実体（確認済み）

**① known-issues**

- 構成: `INDEX.md`（Active / Monitoring / Fixed の3表）+ `NNN-slug.md` + `_TEMPLATE.md`。
- 個別ファイルのヘッダ: `Status`（Active/Fixed/Workaround/Monitoring）/ `Category`（Bug/Structural/Schema/Performance/Security/Tooling）/ `Severity`（Blocking/Important/Minor）/ `Discovered` / `Resolved`。
- 本文セクション: Symptom / Root Cause / Impact / Fix・Workaround / References / Lessons Learned。
- 現状: ID 029 まで（統合により合計 25 件）。Active=3（028/027/026）、Monitoring=1（006）、残り Fixed。※028 のファイル Status は Workaround（INDEX 上は Active 表）
- 補足: Fixed の多くは旧 Tauri/D1 前提で、web-first 移行後は再現しない（凍結の根拠）。

**② ロードマップ**

- 実体パスは `.claude/docs/vision/plans/`（例 `2026-06-07-web-desktop-parity-roadmap.md`）と `.claude/` 直下。※`.claude/feature_plans/` は失効パス。
- frontmatter: `Status`（PLANNED/FROZEN/COMPLETED/DRAFT）/ `Created` / `Branch` / `Parent` / `Supersedes` / `Related`。
- 構造: 親ロードマップ → フェーズ別子計画書の親子階層。要件定義は `.claude/docs/requirements/`。
- **実行時判明（2026-07-04）**: parity roadmap は frontmatter「W0 未着手」のまま実体は W0–W8 全マージ済（W0=#59 / W1=#63,#66 / W2=#64 / W3=#68–70,#75 / W4=#78+follow-up / W5=#87 / W6=#89 / W7=#91 / W8=#96,#97,#105）。残は W4 follow-up（PR #116 ほか）と目視ゲートのみ。

## 4. 確定した設計判断（2026-07-04）

- **D1｜SSOT = GitHub Issues。** ローカル file は正にしない（二重更新回避）。
- **D2｜既存バグは Active/Monitoring のみ移行。** Fixed は凍結し Lessons Learned を grep 資産として保全。
- **D3｜ロードマップは詳細 .md を残置。** Issue は薄い追跡層（要約 + link + sub-issue + Projects 表示）に徹する。
- **D4｜種別は label で表現。** `sunbreak-pro` は個人アカウントで、org 限定の issue type は使えないため。
- **D5｜初回ロードマップ移行は親計画1本のみ。Severity は label のみ。**

## 5. 分類マッピング（現行 → GitHub）

GitHub 側の道具立ては「label（属性）/ state（open-closed）/ sub-issue（階層）/ Projects field（進捗・並べ替え）」。役割を分けて割り当てる。

### 5.1 種別（label `type:*`）

`sunbreak-pro` は個人アカウントのため、org 限定機能の issue type は使わず **label で種別を表す**（2026-07-04 確定）。

| 用途                     | label          |
| ------------------------ | -------------- |
| バグ（known-issues）     | `type:bug`     |
| ロードマップの親（Epic） | `type:feature` |
| フェーズ / 個別作業      | `type:task`    |

> sub-issue（親子）と依存（blocked-by）は個人 repo でも使えるため、階層表現は sub-issue を継続利用する。org 限定なのは issue type のみ。

### 5.2 Category → label `area:*`

`Structural / Schema / Performance / Security / Tooling` を `area:structural` 等の label に。Category="Bug" は `type:bug` に吸収（area 不要）。

### 5.3 Severity → label `sev:*`

`Blocking / Important / Minor` を `sev:blocking`（赤）/ `sev:important`（橙）/ `sev:minor`（灰）。Projects field へのミラーはしない（D5）。

### 5.4 Status → state + label

| 現行 Status | GitHub 表現                                                        |
| ----------- | ------------------------------------------------------------------ |
| Active      | open（**status ラベル無し = Active**。`status:active` は作らない） |
| Monitoring  | open + `status:monitoring`                                         |
| Workaround  | open + `status:workaround`                                         |
| Fixed       | closed（※既存 Fixed は移行せず凍結。新規のみ closed 運用）         |

### 5.5 ロードマップ frontmatter → GitHub

| frontmatter        | GitHub 表現                                                      |
| ------------------ | ---------------------------------------------------------------- |
| Status: PLANNED    | Project Status="Planned" / open                                  |
| Status: FROZEN     | Project Status="Frozen" / open + `status:frozen`（初回は対象外） |
| Status: COMPLETED  | closed                                                           |
| Parent             | 親 Epic Issue への sub-issue リンク                              |
| Related/Supersedes | Issue 本文の参照リンク or blocked-by 依存                        |

## 6. 移行手順（Phase 分割）

> 実行は専用 worktree + feature ブランチ（`chore/github-issues-migration`）。**gh 2.92 実測**: `--parent` / `--add-sub-issue` / `--blocked-by` は未搭載（gh 2.94 / 2026-06-10 リリースで追加）。紐づけは REST GA エンドポイント `POST /repos/{owner}/{repo}/issues/{n}/sub_issues` を使用。全 gh コマンドに `-R sunbreak-pro/life-editor` を固定（cwd 非依存 = known-issue 028 対策）。

- **Phase 0**: `gh --version` / `gh auth status`（scope 確認）/ `hasIssuesEnabled` 確認
- **Phase 1**: label 一式（type 3 / sev 3 / area 5 / status 3 = 14 本、`--force` で冪等）
- **Phase 2**: `.github/ISSUE_TEMPLATE/known-issue.yml` + `roadmap-item.yml`
- **Phase 3**: Active/Monitoring 4 件を `--body-file <元.md>` で起票
- **Phase 4**: Epic 起票 → W0–W8 を sub-issue 化（REST 紐づけ）。完了済みフェーズは起票直後に close（Epic 進捗バーが実態を示す）
- **Phase 5**: `gh project create` → `gh project link` → `field-create`（Area/Target）→ 全 Issue を `item-add`。※要 `project` scope（`gh auth refresh -s project`）。Status 選択肢とビュー 3 種（Table/Roadmap/Board）は UI 手動
- **Phase 6**: バックリンク（INDEX 冒頭注記 + 表直下・各 .md 末尾・roadmap frontmatter `Issue:`）
- **Phase 7**: CLAUDE.md（§7.0 デバッグ行・§9 Known Issue 節を Issues-first に書き換え）

## 7. Fixed の凍結処理（D2）

- 何もファイル移動しない。`INDEX.md` の Fixed 表と個別ファイルはそのまま残す。
- 目的は「Lessons Learned の grep 検索資産」の維持。新規 Fixed は GitHub Issue を closed にするため、以後 Fixed 表は増えない（凍結）。過去知見の検索は `gh issue list --state closed --search` と INDEX grep の両輪。

## 8. SSOT 運用ルール（移行後）

- **バグ / ロードマップ追跡の正 = GitHub Issues + Project。** 新規はまず Issue を起票。
- **詳細設計の正 = 計画書 .md**（`.claude/docs/vision/plans/`）。Issue は要約 + link のみ。両者は `Issue:` frontmatter と本文リンクで相互参照。
- **Fixed 履歴の正 = `.claude/docs/known-issues/`（凍結）。**
- **AI の読み書き経路:**
  - 読み: `gh issue list -R sunbreak-pro/life-editor --json number,title,labels,state` / `gh issue view <N> --json body`。
  - 書き: `gh issue create/edit/close`（`-R` 明示）。
  - Orca: Issue ドロワーで閲覧・編集し、Issue から worktree を生成。
- CLAUDE.md に「課題は `gh` で操作。計画書 .md を更新したら対応 Issue の DoD チェックも更新」と明記（実施済み）。

## 9. Orca 連携（実運用）

- Orca の Issue ドロワーで本 repo の Issue を一覧・フィルタ。着手する Issue から worktree を作ると、タスク名が Issue から自動で埋まり両者がリンクされる。
- Tasks サイドバーに上記 Project が現れ、カードから直接 worktree を作成可能。
- PR に `Fixes #N` を書いてマージ → 対応 Issue が自動クローズ（Project からも消える）。

## 10. 学習メモ（Anthropic 文脈）

- **`gh` = AI エージェントの GitHub インターフェース。** Claude Code も Orca も、内部的には `gh` を叩いて Issue を読み書きする。これが「AI が課題台帳を直接扱える」ことの実体。
- **GitHub MCP（任意）**: `gh` の代わりに GitHub 公式 MCP サーバを登録すると、より構造化された形で Issue/PR を扱える。
- **Skills 候補**: 「known-issue を定型で起票する」手順は `.claude/skills/` の SKILL.md にして再利用可能（同パターン3回で Skill 昇格の原則）。

## 11. リスクと緩和

| リスク                                | 影響 | 緩和                                                                                      |
| ------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| gh が 2.94 未満で `--parent` 非対応   | 中   | **顕在化済み（手元 2.92）**。REST `sub_issues` エンドポイントで紐づけ（本移行で実証済み） |
| issue type が個人アカウントで使えない | —    | 解決済み: 種別は label `type:*` で表現（D4）                                              |
| Issue と .md の二重更新・乖離         | 中   | 「.md=詳細 / Issue=追跡」の役割固定 + `Issue:` 相互リンク + CLAUDE.md 明記                |
| AI がファイル前提のまま課題を探す     | 低   | CLAUDE.md 更新 + INDEX.md 冒頭注記で経路変更を明示                                        |
| `project` scope 不足で Phase 5 失敗   | 低   | **顕在化済み**。`gh auth refresh -s project`（ブラウザ認証・ユーザー実行）後に Phase 5    |

## 12. 工数見積り

合計 約3.0–3.5h 見積 → 実績: フェーズA（dry-run + 実測検証）+ フェーズB（Phase 1–4, 6–7）を 2026-07-04 の 1 セッションで完了。Phase 5 のみ scope 取得待ち。

## 13. 検証（Definition of Done）

- [x] `gh label list` に type/sev/area/status ラベル一式が存在（14 本）
- [x] Active/Monitoring 4件が Issue 化され、正しい label が付与（#117–#120。028 は status:workaround）
- [x] 各移行元 .md 末尾に対応 Issue 番号が追記されている
- [x] 生きている親ロードマップが Epic Issue + sub-issue で表現され、.md へリンク（Epic #121 + #122–#131）
- [ ] Project にビュー（Table/Roadmap/Board）が作成され、全 Issue が登録（**Phase 5 = project scope 取得後**。ビューと Status 選択肢は UI 手動）
- [x] `INDEX.md` 冒頭に凍結注記、親計画書 .md に `Issue:` frontmatter
- [x] CLAUDE.md に `gh` 運用ルールが追記（§7.0 / §9 書き換え）
- [ ] Orca の Issue ドロワーに本 repo の Issue が表示される（**ユーザー目視確認**）

## 14. 確定事項（2026-07-04）

- [x] `sunbreak-pro` = 個人アカウント → issue type 不使用、種別は label `type:*`
- [x] ロードマップ初回移行 = 生きている親計画1本（web-desktop-parity）のみ。FROZEN・その他は後続
- [x] Severity = label のみ（Projects field ミラーはしない）
- [x] `gh --version` = 2.92.0 実測 → sub-issue 紐づけは REST 方式に確定
- [x] `status:active` label は不使用（open + status ラベル無し = Active）
- [x] 完了済みフェーズ（W0–W3, W5–W8）は起票即 close・W4 のみ open

## 15. 実施結果（2026-07-04 フェーズB）

- **Branch**: `chore/github-issues-migration`（worktree `.claude/worktrees/issues-migration`・base = origin/main fcbc1fb8）
- **Issue 対応表**: 028→[#117](https://github.com/sunbreak-pro/life-editor/issues/117) / 027→[#118](https://github.com/sunbreak-pro/life-editor/issues/118) / 026→[#119](https://github.com/sunbreak-pro/life-editor/issues/119) / 006→[#120](https://github.com/sunbreak-pro/life-editor/issues/120)
- **Epic**: [#121](https://github.com/sunbreak-pro/life-editor/issues/121) ／ sub: W0=#122 W1=#123 W2=#124 W3=#126 **W4=#127(open)** W5=#128 W6=#129 W7=#130 W8=#131
- **残作業**: Phase 5（Project 作成・item 登録 → その後 UI でビュー 3 種 + Status 選択肢 + Target 日付）／ Orca ドロワー目視確認
