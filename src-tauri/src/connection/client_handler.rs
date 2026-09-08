use russh::client::Handler;
use russh::keys::PublicKeyOrCertificate;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::connection::state::ConnectionState;

#[derive(Clone)]
pub struct ClientHandler {
    pub server_id: String,
    pub state: Arc<RwLock<ConnectionState>>,
}

impl ClientHandler {
    pub fn new(server_id: String, state: Arc<RwLock<ConnectionState>>) -> Self {
        Self { server_id, state }
    }
}

impl Handler for ClientHandler {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        _server_public_key: &PublicKeyOrCertificate,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}
