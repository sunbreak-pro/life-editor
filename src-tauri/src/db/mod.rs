pub mod migrations;
pub mod helpers;
pub mod row_converter;
pub mod task_repository;
pub mod timer_repository;
pub mod daily_repository;
pub mod note_repository;
pub mod sound_repository;
pub mod custom_sound_repository;
pub mod calendar_repository;
pub mod routine_repository;
pub mod calendar_tag_repository;
pub mod schedule_item_repository;
pub mod routine_group_repository;
pub mod routine_group_assignment_repository;
pub mod playlist_repository;
pub mod wiki_tag_repository;
pub mod wiki_tag_group_repository;
pub mod wiki_tag_connection_repository;
pub mod note_connection_repository;
pub mod note_link_repository;
pub mod time_memo_repository;
pub mod paper_board_repository;
pub mod pomodoro_preset_repository;
pub mod attachment_repository;
pub mod database_repository;
pub mod app_settings_repository;
pub mod template_repository;
pub mod sidebar_link_repository;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn init_database(app_data_dir: &std::path::Path) -> rusqlite::Result<Connection> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("life-editor.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;

    migrations::run_migrations(&conn)?;

    Ok(conn)
}
