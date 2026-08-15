# Decision Queue — chat-briefing-refine

### D-20260815-briefing-1: #872 の目標をどこに保存するか

- 背景: Issue #872（週・月・年の目標を Briefing に常設表示）。実測 = 「宣言」が既に TipTap 見出しをセクション扱いして DDL ゼロで書き込み UI を成立させている（`shared/src/components/briefing/dailySections.ts` + `web/src/briefing/hooks/useDailySections.ts`）
- A: 専用ノート 1 枚の本文に `## 週目標` / `## 月目標` / `## 年目標` を持つ（推奨 — DDL ゼロ・宣言の実装をそのまま写せる・PR 1 本で閉じる。副作用として Notes 側でも同じ目標を編集できる）
- B: 新規テーブル（`items_meta` + `goals_payload` の 2 行分割）。データモデルは綺麗だが DDL = 🛑 こうだいさんの `supabase db push` が挟まり PR 1 本で閉じない。mapper / RLS / Realtime / `syncDomains.ts` 対応表 / lockstep テストまで芋づるで増える
- 放置時: A で進める（後から B へ移送可能。移送は「本文をパースして行を作る」1 回の migration で済む）
- 期限感: #872 の実装開始まで（回答が無ければ A で着手する）

### D-20260815-briefing-2: 目標ノートの特定方法

- 背景: D-20260815-briefing-1 で A を採る前提。`daily-YYYY-MM-DD` という決定論的 id の前例が既にある（`shared/src/services/SupabaseDailiesUnifiedService.ts`）
- A: 予約 id `note-goals` で固定（推奨 — 改名・重複タイトルに強い。既存の前例と同じ流儀）
- B: タイトル規約（「目標」/「Goals」）で検索して拾う（実装は軽いが、ユーザーが改名すると行方不明になる）
- 放置時: A
- 期限感: 同上

### D-20260815-briefing-3: 期間が変わったときの扱い（ロールオーバー）

- 背景: 「今週の目標」は週が変われば別物になるはずだが、履歴を持つと実装量が跳ねる
- A: 常設テキスト 1 組。自動リセットなし、期間ラベル（「今週 8/10–8/16」等）だけ計算して表示する（推奨 — 目的は「視界に入ること」なので、まずそこだけ満たす）
- B: 期間キー付きで保存し、週が変わると欄が空になり前週分は履歴として残る（振り返りができるが、保存構造・UI とも別物の規模）
- 放置時: A（B は別 Issue に切り出す）
- 期限感: 同上

### D-20260815-briefing-4: 紙面のどこに置くか

- 背景: 朝刊の並びは masthead → フォーカス → AI 講評 → 宣言 → 予定 → Todo → 可視化 → 持ち越し
- A: 「宣言」ブロックの直下（推奨 — 今日 → 週 → 月 → 年 と時間軸が広がる自然な流れになる）
- B: masthead の直下（最上段で必ず目に入るが、今日の予定・Todo が 1 画面ぶん押し下がる）
- 放置時: A
- 期限感: 同上

### D-20260815-briefing-5: 夕刊にも出すか

- 背景: Issue の Scope には `EveningView.tsx` が挙がっているが、最小形では触らない想定
- A: 朝刊のみ（推奨 — まず 1 面で成立させ、夕刊は反応を見てから）
- B: 夕刊にも読み取り専用で表示する（1 日の締めに目標と突き合わせられる）
- 放置時: A
- 期限感: 同上

### D-20260815-briefing-6: Mobile で目標を編集できるようにするか

- 背景: `docs/requirements/mobile-scope.md` は Briefing を Consumption としているが、紙面は幅共通で、宣言・気分・完了トグルは narrow でも書ける。この「Consumption なのに書ける」矛盾は既に D-20260810-mobile-2 で係属中
- A: 幅共通で編集可（推奨 — 既存の宣言・気分と同じ扱い。ただし D-20260810-mobile-2 の矛盾を 1 件広げるので、その判断に本件も含める旨をスコープ表に追記する）
- B: narrow は読み取り専用にする（mobile-scope の語と整合するが、紙面内で 1 ブロックだけ挙動が違う）
- 放置時: A
- 期限感: 同上
