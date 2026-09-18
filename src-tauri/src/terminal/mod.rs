//! Shared interactive terminal — one real PTY per session, rooted at the
//! Space's folder. The SAME session is visible in the app's terminal panel
//! (xterm.js renders the `terminal-output` events) and drivable by the agent
//! through the `terminal` client tool (`terminal_run`), so the user watches
//! every agent command live.
//!
//! Agent runs use a sentinel protocol: the command line is suffixed with
//! `printf '\n__FM_DONE_<nonce>_%d\n' $?`, and the reader thread captures the
//! stream until the sentinel (with a real exit code) appears. The echoed
//! command line also contains the sentinel text but never parses as
//! `<digits>\n`, so scanning skips it (see `split_at_sentinel` tests).

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::time::Duration;

use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::tools::validate_root;

const DEFAULT_RUN_TIMEOUT_MS: u64 = 120_000;
const MAX_RUN_TIMEOUT_MS: u64 = 600_000;
/// Cap on output captured for the agent — the panel still shows everything.
const MAX_CAPTURE_BYTES: usize = 64 * 1024;

#[derive(Clone, Serialize)]
struct TerminalEvent {
    id: String,
    data: String,
}

struct PendingRun {
    sentinel: String,
    collected: String,
    tx: mpsc::Sender<(String, i32)>,
}

struct Session {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    pending: Mutex<Option<PendingRun>>,
}

fn sessions() -> &'static Mutex<HashMap<String, Arc<Session>>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, Arc<Session>>>> = OnceLock::new();
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_unique(prefix: &str) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{prefix}-{millis}-{count}")
}

fn get_session(id: &str) -> Result<Arc<Session>, String> {
    sessions()
        .lock()
        .map_err(|_| "terminal registry poisoned".to_string())?
        .get(id)
        .cloned()
        .ok_or_else(|| format!("no terminal session \"{id}\" — it may have been closed"))
}

/// Finds `<sentinel><digits>(\r|\n)` in `collected`. Occurrences whose suffix is
/// not a complete `<digits>` line (e.g. the shell's ECHO of the typed command,
/// where the suffix is the literal `%d`) are skipped; an occurrence without a
/// terminator yet means "wait for more bytes".
fn split_at_sentinel(collected: &str, sentinel: &str) -> Option<(String, i32)> {
    let mut search_from = 0;
    while let Some(found) = collected[search_from..].find(sentinel) {
        let start = search_from + found;
        let after = &collected[start + sentinel.len()..];
        match after.find(['\r', '\n']) {
            Some(end) => {
                if let Ok(code) = after[..end].trim().parse::<i32>() {
                    return Some((collected[..start].to_string(), code));
                }
                search_from = start + sentinel.len();
            }
            None => return None,
        }
    }
    None
}

fn cap_front(text: &mut String, max: usize) {
    if text.len() <= max {
        return;
    }
    let mut cut = text.len() - max;
    while !text.is_char_boundary(cut) {
        cut += 1;
    }
    text.drain(..cut);
}

fn spawn_reader(app: AppHandle, id: String, session: Arc<Session>, mut reader: Box<dyn Read + Send>) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();

                    if let Ok(mut pending) = session.pending.lock() {
                        if let Some(run) = pending.as_mut() {
                            run.collected.push_str(&chunk);
                            cap_front(&mut run.collected, MAX_CAPTURE_BYTES);
                            if let Some((output, code)) = split_at_sentinel(&run.collected, &run.sentinel) {
                                let _ = run.tx.send((output, code));
                                *pending = None;
                            }
                        }
                    }

                    let _ = app.emit("terminal-output", TerminalEvent { id: id.clone(), data: chunk });
                }
            }
        }

        let _ = app.emit("terminal-exit", TerminalEvent { id: id.clone(), data: String::new() });
        if let Ok(mut map) = sessions().lock() {
            map.remove(&id);
        }
    });
}

fn reap(mut child: Box<dyn Child + Send + Sync>) {
    // Waits off-thread so the exited shell never lingers as a zombie.
    std::thread::spawn(move || {
        let _ = child.wait();
    });
}

fn open_blocking(app: AppHandle, root: String, cols: u16, rows: u16) -> Result<String, String> {
    let workspace = validate_root(&root)?;

    let pair = native_pty_system()
        .openpty(PtySize { rows: rows.max(2), cols: cols.max(20), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("failed to open a pty: {e}"))?;

    // Login shell: a GUI app inherits no user PATH/nvm/rbenv — `-l` loads them.
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l");
    cmd.cwd(&workspace);
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("failed to start {shell}: {e}"))?;
    drop(pair.slave);

    let killer = child.clone_killer();
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("failed to read the pty: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("failed to write to the pty: {e}"))?;

    let id = next_unique("term");
    let session = Arc::new(Session {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        killer: Mutex::new(killer),
        pending: Mutex::new(None),
    });

    sessions()
        .lock()
        .map_err(|_| "terminal registry poisoned".to_string())?
        .insert(id.clone(), session.clone());

    spawn_reader(app, id.clone(), session, reader);
    reap(child);

    Ok(id)
}

#[tauri::command]
pub async fn terminal_open(app: AppHandle, root: String, cols: u16, rows: u16) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || open_blocking(app, root, cols, rows))
        .await
        .map_err(|e| format!("terminal task failed: {e}"))?
}

