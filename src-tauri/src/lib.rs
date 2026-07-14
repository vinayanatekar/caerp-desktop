mod commands;
mod database;
mod models;

use commands::{
    add_client,
    delete_client,
    get_clients,
    update_client,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
    add_client,
    get_clients,
    update_client,
    delete_client
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}