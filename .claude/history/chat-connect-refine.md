# HISTORY (chat-connect-refine)

- 2026-07-11: [途中] Layout Standard v2 adoption（#206）— origin/main 取り込み（#202 docs 含む・merge 済）後、#196 由来の二重ヘッダーを解消。自前 ConnectHeader 撤去 + graph アクション（件数/フィルタ解除/reheat=再配置/fit=全体表示）を rightSidebar settings タブへ集約（新規 ConnectGraphActions.tsx + ConnectSidebarPanel に settingsHeader スロット + ConnectGraphView Desktop 分岐改修 + ConnectHeader.tsx 削除）。mobile/narrow 不変・幅トグルは layout-standard 後続。検証: shared build 緑 / web build 緑 / role-qa PASS(Blocker 0) / shared test は過負荷 flaky 6件のみ(単体 69/69 pass・Connect 無関係)。commit/PR 承認待ち
- 2026-07-11: [途中] #181 connect 行 — fluid variant 採用確認 + Connect の rem gutter 3 箇所を px lumen gutter トークンへ置換。検証全 pass（shared build / 768 tests / web build・role-qa PASS）。commit / PR 作成前
