//! Local coding tools — bridge to the `agent-core` CLI.
//!
//! The webview never touches the OS: it calls exactly three commands. `list_local_tools`
//! returns the tool manifest (fed to the chat as `clientTools`); `run_local_tool` executes
//! one call as a fresh `agent-core --root <workspace> call <name> '<json>'` subprocess —
//! agent-core is stateless by design and persists cross-call state in `<workspace>/.agent/`;
//! `cancel_local_tools` flags in-flight calls (chat Stop) so their children are killed.
//!
//! Failures are returned as `{ok:false, error}` envelopes, never thrown: the model reads
//! *why* a call failed (including agent-core's own `permission_required` flow) and adapts.

use std::collections::HashSet;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{json, Value};

/// A single tool call may run tests or builds through agent-core's `shell`.
const RUN_TIMEOUT: Duration = Duration::from_secs(180);
const LIST_TIMEOUT: Duration = Duration::from_secs(20);
/// Dev fallback (relative to $HOME) after `AGENT_CORE_BIN` and `PATH`.
const DEV_FALLBACK_BIN: &str = "Ezhil/Ezhil/test/test/agent-core/target/release/agent-core";
/// Workspace roots that must never be granted, whatever the space says.
const FORBIDDEN_SUBDIRS: [&str; 4] = [".ssh", ".aws", ".gnupg", "Library/Keychains"];

#[derive(Serialize)]
pub struct ToolManifestEntry {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

fn refusal(message: String) -> Value {
    json!({ "ok": false, "error": message })
}

fn snippet(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.len() > 500 { format!("{}…", &trimmed[..500]) } else { trimmed.to_string() }
}

fn find_on_path(program: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(program))
        .find(|candidate| candidate.is_file())
}

fn resolve_binary() -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("AGENT_CORE_BIN") {
        let path = PathBuf::from(&explicit);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!("AGENT_CORE_BIN points at \"{explicit}\", which does not exist"));
    }

    if let Some(found) = find_on_path("agent-core") {
        return Ok(found);
    }

    if let Ok(home) = std::env::var("HOME") {
        let fallback = PathBuf::from(home).join(DEV_FALLBACK_BIN);
        if fallback.is_file() {
            return Ok(fallback);
        }
    }

    Err("agent-core binary not found: set AGENT_CORE_BIN or put agent-core on PATH".to_string())
}

/// The workspace must be a real, absolute directory — and never the home folder
/// itself or a credential directory, regardless of what the space is configured with.
/// Shared with the terminal module: the PTY cwd obeys the same rules.
pub(crate) fn validate_root(root: &str) -> Result<PathBuf, String> {
    let trimmed = root.trim();
    if trimmed.is_empty() {
        return Err("this space has no local folder path configured".to_string());
    }

    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(format!("workspace folder must be an absolute path, got \"{trimmed}\""));
    }

    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("workspace folder \"{trimmed}\" is not accessible: {e}"))?;
    if !canonical.is_dir() {
        return Err(format!("workspace folder \"{trimmed}\" is not a directory"));
    }

    if let Ok(home) = std::env::var("HOME") {
        if let Ok(home) = std::fs::canonicalize(home) {
            if canonical == home {
                return Err("the home folder itself cannot be used as a workspace".to_string());
            }
            for sub in FORBIDDEN_SUBDIRS {
                if canonical.starts_with(home.join(sub)) {
                    return Err(format!("\"{sub}\" cannot be used as a workspace"));
                }
            }
        }
    }

    Ok(canonical)
}

// ---- Cancellation ---------------------------------------------------------

/// Ids flagged by `cancel_local_tools`; the runner's 50ms poll loop kills
/// flagged children and resolves their calls as cancelled refusals.
fn cancelled_calls() -> &'static Mutex<HashSet<String>> {
    static CANCELLED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CANCELLED.get_or_init(|| Mutex::new(HashSet::new()))
}

fn is_cancelled(call_id: &str) -> bool {
    !call_id.is_empty()
        && cancelled_calls()
            .lock()
            .map(|set| set.contains(call_id))
            .unwrap_or(false)
}

fn clear_cancelled(call_id: &str) {
    if call_id.is_empty() {
        return;
    }
    if let Ok(mut set) = cancelled_calls().lock() {
        set.remove(call_id);
    }
}

/// Chat Stop: flag every in-flight call the webview is still tracking.
#[tauri::command]
pub fn cancel_local_tools(call_ids: Vec<String>) {
    if let Ok(mut set) = cancelled_calls().lock() {
        for id in call_ids {
            if !id.is_empty() {
                set.insert(id);
            }
        }
    }
}

/// Spawn with piped output, drain on threads (no pipe deadlock), kill on
/// timeout or when this call id is flagged for cancellation.
fn run_with_timeout(
    mut cmd: Command,
    timeout: Duration,
    call_id: &str,
) -> Result<(String, String, Option<i32>), String> {
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("failed to start agent-core: {e}"))?;

    let mut stdout_pipe = child.stdout.take().expect("stdout piped above");
    let mut stderr_pipe = child.stderr.take().expect("stderr piped above");
    let stdout_reader = std::thread::spawn(move || {
        let mut buffer = String::new();
        let _ = stdout_pipe.read_to_string(&mut buffer);
        buffer
    });
    let stderr_reader = std::thread::spawn(move || {
        let mut buffer = String::new();
        let _ = stderr_pipe.read_to_string(&mut buffer);
        buffer
    });

    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = stdout_reader.join().unwrap_or_default();
                let stderr = stderr_reader.join().unwrap_or_default();
                return Ok((stdout, stderr, status.code()));
            }
            Ok(None) => {
                if is_cancelled(call_id) {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("cancelled: the user stopped this chat turn".to_string());
                }
                if started.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("agent-core timed out after {}s and was stopped", timeout.as_secs()));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("failed waiting for agent-core: {e}")),
        }
    }
}

