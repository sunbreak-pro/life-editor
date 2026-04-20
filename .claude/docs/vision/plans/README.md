# Vision Plans

> Vision で示した方針・原則を **実装着手レベル** に落とした計画書を置く場所。

---

## 位置づけ

- **`vision/*.md`**: 抽象・設計原則・方針（Why と What）
- **`vision/plans/*.md`**: 具体的な実装プラン（How / When / Where、ファイル名・関数名・順序）

Vision 直下のドキュメントから本ディレクトリの該当プランへ相互リンクする。

## 命名規則

```
YYYY-MM-DD-<slug>.md
```

- `YYYY-MM-DD`: 起票日
- `<slug>`: ケバブケース。元 Vision との対応が分かる名前を推奨（例: `2026-04-20-mobile-data-parity-phase-a.md`）
- 同じ Vision に複数フェーズある場合は `-phase-a` / `-phase-b` 等で枝分かれ

## ライフサイクル

1. **起票**: `vision/<topic>.md` から相互リンクを貼って本ディレクトリに新規作成
2. **進行中**: コードと同一 PR で更新。MEMORY.md の進行中欄にも反映
3. **完了**: `.claude/archive/` へ移動。学びは vision/ 側に統合（CLAUDE.md §9 のフローに従う）
4. **却下 / 凍結**: 理由を書いて `.claude/archive/dropped/` 等へ

## Vision との関係

- 個別プランで設計原則レベルの判断が必要になった場合 → 該当 `vision/<topic>.md` を更新してから本プランに反映
- プラン側で「設計原則の修正」を直接書かない（vision/ が SSOT）
