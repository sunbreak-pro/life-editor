# Routine Morning Prompt (PM Role) — 退役

> **2026-08-06 退役**。旧本文は Mac 時代の Cloud Routine 前提の「朝の PM ルーチン」で、中心は `goals.md` の Goal 状態機械（ACTIVE / PENDING / BLOCKED）を朝に更新することだった。同日の Phase 2 改訂で**その状態機械ごと畳んだ**ため前提が消えた。旧本文は git 履歴を参照。
> 朝の枠を使う定期ルーチンは [`routine-digest.md`](./routine-digest.md) が正本。ここを再稼働させる予定は無い。

## 旧 Step の行き先

| 旧 Step                  | どこへ行ったか                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| 前夜結果の取り込み・報告 | `routine-digest.md`（朝 06:03）が outbox を収集源にする                                      |
| Goal 状態更新            | **消滅** — Goal の一覧そのものを持たなくなった（→ [`goals.md`](./goals.md)）                 |
| PR レビューコメント反映  | digest が open PR を集め、計画書への転記は chat-main の手番                                  |
| 今夜の plan 候補を準備   | 夜のレーンが `goals.md` の選定基準で自分で選ぶ（→ [`routine-night.md`](./routine-night.md)） |
| Worktree prune           | **未継承** — merge 済みブランチの worktree 掃除はどのルーチンも持っていない（人手のまま）    |

最後の 1 行だけが後継のいない機能。必要になったら digest 側に「残存 worktree N 本・うち merge 済み M 本」の報告として足すのが素直（削除自体は不可逆寄りなので人の手番に残す）。
