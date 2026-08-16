# MEMORY (chat-work-refine)

## 進行中

（なし）

## 直近の完了

- #946 Pomodoro Settings の 2 列でラベル行数が違うと入力欄が揃わない ✅（2026-08-16）: **PR #984 open**（Closes #946・merge = 人手 P-001）。grid セルの高さを使う構造修正（フィールドに `h-full` + キャプションに `grow`）で、en / ja のどちらでラベルが何行に折り返しても入力欄が下端で揃う。ピクセル固定は不採用
- #882 Todo 未選択でタイマー開始したら「無題のTodo」を自動作成 ✅（2026-08-15）: **PR #907 open**（Closes #882・merge = 人手 P-001）。WORK を Todo 未選択で開始したら本物の Todo を 1 件作って紐付け、activeTodo にも据える。休憩では作らない / 作成失敗でもセッション行は残す、の 2 つを意図的な境界としてテストで固定
- #881 Mobile のスタート / 停止アイコンが上下と被る ✅（2026-08-15）: **PR #904 open**（Closes #881・merge = 人手 P-001）。fullscreen の操作列を Desktop 相当へ（メイン 72→56px・左右 52→44px）。縮小幅はユーザー確定（選択肢提示で「Desktop 相当まで落とす」）

## 予定

- life-tags adoption（兄弟計画 `2026-07-11-life-tags-unification.md`・着手は合図待ち・work は影響小）
