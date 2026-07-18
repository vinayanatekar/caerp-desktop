mod commands;
mod database;
mod models;

use commands::{
    add_client,
    delete_client,
    get_clients,
    update_client,
    open_income_tax,
    get_session_status,
    refresh_session_status,
    get_client,
    search_google_user
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
    add_client,
    get_clients,
    update_client,
    delete_client,
    open_income_tax,
    get_session_status,
    refresh_session_status,
    get_client,
    search_google_user
])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            database::init_database().expect("Failed to initialize database");

            // Start the background Playwright browser daemon on startup
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let _ = commands::start_automation_daemon(&app_handle);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::Exit => {
                let _ = commands::shutdown_daemon();
            }
            _ => {}
        });
}


