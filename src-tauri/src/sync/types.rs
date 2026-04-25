use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Payload for both push and pull sync operations.
/// Uses serde_json::Value to avoid duplicating 10+ entity structs.
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncPayload {
    #[serde(default)]
    pub tasks: Vec<Value>,
    #[serde(default)]
    pub dailies: Vec<Value>,
    #[serde(default)]
    pub notes: Vec<Value>,
    #[serde(default)]
    pub schedule_items: Vec<Value>,
    #[serde(default)]
    pub routines: Vec<Value>,
    #[serde(default)]
    pub wiki_tags: Vec<Value>,
    #[serde(default)]
    pub time_memos: Vec<Value>,
    #[serde(default)]
    pub calendars: Vec<Value>,
    #[serde(default)]
    pub templates: Vec<Value>,
    #[serde(default)]
    pub routine_groups: Vec<Value>,
    #[serde(default)]
    pub sidebar_links: Vec<Value>,
    // Relation tables
    #[serde(default)]
    pub wiki_tag_assignments: Vec<Value>,
    #[serde(default)]
    pub wiki_tag_connections: Vec<Value>,
    #[serde(default)]
    pub note_connections: Vec<Value>,
    #[serde(default)]
    pub calendar_tag_assignments: Vec<Value>,
    #[serde(default)]
    pub routine_group_assignments: Vec<Value>,
    #[serde(default)]
    pub calendar_tag_definitions: Vec<Value>,
    // Metadata
    #[serde(default)]
    pub timestamp: String,
    #[serde(default)]
    pub has_more: bool,
}

/// Result returned to the frontend after a sync cycle.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub pushed: usize,
    pub pulled: usize,
    pub timestamp: String,
}

/// Sync status for the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub enabled: bool,
    pub last_synced_at: Option<String>,
    pub device_id: Option<String>,
    pub url: Option<String>,
}

/// Push response from cloud.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResponse {
    pub pushed: usize,
    pub timestamp: String,
}

#[derive(Debug)]
pub enum SyncError {
    Network(String),
    Auth(String),
    Server(String),
    Database(String),
    NotConfigured,
}

impl std::fmt::Display for SyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncError::Network(e) => write!(f, "Network error: {}", e),
            SyncError::Auth(e) => write!(f, "Auth error: {}", e),
            SyncError::Server(e) => write!(f, "Server error: {}", e),
            SyncError::Database(e) => write!(f, "Database error: {}", e),
            SyncError::NotConfigured => write!(f, "Sync not configured"),
        }
    }
}

impl From<rusqlite::Error> for SyncError {
    fn from(e: rusqlite::Error) -> Self {
        SyncError::Database(e.to_string())
    }
}

impl From<reqwest::Error> for SyncError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() || e.is_connect() {
            SyncError::Network(e.to_string())
        } else {
            SyncError::Server(e.to_string())
        }
    }
}
