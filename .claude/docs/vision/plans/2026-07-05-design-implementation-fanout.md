---
Status: IN_PROGRESS
Created: 2026-07-05
Branch: claude/design-impl-fanout-plan
Owner-chat: frontend
---

# Plan: 生成デザインの実装 fan-out（ClaudeDesign import → shared/ 実装）

> brief fan-out（`2026-07-04-claudedesign-screen-design-fanout.md`・Step 8「別計画」）の後続。
> ClaudeDesign で生成された各画面デザインを claude_design MCP で import し、目標 IA の UI を `shared/src/components/` に実装する。
> **work-order 方式**: セッションは本計画書 + 作業 slug の指定だけでゴール（draft PR）まで自律実行する。

---

## Context

- **前提（完了済み）**: 9 brief が全機械チェック合格で main に揃っている（`.claude/docs/design/briefs/`）。ClaudeDesign へのファイル受け渡しは DesignSync → プロジェクト内 brief 参照の経路が実証済み。第 1 号の生成物 = App Shell（`Shell.md デザイン` プロジェクト）
- **方式**: 各画面のデザインが ClaudeDesign で生成されるたびに、対応する実装オーダーを 1 セッションずつ起動する。デザイン生成（🛑 ユーザー）→ 実装オーダー起動（🛑 ユーザー・1 コマンド + 1 行）→ 実装〜draft PR（🤖 セッション）
- **Non-goals**: デザインの再生成・brief の改訂（fan-out 計画の領分）/ DB・DataService 実装の変更 / `SectionId` からの terminal 除去（Issue #146 の別作業。**本 fan-out に混ぜない**）/ FROZEN `frontend/` への変更

## Scope (Touchable Paths)

```
shared/src/components/**        ← 実装の主戦場（新規 UI はここに集約）
shared/src/styles/**            ← トークン追加が必要な場合のみ（既存値の変更は 🛑）
web/src/**                      ← 画面配線のみ
.claude/docs/vision/plans/      ← 各オーダーの mini-plan（任意）
```

各セッションは自分のオーダーの成果物 + 自分の tracker 3 ファイル（memory / history / outbox）のみ commit する。

---

## 起動手順（ユーザー向け・1 オーダーにつき 1 コマンド + 1 行）

```bash
# 1. worktree / ブランチ / セッション標識を用意（slug は §作業レジストリ から）
cd /Users/newlife/dev/apps/life-editor
bash .claude/scripts/impl-work.sh <slug>

# 2. スクリプトの表示どおり新セッションを開き、最初のメッセージに 1 行:
計画書 .claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md の作業オーダー <slug> をゴールまで実行してください。import URL: <ClaudeDesign 共有リンク>
```

- **import URL の渡し方**: レジストリの URL 列が埋まっていればそれが正。**boot メッセージに URL が添えられた場合はそちらを優先**（デザイン生成のたびに計画書を commit し直す手間を省くため。レジストリへの反映は orchestrator が後でまとめて行う）
- **起動条件**: ①対象画面のデザインが ClaudeDesign で生成済み（URL がある）②依存オーダーが merge 済み（レジストリの依存列）

## セッション共通プロトコル（全オーダー共通）

1. **自己確認**: SessionStart の identity 表示で worktree = `.claude/worktrees/<slug>` / branch = `claude/<slug>` を確認。不一致なら作業せず停止・報告
2. **環境準備**: 最初に `git fetch origin main && git rebase origin/main` を実行（worktree 作成時点より main が進んでいる場合があるため。2026-07-06 追加 — 既存 worktree は 980bbea4 起点で古い）。worktree は node_modules 非共有 — `cd shared && npm install` と `cd web && npm install` を実行（`.env` 由来の build 差異に注意 → memory `worktree-supabase-treeshake`）
3. **デザイン import**: 次の定型文で claude_design MCP から取得（認証を求められたらユーザーに `/design-login` を依頼）:
   ```
   Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
   <import URL>
   ```
