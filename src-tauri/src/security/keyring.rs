use std::collections::HashMap;
use std::sync::RwLock;
use tracing::{debug, warn};
use crate::core::Result;

pub struct KeyringService {
    service_name: String,
    memory_fallback: RwLock<HashMap<String, String>>,
}

impl KeyringService {
    pub fn new() -> Self {
        Self {
            service_name: "com.remora.app".to_string(),
            memory_fallback: RwLock::new(HashMap::new()),
        }
    }

    pub fn set_secret(&self, key: &str, secret: &str) -> Result<()> {
        let mut mem = self.memory_fallback.write().unwrap();
        mem.insert(key.to_string(), secret.to_string());

        if let Ok(entry) = keyring::Entry::new(&self.service_name, key) {
            if let Err(e) = entry.set_password(secret) {
                warn!("OS Keyring set_password failed ({}), using memory fallback", e);
            } else {
                debug!("Saved secret to OS keyring for key: {}", key);
            }
        }
        Ok(())
    }

    pub fn get_secret(&self, key: &str) -> Result<Option<String>> {
        if let Ok(entry) = keyring::Entry::new(&self.service_name, key) {
            if let Ok(pwd) = entry.get_password() {
                return Ok(Some(pwd));
            }
        }
        let mem = self.memory_fallback.read().unwrap();
        Ok(mem.get(key).cloned())
    }

    pub fn delete_secret(&self, key: &str) -> Result<()> {
        let mut mem = self.memory_fallback.write().unwrap();
        mem.remove(key);

        if let Ok(entry) = keyring::Entry::new(&self.service_name, key) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}

impl Default for KeyringService {
    fn default() -> Self {
        Self::new()
    }
}
