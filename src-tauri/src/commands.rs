use rusqlite::{params, Connection};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::thread;
use tauri::{command, AppHandle, Emitter};

use crate::models::{User, PortalSession, GoogleSearchResult};

#[derive(serde::Serialize, Clone)]
struct AutomationPayload {
    event_type: String,
    message: String,
}

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
fn is_valid_pan(pan: &str) -> bool {
    if pan.len() != 10 {
        return false;
    }
    let chars: Vec<char> = pan.chars().collect();
    for i in 0..5 {
        if !chars[i].is_ascii_alphabetic() {
            return false;
        }
    }
    for i in 5..9 {
        if !chars[i].is_ascii_digit() {
            return false;
        }
    }
    if !chars[9].is_ascii_alphabetic() {
        return false;
    }
    true
}

#[command]
pub fn open_income_tax(app: AppHandle, user_id: i64, target: String) -> Result<String, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT pan, password FROM clients WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let (pan, password): (String, String) = stmt
        .query_row(params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;

    // Validate User Information
    if pan.trim().is_empty() {
        return Err("Validation Error: PAN is required.".to_string());
    }
    if password.trim().is_empty() {
        return Err("Validation Error: Password is required.".to_string());
    }
    if !is_valid_pan(&pan) {
        return Err("Validation Error: Invalid PAN format. A PAN must consist of 5 letters, 4 digits, and 1 letter (e.g., ABCDE1234F).".to_string());
    }

    ensure_daemon_running(&app)?;

    // Send action trigger request to the running Node.js HTTP daemon
    let mut stream = TcpStream::connect("127.0.0.1:30100")
        .map_err(|e| format!("Failed to connect to automation daemon. Make sure the CAERP app started successfully: {}", e))?;

    let json_body = serde_json::json!({
        "pan": pan,
        "password": password,
        "target": target
    }).to_string();

    let request = format!(
        "POST /action HTTP/1.1\r\n\
         Host: 127.0.0.1:30100\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        json_body.len(),
        json_body
    );

    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;

    Ok("Request sent to automation daemon".to_string())
}

pub fn start_automation_daemon(app: &AppHandle) -> Result<(), String> {
    println!("Launching background automation daemon process...");

    let mut base_path = std::env::current_dir().map_err(|e| e.to_string())?;
    if !base_path.join("automation").join("login.ts").exists() {
        if let Some(parent) = base_path.parent() {
            if parent.join("automation").join("login.ts").exists() {
                base_path = parent.to_path_buf();
            }
        }
    }

    let cmd = if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" };
    
    let mut child = Command::new(cmd)
        .arg("tsx")
        .arg("automation/login.ts")
        .current_dir(&base_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("Failed to open daemon stdout")?;
    let stderr = child.stderr.take();

    if let Some(err_stream) = stderr {
        thread::spawn(move || {
            let reader = BufReader::new(err_stream);
            for line in reader.lines() {
                if let Ok(l) = line {
                    println!("[Daemon Stderr] {}", l);
                }
            }
        });
    }

    let app_clone = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                println!("[Daemon] {}", line_str);
                
                if line_str.contains("[STATUS] ") {
                    let msg = line_str.split("[STATUS] ").nth(1).unwrap_or("").to_string();
                    let _ = app_clone.emit("automation_event", AutomationPayload {
                        event_type: "status".to_string(),
                        message: msg,
                    });
                } else if line_str.contains("[SUCCESS] ") {
                    let msg = line_str.split("[SUCCESS] ").nth(1).unwrap_or("").to_string();
                    let _ = app_clone.emit("automation_event", AutomationPayload {
                        event_type: "success".to_string(),
                        message: msg,
                    });
                } else if line_str.contains("[ERROR] ") {
                    let msg = line_str.split("[ERROR] ").nth(1).unwrap_or("").to_string();
                    let _ = app_clone.emit("automation_event", AutomationPayload {
                        event_type: "error".to_string(),
                        message: msg,
                    });
                }
            }
        }
        let _ = child.wait();
    });

    Ok(())
}

pub fn ensure_daemon_running(app: &AppHandle) -> Result<(), String> {
    if TcpStream::connect("127.0.0.1:30100").is_ok() {
        return Ok(());
    }
    println!("Automation daemon not reachable on 127.0.0.1:30100. Auto-launching daemon...");
    let _ = start_automation_daemon(app);
    for _ in 0..15 {
        thread::sleep(std::time::Duration::from_millis(500));
        if TcpStream::connect("127.0.0.1:30100").is_ok() {
            println!("Automation daemon successfully initialized on port 30100.");
            return Ok(());
        }
    }
    Err("Failed to start automation daemon on port 30100. Make sure Node.js is installed.".to_string())
}

pub fn shutdown_daemon() -> Result<(), String> {
    println!("Sending shutdown command to automation daemon...");
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:30100") {
        let request = "POST /close HTTP/1.1\r\n\
                       Host: 127.0.0.1:30100\r\n\
                       Content-Length: 0\r\n\
                       Connection: close\r\n\
                       \r\n";
        let _ = stream.write_all(request.as_bytes());
    }
    Ok(())
}

