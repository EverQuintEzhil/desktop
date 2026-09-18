mod auth_server;
mod terminal;
mod tools;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Must be the FIRST plugin: when the OS routes a `fluentmind-desktop://`
    // sign-in URL to a fresh process (Windows/Linux), single-instance forwards
    // it to the running app — where the deep-link plugin re-emits it to the
    // webview — instead of opening a second window.
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .manage(auth_server::AuthServerState::default())
        .setup(|_app| {
            // Installers register the URL scheme on Windows/Linux; a dev build has
            // no installer, so register it for this binary at startup — without it
            // "Sign in with website" opens the browser but the session can never
            // come back. macOS reads the scheme from the app bundle instead.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                _app.deep_link().register_all()?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            auth_server::start_desktop_auth_server,
            auth_server::stop_desktop_auth_server,
            tools::list_local_tools,
            tools::run_local_tool,
            tools::cancel_local_tools,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::terminal_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