4. **必読順**: 本計画書全体 → 自分のオーダー詳細 → `.claude/docs/design/IA.md` → 自分の brief（`briefs/<section>.md` §3 デザイン方針・§4 意図）→ `.claude/rules/frontend.md` → オーダー記載の既存実装
5. **実装規約（不変式）**: `lumen-*` トークン必須・**新規コンポーネントに hex 直書き禁止** / 主要コンテナ背景は完全不透明 / i18n は props 経由・en / ja 両 catalog / DataService 境界厳守（コンポーネントから直接バックエンド呼び出し禁止）/ **import したデザインとリポジトリ規約が矛盾したら規約を優先**し、差分を報告に含める
6. **単一書込者**: シェル部品（AppShell / SidebarNav / NavItem / BottomTabBar / BottomSheet / HeaderTabs 系 / RightSidebar・MobileDrawer 系 = 2026-07-05 Turn 2 追加）と `web/src/MainScreen.tsx` の所有者は `shell-impl`（Turn 1 = #160 merge 後は follow-up の `shell-turn2-impl` が承継）。**セクションオーダーはシェル部品を編集しない** — 変更が必要なら自分の outbox に要望を append して報告
7. **重さの采配**: lead-pipeline のティア判定に従う。重い画面（materials 等）は実装前に mini-plan（`docs/vision/plans/2026-07-05-<slug>.md`・_TEMPLATE 準拠）を作ってから着手
8. **検証**: `cd shared && npm run build && npm run test` ／ `cd web && npm run build` が全て pass
9. **完了プロトコル**: AC 自己チェック → task-tracker 記録 → **draft PR**（タイトルはレジストリで固定）→ 自分の outbox（`.claude/comm/outbox/chat-<slug>.md`）に要約 append → 報告。**self-merge 禁止・main 直接 push 禁止**
10. **Gate**: 🤖 draft PR まで自律 ／ 🛑 merge・デザイン再生成の指示・トークン実値の変更 = ユーザー

## 作業レジストリ

| slug               | 対象                                                                                               | 依存                          | import URL                                                                               | PR タイトル                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `shell-impl`       | アプリシェル（サイドバー 5+2 / Mobile 4+More / header タブ標準）**✅ #160 merge 済（2026-07-06）** | なし（**最優先**）            | `https://claude.ai/design/p/c73cdbf4-1933-4a70-ac09-b843d2cee85c?file=App+Shell.dc.html` | `feat: app shell — target IA implementation (ClaudeDesign import)`                  |
| `shell-turn2-impl` | App Shell Turn 2（RightSidebar 詳細パネル + 開閉トグル + Mobile ハンバーガー drawer）              | shell-impl merge 済（着手可） | `https://claude.ai/design/p/c73cdbf4-1933-4a70-ac09-b843d2cee85c?file=App+Shell.dc.html` | `feat: app shell — rightSidebar detail panel + mobile drawer (ClaudeDesign Turn 2)` |
| `schedule-impl`    | Schedule（Calendar 週グリッド / Routines）                                                         | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: schedule — target IA implementation (ClaudeDesign import)`                   |
| `materials-impl`   | Materials 4 タブ（Tasks / Notes / Daily / Tags。最重量・mini-plan 必須）                           | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: materials — target IA implementation (ClaudeDesign import)`                  |
| `connect-impl`     | Connect（グラフ + バックリンク）                                                                   | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: connect — target IA implementation (ClaudeDesign import)`                    |
| `work-impl`        | Work（Pomodoro・タブなし単画面）                                                                   | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: work — target IA implementation (ClaudeDesign import)`                       |
| `analytics-impl`   | Analytics 4 タブ（ChartCard 統一・skeleton）                                                       | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: analytics — target IA implementation (ClaudeDesign import)`                  |
| `settings-impl`    | Settings（ユーティリティ枠）                                                                       | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: settings — target IA implementation (ClaudeDesign import)`                   |
| `auth-impl`        | Auth（ログイン / サインアップ・シェル外）                                                          | なし（シェル非依存）          | （未生成）                                                                               | `feat: auth — target IA implementation (ClaudeDesign import)`                       |
| `trash-impl`       | Trash（5 カテゴリ復元・ユーティリティ枠）                                                          | shell-turn2-impl merge 後     | （未生成）                                                                               | `feat: trash — target IA implementation (ClaudeDesign import)`                      |