#[tauri::command]
pub fn terminal_write(id: String, data: String) -> Result<(), String> {
    let session = get_session(&id)?;
    let mut writer = session.writer.lock().map_err(|_| "terminal writer poisoned".to_string())?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| format!("terminal write failed: {e}"))
}

#[tauri::command]
pub fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    let session = get_session(&id)?;
    let master = session.master.lock().map_err(|_| "terminal state poisoned".to_string())?;
    master
        .resize(PtySize { rows: rows.max(2), cols: cols.max(20), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("terminal resize failed: {e}"))
}

#[tauri::command]
pub fn terminal_close(id: String) {
    let session = sessions().lock().ok().and_then(|mut map| map.remove(&id));
    if let Some(session) = session {
        if let Ok(mut killer) = session.killer.lock() {
            let _ = killer.kill();
        }
    }
}

fn run_blocking(id: String, command: String, timeout_ms: Option<u64>) -> Value {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return json!({ "ok": false, "error": "command is empty" });
    }
    if trimmed.contains('\n') || trimmed.contains('\r') {
        return json!({ "ok": false, "error": "one command per call — chain with && instead of newlines" });
    }

    let session = match get_session(&id) {
        Ok(session) => session,
        Err(message) => return json!({ "ok": false, "error": message }),
    };

    let sentinel = format!("__FM_DONE_{}_", next_unique("run"));
    let rx = {
        let mut pending = match session.pending.lock() {
            Ok(pending) => pending,
            Err(_) => return json!({ "ok": false, "error": "terminal state poisoned" }),
        };
        if pending.is_some() {
            return json!({ "ok": false, "error": "another terminal command is still running in this session — wait for it or ask the user" });
        }
        let (tx, rx) = mpsc::channel();
        *pending = Some(PendingRun { sentinel: sentinel.clone(), collected: String::new(), tx });
        rx
    };

    // `$?` is POSIX (sh/bash/zsh). The sentinel rides the same byte stream the
    // panel displays, so the user sees exactly what the agent ran.
    let line = format!("{trimmed}; printf '\\n{sentinel}%d\\n' $?\r");
    {
        let writer = session.writer.lock();
        match writer {
            Ok(mut writer) => {
                if let Err(e) = writer.write_all(line.as_bytes()).and_then(|_| writer.flush()) {
                    if let Ok(mut pending) = session.pending.lock() {
                        *pending = None;
                    }
                    return json!({ "ok": false, "error": format!("terminal write failed: {e}") });
                }
            }
            Err(_) => return json!({ "ok": false, "error": "terminal writer poisoned" }),
        }
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_RUN_TIMEOUT_MS).min(MAX_RUN_TIMEOUT_MS));
    match rx.recv_timeout(timeout) {
        Ok((output, exit_code)) => json!({
            "ok": true,
            "data": { "output": output, "exit_code": exit_code, "timed_out": false },
        }),
        Err(_) => {
            let partial = session
                .pending
                .lock()
                .ok()
                .and_then(|mut pending| pending.take())
                .map(|run| run.collected)
                .unwrap_or_default();
            json!({
                "ok": true,
                "data": {
                    "output": partial,
                    "exit_code": null,
                    "timed_out": true,
                    "note": "the command may still be running in the terminal — the user can see and stop it there",
                },
            })
        }
    }
}

#[tauri::command]
pub async fn terminal_run(id: String, command: String, timeout_ms: Option<u64>) -> Value {
    tauri::async_runtime::spawn_blocking(move || run_blocking(id, command, timeout_ms))
        .await
        .unwrap_or_else(|e| json!({ "ok": false, "error": format!("terminal task failed: {e}") }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SENTINEL: &str = "__FM_DONE_run-1-1_";

    #[test]
    fn sentinel_skips_the_echoed_command_line() {
        let stream = format!(
            "npm test; printf '\\n{SENTINEL}%d\\n' $?\r\n...real test output...\n{SENTINEL}0\n"
        );
        let (output, code) = split_at_sentinel(&stream, SENTINEL).expect("sentinel with digits");
        assert_eq!(code, 0);
        assert!(output.contains("real test output"));
        assert!(!output.contains(&format!("{SENTINEL}0")));
    }

    #[test]
    fn sentinel_waits_for_a_complete_line() {
        assert!(split_at_sentinel(&format!("partial {SENTINEL}12"), SENTINEL).is_none());
        assert!(split_at_sentinel("no marker at all", SENTINEL).is_none());
    }

    #[test]
    fn sentinel_reports_nonzero_exit_codes() {
        let stream = format!("boom\n{SENTINEL}127\r\n");
        let (_, code) = split_at_sentinel(&stream, SENTINEL).expect("complete sentinel");
        assert_eq!(code, 127);
    }

    #[test]
    fn capture_cap_respects_char_boundaries() {
        let mut text = "é".repeat(100);
        cap_front(&mut text, 11);
        assert!(text.len() <= 12);
        assert!(text.chars().all(|c| c == 'é'));
    }
}
