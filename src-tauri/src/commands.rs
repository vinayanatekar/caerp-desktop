use rusqlite::{params, Connection};
use tauri::command;

use crate::models::User;

#[command]
pub fn add_client(user: User) -> Result<String, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO clients
        (pan, password, name, mobile, email, dob)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            user.pan,
            user.password,
            user.name,
            user.mobile,
            user.email,
            user.dob
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok("Client added successfully".to_string())
}
#[command]
pub fn get_clients() -> Result<Vec<User>, String> {

    println!("Current directory: {:?}", std::env::current_dir());

    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, pan, password, name, mobile, email, dob FROM clients"
        )
        .map_err(|e| e.to_string())?;

    let clients = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                pan: row.get(1)?,
                password: row.get(2)?,
                name: row.get(3)?,
                mobile: row.get(4)?,
                email: row.get(5)?,
                dob: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let clients = clients
        .collect::<Result<Vec<User>, rusqlite::Error>>()
        .map_err(|e| e.to_string())?;

    println!("Found {} clients", clients.len());
    println!("{:#?}", clients);

    Ok(clients)
}

#[command]
pub fn update_client() -> Result<String, String> {
    Ok("update_client called".to_string())
}

#[command]
pub fn delete_client() -> Result<String, String> {
    Ok("delete_client called".to_string())
}