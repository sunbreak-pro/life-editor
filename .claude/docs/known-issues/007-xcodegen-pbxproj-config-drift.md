# 007: cargo tauri ios dev の XcodeGen 再生成で Xcode UI 設定が消える

**Status**: Fixed
**Category**: Tooling / Structural
**Severity**: Important
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

## Symptom

初回 iOS ビルド成功後の `cargo tauri ios dev --host` 再実行で:

```
Failed to load provisioning paramter list due to error:
Error Domain=com.apple.dt.CoreDeviceError Code=1002 "No provider was found."
```

Xcode UI で設定した Team / Bundle Identifier が消え、provisioning profile 不発。

## Root Cause

`cargo tauri ios dev` は毎回 XcodeGen で `life-editor.xcodeproj/project.pbxproj` を **`project.yml` から再生成**。`project.yml` に以下が欠けていた:

- `DEVELOPMENT_TEAM` 未指定
- `CODE_SIGN_STYLE` 未指定
- `PRODUCT_BUNDLE_IDENTIFIER` が古い `com.lifeEditor.app`

→ pbxproj 再生成時に Team が抜け、Bundle ID が Personal Team 未所有の値に戻り、profile 不発。

## Fix

`src-tauri/gen/apple/project.yml` の `settingGroups.app.base` に 3 項目追加:

```yaml
settingGroups:
  app:
    base:
      PRODUCT_NAME: Life Editor
      PRODUCT_BUNDLE_IDENTIFIER: com.lifeEditor.app.newlife # 更新
      DEVELOPMENT_TEAM: 542QHWHN37 # 追加
      CODE_SIGN_STYLE: Automatic # 追加
```

## References

- `src-tauri/gen/apple/project.yml` / `src-tauri/tauri.conf.json::identifier`
- Xcode UI 上の変更は **エフェメラル** — SoT は `project.yml`

## Lessons Learned

- ビルドは `project.yml` → XcodeGen → `project.pbxproj` の一方向。pbxproj 直接編集は次回再生成で消える
- 署名 3 設定（`PRODUCT_BUNDLE_IDENTIFIER` / `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE`）は常に `project.yml` 側に書く
- "No provider was found" の意味は「この Bundle ID + Team 組み合わせの profile が無い」
- 検索: `XcodeGen regenerate pbxproj`, `No provider was found`, `DEVELOPMENT_TEAM project.yml`
