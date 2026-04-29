use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use super::claude_detector::ClaudeDetector;

const BATCH_INTERVAL: Duration = Duration::from_millis(16);
const READ_BUF_SIZE: usize = 4096;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalDataPayload {
    session_id: String,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ClaudeStatusPayload {
    session_id: String,
    state: String,
}

struct SessionHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    _shutdown_tx: Option<oneshot::Sender<()>>,
    claude_state: Arc<Mutex<String>>,
}

pub struct PtyState {
    sessions: Mutex<HashMap<String, SessionHandle>>,
    app_handle: AppHandle,
}

impl PtyState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            app_handle,
        }
    }

    pub fn create(&self) -> Result<String, String> {
        let session_id = format!("terminal-{}", chrono::Utc::now().timestamp_millis());

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let shell =
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let home = dirs::home_dir().unwrap_or_default();
        let workspace_dir = home.join("life-editor-workspace");
        let cwd = if workspace_dir.exists() {
            workspace_dir
        } else {
            home
        };

        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("--login");
        cmd.cwd(&cwd);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);

        let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let claude_state = Arc::new(Mutex::new("inactive".to_string()));
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // Spawn reader thread
        let app_handle = self.app_handle.clone();
        let sid = session_id.clone();
        let cs = Arc::clone(&claude_state);

        thread::spawn(move || {
            reader_loop(reader, app_handle, sid, cs, shutdown_rx);
        });

        // Spawn a thread to wait for child exit and clean up
        let app_handle2 = self.app_handle.clone();
        let sid2 = session_id.clone();
        thread::spawn(move || {
            let _ = child.wait();
            // Child exited — reader thread will also stop via EOF
            eprintln!("[Terminal] Child exited for session {}", sid2);
            // Remove session from map if still present
            if let Some(pty_state) = app_handle2.try_state::<PtyState>() {
                let mut sessions = pty_state.sessions.lock().unwrap();
                sessions.remove(&sid2);
            }
        });

        let handle = SessionHandle {
            writer,
            master: pair.master,
            _shutdown_tx: Some(shutdown_tx),
            claude_state,
        };

        self.sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), handle);
        eprintln!("[Terminal] Created session {}", session_id);
        Ok(session_id)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get_mut(session_id) {
            handle
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| e.to_string())?;
            handle.writer.flush().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn resize(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get(session_id) {
            handle
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn destroy(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.remove(session_id) {
            // shutdown_tx is dropped here, signaling the reader thread.
            // master is dropped here, closing the PTY fd → reader gets EOF.
            drop(handle);
            eprintln!("[Terminal] Destroyed session {}", session_id);
        }
        Ok(())
    }

    pub fn get_claude_state(&self, session_id: &str) -> String {
        let sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get(session_id) {
            handle.claude_state.lock().unwrap().clone()
        } else {
            "inactive".to_string()
        }
    }

    pub fn destroy_all(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        let ids: Vec<String> = sessions.keys().cloned().collect();
        for id in &ids {
            if let Some(handle) = sessions.remove(id) {
                drop(handle);
                eprintln!("[Terminal] Destroyed session {}", id);
            }
        }
    }
}

fn reader_loop(
    mut reader: Box<dyn Read + Send>,
    app_handle: AppHandle,
    session_id: String,
    claude_state: Arc<Mutex<String>>,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    let mut buf = [0u8; READ_BUF_SIZE];
    let mut batch_buf = String::new();
    let mut detector = ClaudeDetector::new();
    let mut last_flush = Instant::now();

    loop {
        // Check shutdown (non-blocking)
        if shutdown_rx.try_recv().is_ok() {
            break;
        }

        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let chunk = String::from_utf8_lossy(&buf[..n]);

                // Feed to claude detector
                if let Some(new_state) = detector.process_output(&chunk) {
                    let state_str = new_state.as_str().to_string();
                    *claude_state.lock().unwrap() = state_str.clone();

                    if let Some(window) =
                        app_handle.get_webview_window("main")
                    {
                        let _ = window.emit(
                            "terminal_claude_status",
                            ClaudeStatusPayload {
                                session_id: session_id.clone(),
                                state: state_str,
                            },
                        );
                    }
                }

                batch_buf.push_str(&chunk);

                // Flush if 16ms elapsed since last flush
                if last_flush.elapsed() >= BATCH_INTERVAL {
                    flush_batch(&app_handle, &session_id, &mut batch_buf);
                    last_flush = Instant::now();
                }
            }
            Err(_) => break,
        }
    }

    // Final flush
    if !batch_buf.is_empty() {
        flush_batch(&app_handle, &session_id, &mut batch_buf);
    }

    eprintln!("[Terminal] Reader thread exiting for session {}", session_id);
}

fn flush_batch(
    app_handle: &AppHandle,
    session_id: &str,
    buffer: &mut String,
) {
    if buffer.is_empty() {
        return;
    }
    let data = std::mem::take(buffer);
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.emit(
            "terminal_data",
            TerminalDataPayload {
                session_id: session_id.to_string(),
                data,
            },
        );
    }
}
