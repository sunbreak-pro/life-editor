# 006: Desktop の app_data_dir が bundle ID 変更で 2 箇所に分裂

**Status**: Monitoring
**Category**: Structural
**Severity**: Important
**Discovered**: 2026-04-18

## Symptom

`~/Library/Application Support/` 配下に Life Editor のデータディレクトリが 2 つ:

| パス                  | 作成時期                  | 実データ                  |
| --------------------- | ------------------------- | ------------------------- |
| `life-editor/`        | 2025-03（旧 productName） | ✅ 実運用（tasks 120 等） |
| `com.lifeEditor.app/` | 2026-04（新 bundle id）   | ❌ ほぼ空                 |

`lsof` 観察ではプロセスが旧 `life-editor/` を開いている。ただし新側も WAL が今日の日付で更新されており書き込み痕跡あり。

## Root Cause

Tauri 2.x の `app.path.app_data_dir()` は **bundle identifier ベース**（旧 1.x は productName ベース）:

- 旧 1.x → `~/Library/Application Support/life-editor/`
- 新 2.x → `~/Library/Application Support/com.lifeEditor.app/`

アップグレード時の自動マイグレーション無し。さらに iOS 署名のため bundle ID を `com.lifeEditor.app.newlife` に変更したため将来 第 3 パスが出現する可能性。

## Impact

- 将来 Tauri が bundle id パスを厳密化した瞬間にユーザーから見てデータ全消失に見える
- Cloud Sync の整合性混乱（同アカウントで複数 device_id）
- 不要ディスク使用

## Fix / Workaround

**未対応**（動いているので触らない）。監視ポイント:

- Tauri 新バージョンへのアップグレード直後は両パスを観察
- bundle ID 再変更時は事前に現行 DB を新パスへコピーする手順を用意

恒久対策候補: (1) Rust main で起動時に旧パス→新パスへ自動移行 / (2) `tauri.conf.json` の `identifier` を二度と変更しないポリシー / (3) symlink で一元化

## References

- `ls -la ~/Library/Application\ Support/ | grep -i life`
- `lsof -p <pid> | grep life-editor.db`
- 現在の `identifier`: `com.lifeEditor.app.newlife`

## Lessons Learned

- Tauri バージョンアップ / bundle ID 変更は **ユーザーデータパス変更を伴う**
- Desktop アプリ debug 時は `lsof` で実際に開いているパスを確認
- 検索: `Tauri app_data_dir`, `Application Support bundle id`, `productName vs identifier path`
