# 2026-05-23 - comm プロトコルへの FileChanged 監視レイヤー追加（実装計画書）

> **Status**: DEFERRED — Phase 0（仕様検証）着手前のまま未着手。FileChanged hook は settings.json 未登録。`.session-name` 等の共有部品は per-chat 機構側で実装済み。本レーンは保留（DEFERRED）として archive
> **対象ブランチ**: 未定（`refactor/web-first-v2` 上の小規模変更 or 専用 branch）
> **正式置き場**: 確定後 `.claude/docs/vision/plans/2026-05-23-filechanged-comm-watch.md` へ
> **前提ドキュメント**: [`.claude/comm/README.md`](../../comm/README.md)（comm プロトコル SSOT）
> **関連計画**: [`2026-05-23-memory-history-per-chat-split.md`](./2026-05-23-memory-history-per-chat-split.md)（MEMORY/HISTORY per-chat 化。本計画と `.session-name` / worktree 正本パス解決を共有）

---

## 0. このシステムが解決する問題（背景と本質）

**結論: 既存 comm プロトコルの唯一の弱点「相手チャットが Outbox 更新に自動では気付かない」を `FileChanged` フックで埋める。**

`comm/README.md` は自ら弱点を明記しています。Claude Code にはファイル監視機能がない、ポストに手紙を入れても相手が開けに行かないと届かない、と。その回避策として README は「Phase 2: SessionStart hook で自動 cat」「`/loop` で定期チェック」を挙げていました。

`FileChanged` は OS のファイルイベント（macOS の FSEvents / Linux の inotify）でディスク変更をミリ秒で検知する、ポーリング不要の仕組みです。これは README が将来やると書いた Phase 2 の上位互換にあたります。**ポストに手紙が入った瞬間に鳴る呼び鈴**を付ける、と考えてください。

この呼び鈴があれば、ユーザーが毎回「他チャットの outbox 確認して」と指示する手間が消え、worktree や並行チャットで起きていた「別チャットが触っている領域を知らずにコンフリクト・無駄作業」（HISTORY に何度も登場する問題）を構造的に抑制できます。

### やらないこと（スコープ外）

- 雛形の作り直し。**単一書き込み者・追記専用・チャット別 Outbox の設計はそのまま温存**します。足すのは監視レイヤーのみ。
- 自動返信・自動編集。検知して「気付かせる」だけ。書き込み判断は従来どおり人間とメインチャットが行う。

---

## 1. 設計の全体像

部品は3つです。雛形（Outbox）はデータ構造、今回足すのは「呼び鈴」と「自己宛の握りつぶし」。

```
[書き込み側]  あるチャットが自分の Outbox に追記（既存・無改修）
      │  ファイル書き込みイベント発生
      ▼
[FileChanged] chat-*.md の変更を検知（新規）
      │  stdin JSON: file_path / change_type を受け取る
      ▼
[フックスクリプト] watch-comm.sh（新規）
      │  ① 変更されたのは「自分の Outbox」か？ → Yes なら静かに終了（自分の手紙に呼び鈴は不要）
      │  ② 他チャットの Outbox なら、最新エントリ（先頭）を抽出
      │  ③ 前回見たエントリと同じなら終了（重複通知の抑制）
      ▼
[通知] Claude のコンテキストへ「chat-X が @all 宛に投稿: …」を差し込む
```

### 自己判定の仕組み（重要）

呼び鈴が**自分の書き込みで鳴ってはいけません**。冷蔵庫に自分で貼った付箋に自分で驚くようなものです。

comm プロトコルではチャット名をユーザーが手動宣言します（「このチャットは chat-X」）。これをスクリプトが知る必要があるため、宣言時にメインチャットが `.claude/comm/.session-name`（チャット名1行だけのファイル）を書き出し、`watch-comm.sh` がそれを読んで「自分の Outbox = `chat-<session-name>.md`」を除外します。

---

## 2. 事前に押さえる技術前提（Phase 0 で必ず検証）

