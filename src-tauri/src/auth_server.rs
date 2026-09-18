//! Loopback fallback for "Sign in with website".
//!
//! macOS only routes `fluentmind-desktop://` URLs to a BUNDLED app (the scheme
//! lives in the bundle's Info.plist), so in `tauri dev` the deep link can never
//! come back. Instead, the app listens on an ephemeral 127.0.0.1 port, passes
//! that port to the website, and the website delivers
//! `GET /auth?token=…&state=…&expires_at=…` here (RFC 8252 §7.3 loopback
//! redirect). The URL is re-emitted to the webview as `desktop-auth-callback`,
//! where it goes through the exact same nonce check as a deep link.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Runtime, State};

/// Event re-emitted to the webview with the full loopback URL as its payload.
const CALLBACK_EVENT: &str = "desktop-auth-callback";

pub struct AuthServerState(Mutex<Option<ServerHandle>>);

impl Default for AuthServerState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

struct ServerHandle {
    port: u16,
    shutdown: Arc<AtomicBool>,
}

/// Starts (or reuses) the loopback listener and returns its port.
#[tauri::command]
pub fn start_desktop_auth_server<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AuthServerState>,
) -> Result<u16, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(handle) = guard.as_ref() {
        return Ok(handle.port);
    }

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let shutdown = Arc::new(AtomicBool::new(false));
    let flag = shutdown.clone();

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if flag.load(Ordering::SeqCst) {
                break;
            }

            if let Ok(stream) = stream {
                handle_connection(stream, port, &app);
            }
        }
    });

    *guard = Some(ServerHandle { port, shutdown });

    Ok(port)
}

/// Stops the listener. Safe to call when it was never started.
#[tauri::command]
pub fn stop_desktop_auth_server(state: State<'_, AuthServerState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(handle) = guard.take() {
        handle.shutdown.store(true, Ordering::SeqCst);
        // Unblock the accept() so the thread observes the flag and exits.
        let _ = TcpStream::connect(("127.0.0.1", handle.port));
    }

    Ok(())
}

fn handle_connection<R: Runtime>(stream: TcpStream, port: u16, app: &AppHandle<R>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));

    let mut reader = match stream.try_clone() {
        Ok(clone) => BufReader::new(clone),
        Err(_) => return,
    };

    let mut request_line = String::new();

    if reader.read_line(&mut request_line).is_err() {
        return;
    }

    // "GET /auth?token=…&state=… HTTP/1.1"
    let target = request_line.split_whitespace().nth(1).unwrap_or("");
    let is_auth = request_line.starts_with("GET ") && (target == "/auth" || target.starts_with("/auth?"));

    let (status, body) = if is_auth {
        // The webview performs the nonce check; the token never touches disk here.
        let _ = app.emit(CALLBACK_EVENT, format!("http://127.0.0.1:{}{}", port, target));

        (
            "200 OK",
            "<!doctype html><html><body style=\"font-family:sans-serif;text-align:center;padding-top:4rem\">\
             <h3>You're signed in</h3><p>Return to the desktop app. You can close this tab.</p></body></html>",
        )
    } else {
        ("404 Not Found", "Not found")
    };

    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
        body.len(),
    );

    let mut stream = stream;
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
