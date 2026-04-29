use crate::db::{app_settings_repository, DbState};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};

const MCP_SERVER_NAME: &str = "life-editor";

fn home_dir() -> PathBuf {
    dirs::home_dir().expect("Cannot determine home directory")
}

fn life_editor_dir() -> PathBuf {
    home_dir().join("life-editor-workspace")
}

fn claude_md_path() -> PathBuf {
    life_editor_dir().join("CLAUDE.md")
}

fn get_mcp_server_path() -> String {
    // In dev, use cwd/mcp-server/dist/index.js
    let cwd = std::env::current_dir().unwrap_or_default();
    let dev_path = cwd.join("mcp-server").join("dist").join("index.js");
    if dev_path.exists() {
        return dev_path.to_string_lossy().to_string();
    }
    // Fallback for packaged app
    dev_path.to_string_lossy().to_string()
}

fn get_db_path() -> String {
    dirs::data_dir()
        .map(|p| {
            p.join("life-editor")
                .join("life-editor.db")
                .to_string_lossy()
                .to_string()
        })
        .unwrap_or_default()
}

fn get_files_root_path(state: &State<'_, DbState>) -> String {
    let conn = state.conn.lock().ok();
    conn.and_then(|c| app_settings_repository::get(&c, "files_root_path").ok().flatten())
        .unwrap_or_else(|| {
            home_dir()
                .join("life-editor-workspace")
                .join("files")
                .to_string_lossy()
                .to_string()
        })
}

const DEFAULT_CLAUDE_MD: &str = r#"# Life Editor — AI Life Management Assistant

あなたは Life Editor の作業エージェント。ユーザーの **tasks / dailies / notes / schedule / wiki_tags / files** を `mcp__life-editor__*` 経由で直接編集できる。GUI は補助、データ操作の主役は MCP。

## 0. 最優先ルール

- 応答は **日本語**
- 何かを作る前に必ず `search_all` で重複・関連を確認
- 日付は **JST**、形式 `YYYY-MM-DD`
- 破壊操作 (`delete_*`) は実行前にユーザー確認
- 失敗したらユーザーに報告し、勝手に再試行しない

## 1. MCP ツール早見表 (30 種)

### Search & Content (まず使う)
- `search_all(query)` — tasks / notes / dailies / schedule 横断検索
- `search_files(query)` / `list_files(path)` / `read_file` / `write_file` / `create_directory` / `rename_file` / `delete_file`
- `generate_content(prompt)` / `format_content(text)`

### Tasks
- `list_tasks(filters?)` / `get_task(id)` / `get_task_tree(rootId?)`
- `create_task({title, parentId?, dueDate?, ...})`
- `update_task(id, patch)` / `delete_task(id)`

### Dailies (1 日 1 エントリ、key=`daily-YYYY-MM-DD`)
- `get_daily(date)` / `upsert_daily(date, content)`

### Notes
- `list_notes(filters?)` / `create_note({title, content})` / `update_note(id, patch)`

### Schedule
- `list_schedule(date)` / `create_schedule_item({date, time, title, ...})`
- `update_schedule_item(id, patch)` / `delete_schedule_item(id)` / `toggle_schedule_complete(id)`

### Wiki Tags (横断タグ)
- `list_wiki_tags()` / `tag_entity(entityType, entityId, tagId)`
- `search_by_tag(tagId)` / `get_entity_tags(entityType, entityId)`

## 2. 典型ワークフロー

### A. 朝のセッション開始
1. `get_daily(today)` で今日のエントリ確認 → 無ければ `upsert_daily` で雛形作成
2. `list_schedule(today)` で予定確認
3. `list_tasks({status:"todo", dueBefore:today+1})` で今日やるタスク確認
4. ユーザーに 1 行サマリで提示

### B. 「〜について記録して」と言われたら
1. `search_all(キーワード)` で既存エントリ確認
2. 既存があれば `update_*`、無ければ `create_*` / `upsert_daily`
3. 関連があれば `tag_entity` でタグ付け

### C. 「タスク追加」と言われたら
1. `search_all` で重複確認
2. 親タスク・期日が曖昧なら **1 回だけ** 質問（即時実行が明示されていれば質問せず推測）
3. `create_task` 実行 → 作成 ID をユーザーに返す

### D. ノート間リンク・整理
- `[[タイトル]]` 記法でノート間リンク（Life Editor 側で自動解決）
- 複数ノートにまたがる概念は wiki_tag で束ねる

## 3. データモデル要点

