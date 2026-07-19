# MEMORY (chat-schedule-refine)

## 進行中

### 🔧 section:schedule Issue キュー消化 #296→#297→#298→#299（着手日: 2026-07-19）

**対象**: `shared/src/components/`（Schedule 関連）+ `web/`
**計画書**: Epic #290（tracking — 子 Issue close ごとにチェックボックス更新）

- 前回: #296 調査完了（Workflow 65 agents）→ ユーザーが仕様 4 点を決定（繰り返し OFF は選択中残す / ON は in-place attach / 掃除 soft-delete / この予定のみ削除は dismiss+復元UI / すべて削除カスケードは現状維持）
- 現在: #296 実装完了。shared build + test 1064 pass + web build + lint 全 green。session-verifier PASS。role-qa PASS（IMPORTANT-1 = convert の bump/attach 順序入替で対応済み）。sync-auditor PASS（DB-Q2 全経路遵守・IMPORTANT-1 の並行競合 = 楽観 routine を await 後に遅延させて対応済み）
- 次: #296 commit → PR（body に #296 紐付け・Epic #290 チェックボックス更新）→ #297 Step 2 双方向書き込み

## 直近の完了

- section:schedule スプリント #281 #278 #279 #280 ✅（2026-07-19 — 全 Issue close・PR は branch `claude/schedule-refine` から提出・実ブラウザ確認は merge 後 chat-main）
- #217 weekStartsOn prefs のカレンダー配線 ✅（2026-07-18 — PR #265 merge 済み・実ブラウザ確認は chat-main 側）
- life-tags S3 完了確認（PR #244 merge・epic #225 closed・`NodeType="task"` 単一値を実測・main 取り込み後 shared 884/884 + web build green）✅（2026-07-12）

## 予定

- （進行中キューに統合済み — #297 が旧「schedule-redesign Step 2」に対応。区切りごとに `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認）
