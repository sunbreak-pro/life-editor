# 「カオスの縁」コンセプト — Life Editor 統合分析

**Status**: ANALYSIS
**Date**: 2026-03-11
**Source**: Gemini との対話から発展したコンセプト

---

## コアコンセプト

> 「ユーザーを完璧に管理するツール」ではなく、「ユーザーの予測を適度に裏切り、対話する有機的なパートナー」

Life Editor は既に「没入型個人タスク管理」を掲げており、単なる管理ツールを超えたコンセプトを持っている。「カオスの縁」はこの方向性を**理論的に裏付け、差別化を深める**ものとして非常に相性が良い。

---

## 提案アイデアの実装可能性評価

### 1. タスクの「突然変異」システム

#### 1-A. 放置タスクの自動分割・変異提案

**実装難易度**: ★★★☆☆（中）
**優先度**: ★★★★★（最高）— Life Editor の差別化ポイントになる

**現状との接点**:
- `tasks` テーブルに `created_at`、`status` があり、放置日数の算出は容易
- `scheduled_at`、`due_date` との差分で「期限超過」も判定可能
- 既存の TaskDetail パネルに提案UIを差し込める

**具体的な実装案**:

```
[DB] tasks.created_at + status='TODO' → 放置日数算出
[新テーブル] task_mutations: id, task_id, suggestion_type, suggestion_text, created_at, accepted
[UI] TaskTree の放置タスク行に 🌱 アイコン表示 → クリックで提案モーダル
```

**変異のロジック（段階的に実装）**:

1. **Phase 1（ルールベース）**: シンプルなテンプレート分解
   - 「〜を書く」→「〜のアウトラインだけ書く」「〜の参考資料を1つ読む」
   - 「〜を完成させる」→「〜の最初の10%だけやる」
   - パターンマッチ + テンプレートで実装可能

2. **Phase 2（AI連携）**: MCP Server 経由で Claude に分解を依頼
   - 既に `mcp-server/` と `ai_settings` テーブルがある
   - Claude Code を介さず、直接 Anthropic API を叩く方向もあり
   - タスクのコンテキスト（親フォルダ名、メモ内容）を渡して適切な分割案を生成

3. **Phase 3（学習型）**: ユーザーが受け入れた変異パターンを蓄積し、提案精度を上げる

**さらに詰められるポイント**:
- 放置の閾値は固定3日ではなく、ユーザーのタスク完了ペースから動的に算出できる（Analytics の session データから平均完了サイクルを計算）
- 変異提案を「押し付け」にしないための UI デザイン（通知ではなく、TaskTree 上の控えめなインジケーター）
- 「変異を拒否」した場合の学習（このタスクは本人が意図的に保持している）

---

#### 1-B. ランダムな優先順位の揺らぎ（今日のお告げ / セレンディピティ）

**実装難易度**: ★★☆☆☆（低）
**優先度**: ★★★★☆（高）— 最小工数で最大のインパクト

**現状との接点**:
- タスクは `status='TODO'` でフィルタリング可能
- 「いつかやる」は現在明示的なステータスがないが、`scheduled_at IS NULL AND due_date IS NULL` で近似可能
- Work セクションのサイドバーに表示枠がある

**具体的な実装案**:

```
[ロジック] 毎日アプリ起動時 or 日付変更時:
  1. status='TODO' のタスクから weighted random で1つ選出
  2. 重み: 古いタスク > 新しいタスク、深い階層 > 浅い階層（埋もれやすいもの優先）
  3. localStorage に today's serendipity として保存

[UI] Work セクション or タスクセクションのトップに
  「✨ 今日の再発見: [タスク名]」カード
  → クリックでタスク詳細にジャンプ
```

**発展案**:
- WikiTag のグラフ接続を利用して、現在作業中のタスクと**意外なつながり**のあるタスクを提案（「これに関連するかも?」）
- Ideas セクションの Notes からもランダムに表示（過去のアイデアの再発見）

---

### 2.「余白」と「流動性」のスケジューリング

#### 2-A. カオス・ブロック（空白の強制挿入）

**実装難易度**: ★★★☆☆（中）
**優先度**: ★★★☆☆（中）

**現状との接点**:
- Schedule セクションに Dayflow（時間軸タイムライン）が既にある
- `schedule_items` テーブルでブロック管理済み
- Routine システムとの連携が自然

