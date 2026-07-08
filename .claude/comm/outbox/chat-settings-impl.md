# Outbox: chat-settings-impl

## 2026-07-08 settings-impl オーダー完了（draft PR 提出）

- design fan-out の settings-impl を完遂。Settings 画面を目標 IA へ刷新（ページヘッダ + 3 カード / テーマミニプレビュー / 10 段スライダー / ショートカット編集モーダル / rightSidebar 詳細パネル注入）
- 新規部品: ThemePreviewCard / SteppedSlider / ShortcutEditModal / SettingsDetailPanel / shortcutParts。HeaderTabs / SegmentedControl / RightSidebar 系は shell 標準部品を使用（シェル部品の編集なし）
- tokens.css 1 点のみ変更: light 値セレクタを `:root, [data-theme="light"]` に拡張（値変更ゼロ・ユーザー承認済み）。後続オーダーはネストしたテーマ固定描画にこのスコープを利用可能
- m2（ショートカット表示語彙）= 現行語彙のままでユーザー確定（2026-07-07）
- 検証: shared build / 587 tests / web build 全 pass。role-qa PASS with nits（全反映 or 記録済み）
- shell 部品への要望: なし（RightSidebarPortal で完結）
