# Cloud Routine ID Registry

> Anthropic Cloud Routine の `trig_<id>` 台帳。`/schedule` で登録 / 更新する際に参照。
> 登録後、必ず本ファイルに追記すること（後から update できなくなるため）。

---

## Registered Routines

| Name    | trig_id          | Schedule              | Prompt source                            | Status   | Registered  |
| ------- | ---------------- | --------------------- | ---------------------------------------- | -------- | ----------- |
| night   | `trig_PENDING`   | `0 22 * * *` JST      | `.claude/automation/routine-night.md`    | PENDING  | —           |
| morning | `trig_PENDING`   | `0 6 * * *` JST       | `.claude/automation/routine-morning.md`  | DEFERRED | —           |

---

## 登録手順

### Night Routine

```
/schedule create
  name: life-editor-night-engineer
  cron: 0 22 * * * (Asia/Tokyo)
  prompt: @.claude/automation/routine-night.md (本文の ## Prompt 以下を貼る)
  model: opus xhigh
```

返ってきた `trig_<id>` を上表に追記し、Status を ACTIVE に。

### Morning Routine（後追い）

夜 Routine が 1 週間以上安定稼働を確認したあとに登録:

```
/schedule create
  name: life-editor-morning-pm
  cron: 0 6 * * * (Asia/Tokyo)
  prompt: @.claude/automation/routine-morning.md (本文の ## Prompt 以下を貼る)
  model: opus xhigh
```

### Update 手順

プロンプト改訂後:

```
/schedule update <trig_id> --prompt @.claude/automation/routine-night.md
```

---

## 一時停止 / 削除

- 一時停止: `/schedule pause <trig_id>`
- 完全削除: `/schedule delete <trig_id>`（削除後は再登録必要、id は変わる）

---

## 既存 Routine 参考（干渉防止）

| Name                              | trig_id                          | Schedule         | 用途                       |
| --------------------------------- | -------------------------------- | ---------------- | -------------------------- |
| weekly-history-learning           | `trig_01K2emDH9VwKsFif4MTELcKK`  | 毎朝 07:03 JST   | 歴史学習配信               |
| commute-mobile-dev                | `trig_01SPebtYwCLHKMLEZoH5vkiH`  | 17:55 JST 平日   | 帰宅時 mobile 開発 routine |

→ Night 22:00 / Morning 06:00 は既存と時間重複なし

---

## 履歴

- 2026-05-26: 台帳初期化（chat-main / Night = PENDING / Morning = DEFERRED）
