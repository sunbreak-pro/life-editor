use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Register global shortcuts from the user's config.
/// Unregisters all existing shortcuts first to avoid duplicates.
pub fn register_shortcuts(app: &AppHandle, config: &HashMap<String, String>) {
    unregister_all(app);

    for (action_id, accelerator) in config {
        if accelerator.is_empty() {
            continue;
        }
        let action = action_id.clone();
        let result =
            app.global_shortcut()
                .on_shortcut(accelerator.as_str(), move |app_handle, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("menu_action", &action);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                });
        if let Err(e) = result {
            eprintln!(
                "[GlobalShortcut] Failed to register '{}' for {}: {}",
                accelerator, action_id, e
            );
        }
    }
}

/// Unregister all global shortcuts
pub fn unregister_all(app: &AppHandle) {
    let _ = app.global_shortcut().unregister_all();
}
