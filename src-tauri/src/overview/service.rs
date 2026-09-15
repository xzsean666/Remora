use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::connection::ConnectionManager;
use crate::core::{Result, ServerOverview};

#[derive(Clone, Debug, Default)]
struct PrevSample {
    cpu_total: u64,
    cpu_idle: u64,
    net_rx_bytes: u64,
    net_tx_bytes: u64,
    timestamp_ms: u64,
}

pub struct OverviewService {
    connection: Arc<ConnectionManager>,
    prev_samples: Arc<RwLock<HashMap<String, PrevSample>>>,
}

const PROBE_SCRIPT: &str = r#"if [ -f /proc/stat ]; then
  echo "===OS==="; echo "Linux";
  echo "===CPU==="; cat /proc/stat 2>/dev/null | grep "^cpu ";
  echo "===MEM==="; cat /proc/meminfo 2>/dev/null | grep -E "^(MemTotal|MemFree|MemAvailable|Buffers|Cached):";
  echo "===DISK==="; df -Pk / 2>/dev/null | tail -1;
  echo "===NET==="; cat /proc/net/dev 2>/dev/null;
  echo "===CORES==="; grep -c ^processor /proc/cpuinfo 2>/dev/null || nproc 2>/dev/null;
  echo "===LOAD==="; cat /proc/loadavg 2>/dev/null;
  echo "===UPTIME==="; cat /proc/uptime 2>/dev/null;
else
  echo "===OS==="; uname -s;
  echo "===CORES==="; sysctl -n hw.ncpu 2>/dev/null;
  echo "===LOAD==="; sysctl -n vm.loadavg 2>/dev/null || uptime 2>/dev/null;
  echo "===DISK==="; df -Pk / 2>/dev/null | tail -1;
  echo "===MEM_DARWIN==="; sysctl -n hw.memsize 2>/dev/null; vm_stat 2>/dev/null;
  echo "===UPTIME_DARWIN==="; sysctl -n kern.boottime 2>/dev/null;
fi"#;

