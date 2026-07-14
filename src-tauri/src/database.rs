use rusqlite::{Connection, Result};

pub fn init_database() -> Result<()> {
    // Create/Open SQLite database
    let conn = Connection::open("caerp.db")?;

    // Create clients table
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pan TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            mobile TEXT,
            email TEXT,
            dob TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ",
        [],
    )?;

    println!("✅ Database initialized successfully.");

    Ok(())
}