ここは未確定要素があり、計画全体がここに依存します。**思い込みで進めず、必ず最初に実機で確認**してください。家電を買う前にコンセントの形と電圧を確認するのと同じです。

| 項目                         | 現時点の理解                                                                                                        | 検証が必要な理由                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileChanged` の発火         | watched file がディスク変更されると発火。FSEvents/inotify ベース                                                    | 使用中の Claude Code バージョンで実際に発火するか                                                                                                                                         |
| matcher の一致               | **ファイルの basename に一致**（`.envrc` はどのディレクトリの `.envrc` にも一致）。`chat-*.md` のようなパターン指定 | glob/正規どちらの記法か、`*` が効くかを実機確認                                                                                                                                           |
| stdin の中身                 | `session_id` / `transcript_path` / `cwd` / `hook_event_name` / `file_path` / `change_type` の JSON                  | フィールド名が版で違わないか                                                                                                                                                              |
| **additionalContext の注入** | `hookSpecificOutput.additionalContext` でコンテキストへ差し込み                                                     | **FileChanged で会話途中に注入されるかは不確実**。PreToolUse/SessionStart で「受理されたが注入されない」バグ報告あり（GitHub #19432 / #13650 等）。注入されなければ後述の Fallback に切替 |
| watchPaths                   | SessionStart hook が `watchPaths` を返すと監視対象を動的設定できる                                                  | worktree 横断（§Phase 2）で絶対パス監視に使う                                                                                                                                             |
| CLAUDE_ENV_FILE              | SessionStart / Setup / CwdChanged / FileChanged で利用可。env を後続 Bash へ永続化                                  | 自己判定やデバウンス状態の受け渡しに使えるか                                                                                                                                              |

### additionalContext が注入されなかった場合の Fallback

「呼び鈴は鳴ったが声が届かない」状態への保険を、最初から二段構えにしておきます。

- **主系**: `FileChanged` → `additionalContext` でその場で気付かせる。
- **副系**: スクリプトが受信内容を `.claude/comm/.inbox-pending.md` に追記し、`SessionStart`（matcher 不問）でそれを cat する。会話途中の注入に失敗しても、次プロンプト送信時か次セッション開始時に確実に拾える。

副系だけでも README の「Phase 2: SessionStart 自動 cat」は達成されるので、最低ラインは保証されます。

---

## Phase 0: 仕様検証スパイク（最優先・10〜20分）

捨てる前提の使い捨て実験です。本実装の前に必ず通します。

- [ ] `.claude/settings.json` に `chat-*.md` を監視する最小 `FileChanged` フックを1つ置く。中身は `cat > /tmp/filechanged-probe.json` で stdin をそのまま保存するだけ
- [ ] 任意の `.claude/comm/outbox/chat-test.md` に1行 append し、`/tmp/filechanged-probe.json` が生成されるか確認
- [ ] 生成された JSON のフィールド名（`file_path` / `change_type` 等）を実値で確認
- [ ] `hookSpecificOutput.additionalContext` を返すスクリプトに差し替え、別チャット append が**会話途中の Claude に見えるか**を確認 → 見えれば主系、見えなければ副系（SessionStart cat）に確定
- [ ] matcher の `chat-*.md` パターンが効くか（効かなければ matcher を広めにして、スクリプト内で basename を正規表現フィルタする方式へ）

**Phase 0 の結論次第で Phase 1 の通知方式（主系/副系）が決まります。**

---

## Phase 1: 同一作業ディレクトリでの最小実装（プロジェクト固有）

> 現状の「1つの作業ディレクトリ＋複数 Claude セッション」（HISTORY の並行チャット運用の実態）を対象とする最小構成。この場合 `.claude/comm/` は全セッションで共有されるため、`FileChanged` はそのまま機能します。

### 1-1. フックスクリプト `watch-comm.sh`

配置先: `.claude/hooks/watch-comm.sh`（実行権限付与 `chmod +x`）

処理の骨子（疑似コード。Phase 0 の実値で確定させる）:

```bash
#!/usr/bin/env bash
# stdin から FileChanged の JSON を受け取る
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.file_path')"
BASENAME="$(basename "$FILE_PATH")"

