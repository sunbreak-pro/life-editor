# archive/vision-tauri/

`refactor/web-first-v2` 移行（Tauri 2 + Cloudflare D1 → Electron + Capacitor + Web + Supabase）で **前提が消滅した旧 vision/ ドキュメント** をここに保管している。参照のみ可、編集禁止。

| ファイル                 | 失効理由                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `mobile-porting.md`      | Tauri iOS / Cloudflare Workers + D1 前提。Capacitor で完全置換        |
| `mobile-data-parity.md`  | DataService 経路の二系統化問題。Supabase 単一実装で構造的に消滅       |
| `ios-everywhere-sync.md` | Tauri iOS の無料署名 + 週次再署名運用。Capacitor で別の運用に置換予定 |
| `realtime-sync.md`       | Cloud Sync polling 可変化提案。Supabase Realtime で根本不要           |

新規の方針は SSOT `.claude/2026-05-04-cross-platform-migration.md` を参照。
