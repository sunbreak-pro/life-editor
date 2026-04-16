mod auto_archive;
mod commands;
mod db;
#[cfg(not(mobile))]
mod file_watcher;
#[cfg(not(mobile))]
mod menu;
mod reminder;
mod sync;
#[cfg(not(mobile))]
mod shortcuts;
#[cfg(not(mobile))]
mod terminal;
#[cfg(not(mobile))]
mod tray;

use db::DbState;
#[cfg(not(mobile))]
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(not(mobile))]
    {
        builder = builder
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .setup(|app| {
            // Use the same data directory as the Electron version
            let data_dir = dirs::data_dir()
                .expect("failed to resolve data dir")
                .join("life-editor");
            let conn =
                db::init_database(&data_dir).expect("failed to initialize database");
            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            // Desktop-only setup: menu, tray, shortcuts, file watcher, terminal
            #[cfg(not(mobile))]
            {
                // Set up native menu
                menu::setup_menu(app)?;

                // Set up system tray (conditional on tray_enabled setting)
                {
                    let db_state = app.state::<DbState>();
                    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                    let tray_enabled =
                        db::app_settings_repository::get(&conn, "trayEnabled")
                            .unwrap_or(None);
                    if tray_enabled.as_deref() != Some("false") {
                        let handle = app.handle().clone();
                        tray::setup_tray(&handle).map_err(|e| e.to_string())?;
                    }
                }

                // Register global shortcuts from saved config
                {
                    let db_state = app.state::<DbState>();
                    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                    let shortcuts_json =
                        db::app_settings_repository::get(&conn, "globalShortcuts")
                            .unwrap_or(None);
                    if let Some(json) = shortcuts_json {
                        if let Ok(config) =
                            serde_json::from_str::<HashMap<String, String>>(&json)
                        {
                            let handle = app.handle().clone();
                            shortcuts::register_shortcuts(&handle, &config);
                        }
                    }
                }

                // Start file watcher if root path is configured
                {
                    let db_state = app.state::<DbState>();
                    let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
                    if let Some(root_path) =
                        db::app_settings_repository::get(&conn, "files_root_path")
                            .unwrap_or(None)
                    {
                        let handle = app.handle().clone();
                        file_watcher::start(&handle, &root_path);
                    }
                }

                // Initialize terminal PTY manager
                {
                    let handle = app.handle().clone();
                    app.manage(terminal::pty_manager::PtyState::new(handle));
                }
            }

            // Start background services
            {
                let handle = app.handle().clone();
                reminder::start(&handle);
                auto_archive::start(&handle);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tasks
            commands::task_commands::db_tasks_fetch_tree,
            commands::task_commands::db_tasks_fetch_deleted,
            commands::task_commands::db_tasks_create,
            commands::task_commands::db_tasks_update,
            commands::task_commands::db_tasks_sync_tree,
            commands::task_commands::db_tasks_soft_delete,
            commands::task_commands::db_tasks_restore,
            commands::task_commands::db_tasks_permanent_delete,
            commands::task_commands::app_migrate_from_local_storage,
            // Timer
            commands::timer_commands::db_timer_fetch_settings,
            commands::timer_commands::db_timer_update_settings,
            commands::timer_commands::db_timer_start_session,
            commands::timer_commands::db_timer_end_session,
            commands::timer_commands::db_timer_fetch_sessions,
            commands::timer_commands::db_timer_fetch_sessions_by_task_id,
            // Pomodoro Presets
            commands::pomodoro_preset_commands::db_timer_fetch_pomodoro_presets,
            commands::pomodoro_preset_commands::db_timer_create_pomodoro_preset,
            commands::pomodoro_preset_commands::db_timer_update_pomodoro_preset,
            commands::pomodoro_preset_commands::db_timer_delete_pomodoro_preset,
            // Sound
            commands::sound_commands::db_sound_fetch_settings,
            commands::sound_commands::db_sound_update_setting,
            commands::sound_commands::db_sound_fetch_presets,
            commands::sound_commands::db_sound_create_preset,
            commands::sound_commands::db_sound_delete_preset,
            commands::sound_commands::db_sound_fetch_all_sound_tags,
            commands::sound_commands::db_sound_create_sound_tag,
            commands::sound_commands::db_sound_update_sound_tag,
            commands::sound_commands::db_sound_delete_sound_tag,
            commands::sound_commands::db_sound_fetch_tags_for_sound,
            commands::sound_commands::db_sound_set_tags_for_sound,
            commands::sound_commands::db_sound_fetch_all_sound_tag_assignments,
            commands::sound_commands::db_sound_fetch_all_sound_display_meta,
            commands::sound_commands::db_sound_update_sound_display_meta,
            commands::sound_commands::db_sound_fetch_workscreen_selections,
            commands::sound_commands::db_sound_set_workscreen_selections,
            // Memo
            commands::memo_commands::db_memo_fetch_all,
            commands::memo_commands::db_memo_fetch_by_date,
            commands::memo_commands::db_memo_upsert,
            commands::memo_commands::db_memo_delete,
            commands::memo_commands::db_memo_fetch_deleted,
            commands::memo_commands::db_memo_restore,
            commands::memo_commands::db_memo_permanent_delete,
            commands::memo_commands::db_memo_toggle_pin,
            commands::memo_commands::db_memo_set_password,
            commands::memo_commands::db_memo_remove_password,
            commands::memo_commands::db_memo_verify_password,
            commands::memo_commands::db_memo_toggle_edit_lock,
            // Notes
            commands::note_commands::db_notes_fetch_all,
            commands::note_commands::db_notes_fetch_deleted,
            commands::note_commands::db_notes_create,
            commands::note_commands::db_notes_update,
            commands::note_commands::db_notes_soft_delete,
            commands::note_commands::db_notes_restore,
            commands::note_commands::db_notes_permanent_delete,
            commands::note_commands::db_notes_search,
            commands::note_commands::db_notes_set_password,
            commands::note_commands::db_notes_remove_password,
            commands::note_commands::db_notes_verify_password,
            commands::note_commands::db_notes_toggle_edit_lock,
            commands::note_commands::db_notes_create_folder,
            commands::note_commands::db_notes_sync_tree,
            // Custom Sounds
            commands::custom_sound_commands::db_custom_sound_save,
            commands::custom_sound_commands::db_custom_sound_load,
            commands::custom_sound_commands::db_custom_sound_delete,
            commands::custom_sound_commands::db_custom_sound_fetch_metas,
            commands::custom_sound_commands::db_custom_sound_fetch_deleted,
            commands::custom_sound_commands::db_custom_sound_restore,
            commands::custom_sound_commands::db_custom_sound_permanent_delete,
            commands::custom_sound_commands::db_custom_sound_update_label,
            // Calendars
            commands::calendar_commands::db_calendars_fetch_all,
            commands::calendar_commands::db_calendars_create,
            commands::calendar_commands::db_calendars_update,
            commands::calendar_commands::db_calendars_delete,
            // Routine Tags
            commands::routine_tag_commands::db_routine_tags_fetch_all,
            commands::routine_tag_commands::db_routine_tags_create,
            commands::routine_tag_commands::db_routine_tags_update,
            commands::routine_tag_commands::db_routine_tags_delete,
            commands::routine_tag_commands::db_routine_tags_fetch_all_assignments,
            commands::routine_tag_commands::db_routine_tags_set_tags_for_routine,
            // Calendar Tags
            commands::calendar_tag_commands::db_calendar_tags_fetch_all,
            commands::calendar_tag_commands::db_calendar_tags_create,
            commands::calendar_tag_commands::db_calendar_tags_update,
            commands::calendar_tag_commands::db_calendar_tags_delete,
            commands::calendar_tag_commands::db_calendar_tags_fetch_all_assignments,
            commands::calendar_tag_commands::db_calendar_tags_set_tags_for_schedule_item,
            // Routines
            commands::routine_commands::db_routines_fetch_all,
            commands::routine_commands::db_routines_create,
            commands::routine_commands::db_routines_update,
            commands::routine_commands::db_routines_delete,
            commands::routine_commands::db_routines_fetch_deleted,
            commands::routine_commands::db_routines_soft_delete,
            commands::routine_commands::db_routines_restore,
            commands::routine_commands::db_routines_permanent_delete,
            // Schedule Items
            commands::schedule_item_commands::db_schedule_items_fetch_by_date,
            commands::schedule_item_commands::db_schedule_items_fetch_by_date_all,
            commands::schedule_item_commands::db_schedule_items_fetch_by_date_range,
            commands::schedule_item_commands::db_schedule_items_create,
            commands::schedule_item_commands::db_schedule_items_update,
            commands::schedule_item_commands::db_schedule_items_delete,
            commands::schedule_item_commands::db_schedule_items_soft_delete,
            commands::schedule_item_commands::db_schedule_items_restore,
            commands::schedule_item_commands::db_schedule_items_permanent_delete,
            commands::schedule_item_commands::db_schedule_items_fetch_deleted,
            commands::schedule_item_commands::db_schedule_items_toggle_complete,
            commands::schedule_item_commands::db_schedule_items_dismiss,
            commands::schedule_item_commands::db_schedule_items_undismiss,
            commands::schedule_item_commands::db_schedule_items_fetch_last_routine_date,
            commands::schedule_item_commands::db_schedule_items_bulk_create,
            commands::schedule_item_commands::db_schedule_items_update_future_by_routine,
            commands::schedule_item_commands::db_schedule_items_fetch_by_routine_id,
            commands::schedule_item_commands::db_schedule_items_bulk_delete,
            commands::schedule_item_commands::db_schedule_items_fetch_events,
            // Routine Groups
            commands::routine_group_commands::db_routine_groups_fetch_all,
            commands::routine_group_commands::db_routine_groups_create,
            commands::routine_group_commands::db_routine_groups_update,
            commands::routine_group_commands::db_routine_groups_delete,
            commands::routine_group_commands::db_routine_groups_fetch_all_tag_assignments,
            commands::routine_group_commands::db_routine_groups_set_tags_for_group,
            // Playlists
            commands::playlist_commands::db_playlists_fetch_all,
            commands::playlist_commands::db_playlists_create,
            commands::playlist_commands::db_playlists_update,
            commands::playlist_commands::db_playlists_delete,
            commands::playlist_commands::db_playlists_fetch_items,
            commands::playlist_commands::db_playlists_fetch_all_items,
            commands::playlist_commands::db_playlists_add_item,
            commands::playlist_commands::db_playlists_remove_item,
            commands::playlist_commands::db_playlists_reorder_items,
            // Wiki Tags
            commands::wiki_tag_commands::db_wiki_tags_fetch_all,
            commands::wiki_tag_commands::db_wiki_tags_search,
            commands::wiki_tag_commands::db_wiki_tags_create,
            commands::wiki_tag_commands::db_wiki_tags_create_with_id,
            commands::wiki_tag_commands::db_wiki_tags_update,
            commands::wiki_tag_commands::db_wiki_tags_delete,
            commands::wiki_tag_commands::db_wiki_tags_merge,
            commands::wiki_tag_commands::db_wiki_tags_fetch_for_entity,
            commands::wiki_tag_commands::db_wiki_tags_set_for_entity,
            commands::wiki_tag_commands::db_wiki_tags_sync_inline,
            commands::wiki_tag_commands::db_wiki_tags_fetch_all_assignments,
            commands::wiki_tag_commands::db_wiki_tags_restore_assignment,
            // Wiki Tag Groups
            commands::wiki_tag_group_commands::db_wiki_tag_groups_fetch_all,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_create,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_update,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_delete,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_fetch_all_members,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_set_members,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_add_member,
            commands::wiki_tag_group_commands::db_wiki_tag_groups_remove_member,
            // Wiki Tag Connections
            commands::wiki_tag_connection_commands::db_wiki_tag_connections_fetch_all,
            commands::wiki_tag_connection_commands::db_wiki_tag_connections_create,
            commands::wiki_tag_connection_commands::db_wiki_tag_connections_delete,
            commands::wiki_tag_connection_commands::db_wiki_tag_connections_delete_by_tag_pair,
            // Note Connections
            commands::note_connection_commands::db_note_connections_fetch_all,
            commands::note_connection_commands::db_note_connections_create,
            commands::note_connection_commands::db_note_connections_delete,
            commands::note_connection_commands::db_note_connections_delete_by_note_pair,
            // Time Memos
            commands::time_memo_commands::db_time_memos_fetch_by_date,
            commands::time_memo_commands::db_time_memos_upsert,
            commands::time_memo_commands::db_time_memos_delete,
            // Paper Boards
            commands::paper_board_commands::db_paper_boards_fetch_all,
            commands::paper_board_commands::db_paper_boards_fetch_by_id,
            commands::paper_board_commands::db_paper_boards_fetch_by_note_id,
            commands::paper_board_commands::db_paper_boards_create,
            commands::paper_board_commands::db_paper_boards_update,
            commands::paper_board_commands::db_paper_boards_delete,
            commands::paper_board_commands::db_paper_nodes_fetch_node_counts,
            commands::paper_board_commands::db_paper_nodes_fetch_by_board,
            commands::paper_board_commands::db_paper_nodes_create,
            commands::paper_board_commands::db_paper_nodes_update,
            commands::paper_board_commands::db_paper_nodes_bulk_update_positions,
            commands::paper_board_commands::db_paper_nodes_bulk_update_z_indices,
            commands::paper_board_commands::db_paper_nodes_delete,
            commands::paper_board_commands::db_paper_edges_fetch_by_board,
            commands::paper_board_commands::db_paper_edges_create,
            commands::paper_board_commands::db_paper_edges_delete,
            // Attachments
            commands::attachment_commands::attachment_save,
            commands::attachment_commands::attachment_load,
            commands::attachment_commands::attachment_delete,
            commands::attachment_commands::attachment_fetch_metas,
            // Databases
            commands::database_commands::db_database_fetch_all,
            commands::database_commands::db_database_fetch_full,
            commands::database_commands::db_database_create,
            commands::database_commands::db_database_update,
            commands::database_commands::db_database_soft_delete,
            commands::database_commands::db_database_permanent_delete,
            commands::database_commands::db_database_add_property,
            commands::database_commands::db_database_update_property,
            commands::database_commands::db_database_remove_property,
            commands::database_commands::db_database_add_row,
            commands::database_commands::db_database_reorder_rows,
            commands::database_commands::db_database_remove_row,
            commands::database_commands::db_database_upsert_cell,
            // App Settings
            commands::app_settings_commands::settings_get,
            commands::app_settings_commands::settings_set,
            commands::app_settings_commands::settings_get_all,
            commands::app_settings_commands::settings_remove,
            // Templates
            commands::template_commands::db_templates_fetch_all,
            commands::template_commands::db_templates_fetch_by_id,
            commands::template_commands::db_templates_create,
            commands::template_commands::db_templates_update,
            commands::template_commands::db_templates_soft_delete,
            commands::template_commands::db_templates_permanent_delete,
            // System Integration
            commands::system_commands::system_get_auto_launch,
            commands::system_commands::system_set_auto_launch,
            commands::system_commands::system_get_start_minimized,
            commands::system_commands::system_set_start_minimized,
            commands::system_commands::system_get_tray_enabled,
            commands::system_commands::system_set_tray_enabled,
            commands::system_commands::system_get_global_shortcuts,
            commands::system_commands::system_set_global_shortcuts,
            commands::system_commands::system_reregister_global_shortcuts,
            commands::system_commands::tray_update_timer,
            // Reminders
            commands::reminder_commands::reminder_get_settings,
            commands::reminder_commands::reminder_set_settings,
            // Data I/O
            commands::data_io_commands::data_export,
            commands::data_io_commands::data_import,
            commands::data_io_commands::data_reset,
            // Diagnostics
            commands::diagnostics_commands::diagnostics_fetch_logs,
            commands::diagnostics_commands::diagnostics_open_log_folder,
            commands::diagnostics_commands::diagnostics_export_logs,
            commands::diagnostics_commands::diagnostics_fetch_metrics,
            commands::diagnostics_commands::diagnostics_reset_metrics,
            commands::diagnostics_commands::diagnostics_fetch_system_info,
            // Shell
            commands::shell_commands::shell_open_external,
            commands::shell_commands::shell_open_path,
            // Files
            commands::files_commands::files_select_folder,
            commands::files_commands::files_get_root_path,
            commands::files_commands::files_list_directory,
            commands::files_commands::files_get_file_info,
            commands::files_commands::files_read_text_file,
            commands::files_commands::files_read_file,
            commands::files_commands::files_create_directory,
            commands::files_commands::files_create_file,
            commands::files_commands::files_write_text_file,
            commands::files_commands::files_rename,
            commands::files_commands::files_move,
            commands::files_commands::files_delete,
            commands::files_commands::files_open_in_system,
            // Copy
            commands::copy_commands::copy_note_to_file,
            commands::copy_commands::copy_memo_to_file,
            commands::copy_commands::copy_convert_file_to_tiptap,
            // Updater
            commands::updater_commands::updater_check_for_updates,
            commands::updater_commands::updater_download_update,
            commands::updater_commands::updater_install_update,
            // Claude/MCP
            commands::claude_commands::claude_register_mcp,
            commands::claude_commands::claude_read_claude_md,
            commands::claude_commands::claude_write_claude_md,
            commands::claude_commands::claude_list_available_skills,
            commands::claude_commands::claude_list_installed_skills,
            commands::claude_commands::claude_install_skill,
            commands::claude_commands::claude_uninstall_skill,
            // Terminal
            commands::terminal_commands::terminal_create,
            commands::terminal_commands::terminal_write,
            commands::terminal_commands::terminal_resize,
            commands::terminal_commands::terminal_destroy,
            commands::terminal_commands::terminal_claude_state,
            // Sync
            commands::sync_commands::sync_configure,
            commands::sync_commands::sync_trigger,
            commands::sync_commands::sync_get_status,
            commands::sync_commands::sync_disconnect,
            commands::sync_commands::sync_full_download,
        ])
        .on_window_event(|_window, _event| {
            #[cfg(not(mobile))]
            {
                if let tauri::WindowEvent::Destroyed = _event {
                    if let Some(pty_state) =
                        _window.try_state::<terminal::pty_manager::PtyState>()
                    {
                        pty_state.destroy_all();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
