# HISTORY (chat-trash-impl)

### 2026-07-08 - trash-impl 作業オーダー完了（Trash 画面 target IA 実装）

#### 概要

design implementation fan-out（計画書 2026-07-05-design-implementation-fanout.md）の trash-impl オーダーを実装。ClaudeDesign import（project ea99bd45 / Trash.dc.html）+ brief §3-§4 に沿って TrashView をフル書き換えし、web ホストの loading / error / busy 状態を刷新した。

#### 変更点

- **shared/src/components/TrashView.tsx**: フル書き換え — ページヘッダ（説明文 + 全 N 件）/ 空カテゴリ畳み / 件数バッジ / 危険度非対称（復元 = ラベル付き secondary・完全削除 = icon-only danger + 確認）/ カスケード警告ボックス / 行単位 TrashBusy スピナー / 768px で Modal ↔ BottomSheet 切替
- **shared/src/components/index.ts**: TrashBusy / TrashBusyAction 型を export 追加
- **shared/src/i18n/locales/en.json + ja.json**: trash 新キー（description / totalCount / emptyDescription / errorTitle / errorDescription / reload / restoring / deleting / cascadeWarning）+ permanentDeleteConfirm 文言更新
- **web/src/trash/TrashScreen.tsx**: per-row busy（TrashBusy | null）/ 実ヘッダ + animate-pulse スケルトン / 再読込ボタン付きエラーカード / retry コールバック
- **テスト**: components.test.tsx の TRASH_LABELS を新形に更新 + trashView.test.tsx 新規（7 テスト: 空カテゴリ畳み / バッジ・totalCount / 全空 / Modal wide + キャンセル先頭 + カスケード警告 / BottomSheet narrow + 破壊ボタン先頭 / busy 行 + 全ボタン disabled / deleting 表示）
- **検証**: shared tsc -b pass / vitest 対象 4 ファイル 48/48 pass（フルスイートの appShell / rightSidebar タイムアウト 2 件は高負荷起因の flaky で再実行 pass・trash 無関係）/ web build pass / hex 直書き grep 0 件