impl OverviewService {
    pub fn new(connection: Arc<ConnectionManager>) -> Self {
        Self {
            connection,
            prev_samples: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_overview(&self, server_id: &str) -> Result<ServerOverview> {
        let output = self.connection.exec_command(server_id, PROBE_SCRIPT).await?;
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let parsed = self.parse_probe_output(&output, server_id, now_ms).await;
        Ok(parsed)
    }

    pub async fn clear_cache(&self, server_id: &str) {
        let mut samples = self.prev_samples.write().await;
        samples.remove(server_id);
    }

    async fn parse_probe_output(&self, raw: &str, server_id: &str, now_ms: u64) -> ServerOverview {
        let mut sections: HashMap<&str, Vec<&str>> = HashMap::new();
        let mut current_section = "";

        for line in raw.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("===") && trimmed.ends_with("===") {
                current_section = trimmed.trim_matches('=');
                continue;
            }
            if !current_section.is_empty() {
                sections.entry(current_section).or_default().push(trimmed);
            }
        }

        // 1. CPU Ticks & Cores
        let mut cpu_total = 0u64;
        let mut cpu_idle = 0u64;

        if let Some(cpu_lines) = sections.get("CPU") {
            for line in cpu_lines {
                if line.starts_with("cpu ") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 5 {
                        let user = parts.get(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let nice = parts.get(2).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let system = parts.get(3).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let idle = parts.get(4).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let iowait = parts.get(5).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let irq = parts.get(6).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let softirq = parts.get(7).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
                        let steal = parts.get(8).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);

                        cpu_idle = idle + iowait;
                        cpu_total = user + nice + system + idle + iowait + irq + softirq + steal;
                    }
                    break;
                }
            }
        }

        // 2. Cores count
        let mut cpu_cores = 1u32;
        if let Some(cores_lines) = sections.get("CORES") {
            if let Some(first) = cores_lines.first() {
                if let Ok(c) = first.parse::<u32>() {
                    if c > 0 {
                        cpu_cores = c;
                    }
                }
            }
        }

        // 3. Load average
        let mut load_avg = [0.0f32; 3];
        if let Some(load_lines) = sections.get("LOAD") {
            if let Some(first) = load_lines.first() {
                let clean = first.replace(['{', '}', ','], " ");
                let parts: Vec<&str> = clean.split_whitespace().collect();
                if parts.len() >= 3 {
                    load_avg[0] = parts[0].parse::<f32>().unwrap_or(0.0);
                    load_avg[1] = parts[1].parse::<f32>().unwrap_or(0.0);
                    load_avg[2] = parts[2].parse::<f32>().unwrap_or(0.0);
                }
            }
        }

        // 4. Memory info
        let mut mem_total = 0u64;
        let mut mem_available = None;
        let mut mem_free = 0u64;
        let mut buffers = 0u64;
        let mut cached = 0u64;

        if let Some(mem_lines) = sections.get("MEM") {
            for line in mem_lines {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() == 2 {
                    let key = parts[0].trim();
                    let val_str = parts[1].trim().split_whitespace().next().unwrap_or("0");
                    let val_kb = val_str.parse::<u64>().unwrap_or(0);
                    match key {
                        "MemTotal" => mem_total = val_kb * 1024,
                        "MemAvailable" => mem_available = Some(val_kb * 1024),
                        "MemFree" => mem_free = val_kb * 1024,
                        "Buffers" => buffers = val_kb * 1024,
                        "Cached" => cached = val_kb * 1024,
                        _ => {}
                    }
                }
            }
        } else if let Some(darwin_lines) = sections.get("MEM_DARWIN") {
            // Darwin fallback
            if let Some(first) = darwin_lines.first() {
                if let Ok(b) = first.parse::<u64>() {
                    mem_total = b;
                }
            }
            let mut free_pages = 0u64;
            for line in darwin_lines {
                if line.contains("Pages free:") {
                    let num_str = line.replace([':', '.'], " ");
                    if let Some(last) = num_str.split_whitespace().last() {
                        free_pages = last.parse::<u64>().unwrap_or(0);
                    }
                }
            }
            let free_bytes = free_pages * 4096;
            mem_available = Some(free_bytes);
        }

        let mem_used = if let Some(avail) = mem_available {
            mem_total.saturating_sub(avail)
        } else {
            mem_total.saturating_sub(mem_free + buffers + cached)
        };

        let mem_usage = if mem_total > 0 {
            ((mem_used as f32 / mem_total as f32) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };

        // 5. Disk info (df -Pk /)
        let mut disk_total = 0u64;
        let mut disk_used = 0u64;
        let mut disk_usage = 0.0f32;
        let mut disk_mount = "/".to_string();

        if let Some(disk_lines) = sections.get("DISK") {
            if let Some(last_line) = disk_lines.last() {
                let parts: Vec<&str> = last_line.split_whitespace().collect();
                if parts.len() >= 6 {
                    let total_kb = parts[1].parse::<u64>().unwrap_or(0);
                    let used_kb = parts[2].parse::<u64>().unwrap_or(0);
                    let pct_str = parts[4].trim_end_matches('%');
                    let pct = pct_str.parse::<f32>().unwrap_or(0.0);

                    disk_total = total_kb * 1024;
                    disk_used = used_kb * 1024;
                    disk_usage = pct;
                    disk_mount = parts[5].to_string();
                }
            }
        }

        // 6. Network (rx/tx bytes sum across non-lo interfaces)
        let mut total_rx = 0u64;
        let mut total_tx = 0u64;

        if let Some(net_lines) = sections.get("NET") {
            for line in net_lines {
                if let Some(idx) = line.find(':') {
                    let iface = line[..idx].trim();
                    if iface == "lo" || iface.is_empty() {
                        continue;
                    }
                    let rest = &line[idx + 1..];
                    let parts: Vec<&str> = rest.split_whitespace().collect();
                    if parts.len() >= 9 {
                        let rx = parts[0].parse::<u64>().unwrap_or(0);
                        let tx = parts[8].parse::<u64>().unwrap_or(0);
                        total_rx += rx;
                        total_tx += tx;
                    }
                }
            }
        }

        // 7. Uptime seconds
        let mut uptime_seconds = 0u64;
        if let Some(uptime_lines) = sections.get("UPTIME") {
            if let Some(first) = uptime_lines.first() {
                if let Some(sec_str) = first.split_whitespace().next() {
                    uptime_seconds = sec_str.parse::<f64>().map(|v| v as u64).unwrap_or(0);
                }
            }
        } else if let Some(darwin_up) = sections.get("UPTIME_DARWIN") {
            if let Some(first) = darwin_up.first() {
                if let Some(idx) = first.find("sec = ") {
                    let rest = &first[idx + 6..];
                    if let Some(end) = rest.find(',') {
                        let sec = rest[..end].trim().parse::<u64>().unwrap_or(0);
                        let now_sec = now_ms / 1000;
                        uptime_seconds = now_sec.saturating_sub(sec);
                    }
                }
            }
        }

        // 8. Delta calculations using cached previous sample
        let (cpu_usage, net_rx_speed, net_tx_speed) = {
            let mut samples = self.prev_samples.write().await;
            if let Some(prev) = samples.get(server_id) {
                let delta_time_ms = now_ms.saturating_sub(prev.timestamp_ms);
                let delta_time_sec = (delta_time_ms as f64) / 1000.0;

                // CPU diff
                let delta_total = cpu_total.saturating_sub(prev.cpu_total);
                let delta_idle = cpu_idle.saturating_sub(prev.cpu_idle);

                let cpu = if delta_total > 0 && delta_total >= delta_idle {
                    let delta_active = delta_total - delta_idle;
                    ((delta_active as f32) / (delta_total as f32) * 100.0).clamp(0.0, 100.0)
                } else if delta_total > 0 {
                    0.0
                } else {
                    // Fallback to load average percentage
                    ((load_avg[0] / (cpu_cores as f32)) * 100.0).clamp(0.0, 100.0)
                };

                // Network rate (Bytes/sec)
                let (rx_spd, tx_spd) = if delta_time_sec >= 0.2 {
                    let rx_diff = total_rx.saturating_sub(prev.net_rx_bytes);
                    let tx_diff = total_tx.saturating_sub(prev.net_tx_bytes);
                    (
                        (rx_diff as f64 / delta_time_sec) as u64,
                        (tx_diff as f64 / delta_time_sec) as u64,
                    )
                } else {
                    (0, 0)
                };

                // Update sample
                samples.insert(
                    server_id.to_string(),
                    PrevSample {
                        cpu_total,
                        cpu_idle,
                        net_rx_bytes: total_rx,
                        net_tx_bytes: total_tx,
                        timestamp_ms: now_ms,
                    },
                );

                (cpu, rx_spd, tx_spd)
            } else {
                // Initial sample: record baseline
                samples.insert(
                    server_id.to_string(),
                    PrevSample {
                        cpu_total,
                        cpu_idle,
                        net_rx_bytes: total_rx,
                        net_tx_bytes: total_tx,
                        timestamp_ms: now_ms,
                    },
                );

                // Initial estimation based on load average
                let initial_cpu = ((load_avg[0] / (cpu_cores as f32)) * 100.0).clamp(0.0, 100.0);
                (initial_cpu, 0, 0)
            }
        };

        ServerOverview {
            cpu_usage,
            cpu_cores,
            load_avg,
            mem_total,
            mem_used,
            mem_usage,
            disk_total,
            disk_used,
            disk_usage,
            disk_mount,
            net_rx_speed,
            net_tx_speed,
            uptime_seconds,
            timestamp: now_ms,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_parse_linux_probe_and_delta() {
        let conn = Arc::new(ConnectionManager::new());
        let service = OverviewService::new(conn);

        let sample1 = r#"===OS===
Linux
===CPU===
cpu  1000 0 1000 8000 0 0 0 0 0 0
===MEM===
MemTotal:       16000000 kB
MemAvailable:    8000000 kB
MemFree:         4000000 kB
Buffers:         2000000 kB
Cached:          2000000 kB
===DISK===
/dev/sda1        100000000 40000000  60000000      40% /
===NET===
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000000000  100000    0    0    0     0          0         0 1000000000  100000    0    0    0     0       0          0
  eth0: 1000000000  500000    0    0    0     0          0         0 2000000000  400000    0    0    0     0       0          0
===CORES===
8
===LOAD===
0.50 0.40 0.30 1/500 12345
===UPTIME===
3600.50 28000.00"#;

        let res1 = service.parse_probe_output(sample1, "srv-1", 10000).await;
        assert_eq!(res1.cpu_cores, 8);
        assert_eq!(res1.load_avg[0], 0.50);
        assert_eq!(res1.disk_usage, 40.0);
        assert_eq!(res1.disk_mount, "/");
        assert_eq!(res1.uptime_seconds, 3600);
        assert_eq!(res1.mem_usage, 50.0); // 8000000 avail out of 16000000

        // Sample 2 after 5 seconds:
        // CPU: active +1000, idle +1000 -> 50% CPU
        // Net: rx +500_000, tx +250_000 -> 100_000 B/s rx, 50_000 B/s tx
        let sample2 = r#"===OS===
Linux
===CPU===
cpu  1500 0 1500 9000 0 0 0 0 0 0
===MEM===
MemTotal:       16000000 kB
MemAvailable:    8000000 kB
===DISK===
/dev/sda1        100000000 40000000  60000000      40% /
===NET===
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
  eth0: 1000500000  501000    0    0    0     0          0         0 2000250000  400500    0    0    0     0       0          0
===CORES===
8
===LOAD===
0.60 0.45 0.35 1/500 12346
===UPTIME===
3605.50 28005.00"#;

        let res2 = service.parse_probe_output(sample2, "srv-1", 15000).await;
        assert!((res2.cpu_usage - 50.0).abs() < 0.1);
        assert_eq!(res2.net_rx_speed, 100_000);
        assert_eq!(res2.net_tx_speed, 50_000);
        assert_eq!(res2.uptime_seconds, 3605);
    }
}

