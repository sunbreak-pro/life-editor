# HISTORY (chat-auth-impl)

### 2026-07-08 - auth-impl オーダー完了（ClaudeDesign Auth.dc.html 実装）

#### 概要

design-implementation-fanout 計画の auth-impl オーダーを完了。ClaudeDesign 生成デザイン Auth.dc.html（12 フレーム）をもとに、シェル外のログイン/サインアップ画面を実装し、draft PR #165 を提出した。

#### 変更点

- **新規 shared components**: `AuthCard.tsx`（400px 中央カード・ブランドヘッダ・エラー帯・busy 状態）/ `PasswordField.tsx`（表示切替トグル 44px タップ領域・helper）/ `SegmentedToggle.tsx`（radiogroup・roving tabindex。shell 所有 SegmentedControl とは別部品として住み分け）
- **トークン追加**: `tokens.css` に `danger-subtle`（light `#f0e5e6` / dark `#2f2126`・エラー帯背景を不透明値に事前フラット化）
- **i18n**: en/ja 両 catalog に `auth` セクション（15 ラベル + 4 エラーキー）
- **host 置換**: `web/src/AuthScreen.tsx` を薄い host に書き換え（mode/error/busy state・Supabase エラーマッピング・submit 再入ガード）
- **テスト**: authCard / passwordField / segmentedToggle の 3 本・15 テスト（単独実行 15/15 pass。フルスイートの timeout はワークツリー並行負荷起因のフレークと切り分け済み）
- **検証・レビュー**: shared build+test / web build 全 pass。role-qa PASS（Blocking 0）+ security-reviewer High/Medium 0。指摘反映 = submit 再入ガード + ArrowLeft テスト
- **PR**: draft PR #165（merge はユーザーゲート 🛑）。意図的差分 = エラー帯の不透明トークン化 / 送信ボタン mobile 44px（DS Button lg 流用）/ 目アイコン 16px 統一
