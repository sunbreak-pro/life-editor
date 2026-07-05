# HISTORY (chat-design-schedule-v2)

### 2026-07-05 - schedule design brief v2 改訂（work-order design-schedule-v2）

#### 概要

計画書 `2026-07-04-claudedesign-screen-design-fanout.md` の work-order「design-schedule-v2」(旧 D1') を実行。schedule design brief を v1 → v2 へ改訂した。変更は `.claude/docs/design/briefs/schedule.md` の 1 ファイルのみ（コード変更なし）。

#### 変更点

- **共通前提 v2 化**: §4 Desktop / Mobile 両プロンプト冒頭の共通前提ブロックを `_COMMON-CONTEXT.md` の v2 に全文差し替え（見出しに「v2 / 2026-07-05」・要約なし）
- **accent 一掃**: 旧 accent 系 hex（Lumen 化前のコバルト系）を Lumen blue（`#1d4ed8` 系）へ。旧 hex 機械チェック 0 件で pass
- **目標 IA 反映**: Mobile 下部タブを Schedule / Materials / Work / Analytics + More へ修正。Schedule 画面を header タブ「Calendar / Routines」構成へ再編（Routine 管理を縦積みから Routines タブへ昇格）
- **カレンダー台帳の置き場提案**: 現 CalendarView（フォルダ別カレンダー CRUD）を第 3 タブに昇格させず、Calendar タブのツールバー歯車 → 軽量モーダルに畳む提案を §3 に追加
- **frontmatter**: Owner-chat / Branch を design-schedule-v2 系へ更新、Status を Ready へ
- **完了ゲート**: `_TEMPLATE.md` §5 AC 全充足 + v2 機械チェック（v2 マーカー有 / 旧 hex 0 件 / §4 プロンプト本文にリポジトリパス無し）を pass
