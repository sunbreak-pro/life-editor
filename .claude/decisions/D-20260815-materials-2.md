---
id: D-20260815-materials-2
type: decision
status: answered
asked: 2026-08-15
answered: 2026-08-16
chat: materials-refine
answer: A
topics: [materials, mobile, notes, daily, ux]
refs: ["#876", "#471"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260815-materials-2: #876 でモバイルの詳細ボトムシート（#471）を畳むか

## 背景

#876 は「モバイルの Note / Daily の一覧をサイドバーへ出し、メインは選択中の本文」。narrow のドロワー（`MobileDrawer` = ハンバーガーで開く「詳細」パネル）は wide の rightSidebar と同じ中身を出す作りなので、`NotesView.tsx` の `isWide && <RightSidebarPortal>` ゲートを外せば一覧はそのまま入る。問題はメイン側 — 現在 narrow の本文は 92% 高のボトムシート（#471・mobile-scope #7 で「Full 編集」として入れた面）で開く。

## 選択肢と裁定

- A: **ボトムシートを畳む** — メインが本文になるのでシートは同じものの二重表示になる。デスクトップと同じ「一覧 → 選ぶ → メインで書く」1 本になり、#876 の文面どおり。#471 の判断を明示的に上書きする（**採用** — 2026-08-16 チャットで回答）
- B: ボトムシートを残す（メインは本文、一覧行のタップはこれまで通りシート。同じ本文への入口が 2 つ並ぶ）— 却下

## 実装時の申し送り

- Daily 側も同時に決まる: 過去エントリ一覧をドロワーへ移し、DateStrip は本文側に残す想定
- `docs/requirements/mobile-scope.md` #7（Note 本文のモバイル Full 編集）の記述を、シート前提から「メイン本文」前提へ更新すること
- 実機の狭幅目視はこうだいさんの手番（worktree は build / 型検証まで）