fn get_or_create_session(conn: &Connection, user_id: i64) -> Result<PortalSession, String> {
    let mut stmt = conn
        .prepare("SELECT id, user_id, portal_name, session_status, last_login_time, last_checked_time, browser_profile, created_at, updated_at FROM portal_sessions WHERE user_id = ?1")
        .map_err(|e| e.to_string())?;
    
    let session = stmt.query_row(params![user_id], |row| {
        Ok(PortalSession {
            id: row.get(0)?,
            user_id: row.get(1)?,
            portal_name: row.get(2)?,
            session_status: row.get(3)?,
            last_login_time: row.get(4)?,
            last_checked_time: row.get(5)?,
            browser_profile: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    });

    if let Ok(s) = session {
        return Ok(s);
    }

    // Fetch PAN to build default browser profile path
    let mut client_stmt = conn
        .prepare("SELECT pan FROM clients WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let pan: String = client_stmt
        .query_row(params![user_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let browser_profile = format!("automation/.user_data/{}", pan);

    conn.execute(
        "INSERT INTO portal_sessions (user_id, session_status, browser_profile) VALUES (?1, 'Not Checked', ?2)",
        params![user_id, browser_profile]
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();
    Ok(PortalSession {
        id: Some(new_id),
        user_id,
        portal_name: "Income Tax Portal".to_string(),
        session_status: "Not Checked".to_string(),
        last_login_time: None,
        last_checked_time: None,
        browser_profile,
        created_at: None,
        updated_at: None,
    })
}

#[command]
pub fn get_client(id: i64) -> Result<User, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, pan, password, name, mobile, email, dob FROM clients WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let client = stmt
        .query_row(params![id], |row| {
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

    Ok(client)
}

#[command]
pub fn get_session_status(user_id: i64) -> Result<PortalSession, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;
    get_or_create_session(&conn, user_id)
}

#[command]
pub fn refresh_session_status(app: AppHandle, user_id: i64) -> Result<PortalSession, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    // Fetch PAN of the user
    let mut client_stmt = conn
        .prepare("SELECT pan FROM clients WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let pan: String = client_stmt
        .query_row(params![user_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    ensure_daemon_running(&app)?;

    // Trigger TCP connection to daemon /check
    let mut stream = TcpStream::connect("127.0.0.1:30100")
        .map_err(|e| format!("Failed to connect to automation daemon: {}", e))?;

    let json_body = serde_json::json!({
        "pan": pan
    }).to_string();

    let request = format!(
        "POST /check HTTP/1.1\r\n\
         Host: 127.0.0.1:30100\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        json_body.len(),
        json_body
    );

    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;

    // Read response from daemon to parse loggedIn status
    let mut response = String::new();
    use std::io::Read;
    stream.read_to_string(&mut response).map_err(|e| e.to_string())?;

    let is_logged_in = response.contains("\"loggedIn\":true");

    let status = if is_logged_in { "Logged In" } else { "Not Logged In" };

    // Update database status
    let query = if is_logged_in {
        "UPDATE portal_sessions SET session_status = ?1, last_login_time = datetime('now', 'localtime'), last_checked_time = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE user_id = ?2"
    } else {
        "UPDATE portal_sessions SET session_status = ?1, last_checked_time = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE user_id = ?2"
    };

    conn.execute(query, params![status, user_id])
        .map_err(|e| e.to_string())?;

    get_or_create_session(&conn, user_id)
}

#[command]
pub fn search_google_user(app: AppHandle, user_id: i64) -> Result<Vec<GoogleSearchResult>, String> {
    let conn = Connection::open("caerp.db")
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT name, pan FROM clients WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let (name, pan): (String, String) = stmt
        .query_row(params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;

    if name.trim().is_empty() {
        return Err("Validation Error: Client name is empty.".to_string());
    }

    ensure_daemon_running(&app)?;

    let mut stream = TcpStream::connect("127.0.0.1:30100")
        .map_err(|e| format!("Failed to connect to automation daemon: {}", e))?;

    let json_body = serde_json::json!({
        "name": name,
        "pan": pan
    }).to_string();

    let request = format!(
        "POST /search_google HTTP/1.1\r\n\
         Host: 127.0.0.1:30100\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        json_body.len(),
        json_body
    );

    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;

    let mut response_str = String::new();
    use std::io::Read;
    stream.read_to_string(&mut response_str).map_err(|e| e.to_string())?;

    let body_str = match response_str.find("\r\n\r\n") {
        Some(index) => &response_str[index + 4..],
        None => &response_str,
    };

    let json_str = match (body_str.find('{'), body_str.rfind('}')) {
        (Some(start), Some(end)) if start <= end => &body_str[start..=end],
        _ => body_str.trim(),
    };

    #[derive(serde::Deserialize)]
    struct SearchResponse {
        status: String,
        results: Option<Vec<GoogleSearchResult>>,
        error: Option<String>,
    }

    let parsed: SearchResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse response from daemon: {}. Body: {}", e, json_str))?;

    if parsed.status == "success" {
        Ok(parsed.results.unwrap_or_default())
    } else {
        Err(parsed.error.unwrap_or_else(|| "Google search failed".to_string()))
    }
}


