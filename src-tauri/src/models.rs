use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Option<i64>,
    pub pan: String,
    pub password: String,
    pub name: String,
    pub mobile: String,
    pub email: String,
    pub dob: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalSession {
    pub id: Option<i64>,
    pub user_id: i64,
    pub portal_name: String,
    pub session_status: String,
    pub last_login_time: Option<String>,
    pub last_checked_time: Option<String>,
    pub browser_profile: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleSearchResult {
    pub title: String,
    pub link: String,
    pub snippet: String,
}