fn list_tools_blocking() -> Result<Vec<ToolManifestEntry>, String> {
    let binary = resolve_binary()?;
    let mut cmd = Command::new(binary);
    cmd.arg("tools");

    let (stdout, stderr, code) = run_with_timeout(cmd, LIST_TIMEOUT, "")?;
    let parsed: Value = serde_json::from_str(stdout.trim())
        .map_err(|_| format!("agent-core tools returned unparsable output (exit {code:?}): {}", snippet(&stderr)))?;

    let tools = parsed
        .pointer("/data/tools")
        .and_then(Value::as_array)
        .ok_or_else(|| "agent-core tools output has no data.tools".to_string())?;

    Ok(tools
        .iter()
        .filter_map(|tool| {
            Some(ToolManifestEntry {
                name: tool.get("name")?.as_str()?.to_string(),
                description: tool.get("description")?.as_str()?.to_string(),
                parameters: tool.get("parameters")?.clone(),
            })
        })
        .collect())
}

fn execute_tool(name: &str, args: Value, root: &str, call_id: &str) -> Value {
    if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return refusal(format!("invalid tool name \"{name}\""));
    }

    let workspace = match validate_root(root) {
        Ok(path) => path,
        Err(message) => return refusal(message),
    };

    let binary = match resolve_binary() {
        Ok(path) => path,
        Err(message) => return refusal(message),
    };

    let args_json = match serde_json::to_string(&args) {
        Ok(json) => json,
        Err(e) => return refusal(format!("tool arguments are not serializable: {e}")),
    };

    let mut cmd = Command::new(binary);
    cmd.arg("--root").arg(&workspace).arg("call").arg(name).arg(args_json);

    match run_with_timeout(cmd, RUN_TIMEOUT, call_id) {
        // agent-core prints exactly one JSON envelope; pass it through verbatim so
        // `permission_required` grants and structured errors reach the model intact.
        Ok((stdout, stderr, code)) => serde_json::from_str(stdout.trim()).unwrap_or_else(|_| {
            refusal(format!("agent-core exited {code:?} with unparsable output: {}", snippet(&stderr)))
        }),
        Err(message) => refusal(message),
    }
}

fn run_tool_blocking(name: String, args: Value, root: String, call_id: String) -> Value {
    let result = execute_tool(&name, args, &root, &call_id);
    // The flag is per-attempt: never let a stale entry poison a future call.
    clear_cancelled(&call_id);
    result
}

#[tauri::command]
pub async fn list_local_tools() -> Result<Vec<ToolManifestEntry>, String> {
    tauri::async_runtime::spawn_blocking(list_tools_blocking)
        .await
        .map_err(|e| format!("tool listing task failed: {e}"))?
}

#[tauri::command]
pub async fn run_local_tool(name: String, args: Value, root: String, call_id: Option<String>) -> Value {
    let call_id = call_id.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || run_tool_blocking(name, args, root, call_id))
        .await
        .unwrap_or_else(|e| refusal(format!("tool execution task failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_and_missing_roots() {
        assert!(validate_root("").is_err());
        assert!(validate_root("relative/path").is_err());
        assert!(validate_root("/definitely/not/a/real/dir/xyz").is_err());
    }

    #[test]
    fn rejects_home_and_credential_dirs() {
        let home = std::env::var("HOME").unwrap();
        assert!(validate_root(&home).is_err());
        // .ssh may not exist on CI; when it does, it must be refused.
        if std::fs::metadata(format!("{home}/.ssh")).is_ok() {
            assert!(validate_root(&format!("{home}/.ssh")).is_err());
        }
    }

    #[test]
    fn accepts_a_real_directory() {
        let dir = std::env::temp_dir();
        assert!(validate_root(dir.to_str().unwrap()).is_ok());
    }

    #[test]
    fn refuses_bad_tool_names_without_spawning() {
        let out = run_tool_blocking("rm -rf".into(), json!({}), "/tmp".into(), String::new());
        assert_eq!(out["ok"], json!(false));
    }

    #[test]
    fn cancelling_kills_a_running_child() {
        let call_id = "test-cancel-live";
        let handle = std::thread::spawn(move || {
            let mut cmd = Command::new("/bin/sleep");
            cmd.arg("5");
            run_with_timeout(cmd, Duration::from_secs(10), call_id)
        });

        std::thread::sleep(Duration::from_millis(200));
        cancel_local_tools(vec![call_id.to_string()]);

        let result = handle.join().expect("runner thread");
        assert!(result.unwrap_err().contains("cancelled"));
        clear_cancelled(call_id);
    }

    #[test]
    fn cancelling_an_unknown_id_is_flagged_then_clearable() {
        cancel_local_tools(vec!["never-ran".to_string()]);
        assert!(is_cancelled("never-ran"));
        clear_cancelled("never-ran");
        assert!(!is_cancelled("never-ran"));
    }
}
