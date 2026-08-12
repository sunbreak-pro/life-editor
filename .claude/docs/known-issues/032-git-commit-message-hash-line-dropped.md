# 032: コミット本文の行頭 `#` が git にコメント扱いされ、Issue 番号で始まる行が黙って消える

**Status**: Workaround
**Category**: Tooling
**Severity**: Minor
**Discovered**: 2026-08-12

## Symptom

`git commit -F -` に heredoc でコミット本文を流し込んだところ、**`#715 ...` で始まる 1 行だけが commit に載らなかった**（2026-08-12 実測）。エラーも警告も出ず、`git log` を読んで初めて欠落に気付く。

再現（`core.commentChar` が既定の `#` の場合）:

```bash
git commit -F - <<'EOF'
chore: sweep the backlog

#715 の調査メモをここに書く   ← この行が消える
残りの行は残る
EOF
```

## Root Cause

git は commit message を読むとき、**行頭が `core.commentChar`（既定 `#`）の行をコメントとして削ぎ落とす**（既定の `--cleanup=default` / `strip`）。`-F` でファイル・標準入力から与えた本文にも同じ cleanup が適用される。

GitHub の記法では `#<number>` が Issue / PR への参照なので、「`#715 ...` で書き始める」のはむしろ自然な書き方であり、**書き手の意図とツールの既定が正面から衝突する**。しかも消えるのは行単位で、残りの行は普通に通るため、diff を見ても異常に見えない。

## Impact

- コミット本文から Issue 参照が丸ごと落ち、後から「どの Issue の作業か」を辿れなくなる
- 静かに失敗する（exit 0・警告なし）ため、**気付かないまま履歴が確定する**。`git commit --amend` は push 済みだと使えないので、後追いの是正が高くつく
- PR 本文をコミット本文から生成している場合、同じ欠落が PR にも伝播する

## Workaround

いずれか 1 つで足りる。

1. **Issue 番号で行を始めない** — 行頭に語を置く（`Issue #715 の調査メモ` / `- #715 …` / `参照: #715`）。いちばん軽く、レビュー時の読みやすさも変わらない
2. **`--cleanup=verbatim` を付ける** — `git commit -F - --cleanup=verbatim`。本文を一切加工させない（末尾の空白行も残るので、整形は自分で担保する）
3. `git -c core.commentChar=';' commit -F -` のように commentChar を退避する（3 つの中では最も副作用が読みにくいので最後の手段）

## References

- `git commit --cleanup=<mode>` の既定は `default`（`-m` / `-F` いずれも strip 相当の cleanup が走る）
- 類例: `026`（PostToolUse formatter が隣接見出しを削る）— どちらも「ツールが黙って本文を書き換える」型
- 発見の経緯: #735（生成物の INDEX 2 本を git 非追跡へ）の作業中に、同日の別コミットで欠落を実測

## Lessons Learned

- **書式を持つテキストをツールに渡すときは「そのツールが本文を加工しないか」を先に疑う**。git の commit message は加工する側
- 静かに落ちる欠落は、`git log -1 --format=%B` で**書いたものと保存されたものを突き合わせる**のがいちばん早い検出手段
- 検索キーワード: commentChar / cleanup=verbatim / commit -F - / 行頭 # / Issue 番号 / コミット本文が消える
