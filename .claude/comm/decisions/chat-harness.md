# Decisions — chat-harness

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20261109-harness-1: 中ティアでも、仕組みの仮説を書いたあとこうだいさんの確認を待ってから実装に入るか

- 背景: Gemini 案の原則 1 は「人間が把握・検証できるようにしてから実装へ」と読める。グローバル CLAUDE.md の前提 1（ユーザーは見ていない・途中で止まらない）と、`rules/human-in-the-loop.md` は「書いて進む」を既定にした。分析 = `docs/reports/2026-11-09-agent-governance-and-harness-map.md` §3
- A: 書いて進む。仮説はスコープ宣言と PR 本文の「仮説と実際」に残し、止まるのは既存の 👀 / 🛑 Gate だけ（推奨 — 前提 1 と両立し、無人の回でも成立する。仮説と実際のずれは PR で突き合わせられる）
- B: 中ティアも仮説を出した時点で 👀 Gate にし、こうだいさんの返事を待ってから実装に入る（確認の回数が増える。無人の回では成立しないので対話セッション限定になる）
- 放置時: この PR を merge するまで何も変わらない。merge 後は A の文面で運用する
- 期限感: いつでも

### D-20261109-harness-2: PR 本文の「確かめていないこと」「読む順」の見出しを hook で検査するか

- 背景: `rules/human-in-the-loop.md` と `.github/pull_request_template.md` は宣言だけで機械の実体が無い。文章だけの禁止は破られる前提（`docs/vision/claude-md-layering.md` §4）。候補 = `gh pr create` を PreToolUse(Bash) で見て、本文に見出しが無ければ止める（`hooks/pre-commit-tracker-guard.sh` と同じ型）。MCP 経由で PR を作るクラウドのセッションには効かない
- A: 次の PR で hook を足す（推奨 — 規約は hook へ、の型に沿う。issue-workflow の PR もこの hook を通る）
- B: 宣言のまま 1 か月様子を見て、守られなかった PR の数で決める
- 放置時: 宣言のまま。hook は作らない
- 期限感: いつでも
