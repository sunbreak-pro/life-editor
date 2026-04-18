# 007: cargo tauri ios dev の XcodeGen 再生成で Xcode UI の手動設定が消える

**Status**: Fixed
**Category**: Tooling / Structural
**Severity**: Important
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

## Symptom

初回 iOS ビルド成功後に `cargo tauri ios dev --host` を再実行すると、以下のエラー:

```
Failed to load provisioning paramter list due to error:
Error Domain=com.apple.dt.CoreDeviceError Code=1002 "No provider was found."
```

Xcode UI で設定した Team や Bundle Identifier が消えていて、provisioning profile が見つからない状態になっていた。

## Root Cause

`cargo tauri ios dev` は毎回 XcodeGen 経由で `life-editor.xcodeproj/project.pbxproj` を **`project.yml` から再生成** する。

問題は `project.yml` に以下の設定が欠けていたこと:

- `DEVELOPMENT_TEAM` 未指定
- `CODE_SIGN_STYLE` 未指定
- `PRODUCT_BUNDLE_IDENTIFIER` が古い `com.lifeEditor.app`（Xcode UI では `.newlife` に変更済みだった）

結果として pbxproj 再生成時に Team が抜け、Bundle ID が `com.lifeEditor.app`（ユーザーの Personal Team が所有していない ID）に戻り、provisioning profile が見つからず "No provider was found"。

## Impact

- Rust コード変更後の再ビルドが壊れる（設定変更の都度 Xcode で手動再設定が必要）
- iOS チーム開発時に各開発者が同じ罠を踏む
- 将来 Bundle ID / Team / Sign Style を変更するとき `project.yml` を更新しないと必ず再発

## Fix / Workaround

`src-tauri/gen/apple/project.yml` の `settingGroups.app.base` に 3 項目追加:

```yaml
settingGroups:
  app:
    base:
      PRODUCT_NAME: Life Editor
      PRODUCT_BUNDLE_IDENTIFIER: com.lifeEditor.app.newlife # ← 更新
      DEVELOPMENT_TEAM: 542QHWHN37 # ← 追加
      CODE_SIGN_STYLE: Automatic # ← 追加
```

これで `cargo tauri ios dev` が XcodeGen で pbxproj を再生成しても、Signing 設定が保持される。

## References

- 修正ファイル: `src-tauri/gen/apple/project.yml`
- 関連: `src-tauri/tauri.conf.json` の `identifier` も `.newlife` に揃える必要あり
- Xcode UI 上の変更は **エフェメラル** — Source of Truth は `project.yml`
- 関連 Issue: なし（独立した Tooling 問題）

## Lessons Learned

- `cargo tauri ios dev` のビルドは `project.yml` → XcodeGen → `project.pbxproj` の一方向パイプライン。pbxproj を直接編集しても次回再生成で消える
- iOS 署名関連 3 設定（`PRODUCT_BUNDLE_IDENTIFIER` / `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE`）は常に `project.yml` 側に書く
- "No provider was found" の根本的な意味は「この Bundle ID + Team の組み合わせに対応する provisioning profile が無い」
- 検索キーワード: `XcodeGen regenerate pbxproj`, `No provider was found`, `DEVELOPMENT_TEAM project.yml`, `cargo tauri ios signing`
