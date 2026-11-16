---
id: 2026-11-16-remove-audio-with-work-screen
type: decision
status: answered
asked: 2026-11-16
answered: 2026-11-16
chat: main
answer: 4 件とも消す
topics: [feature-removal, audio, timer, work-screen]
refs: ["#2716", "#2717", "#2369", "docs/reports/2026-11-16-feature-inventory-for-removal.html"]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# Work 画面と一緒に、音とタイマーまわりの 4 件を消すか

## 背景

> キューを経ていません。2026-11-16 に main のチャットが AskUserQuestion で聞いた問いを、そのまま写しました。

- **何が起きているか。** Work 画面を消すと、環境音のミキサーと音を鳴らす土台・完了のチャイム・サイドバーのタイマー表示は、使う所がなくなります。音の土台（`AudioProvider`）を使うのは、タイマー（`web/src/TimerHost.tsx`）と Work 画面（`web/src/work/WorkScreen.tsx`）の 2 か所だけでした。サウンドアイテムを組み込む Issue #2369 は、コードがまだありません。
- **なぜ決める必要があるか。** Work 画面の削除（Issue #2717）の「着手前に決めること」に残っていて、決まらないと #2717 の消す範囲が確定しません。
- **推奨と根拠。** 4 件とも消すほうを推奨しました。使う所が残らないためです。

## 選択肢と裁定

- 4 件とも消す（**採用** — ユーザー回答 2026-11-16）。Work 画面と同じ PR で外し、#2369 は作りません。
- サウンドアイテムだけ残す（却下）。音の土台を残し、#2369 を期日までにやるかを仕分ける案でした。
- Work 画面の PR では触らない（却下）。音まわりを、使われないコードとして残す案でした。

## 却下案が復活する条件

集中タイマーか、作業中に音を流す機能を作り直すと決めたとき。音源の置き場（Supabase Storage の公開バケット `sounds`）は、この決定では消していません。

## 波及

- Issue #2717 に、消す範囲（`AudioContext.tsx`・`AudioContextValue.ts`・`useAudioContext.ts`・`ambientLoop.ts`・`audioVolumeRamp.ts`・`constants/sounds.ts`・`AppProviders.tsx` の `AudioHost`）をコメントで足しました。
- CLAUDE.md §2 の「Audio は Provider 維持」、§3 の `AudioContext` の gotcha、§9 の音源のバケットの記述、`rules/frontend.md` の Provider の順序は、#2717 の PR で合わせます。
- DB の表（`sound_settings` など）を DROP するかは決めていません。
- Issue #2369 の close は、こうだいさんか chat-main が行います。