- **特化テーブル**: tasks / routines / schedule_items / notes / dailies / pomodoro_presets / timer_sessions
- **汎用 Database** で表すもの: 家計簿 / 読書記録 / 習慣 / 連絡先 / 学習進捗
- 判断基準: 特化 UI（DnD / カレンダー / リマインダー）が要る → 特化テーブル。型付きフィールドで足りる → 汎用 Database
- ID 形式: `task-<ts+counter>` / `daily-YYYY-MM-DD` / その他は `<prefix>-<uuid>`
- ソフトデリート: `is_deleted` + `deleted_at`、TrashView から復元可

## 4. ファイル操作の境界

- `files_*` ツールは **`FILES_ROOT_PATH`** （Settings → Files で設定したフォルダ。デフォルト `~/life-editor-workspace/files`）配下のみ
- ルート外への書き込みは拒否される — エラーが出たら Settings 経由でルート変更を提案

## 5. 禁止事項

- ✗ DB に直接 SQL を書く（必ず MCP ツール経由）
- ✗ 確認なしの一括 `delete_*`
- ✗ 推測で日付・タスク ID を作る（必ず `list_*` か `search_all` で実在確認）
- ✗ 英語応答（コード・コミットメッセージは英語、対話は日本語）

## 6. Skills

`.claude/skills/` 配下のスキルが有効。Settings → Claude Code → Skills でインストール / 無効化。よく使うもの:

- `task-tracker` — MEMORY.md / HISTORY.md でタスク進捗追跡
- `life-editor-mcp` — このワークスペースの MCP 操作パターン集
- `git-workflow` — コミット規約・ブランチ運用

## 7. トラブルシュート

- MCP が接続されない → Settings → Claude Code → 「MCP Server を再登録」
- ツール呼び出しでエラー → `search_all` → `list_*` で対象が実在するか確認
- ファイル書込み拒否 → `FILES_ROOT_PATH` 配下か確認
"#;

fn setup_life_editor_dir(_app: &AppHandle, state: &State<'_, DbState>) {
    let dir = life_editor_dir();
    let _ = fs::create_dir_all(&dir);

    // Create CLAUDE.md if not exists
    let md_path = claude_md_path();
    if !md_path.exists() {
        let _ = fs::write(&md_path, DEFAULT_CLAUDE_MD);
    }

    // Create/update .mcp.json
    let mcp_config = serde_json::json!({
        "mcpServers": {
            MCP_SERVER_NAME: {
                "command": "node",
                "args": [get_mcp_server_path()],
                "env": {
                    "DB_PATH": get_db_path(),
                    "FILES_ROOT_PATH": get_files_root_path(state),
                },
                "type": "stdio",
            }
        }
    });
    let _ = fs::write(
        dir.join(".mcp.json"),
        serde_json::to_string_pretty(&mcp_config).unwrap_or_default(),
    );

    // Create/update .claude/settings.json (permissions only)
    let claude_dir = dir.join(".claude");
    let _ = fs::create_dir_all(&claude_dir);

    let settings_path = claude_dir.join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Remove stale mcpServers, set permissions
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("mcpServers");
        obj.insert(
            "permissions".to_string(),
            serde_json::json!({ "allow": ["mcp__life-editor__*"] }),
        );
    }
    let _ = fs::write(
        &settings_path,
        serde_json::to_string_pretty(&settings).unwrap_or_default(),
    );
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSetupResult {
    success: bool,
    message: String,
    claude_installed: bool,
}

