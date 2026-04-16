use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{image::Image, AppHandle, Manager};

const TRAY_ID: &str = "main-tray";

/// Set up the system tray icon with context menu.
/// If the tray already exists (hidden), re-shows it.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // If tray already exists, just make it visible
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_visible(true)?;
        return Ok(());
    }

    let show_hide =
        MenuItem::with_id(app, "tray_show_hide", "Show/Hide Window", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_hide, &separator, &quit])?;

    let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Life Editor")
        .menu(&menu)
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            "tray_show_hide" => toggle_window_visibility(app_handle),
            "tray_quit" => {
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // On non-macOS, left click toggles window visibility
            if !cfg!(target_os = "macos") {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_window_visibility(tray.app_handle());
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Hide the tray icon
pub fn remove_tray(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(false);
    }
}

/// Update tray tooltip and macOS title text for timer display
pub fn update_timer(app: &AppHandle, remaining: &str, is_running: bool) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if is_running {
            format!("Life Editor — {}", remaining)
        } else {
            "Life Editor".to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));

        // On macOS, display remaining time next to the tray icon
        #[cfg(target_os = "macos")]
        {
            let title = if is_running { remaining } else { "" };
            let _ = tray.set_title(Some(title));
        }
    }
}

fn toggle_window_visibility(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
