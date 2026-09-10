use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Storage error: {0}")]
    Storage(String),
    #[error("Security error: {0}")]
    Security(String),
    #[error("SSH connection error: {0}")]
    Connection(String),
    #[error("SFTP error: {0}")]
    Sftp(String),
    #[error("Terminal error: {0}")]
    Terminal(String),
    #[error("Transfer error: {0}")]
    Transfer(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_serialization_as_string() {
        let err = AppError::Connection("Connection refused (os error 111)".to_string());
        let serialized = serde_json::to_string(&err).expect("serialize error");
        assert_eq!(
            serialized,
            "\"SSH connection error: Connection refused (os error 111)\""
        );

        let db_err = AppError::Database("no such table: test".to_string());
        let serialized_db = serde_json::to_string(&db_err).expect("serialize db error");
        assert_eq!(serialized_db, "\"Database error: no such table: test\"");
    }
}
