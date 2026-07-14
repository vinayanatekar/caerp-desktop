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