**具体的な実装案**:

```
[設定] Settings に「カオスブロック」トグル
  - 有効時: 1日のスケジュールに最低1ブロック（30-60分）の余白を確保
  - スケジュール登録時、余白がなくなる場合に警告

[UI] Dayflow 上で特別な見た目のブロック（波線 or グラデーション背景）
  ラベル: 「🌊 Flow Time」「🍃 余白」など（ユーザーカスタマイズ可）

[ロジック] Routine テンプレートにも「余白ルーティン」を追加可能
```

**さらに詰められるポイント**:
- 余白ブロックの位置を毎日少しずつランダムにずらす（カオス性）
- ポモドーロの BREAK とは別概念として設計（BREAK は作業の合間の休息、余白は「何が起こるかわからない時間」）
- Time Memo（V28）と連携：余白時間に何をしたかを記録 → Analytics で余白の使い方パターンを可視化

---

#### 2-B. 期限のグラデーション（曖昧なトリガー）

**実装難易度**: ★★★★☆（高）
**優先度**: ★★★☆☆（中）

**現状との接点**:
- `tasks` テーブルに `due_date` と `scheduled_at` がある
- 現在は日時指定のみ

**具体的な実装案**:

```
[DB] tasks テーブルに追加:
  deadline_type: 'exact' | 'week' | 'month' | 'someday' | 'condition'
  deadline_condition: TEXT (条件文: 「気分が乗った時」「天気の良い日」等)

[UI] DateTimePicker の代替/拡張として DeadlineSelector
  - 「正確な日時」「今週中」「今月中」「いつかやる」「条件付き」をタブ切替

[表示] TaskTree でアイコン分け:
  📅 exact  |  📆 week  |  🗓 month  |  🌙 someday  |  ⚡ condition
```

**課題と検討点**:
- 「条件付き」トリガーの自動判定は技術的に難しい（天気APIとの連携は可能だが、「気分が乗った時」は本質的にユーザーの主観）
- → 解決策: 条件は「リマインダーテキスト」として扱い、毎朝の「今日のお告げ」に条件付きタスクを混ぜる形で実装
- 曖昧な期限のタスクが永遠に放置されるリスク → 1-A の変異システムと組み合わせることでカバー

---

### 3.「予測不能な報酬」によるモチベーション設計

#### 3-A. ランダムなフィードバック演出

**実装難易度**: ★★☆☆☆（低）
**優先度**: ★★★★★（最高）— UXへの即効性が高い

**現状との接点**:
- `CompletionToast` が既にある（タスク完了時のトースト通知）
- `session_complete_sound.mp3` でサウンドフィードバック済み
- Electron なのでネイティブ通知も利用可能

**具体的な実装案**:

```
[新モジュール] frontend/src/utils/rewardEngine.ts

const REWARD_TIERS = {
  normal: { weight: 70, animation: 'checkmark' },      // 通常のチェックマーク
  nice:   { weight: 20, animation: 'confetti-small' },  // 小さな紙吹雪
  epic:   { weight: 8,  animation: 'confetti-big' },    // 画面全体の祝福
  legend: { weight: 2,  animation: 'special' },         // 珍しい演出（虹、花火等）
}

// 追加の揺らぎ要素:
// - 連続完了ボーナス: 3タスク連続で完了すると確率UP
// - 長期放置タスク完了: 1週間以上放置→完了で確率UP
// - ポモドーロ完走ボーナス: セッション完了ごとに mini reward
```

**バッジ/コレクション要素**:
```
[新テーブル] achievements:
  id, type, name, description, icon, unlocked_at, rarity

[例]
  「早起きの鳥」: 朝7時前にタスク完了
  「不死鳥」: 30日以上放置タスクを復活・完了
  「マラソンランナー」: 1日5ポモドーロ完走
  「セレンディピティ」: お告げタスクを実際に完了
  「カオスマスター」: 余白ブロックを7日連続確保
```

**さらに詰められるポイント**:
- サウンドも確率的に変える（通常 → たまにファンファーレ）
- 演出の「レア度」を可視化しない（知ると予測可能になり、変動比率の効果が薄れる）
- 完了時のメッセージもランダムプール化（「お疲れさま」「すごい!」「地道な一歩!」「伝説的!」etc.）

---

#### 3-B. 振り返りのカオス化（過去の自分との再会）

