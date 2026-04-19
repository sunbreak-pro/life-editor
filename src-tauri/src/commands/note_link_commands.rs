use crate::db::note_link_repository::{
    self, BacklinkHit, NoteLink, NoteLinkPayload, UnlinkedMention,
};
use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub fn db_note_links_fetch_all(state: State<'_, DbState>) -> Result<Vec<NoteLink>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::fetch_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_fetch_forward(
    state: State<'_, DbState>,
    source_note_id: String,
) -> Result<Vec<NoteLink>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::fetch_forward_links(&conn, &source_note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_fetch_backlinks(
    state: State<'_, DbState>,
    target_note_id: String,
) -> Result<Vec<BacklinkHit>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::fetch_backlinks(&conn, &target_note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_upsert_for_note(
    state: State<'_, DbState>,
    source_note_id: String,
    links: Vec<NoteLinkPayload>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::upsert_links_for_note(&conn, &source_note_id, links)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_upsert_for_memo(
    state: State<'_, DbState>,
    source_memo_date: String,
    links: Vec<NoteLinkPayload>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::upsert_links_for_memo(&conn, &source_memo_date, links)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_delete_for_note(
    state: State<'_, DbState>,
    source_note_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::delete_links_for_note(&conn, &source_note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_note_links_unlinked_mentions(
    state: State<'_, DbState>,
    source_note_id: String,
) -> Result<Vec<UnlinkedMention>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    note_link_repository::fetch_unlinked_mentions(&conn, &source_note_id)
        .map_err(|e| e.to_string())
}
