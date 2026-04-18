# 006: Desktop の app_data_dir が bundle ID 変更で 2 箇所に分裂（旧データ孤立リスク）

**Status**: Monitoring
**Category**: Structural
**Severity**: Important
**Discovered**: 2026-04-18

## Symptom

Mac の `~/Library/Application Support/` 配下に Life Editor のデータディレクトリが **2 つ**存在:

| パス                  | 作成時期      | life-editor.db サイズ | 実データ                        |
| --------------------- | ------------- | --------------------- | ------------------------------- |
| `life-editor/`        | 2025-03（古） | 1MB + 3.5MB WAL       | ✅ 実運用データ（tasks 120 等） |
| `com.lifeEditor.app/` | 2026-04（新） | 638KB                 | ❌ ほぼ空（テスト用 1-2 件）    |

現在稼働中のプロセスは両方とも **古い `life-editor/` 側** を `lsof` で開いていた:

```
life-edit 38296 newlife /Users/newlife/Library/Application Support/life-editor/life-editor.db
life-edit 67265 newlife /Users/newlife/Library/Application Support/life-editor/life-editor.db
```

ただし `com.lifeEditor.app/` も WAL が今日の日付で更新されており、何らかの経路で書き込みが行われた痕跡がある。

## Root Cause

Tauri 2.x 以降の `app.path.app_data_dir()` は **bundle identifier ベース**のパスを返す（旧 1.x は productName ベース）。

- 旧 Tauri 1.x → `~/Library/Application Support/life-editor/`（productName lowercase）
- 新 Tauri 2.x → `~/Library/Application Support/com.lifeEditor.app/`（bundle id）

アップグレード時に自動マイグレーションがなく、両パスが併存している。さらに iOS 署名のために bundle ID を `com.lifeEditor.app.newlife` に変更したため、将来さらに第 3 のパス `com.lifeEditor.app.newlife/` が出現する可能性もある。

## Impact

- **データ消失の見かけ**: 将来 Tauri が厳密に bundle id パスを使うようになった瞬間、ユーザーから見てデータが全消失したように見える
- **Cloud Sync の整合性混乱**: どちらの DB が sync 対象になるか確定しない場合、同じアカウントで複数 device_id を持つ状態が発生
- **不要ディスク使用**: 旧パスが残り続けると二重にストレージを消費

## Fix / Workaround

**現時点は未対応**（動いているので触らない）。監視ポイント:

- Tauri 新バージョンへのアップグレード直後は必ず両パスを観察
- bundle ID を再変更する場合は事前に現行 DB を新パスへコピーする手順を用意
- 将来的には起動時に「旧パスが存在 & 新パスが空 or 古い」場合に自動マイグレーションする処理を検討

**恒久対策の候補**:

1. Rust の main 関数内で起動時に旧パスを探して新パスへ移行
2. もしくは `tauri.conf.json` の `identifier` を二度と変更しないポリシーを確立
3. もしくは symlink で新パス → 旧パスを張って一元化

## References

- 観測コマンド:
  ```bash
  ls -la ~/Library/Application\ Support/ | grep -i life
  lsof -p <life-editor pid> | grep life-editor.db
  ```
- Tauri ドキュメント: `app_data_dir()` は bundle id ベース（v2）
- `src-tauri/tauri.conf.json` の `identifier` 現在値: `com.lifeEditor.app.newlife`
- 関連 Issue: 将来 `com.lifeEditor.app.newlife` 用の第 3 パスが実際に作られるかは要検証

## Lessons Learned

- Tauri バージョンアップや bundle ID 変更は **ユーザーデータのパス変更を伴う可能性** がある。変更前に旧パスの内容を退避する手順を必ず書く
- Desktop アプリの debug 時は `lsof` で実際に開いているファイルパスを確認する
- 検索キーワード: `Tauri app_data_dir`, `Application Support bundle id migration`, `productName vs identifier path`
