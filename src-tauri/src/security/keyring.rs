use std::collections::HashMap;
use std::sync::RwLock;
use tracing::{debug, warn};
use crate::core::Result;

/// Helper to safely run OS keyring operations on a dedicated OS thread.
/// This prevents blocking or runtime nesting conflicts with Tokio worker threads,
/// and catches any panics from underlying DBus/Keyring providers.
fn run_isolated<F, R>(f: F) -> Option<R>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    match std::thread::spawn(f).join() {
        Ok(res) => Some(res),
        Err(e) => {
            warn!("OS Keyring operation panicked or failed to join: {:?}", e);
            None
        }
    }
}

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

        let service = self.service_name.clone();
        let key_owned = key.to_string();
        let secret_owned = secret.to_string();

        let _ = run_isolated(move || {
            if let Ok(entry) = keyring::Entry::new(&service, &key_owned) {
                if let Err(e) = entry.set_password(&secret_owned) {
                    warn!("OS Keyring set_password failed ({}), using memory fallback", e);
                } else {
                    debug!("Saved secret to OS keyring for key: {}", key_owned);
                }
            }
        });

        Ok(())
    }

    pub fn get_secret(&self, key: &str) -> Result<Option<String>> {
        let service = self.service_name.clone();
        let key_owned = key.to_string();

        let os_secret = run_isolated(move || {
            if let Ok(entry) = keyring::Entry::new(&service, &key_owned) {
                match entry.get_password() {
                    Ok(pwd) => Some(pwd),
                    Err(e) => {
                        debug!("OS Keyring get_password returned: {}", e);
                        None
                    }
                }
            } else {
                None
            }
        })
        .flatten();

        if let Some(pwd) = os_secret {
            return Ok(Some(pwd));
        }

        let mem = self.memory_fallback.read().unwrap();
        Ok(mem.get(key).cloned())
    }

    pub fn delete_secret(&self, key: &str) -> Result<()> {
        let mut mem = self.memory_fallback.write().unwrap();
        mem.remove(key);

        let service = self.service_name.clone();
        let key_owned = key.to_string();

        let _ = run_isolated(move || {
            if let Ok(entry) = keyring::Entry::new(&service, &key_owned) {
                let _ = entry.delete_credential();
            }
        });

        Ok(())
    }
}

impl Default for KeyringService {
    fn default() -> Self {
        Self::new()
    }
}
