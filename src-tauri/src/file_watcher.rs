use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

struct WatcherHandle {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

static WATCHER: Mutex<Option<WatcherHandle>> = Mutex::new(None);

/// Start watching a directory for file changes.
/// Emits `files_changed` events to the frontend.
pub fn start(app: &AppHandle, root_path: &str) {
    stop();

    let root = root_path.to_string();
    let app_handle = app.clone();

    let debouncer = new_debouncer(
        Duration::from_millis(150),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if let Ok(events) = res {
                let root_path = Path::new(&root);
                let mut changes: Vec<serde_json::Value> = Vec::new();

                for event in &events {
                    let rel = event
                        .path
                        .strip_prefix(root_path)
                        .unwrap_or(&event.path)
                        .to_string_lossy()
                        .to_string();

                    // Skip hidden files
                    if rel.starts_with('.') || rel.contains("/.") {
                        continue;
                    }

                    let change_type = match event.kind {
                        DebouncedEventKind::Any => "change",
                        DebouncedEventKind::AnyContinuous => "change",
                        _ => "change",
                    };

                    changes.push(serde_json::json!({
                        "path": rel,
                        "type": change_type,
                    }));
                }

                if !changes.is_empty() {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.emit("files_changed", &changes);
                    }
                }
            }
        },
    );

    match debouncer {
        Ok(mut debouncer) => {
            let watch_result = debouncer.watcher().watch(
                Path::new(root_path),
                notify::RecursiveMode::Recursive,
            );
            if let Err(e) = watch_result {
                eprintln!("[FileWatcher] Failed to watch {}: {}", root_path, e);
                return;
            }

            let mut guard = WATCHER.lock().unwrap();
            *guard = Some(WatcherHandle {
                _debouncer: debouncer,
            });
            eprintln!("[FileWatcher] Started watching: {}", root_path);
        }
        Err(e) => {
            eprintln!("[FileWatcher] Failed to create debouncer: {}", e);
        }
    }
}

/// Stop watching
pub fn stop() {
    let mut guard = WATCHER.lock().unwrap();
    if guard.is_some() {
        *guard = None;
        eprintln!("[FileWatcher] Stopped");
    }
}