#[tauri::command]
pub fn claude_register_mcp(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<ClaudeSetupResult, String> {
    let claude_dir = home_dir().join(".claude");
    if !claude_dir.exists() {
        return Ok(ClaudeSetupResult {
            success: false,
            message: "Claude Code is not installed (~/.claude/ not found)".to_string(),
            claude_installed: false,
        });
    }

    // Setup ~/life-editor-workspace/ directory
    setup_life_editor_dir(&app, &state);

    // Clean up stale mcpServers from ~/.claude/settings.json
    let global_settings_path = claude_dir.join("settings.json");
    if global_settings_path.exists() {
        if let Ok(raw) = fs::read_to_string(&global_settings_path) {
            if let Ok(mut settings) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(mcp) = settings.get_mut("mcpServers").and_then(|m| m.as_object_mut()) {
                    if mcp.remove(MCP_SERVER_NAME).is_some() {
                        if mcp.is_empty() {
                            settings.as_object_mut().unwrap().remove("mcpServers");
                        }
                        let _ = fs::write(
                            &global_settings_path,
                            serde_json::to_string_pretty(&settings).unwrap_or_default(),
                        );
                    }
                }
            }
        }
    }

    // Register in ~/.claude.json
    let claude_json_path = home_dir().join(".claude.json");
    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        fs::read_to_string(&claude_json_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let mcp_servers = claude_json
        .as_object_mut()
        .unwrap()
        .entry("mcpServers")
        .or_insert(serde_json::json!({}));

    if let Some(servers) = mcp_servers.as_object_mut() {
        servers.insert(
            MCP_SERVER_NAME.to_string(),
            serde_json::json!({
                "command": "node",
                "args": [get_mcp_server_path()],
                "env": {
                    "DB_PATH": get_db_path(),
                    "FILES_ROOT_PATH": get_files_root_path(&state),
                },
                "type": "stdio",
            }),
        );
    }

    match fs::write(
        &claude_json_path,
        serde_json::to_string_pretty(&claude_json).unwrap_or_default(),
    ) {
        Ok(()) => Ok(ClaudeSetupResult {
            success: true,
            message: "MCP Server registered successfully".to_string(),
            claude_installed: true,
        }),
        Err(e) => Ok(ClaudeSetupResult {
            success: false,
            message: format!("Failed to write ~/.claude.json: {}", e),
            claude_installed: true,
        }),
    }
}

#[tauri::command]
pub fn claude_read_claude_md() -> Result<String, String> {
    let path = claude_md_path();
    if !path.exists() {
        return Ok(DEFAULT_CLAUDE_MD.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn claude_write_claude_md(content: String) -> Result<(), String> {
    let dir = life_editor_dir();
    let _ = fs::create_dir_all(&dir);
    fs::write(claude_md_path(), content).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    name: String,
    description: String,
    source_path: String,
    scope: String,
}

fn read_description_from_dir(dir_path: &std::path::Path) -> String {
    // Prefer SKILL.md frontmatter (standard format), fall back to instructions.md / README.md.
    let skill_md = dir_path.join("SKILL.md");
    if skill_md.exists() {
        if let Ok(content) = fs::read_to_string(&skill_md) {
            if let Some(desc) = parse_frontmatter_field(&content, "description") {
                return desc.chars().take(200).collect();
            }
        }
    }
    for filename in &["instructions.md", "README.md"] {
        let file_path = dir_path.join(filename);
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && !trimmed.starts_with('#') {
                        return trimmed.chars().take(200).collect();
                    }
                }
            }
        }
    }
    String::new()
}

fn parse_frontmatter_field(content: &str, key: &str) -> Option<String> {
    let mut lines = content.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    let prefix = format!("{}:", key);
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            return None;
        }
        if let Some(rest) = trimmed.strip_prefix(&prefix) {
            return Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

#[tauri::command]
pub fn claude_list_available_skills() -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();
    let home = home_dir();

    // Skills are managed in ~/dev/Claude/skill-lib/ per the user's skill-management rule.
    // Symlinks under ~/.claude/skills/ and project .claude/skills/ point here.
    let dirs = [
        (home.join("dev/Claude/skill-lib/global"), "global"),
        (
            home.join("dev/Claude/skill-lib/projects/life-editor"),
            "project",
        ),
    ];

    for (dir, scope) in &dirs {
        if !dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                if entry.file_type().map_or(false, |t| t.is_dir()) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    skills.push(SkillInfo {
                        description: read_description_from_dir(&entry.path()),
                        source_path: entry.path().to_string_lossy().to_string(),
                        scope: scope.to_string(),
                        name,
                    });
                }
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
pub fn claude_list_installed_skills() -> Result<Vec<String>, String> {
    let skills_dir = life_editor_dir().join(".claude").join("skills");
    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let ft = entry.file_type().map_err(|e| e.to_string())?;
            if ft.is_symlink() || ft.is_dir() {
                names.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    Ok(names)
}

#[tauri::command]
pub fn claude_install_skill(source_path: String, name: String) -> Result<(), String> {
    let skills_dir = life_editor_dir().join(".claude").join("skills");
    let _ = fs::create_dir_all(&skills_dir);

    let target = skills_dir.join(&name);
    if target.exists() {
        return Err(format!("Skill \"{}\" is already installed", name));
    }

    #[cfg(unix)]
    std::os::unix::fs::symlink(&source_path, &target).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(&source_path, &target).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn claude_uninstall_skill(name: String) -> Result<(), String> {
    let target = life_editor_dir().join(".claude").join("skills").join(&name);
    if !target.exists() {
        return Err(format!("Skill \"{}\" is not installed", name));
    }

    let meta = fs::symlink_metadata(&target).map_err(|e| e.to_string())?;
    if !meta.is_symlink() {
        return Err(format!(
            "Skill \"{}\" is not a symlink — refusing to delete",
            name
        ));
    }
    fs::remove_file(&target).map_err(|e| e.to_string())
}
