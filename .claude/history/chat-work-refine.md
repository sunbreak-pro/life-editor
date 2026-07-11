# HISTORY (chat-work-refine)

### 2026-07-11 - #181 work 行消化（Layout Standard v1 adoption）

#### 概要

WorkScreen の独自レイアウトフレームを撤去し、MainScreen 側 PageContainer（width="reading", #180）へ幅・gutter・スクロールの所有権を移譲した。draft PR #192 で提出（merge = 人手ゲート）。

#### 変更点

- **WorkScreen desktop 分岐**: `max-w-[720px]` + `px-8` + `pb-6 pt-2` を撤去し `flex flex-col gap-4` のみに（commit 910af963）
- **WorkScreen mobile 分岐**: `px-6 pb-4 pt-3` を撤去（fullscreen タイマーは `min-h-[72dvh]` 自己完結・横は標準 gutter で充足）
- **検証**: shared build + test（94 files / 768 tests）+ web build pass。role-qa 独立レビュー PASS（ポータル/モーダルの clipping・stacking 影響なし実測確認）
- **docs**: orders 台帳に消化記録を追記（commit cc1833b0）。#181 は本文編集権限が無かったためコメントで代理チェックを依頼
