---
id: D-20260902-materials-1
type: decision
status: recorded
asked: 2026-09-02
answered: 2026-09-02
chat: materials-refine
answer: B
topics: [materials, notes, attachments, editor, mobile]
refs: ["#1439", "#1404", "web/src/notes/useAttachmentUpload.ts", "web/src/notes/attachmentNode.ts", "shared/src/context/ToastContext.tsx"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260902-materials-1: 添付アップロード中の進捗をどう見せ、「保存されないノード」を作るか

## 背景

本件はキューに open エントリを積む前に、2026-09-02 のこうだいさんの `/goal` 指示（"#1439 attachment upload progress: settle the placeholder and the 'node that must not be saved' policy"）で裁定そのものが materials レーンに委任された。そのため `status: recorded`（ユーザー回答を経ない自裁）で記録する。異なる裁定が出た場合は新しい D ファイルを作って supersede する。

以下は Issue #1439 本文の「決めること」の原文。

1. アップロード中の見せ方: エディタ内のプレースホルダノード（保存対象外）か、エディタ外のトースト / 進捗バーか
2. プレースホルダにするなら、自動保存にどう拾わせないか（一時ノードを保存直前に落とす / `transient` 属性で mapper が捨てる / 別 state で持つ）
3. 失敗時の後始末: プレースホルダを消すだけか、再試行の導線を出すか
4. 対象幅: Desktop だけで十分か、Mobile 幅も同じ形か（#1404 の配線は Notes のみ）

前提の実装 = #1404（PR #1425）は「アップロードが終わってからノードを挿入する」。先に入れるとエディタの 800ms 自動保存に拾われ、まだ届いていないパスを指すノードが永続化されるため（`web/src/notes/useAttachmentUpload.ts` のヘッダコメント）。

## 選択肢と裁定

### 決めること 1 — 見せ方

- A: エディタ内にプレースホルダノードを挿し、保存対象から外す（**却下**）
- B: **ドキュメントの外に進捗を出し、ノードは今までどおり完了後に 1 度だけ挿す**（**採用** — materials レーン裁定 2026-09-02）

B を採る理由は 3 つ。

1. **保存事故が構造的に起きない。** A は「保存の直前でプレースホルダを落とす」処理が 1 経路でも漏れた瞬間に、届いていないバイト列を指すノードが永続化される。壊れ方が静かで、ユーザーからは「ノートが壊れた」としか見えない。B はドキュメントに一切触れないので、この失敗モード自体が存在しない。
2. **決定的な進捗（%）はそもそも出せない。** `@supabase/storage-js` 2.105.4 の `FileOptions` は `cacheControl` / `contentType` / `upsert` / `duplex` / `metadata` / `headers` だけで、進捗コールバックを持たない（2026-09-02 に `web/node_modules/@supabase/storage-js/dist/index.d.mts` を実測）。`upload()` は fetch 一発なので、% を出すには signed upload URL + XHR へ載せ替えるしかない。出せるのは「進行中」を示す不定形インジケータだけで、それをドキュメントの中に置く必然性は無い。
3. **実装が 1 箇所で済む。** 進捗はホスト（Notes 画面）の関心事に閉じ、TipTap のスキーマ・シリアライズ・undo 履歴のどれにも波及しない。

### 決めること 2 — 自動保存にどう拾わせないか

**不要**（1 の裁定の帰結）。検討した 3 案はいずれも却下する。

- 一時ノードを保存直前に落とす（却下 — 保存経路は自動保存・手動保存・セクション離脱など複数あり、「落とし忘れ経路」が将来ずっと増え続ける）
- `transient` 属性で mapper が捨てる（却下 — ドキュメントに「保存してはいけない状態」を持たせる設計そのものを持ち込まない。mapper は role ごとに複数あり、新しい経路が増えるたびに同じ配慮が要る）
- 別 state で持つ（却下ではなく **B の実装そのもの** — ただしノードではなくホストの UI 状態として持つ）

### 決めること 3 — 失敗時の後始末

**進捗表示を消して、既存の danger トースト（`attachment.uploadFailed`）だけを出す。再試行の導線は付けない。**

再試行ボタンのためには失敗した `File` をホストに保持し続けることになり、「まだ送っていないファイル」がアプリの状態に残る。これは 1 で避けた危険（未着のバイト列への参照）を別の形で持ち込む。再選択はスラッシュコマンドから 2 操作で済むので、導線の価値がリスクに見合わない。

### 決めること 4 — 対象幅

**両幅共通の 1 実装。幅分岐を作らない。** 対象セクションは Notes のみ（#1404 の配線範囲。Daily エディタは attach 導線を持たない）。

進捗表示がドキュメントの外＝ホストの帯なので、`useMediaQuery` の分岐を足す理由が無い。スマホからの主導線は公開 Web URL（CLAUDE.md §2）で同じホストが動くため、狭幅でもそのまま出る。

## 実装 Issue への申し送り

- **置き場所 = エディタ本文の直上に 1 行のステータス帯**（ファイル名 + 「アップロード中」 + 不定形インジケータ）。トーストにしない理由は、既定 4000ms で勝手に消える一方、`durationMs: 0` にすると今度は完了時に閉じる手段が無いため（`showToast` は toast の id を返さない — `shared/src/context/ToastContext.tsx`）。待ち時間の長さに追随できるのは常設の帯だけ。
- 同時アップロードは 1 件でよい（スラッシュコマンドは 1 ファイルずつ選ぶ）。
- a11y: `role="status"` + `aria-live="polite"`。
- i18n: `attachment.uploading` を en / ja へ追加（§6 の lockstep）。

## 却下案が復活する条件

- Storage の `upload()` が進捗コールバックを持つ、または別の理由で signed upload URL + XHR へ載せ替えるとき。決定的な % が出せるならドキュメント内プレースホルダの価値は上がる（ただし決めること 2 の保存事故の議論は残るので、それだけでは覆らない）。
- 添付が Notes 以外（Daily 等）にも配線されたとき、決めること 4 の対象セクションを見直す。

## 波及

- `web/src/notes/useAttachmentUpload.ts` のヘッダコメント「WHAT IT DELIBERATELY DOES NOT DO: show progress」は、実装 Issue の着地時に「進捗はホスト側の帯が出す」へ更新する。本 PR ではコードを触らない（#1439 の Scope 宣言どおり）。