**実装難易度**: ★★☆☆☆（低）
**優先度**: ★★★★☆（高）

**現状との接点**:
- `memos` テーブルに日付ベースのメモが蓄積されている
- `timer_sessions` にタスクごとの作業履歴がある
- Analytics セクションに既に統計グラフがある
- `notes` テーブルにアイデアメモがある

**具体的な実装案**:

```
[ロジック] "タイムカプセル" エンジン
  - 起動時 or Analytics 閲覧時にランダム取得:
    1. 半年前〜1年前の完了タスク
    2. 過去のメモからランダム1件
    3. 過去のノートからランダム1件

[UI] Analytics の隅 or サイドバーに:
  「📦 タイムカプセル — 6ヶ月前のあなた」
  「✅ "React のチュートリアル完了" を達成していました」
  「📝 "将来はAIと一緒に仕事がしたい" と書いていました」

[発展] Work セクション開始時にも表示可能（モチベーション注入）
```

---

## カオスの縁から派生する追加機能アイデア

### 4. 「エントロピー指標」— アプリ全体の秩序/カオスバランスの可視化

**コンセプト**: ユーザーの行動パターンから「秩序度」を算出し、カオスの縁にいるかどうかを可視化する

```
[計算要素]
  秩序側（+）:
    - スケジュール通りに行動した割合
    - タスク完了率
    - ルーティン遵守率

  カオス側（-）:
    - 未計画タスクの実行数
    - 余白ブロックの活用度
    - セレンディピティタスクの着手率

  → 0（完全カオス）〜 100（完全秩序）のスケールで表示
  → 理想ゾーン: 40-70（カオスの縁）
```

**UI**: Analytics に温度計/ゲージメーター風の表示。ゾーンが偏りすぎると控えめに示唆。

---

### 5. 「タスクの有機的消滅」— ソフトデリートの拡張

**コンセプト**: 一定期間触れられなかったタスクは自動的に「枯れる」

```
[既存] isDeleted フラグ → ゴミ箱
[新概念] decayLevel: 0(活性) → 1(黄変) → 2(枯葉) → 3(堆肥化=自動アーカイブ)

- TaskTree 上でタスクの見た目が徐々に変化（透明度、色あせ）
- 枯れかけのタスクに触ると decay リセット（意識的な選択）
- 堆肥化されたタスクは「過去の養分」として振り返りに再利用
```

**既存の soft delete との整合**: decay は delete とは別軸。decay したタスクはアーカイブであり、削除ではない。

---

### 6. 「環境音のカオス混入」— サウンドミキサーの拡張

**コンセプト**: 既存の6種サウンド + カスタム音に「ランダムなアクセント音」を混ぜる

```
[既存] Sound Mixer: Rain, Thunder, Wind, Ocean, Birds, Fire
[新機能] Chaos Sound Layer:
  - 数分〜数十分に1回、短い環境音がランダムに挿入
  - 例: 遠くの鐘の音、猫の鳴き声、風鈴、小さな雷
  - 音量は環境音より控えめ（背景に溶け込むレベル）
  - これにより没入状態に「微妙な揺らぎ」が生まれ、集中が単調にならない

[設定] Chaos Sound: OFF / Subtle / Normal / Chaotic
```

これは **1/f ゆらぎ** の音響版。既存のプレイリストシステム（シャッフル再生）と組み合わせ可能。

---

### 7. 「コンテキスト・ドリフト」— WikiTag の偶発的つながり

**コンセプト**: WikiTag の接続グラフを使い、思いがけない関連性を発見させる

```
[既存] WikiTag connections: tag_a → tag_b のグラフ構造
[新機能] Ideas セクションの ConnectTab に:
  「🔮 意外なつながり」— 直接接続されていないが、
  2-3ホップで繋がるタグペアをランダムに提示

  例: 「料理」→「化学」→「実験」→「プログラミング」
  → 「料理とプログラミングの間に何か共通点は?」
```

Wiki Tag のグラフ探索で実装可能。既存の `wiki_tag_connections` テーブルとグラフ表示UIを活用。

---

## 実装優先度マトリクス