## オーダー詳細（共通プロトコルとの差分のみ）

### shell-impl

- 【ゴール】目標 IA のアプリシェルを実装する。Desktop = サイドバー本流 5（Schedule / Materials / Connect / Work / Analytics）+ ユーティリティ枠（Settings / Trash・視覚分離）+ フッター（⌘K / user / SignOut）、折畳 64px。Mobile = 下部タブ 4 + More ボトムシート（Connect / Settings / Trash・safe-area）。**header タブ標準部品（HeaderTabs + Mobile 用 SegmentedControl）を新設** — 後続オーダー全員が使う
- 【既存実装】`shared/src/components/AppShell.tsx`（wideQuery 768px）・`SidebarNav.tsx`（240px / 64px）・`NavItem.tsx`・`BottomTabBar.tsx`・`BottomSheet.tsx`・`CommandPalette.tsx`・`Toast.tsx`・`web/src/MainScreen.tsx`・`OfflineBanner.tsx`
- 【注意】`SectionId` に terminal が残っていても触らない（Issue #146）。ナビから出さないだけに留める。サイドバー行のアクティブ表現（左端 3px accent バー + accent-subtle 地）は brief §3 の定義どおり
- 【AC 追加】brief `briefs/shell.md` §3 の header タブ標準（2px accent 下線・件数バッジ規約）と IA.md に完全一致 / 新設部品に hex 直書きなし（`grep -E "#[0-9a-fA-F]{3,8}"` = 0）
- 【Turn 2 追加スコープ（2026-07-05 デザイン更新・PR #160 は Turn 1 版で実装済み）】追加分 = **RightSidebar（詳細パネル。幅 320px / min 240px・左端リサイズハンドル・上部 48px「詳細」ヘッダー + 閉じる X・押し込み式）+ 開閉トグル（header タブ行右端・PanelRight。タブなし単画面は画面最上部右端）+ Mobile ハンバーガー（セグメント行左端・Menu）→ 左 drawer 320px（Desktop と同一内容 + 黒 30% スクリム）**。意匠の正 = brief §3「rightSidebar 標準」+ `App Shell.dc.html` Turn 2（フレーム 2a-2c）。実装時の必須補完: aria 付与 / タスク未選択の空状態 / drawer の safe-area / パレット外 hex 2 色（`#bfdbfe`・`#25252b`）は lumen トークンへ丸める。**対応方式 = follow-up に確定（2026-07-06 ユーザーが #160 を merge し worktree 作成を指示）→ 下の `shell-turn2-impl` オーダーへ分離**

### shell-turn2-impl

- 【ゴール】App Shell Turn 2 = **RightSidebar（詳細パネル）+ 開閉トグル + Mobile ハンバーガー → 左 drawer** を実装する。意匠の正 = brief `briefs/shell.md` §3「rightSidebar（詳細パネル）標準」+ `App Shell.dc.html` Turn 2 フレーム（2a-2c。import URL はレジストリの shell-impl と同一）。スコープ = パネル枠 + ポータル機構 + トグル + drawer + 空状態まで（セクション固有の中身の配線は各セクションオーダーの領分）
- 【前提】shell Turn 1（PR #160）は merge 済み。HeaderTabs / SegmentedControl / AppShell / `web/src/MainScreen.tsx` を再利用し、シェル部品の所有権を承継する
- 【仕様値】幅 320px（min 240px・左端 6px リサイズハンドル）・押し込み式（overlay 禁止・メイン領域が縮む）・背景 = subsidebar 色 + 左 border・上部 48px「詳細」ヘッダー + 閉じる X ／ トグル = lucide PanelRight（header タブ行右端。open 中 = accent 文字 + accent-subtle 地。タブなし単画面 = 画面最上部の右端）／ Mobile = lucide Menu 36×36 border 付きボタン（セグメントコントロール行の左端）→ 左から幅 320px の drawer + 黒 30% スクリム（Desktop rightSidebar と同一内容。ナビ用 More ボトムシートとは役割分離）
- 【必須補完（デザイン側の欠落）】aria 付与 / 未選択時の空状態 / drawer の safe-area / デザイン内のパレット外 hex 2 色（`#bfdbfe`・`#25252b`）は lumen トークンへ丸める
- 【前例】旧 frontend の `RightSidebarContext` ポータル方式（FROZEN — 読むのは可・流用は規約準拠で書き直し）

