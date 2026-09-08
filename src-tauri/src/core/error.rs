use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize, Clone)]
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

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