| アイデア | 工数 | インパクト | 既存資産活用度 | 推奨フェーズ |
|---------|------|-----------|---------------|------------|
| 3-A. ランダム報酬 | 低 | 極高 | CompletionToast拡張 | **Phase 1** |
| 1-B. 今日のお告げ | 低 | 高 | タスクDB + UI追加 | **Phase 1** |
| 3-B. タイムカプセル | 低 | 高 | Memo/Note DB活用 | **Phase 1** |
| 1-A. タスク変異 (Phase1) | 中 | 極高 | TaskTree拡張 | **Phase 2** |
| 5. タスクの有機的消滅 | 中 | 高 | isDeleted拡張 | **Phase 2** |
| 6. 環境音カオス | 中 | 中高 | Sound Mixer拡張 | **Phase 2** |
| 2-A. カオスブロック | 中 | 中 | Schedule/Dayflow | **Phase 3** |
| 4. エントロピー指標 | 中 | 中高 | Analytics拡張 | **Phase 3** |
| 7. コンテキストドリフト | 中 | 中 | WikiTag Graph | **Phase 3** |
| 2-B. 期限グラデーション | 高 | 中 | DB変更必要 | **Phase 4** |
| 1-A. タスク変異 (AI) | 高 | 極高 | MCP/API連携 | **Phase 4** |

---

## アーキテクチャ上の考慮点

### 新規テーブル案

```sql
-- タスク変異ログ
CREATE TABLE task_mutations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL,  -- 'split' | 'simplify' | 'reframe'
  suggestion_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',  -- 'pending' | 'accepted' | 'dismissed'
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 実績/バッジ
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  rarity TEXT DEFAULT 'common',  -- 'common' | 'rare' | 'epic' | 'legendary'
  unlocked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- カオス設定
CREATE TABLE chaos_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  serendipity_enabled INTEGER DEFAULT 1,
  reward_variation_enabled INTEGER DEFAULT 1,
  chaos_sound_level TEXT DEFAULT 'subtle',
  chaos_block_enabled INTEGER DEFAULT 0,
  task_decay_enabled INTEGER DEFAULT 0,
  entropy_display_enabled INTEGER DEFAULT 0
);
```

### IPC 追加パターン

新規 `chaosHandlers.ts` として:
- `chaos:getDailySerendipity` — 今日のお告げ取得
- `chaos:getTimeCapsule` — ランダム過去データ取得
- `chaos:getTaskMutations` — 変異提案取得
- `chaos:respondToMutation` — 変異への応答
- `chaos:getRewardTier` — 報酬ティア算出
- `chaos:getAchievements` — 実績一覧
- `chaos:getEntropyScore` — エントロピー指標算出

### フロントエンド新規モジュール

```
frontend/src/
├── hooks/
│   ├── useChaosEngine.ts        — カオス機能の統合フック
│   ├── useSerendipity.ts        — 今日のお告げ
│   ├── useRewardEngine.ts       — 報酬演出
│   ├── useTimeCapsule.ts        — 過去の自分
│   └── useTaskDecay.ts          — タスク減衰
├── components/
│   ├── chaos/
│   │   ├── SerendipityCard.tsx   — お告げ表示
│   │   ├── TimeCapsuleCard.tsx   — タイムカプセル
│   │   ├── RewardAnimation.tsx   — 報酬演出
│   │   ├── MutationSuggestion.tsx — 変異提案
│   │   ├── EntropyGauge.tsx      — エントロピーメーター
│   │   └── DecayIndicator.tsx    — 減衰表示
│   └── ...
├── context/
│   └── ChaosContext.tsx          — カオス設定の共有
└── utils/
    └── rewardEngine.ts           — 確率計算ユーティリティ
```

---

## まとめ: Life Editor × カオスの縁

Life Editor の既存アーキテクチャは「カオスの縁」を受け入れるための**土壌が非常に整っている**:

1. **データの蓄積がある**: タスク履歴、メモ、セッションログ → タイムカプセルや変異の材料
2. **音響システムがある**: Sound Mixer → カオスサウンドレイヤーの追加が自然
3. **WikiTag グラフがある**: → 偶発的つながりの発見エンジン
4. **Analytics がある**: → エントロピー指標の表示先が既にある
5. **MCP/AI 基盤がある**: → AI によるタスク変異提案への発展パス

**「AIと一緒に生活を設計する」** というv2テーマに、カオスの縁は **「完璧な設計」ではなく「生きた設計」** という哲学を加える。これは他のタスク管理アプリにない、Life Editor 独自の価値提案になる。