### schedule-impl / connect-impl / work-impl / analytics-impl / settings-impl / trash-impl

- 【ゴール】各 brief §3-§4 の意図 + import したデザインに沿って画面を実装。header タブは shell-impl が新設した HeaderTabs / SegmentedControl を**使う**（再実装しない）。rightSidebar のトグル・パネル枠・ハンバーガー drawer も shell 側（`shell-turn2-impl` が新設）の標準部品を**使う**（セクション固有の中身の設計は本 fan-out のスコープ外 — 枠の配線まで）
- 【既存実装】brief §2「現状 UI インベントリ」に file:line 付きで列挙済み — それを正とする
- 【注意】analytics は ChartCard / EmptyState / DateRangePresetSelector の新設候補（brief §3）。settings のショートカット表示語彙は保留中の監査指摘 m2 — 実装時にユーザーへ 1 回確認

### materials-impl

- 【ゴール】独立 4 画面（Tasks / Notes / Daily / Tags）を Materials 1 セクション 4 タブに再構成する最重量オーダー。**mini-plan 必須**（タブ間の状態保持・URL なしのタブ切替・4 画面分の配線変更を設計してから着手）
- 【注意】1 PR が大きくなりすぎる場合はタブ単位の段階 PR に分割してよい（分割時はレジストリの PR タイトルに ` (1/n)` を付す）

### auth-impl

- 【ゴール】ログイン / サインアップ画面（シェル外・未ログイン時の入口）。`web/src/AuthScreen.tsx` の置き換え。シェル非依存なので shell-impl と並走可

---

## Acceptance Criteria（機械検証可能・fan-out 全体）

- [ ] 各オーダーの draft PR が存在し、diff = 自分のオーダーの成果物 + 自分の tracker 3 ファイルのみ
- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` が全オーダーのブランチで pass
- [ ] 新設コンポーネントに hex 直書きなし（`grep -rE "#[0-9a-fA-F]{3,8}" <新規ファイル>` = 0。tokens.css を除く）
- [ ] シェル部品の変更が shell-impl 以外の PR に含まれない
- [ ] i18n: 新設 UI 文字列が en / ja 両 catalog に存在する

## Worklog

- 2026-07-05: 計画作成（chat-frontend）。受け渡し経路の実証（DesignSync push → ClaudeDesign がプロジェクト内 brief を読んで生成）を受け、App Shell 生成物の import URL をレジストリに登録。起動スクリプト `.claude/scripts/impl-work.sh` を追加（slug の whitelist は本レジストリを grep — 二重管理なし）。
- 2026-07-06: App Shell デザイン Turn 2（rightSidebar + Mobile ハンバーガー・2026-07-05 ユーザーフィードバック）を受け、shell-impl オーダーに【Turn 2 追加スコープ】を記載（対応方式 = 🛑 ユーザー判断）。単一書込者リストへ RightSidebar / MobileDrawer 系を追加。セクションオーダーには「rightSidebar は shell 標準部品を使う（中身はスコープ外）」を明記。brief 側の同期は design fan-out 計画 Worklog（2026-07-06）参照。
- 2026-07-07: PR #160（shell Turn 1）/ #161（v3 ドキュメント同期）merge 済みを確認。完成版 `App Shell.dc.html` を再取得し、前回 Turn 2 分析時と**バイト単位で同一**（= v3 ドキュメントは完成版と一致済み）を確認。Turn 2 の対応方式はユーザー判断で follow-up に確定 → `shell-turn2-impl` オーダーを新設（本行の main 反映前は impl-work.sh の whitelist を通らないため、worktree は orchestrator が手動 4 ステップで作成）。共通プロトコル 2 に「開始時 fetch + rebase」を追加（既存 worktree が 980bbea4 起点で古いため）。セクションオーダーの依存を shell-turn2-impl merge 後に更新（rightSidebar 枠の配線に標準部品が要るため）。