# comm/outbox 配下の chat-*.md 以外は無視
case "$BASENAME" in
  chat-*.md) ;;
  *) exit 0 ;;
esac

# 自己判定: 自分の Outbox なら静かに終了
SELF="$(cat "$CLAUDE_PROJECT_DIR/.claude/comm/.session-name" 2>/dev/null)"
[ "$BASENAME" = "chat-${SELF}.md" ] && exit 0

# 重複抑制: 前回処理した mtime を記録し、変化なければ終了
STATE="$CLAUDE_PROJECT_DIR/.claude/comm/.watch-state/${BASENAME}.seen"
mkdir -p "$(dirname "$STATE")"
NOW_MTIME="$(stat -f %m "$FILE_PATH" 2>/dev/null || stat -c %Y "$FILE_PATH")"
[ "$(cat "$STATE" 2>/dev/null)" = "$NOW_MTIME" ] && exit 0
printf '%s' "$NOW_MTIME" > "$STATE"

# 最新エントリ（先頭の ## 見出しブロック1つ）を抽出
LATEST="$(awk '/^## /{c++} c==1{print} c==2{exit}' "$FILE_PATH")"

# 主系: additionalContext で通知（Phase 0 で注入可と確認できた場合）
jq -n --arg ctx "[comm] ${BASENAME} に新着:
${LATEST}" \
  '{hookSpecificOutput:{hookEventName:"FileChanged", additionalContext:$ctx}}'

# 副系（保険・常時併用可）: pending へ追記
printf '\n[%s] %s\n%s\n' "$(date '+%F %T')" "$BASENAME" "$LATEST" \
  >> "$CLAUDE_PROJECT_DIR/.claude/comm/.inbox-pending.md"
