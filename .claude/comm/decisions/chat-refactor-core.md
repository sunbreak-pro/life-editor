# Decision Queue — chat-refactor-core

（2026-08-12 昇格分 = D-20260812-refactor-1 / D-20260812-refactor-2 / D-20260811-refactor-1 / D-20260811-refactor-2 — `.claude/decisions/` 台帳へ。D-20260812-refactor-1 と D-20260811-refactor-1 / -2 の台帳化とキューからの除去は chat-main が代行した）

---

### D-20260818-refactor-1: セクション切替の体感ロード、どの案から着手し、キャッシュはどこに置くか

- 背景: #1038 の実測（[`docs/reports/2026-08-18-section-switch-load.md`](../../docs/reports/2026-08-18-section-switch-load.md)）。体感の主因は本数ではなく、**切替のたびに前回値を捨てて取り直しが返るまで骨組みを見せる**こと（materials 復帰 = 5 本を全件再取得・キャッシュ利用 0 本）。副次的に、その画面が表示に使わない読みが schedule で 3 本 / connect で 2 本、Materials のタブ切替で 3 本ある
- A: **案 A（stale-while-revalidate）から**（推奨 — 「空の時間」を消せるのはこれだけ。`useDomainLoad` + 小さな store 1 本で、前例は `useLazyStalePool`）
  - A-1: キャッシュはメモリのみ（タブを閉じたら消える。安全側）
  - A-2: localStorage にも置く（リロード直後の初回表示にも効くが、古いスキーマの残骸というリスクを負う）
- B: **案 B（無駄取りの削減）から**（schedule 11→8 / connect 7→5 / Materials タブ切替 4→1。低リスクだが「空の時間」自体は残る）
- C: 両方やる（A → B の順で別 Issue 2 本）
- 放置時: **#1038 は調査完了としてこのまま保留**。実装 Issue は起票せず、refactor-core は次の自分宛 Issue に進む
- 期限感: いつでも（体感の話なので、実ブラウザ計測 #994 の結果と合わせて決めても良い）
