---
id: D-YYYYMMDD-<chat略称>-<連番>
type: decision
status: answered # enum のみ: answered（ユーザー回答済み）/ recorded（事後記録・自裁）/ superseded / withdrawn
asked: YYYY-MM-DD
answered: YYYY-MM-DD # answered / recorded では必須。withdrawn は取り下げ日
chat: <chat-name>
answer: A # ANSWERS.md の行と一致させる（監査突合キー）。recorded は裁定の要約 1 語でよい
topics: [kebab-case, で複数可]
refs: ["#NNN", "docs/vision/plans/....md"] # 根拠・関連（Issue / plan / file:line）
supersedes: [] # 置換した旧決定の ID、または旧記述の "file § 位置"
superseded-by: [] # 後継 D の ID（後継作成時に追記 — 双方向を records.mjs check が検証）
implemented-by: [] # 実装が着地した PR / commit
promoted-to: null # POLICY 昇格時に P-NNN
---

# D-YYYYMMDD-<chat>-<n>: <問いを 1 行>

## 背景

（キューのエントリ本文をそのまま貼る — 書き直さない。キュー原文が消化済みの場合は ANSWERS の行と反映先から再構成し、その旨を 1 行注記する）

## 選択肢と裁定

- A: …（**採用** — ユーザー回答 YYYY-MM-DD / 理由）
- B: …（却下 — 理由）

## 却下案が復活する条件（任意）

## 波及（任意）

（この裁定が書き換えた docs / 規約 / コードの一覧。implemented-by と重複しない範囲で）
