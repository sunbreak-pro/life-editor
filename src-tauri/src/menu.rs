use tauri::menu::{Menu, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// Set up the native application menu and handle menu events
pub fn setup_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let menu = build_menu(handle)?;
    app.set_menu(menu)?;

    // Handle menu item clicks
    app.on_menu_event(move |app_handle, event| {
        let id = event.id().0.as_str();
        // Send menu action to the frontend
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.emit("menu_action", id);
        }
    });

    Ok(())
}

fn build_menu(handle: &AppHandle) -> Result<Menu<Wry>, tauri::Error> {
    let is_macos = cfg!(target_os = "macos");

    let menu = Menu::new(handle)?;

    // macOS app menu
    if is_macos {
        let app_menu = Submenu::new(handle, "Life Editor", true)?;
        app_menu.append(&PredefinedMenuItem::about(handle, Some("About Life Editor"), None)?)?;
        app_menu.append(&PredefinedMenuItem::separator(handle)?)?;
        app_menu.append_items(&[
            &tauri::menu::MenuItem::with_id(handle, "navigate:settings", "Preferences...", true, Some("CmdOrCtrl+,"))?,
        ])?;
        app_menu.append(&PredefinedMenuItem::separator(handle)?)?;
        app_menu.append(&PredefinedMenuItem::services(handle, None)?)?;
        app_menu.append(&PredefinedMenuItem::separator(handle)?)?;
        app_menu.append(&PredefinedMenuItem::hide(handle, None)?)?;
        app_menu.append(&PredefinedMenuItem::hide_others(handle, None)?)?;
        app_menu.append(&PredefinedMenuItem::show_all(handle, None)?)?;
        app_menu.append(&PredefinedMenuItem::separator(handle)?)?;
        app_menu.append(&PredefinedMenuItem::quit(handle, None)?)?;
        menu.append(&app_menu)?;
    }

    // File menu
    let file_menu = Submenu::new(handle, "File", true)?;
    file_menu.append_items(&[
        &tauri::menu::MenuItem::with_id(handle, "new-task", "New Task", true, Some("CmdOrCtrl+N"))?,
        &tauri::menu::MenuItem::with_id(handle, "new-folder", "New Folder", true, Some("CmdOrCtrl+Shift+N"))?,
    ])?;
    file_menu.append(&PredefinedMenuItem::separator(handle)?)?;
    file_menu.append_items(&[
        &tauri::menu::MenuItem::with_id(handle, "export-data", "Export Data...", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(handle, "import-data", "Import Data...", true, None::<&str>)?,
    ])?;
    file_menu.append(&PredefinedMenuItem::separator(handle)?)?;
    if is_macos {
        file_menu.append(&PredefinedMenuItem::close_window(handle, None)?)?;
    } else {
        file_menu.append(&PredefinedMenuItem::quit(handle, None)?)?;
    }
    menu.append(&file_menu)?;

    // Edit menu
    let edit_menu = Submenu::new(handle, "Edit", true)?;
    edit_menu.append(&PredefinedMenuItem::undo(handle, None)?)?;
    edit_menu.append(&PredefinedMenuItem::redo(handle, None)?)?;
    edit_menu.append(&PredefinedMenuItem::separator(handle)?)?;
    edit_menu.append(&PredefinedMenuItem::cut(handle, None)?)?;
    edit_menu.append(&PredefinedMenuItem::copy(handle, None)?)?;
    edit_menu.append(&PredefinedMenuItem::paste(handle, None)?)?;
    edit_menu.append(&PredefinedMenuItem::select_all(handle, None)?)?;
    menu.append(&edit_menu)?;

    // View menu
    let view_menu = Submenu::new(handle, "View", true)?;
    view_menu.append_items(&[
        &tauri::menu::MenuItem::with_id(handle, "toggle-left-sidebar", "Toggle Left Sidebar", true, Some("CmdOrCtrl+."))?,
        &tauri::menu::MenuItem::with_id(handle, "toggle-timer-modal", "Timer Modal", true, Some("CmdOrCtrl+Shift+T"))?,
        &tauri::menu::MenuItem::with_id(handle, "toggle-terminal", "Toggle Terminal", true, Some("CmdOrCtrl+J"))?,
    ])?;
    view_menu.append(&PredefinedMenuItem::separator(handle)?)?;
    view_menu.append(&PredefinedMenuItem::fullscreen(handle, None)?)?;
    menu.append(&view_menu)?;

    // Window menu
    let window_menu = Submenu::new(handle, "Window", true)?;
    window_menu.append(&PredefinedMenuItem::minimize(handle, None)?)?;
    if is_macos {
        window_menu.append(&PredefinedMenuItem::maximize(handle, None)?)?;
    } else {
        window_menu.append(&PredefinedMenuItem::close_window(handle, None)?)?;
    }
    menu.append(&window_menu)?;

    // Help menu
    let help_menu = Submenu::new(handle, "Help", true)?;
    help_menu.append_items(&[
        &tauri::menu::MenuItem::with_id(handle, "navigate:tips", "Tips", true, None::<&str>)?,
    ])?;
    menu.append(&help_menu)?;

    Ok(menu)
}