```

### 1-2. `.claude/settings.json`（プロジェクト固有）

```json
{
  "hooks": {
    "FileChanged": [
      {
        "matcher": "chat-.*\\.md",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/watch-comm.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "test -f \"$CLAUDE_PROJECT_DIR/.claude/comm/.inbox-pending.md\" && cat \"$CLAUDE_PROJECT_DIR/.claude/comm/.inbox-pending.md\"; : > \"$CLAUDE_PROJECT_DIR/.claude/comm/.inbox-pending.md\""
          }
        ]
      }
    ]
  }
}
```

> matcher の記法は Phase 0 の結果で確定（`chat-*.md` が通れば簡略化、通らなければ広め matcher + スクリプト内フィルタ）。

### 1-3. チャット名宣言フローへの組み込み

comm プロトコルの「セッション開始時にチャット名宣言」に1ステップ足します。

- ユーザーが「このチャットは chat-engineer」と宣言したら、メインチャットが `echo engineer > .claude/comm/.session-name` を実行
- これで `watch-comm.sh` の自己判定が成立

### 1-4. 除外設定

- [ ] `.gitignore` に `.claude/comm/.session-name` / `.claude/comm/.watch-state/` / `.claude/comm/.inbox-pending.md` を追加（セッション固有・一時状態のためコミット対象外）

### 1-5. 検証

- [ ] 2つの Claude セッション（同一作業ディレクトリ）を起動、それぞれ chat-a / chat-b と宣言
- [ ] chat-a が自分の Outbox に append → **chat-b 側に自動で新着が見える**（主系 or 次プロンプトで副系）
- [ ] chat-a 自身には呼び鈴が鳴らない（自己判定 OK）
- [ ] 同じ内容で2回 append しても二重通知されない（デバウンス OK）
- [ ] context 消費が過大でないか（最新1エントリのみ抽出しているか）

---

## Phase 2: worktree 横断対応（設計の急所）

> **ここが今回いちばん重要な判断ポイントです。** git worktree は作業ディレクトリが別々なので、worktree A の `.claude/comm/` と B のそれはディスク上は別物。コミット・マージするまで互いに見えません。Phase 1 のままでは worktree をまたいだ呼び鈴は鳴りません。

冷蔵庫の付箋でたとえると、**部屋ごとに別の冷蔵庫がある**状態です。共有の付箋ボードを1枚決めないと、隣の部屋の付箋は見えません。

### 共有ボードの置き場所（要決定）

| 案            | 置き場所                                                                          | 長所                                       | 短所                                            |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| **A（推奨）** | メイン作業ツリーの `.claude/comm/` を正本にし、各 worktree から**絶対パスで監視** | 雛形・git 履歴（README の第4防御層）を温存 | worktree からメイン path を解決する仕掛けが要る |
| B             | git 共通ディレクトリ配下（`git rev-parse --git-common-dir`）に comm を置く        | 全 worktree が定義上共有                   | git 管理外＝コミット履歴の防御層を失う          |
| C             | `~/.claude/comm/<repo-id>/`                                                       | 全 worktree 共有・最もシンプル             | git 管理外・グローバル汚染                      |

案 A の実装勘所:

- git の**共通ディレクトリは全 worktree で共有**される（`git rev-parse --git-common-dir`）。これを使えば、どの worktree からでもメイン作業ツリーの絶対 path を解決できる
- `SessionStart` フックで `watchPaths` にメイン `.claude/comm/outbox/*.md` の絶対パスを返し、自分の worktree 内ではなく**正本を監視**させる
- 書き込み（Outbox append）も正本に対して行うよう、チャット名宣言時に「comm 正本パス」を解決して固定する

### Phase 2 タスク

- [ ] 共有ボード置き場所をユーザーと確定（推奨は案 A）
- [ ] `SessionStart` フックで正本 comm パスを解決し `watchPaths`（絶対パス）を返す実装
- [ ] `watch-comm.sh` を正本パス基準に修正
- [ ] worktree を2つ作って実機検証（A の worktree の append が B の worktree のセッションに届くか）

---

## Phase 3: 指示ベースの反映（任意・ブロックはしない）

> ここまでは「気付かせる（受動）」。さらに「気付いた内容を作業に織り込む」を足す段階。**ただし `PreToolUse` で書き込みを機械的にブロックする方式は採らない。** スキルの記述で対応させる、指示ベースに振り切る。

### なぜブロックしないか（自由度の設計）

コンフリクト回避は「これは本当に重なっている作業か、それとも隣接しているだけか」という文脈判断が要る話です。これは skill-creator の自由度設定でいう「開けた野原（高自由度＝テキスト指示）」側であって、「崖のある細い橋（低自由度＝スクリプトでブロック）」ではありません。改札機で物理的に止めるより、「工事中、迂回してください」の張り紙を読んで自分で判断させる方が合っています。

そしてこの確率的な指示で釣り合うのは、**取りこぼしても致命傷ではない**領域だからです。見落としのコストが低いと割り切った話なので、確率的な指示でちょうど良い。逆に CLAUDE.md §9 の平文トークン禁止のような「絶対に起きてはいけない」ことは確率に任せず硬いガードにすべき、という線引きです。

### どこに書くか（別コンテキスト問題に注意）

ここに見落としやすい落とし穴があります。`FileChanged` の `additionalContext` は、**フックを動かしているそのセッション（＝メイン）**のコンテキストに差し込まれます。サブエージェント（role-engineer 等）は別コンテキストで走るため、メインが受け取った通知をサブエージェントは見ていません。

したがって、個別の agent.md にだけ「気づいたら反映せよ」と書いても、**そのエージェントの手元に通知が届いていないので空振り**します。郵便受けは玄関にあるのに別棟の人に「手紙が来たら対応してね」と頼むようなものです。

正しい置き場所は、**通知を実際に受け取り、かつ委譲を決めるレイヤー**です。

- **正本は `multi-session-coordinator` スキル側**に置く。ここは comm を読んで采配する層なので、通知も判断もここに集まる。「comm が他チャットの占有領域を知らせてきたら、委譲先の選定や着手範囲に織り込む」と記述する
- **CLAUDE.md には記述しない**（手順はスキルへ委譲し CLAUDE.md は「変わらない事実」のみ持つ方針に従う。§9 への追記も今回は行わない）
- 個別 agent.md への記述は最小限。書くとしても「**メインから申し送りで渡された占有情報を踏まえる**」という受け身の形に限り、検知ロジックは持たせない
- メインがサブエージェントに委譲するときは、占有領域の情報を**タスクの申し送りに乗せて渡す**。これで別コンテキスト問題を回避する

### Phase 3 タスク

- [ ] `multi-session-coordinator` スキルに「comm 通知を着手範囲・委譲判断に織り込む」節を追記（指示ベース・ブロックなし）
- [ ] 必要に応じて、メイン → サブエージェント委譲時の申し送りテンプレに「占有領域」項目を追加
- [ ] git-orchestrator との役割分担を明記（HISTORY で繰り返した「別チャットが HEAD 切替で作業が見えなくなる」「専有レーンに `git add -A` で踏み込む」事故は、ここの指示と git-orchestrator のガードで二重に防ぐ）
- [ ] 占有領域の宣言は既存 Outbox の文面（「これから `web/src/schedule/` を触ります」等）をそのまま流用し、機械可読フォーマットや `.active-lanes.json` のような新規共有状態は**作らない**（README の Phase 4 = ロック機構は不便を感じてから）

---

## Phase 4: 全プロジェクト共通化（`~/.claude/settings.json`）

Phase 1〜3 で実運用が安定してから、グローバルへ昇格します。

- [ ] `watch-comm.sh` を `~/.claude/hooks/` へ移し、`$CLAUDE_PROJECT_DIR` 基準で動くよう汎用化
- [ ] `~/.claude/settings.json` に `FileChanged` / `SessionStart` を登録
- [ ] comm プロトコルを使わないプロジェクトでは `.claude/comm/` 不在で静かに no-op になることを確認（スクリプト先頭で comm ディレクトリ存在チェック）
- [ ] グローバル settings のバックアップ（HISTORY で言及の `~/.claude/` 運用に従う）

---

## 付随作業

- [ ] **`comm/README.md` の更新**: 「Claude Code はファイルを監視できない」という最重要の制約節と、確認方法の比較表を、本実装の導入後に書き換える。READMEは comm プロトコルの SSOT なので、ここを直さないと記述と実態が乖離する（CLAUDE.md §0 の更新規則どおり、実装と同一 PR で）。**監視レイヤーの説明はこの README に集約し、CLAUDE.md には記述しない**（手順はスキル/ドキュメントへ委譲する方針に従う）

---

## 残課題・リスク

- **additionalContext 注入の不確実性**: Phase 0 の最重要確認事項。注入されなければ副系（SessionStart cat）に確定するが、その場合「会話途中の即時気付き」は失われ「次プロンプト時の気付き」に劣化する。許容できるかユーザー判断
- **worktree 共有ボードの置き場所**: Phase 2 で確定。git 履歴の防御層（案 A）か、worktree 横断の確実性（案 B/C）かのトレードオフ
- **発火頻度とコンテキスト消費**: 大量 append や高速連続書き込みで `FileChanged` が連発しうる。最新1エントリのみ抽出＋mtime デバウンスで抑えるが、実運用で context 消費を観察
- **`/dev/stdin` 既知バグとの関係**: 過去に把握済みの「`/dev/stdin` の Read でフリーズ」問題と、本フックの stdin 受け取りは別経路（フックは独立プロセスの stdin）。混同しないこと
- **チャット名の手動宣言依存**: 自己判定はユーザーのチャット名宣言が前提。宣言を忘れると自己通知が混じる。宣言フローを運用で徹底
- **指示ベースの取りこぼし**: Phase 3 はブロックしない設計のため、通知を見ても反映し損ねる可能性は残る。これは「見落としても致命傷ではない」と割り切った領域だから許容する判断。致命的な事故（main 直 push、専有レーン踏み込み等）は git-orchestrator 側の硬いガードが受け持つ、という役割分担を崩さないこと
