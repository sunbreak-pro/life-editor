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
    home_dir().join("life-editor")
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
                .join("life-editor")
                .join("files")
                .to_string_lossy()
                .to_string()
        })
}

const DEFAULT_CLAUDE_MD: &str = r#"# Life Editor - AI Life Management Assistant

You are a life management assistant with access to the user's tasks, dailies, notes, and schedule via MCP tools.

## Available MCP Tools

- search_all: Search across all domains (use this first to find context!)
- list_tasks / get_task / create_task / update_task / delete_task
- get_daily / upsert_daily: Daily entries (YYYY-MM-DD key)
- list_notes / create_note / update_note
- list_schedule: View schedule for a date

## Guidelines

- Always respond in Japanese
- Use search_all before creating to avoid duplicates
- When creating tasks, ask about scheduling if not specified
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

    // Setup ~/life-editor/ directory
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
    for filename in &["instructions.md", "README.md"] {
        let file_path = dir_path.join(filename);
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && !trimmed.starts_with('#') {
                        return trimmed.chars().take(120).collect();
                    }
                }
            }
        }
    }
    String::new()
}

#[tauri::command]
pub fn claude_list_available_skills() -> Result<Vec<SkillInfo>, String> {
    let mut skills = Vec::new();
    let home = home_dir();

    let dirs = [
        (
            home.join("dev/Claude/original-skills-storage/skills/custom/global"),
            "global",
        ),
        (
            home.join("dev/Claude/original-skills-storage/skills/custom/projects/life-editor"),
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
