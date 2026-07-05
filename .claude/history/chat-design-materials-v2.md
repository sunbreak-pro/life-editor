# HISTORY (chat-design-materials-v2)

### 2026-07-05 - Materials brief v2 改訂（IA + Lumen accent）

#### 概要

ClaudeDesign fan-out（work-order 方式）の `design-materials-v2` オーダーとして、`briefs/materials.md`（v1・PR #137 merge 済み）を v2 へ改訂。worktree `design-materials-v2` / branch `claude/design-materials-v2` で draft PR 提出。改訂幅は fan-out 中で最大。

#### 変更点

- **共通前提 v2 化**: §4 全 8 プロンプト（Tasks/Notes/Daily/Tags × Desktop/Mobile）の冒頭ブロックを `_COMMON-CONTEXT.md` の v2（Lumen blue accent + 目標シェル構成）へ全文差し替え。v1 は 4.1/4.2 が旧 accent hex 入りの全文埋め込み、4.3/4.4 は「（中略）」の省略プレースホルダだったため、8 本すべてを v2 全文埋め込みへ統一
- **旧 hex 一掃**: `#1f4fff`/`#1a42d9`/`#e1e6fb`/`#5b82ff`/`#7596ff`/`#e3e7ff`/`#2330b0` を除去（機械チェック 0 件）。intro の ⚠️ sync-drift 注記（旧 hex を本文に含んでいた）も撤去し v2 版数注記へ置換
- **header タブ再フレーム**: Tasks/Notes/Daily/Tags を「独立セクション」から「Materials 1 セクションの header タブ 4 つ」へ（IA 決定①）。各プロンプトを「サイドバー Materials アクティブ + コンテンツ最上部の 4 タブ行（現タブ active）」前提へ再構成。Mobile は下部固定タブ Materials（2 番目）+ セグメントコントロール表現
- **§3 統一方針明記**: 4 タブ間の新規作成導線（右端同位置・Tasks=+タスク / Notes=+ノート / Tags=+タグ / Daily=今日へ）・リスト密度・空状態を統一方針として明記。header タブ UI 自体（形状・アクティブ表現）は shell brief（D7）へ委譲（ユーザー選択・二重定義回避）
- **保全**: §1/§2 の現状インベントリと file:line 引用は Python 抽出で verbatim 保持（引用 6 点を実ファイルで裏取り済み・全て範囲内）

#### 検証

- `grep -c "v2 / 2026-07-05"` = 8 / 旧 hex grep = 0（OK）
- §4 コードフェンス 8 本すべてリポジトリパス無し（自己完結）/ COMMON 埋め込み 8 回一致
- diff は `briefs/materials.md` 1 ファイル + 自 tracker のみ・コード変更 0

#### 運用メモ

- 1 chat = 1 worktree = 1 branch を厳守（過去の共有 worktree 混線を回避）。組み立ては scratchpad の Python スクリプトで共通ブロックを機械的に 8 複製し、手打ちズレを排除
