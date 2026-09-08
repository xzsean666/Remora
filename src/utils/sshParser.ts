/**
 * SSH Command Parser Utility
 * Parses standard and complex SSH command lines into structured connection configs.
 * 
 * Supports:
 * - ssh -i ~/ssh/sean -p 22 root@192.168.31.110
 * - ssh -p 2222 user@host
 * - ssh -i "/path with space/id_ed25519" -l admin 192.168.1.50
 * - ssh -o Port=2202 -o IdentityFile=~/.ssh/id_rsa user@host
 * - ssh user@host:2222
 * - ssh host (defaults to root:22)
 * - Commands without leading 'ssh'
 */

export interface ParsedSshConfig {
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  authType: "password" | "private_key" | "agent";
  name: string;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedSshConfig;
  error?: string;
}

/**
 * Tokenizes a command line string respecting single and double quotes and escaped spaces.
 */
export function tokenizeCommandLine(cmd: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes: '"' | "'" | null = null;
  let escape = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (inQuotes) {
      if (char === inQuotes) {
        inQuotes = null;
      } else {
        current += char;
      }
    } else {
      if (char === '"' || char === "'") {
        inQuotes = char;
      } else if (/\s/.test(char)) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parses an SSH command line into ServerConfig form fields.
 */
export function parseSshCommand(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: "Please enter an SSH command" };
  }

  const tokens = tokenizeCommandLine(trimmed);
  if (tokens.length === 0) {
    return { success: false, error: "No valid arguments found in command" };
  }

  let i = 0;
  // If first token is ssh or ssh.exe, skip it
  if (tokens[i].toLowerCase() === "ssh" || tokens[i].toLowerCase() === "ssh.exe") {
    i++;
  }

  let port: number | undefined;
  let keyPath: string | undefined;
  let username: string | undefined;
  let host: string | undefined;

  // Recognized flags taking an argument
  const singleArgOptions = new Set([
    "-b", "-c", "-d", "-e", "-f", "-i", "-j", "-k", "-l",
    "-m", "-o", "-p", "-q", "-r", "-s", "-w", "-B", "-D",
    "-E", "-F", "-I", "-J", "-L", "-M", "-O", "-P", "-R", "-S", "-W"
  ]);

  while (i < tokens.length) {
    const token = tokens[i];

    // Port option: -p 22 or -P 22
    if (token === "-p" || token === "-P") {
      i++;
      if (i < tokens.length) {
        const parsed = parseInt(tokens[i], 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
          port = parsed;
        }
      }
    } else if ((token.startsWith("-p") || token.startsWith("-P")) && token.length > 2) {
      const parsed = parseInt(token.slice(2), 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
        port = parsed;
      }
    }
    // Identity file / Key path: -i key_path
    else if (token === "-i") {
      i++;
      if (i < tokens.length) {
        keyPath = tokens[i];
      }
    } else if (token.startsWith("-i") && token.length > 2) {
      keyPath = token.slice(2);
    }
    // Login username: -l username
    else if (token === "-l") {
      i++;
      if (i < tokens.length) {
        username = tokens[i];
      }
    } else if (token.startsWith("-l") && token.length > 2) {
      username = token.slice(2);
    }
    // OpenSSH -o config options: -o Port=2222, -o IdentityFile=~/.ssh/id_rsa, -o User=root
    else if (token === "-o" || token === "-O") {
      i++;
      if (i < tokens.length) {
        const opt = tokens[i];
        const eqIdx = opt.indexOf("=");
        if (eqIdx !== -1) {
          const optKey = opt.slice(0, eqIdx).trim().toLowerCase();
          const optVal = opt.slice(eqIdx + 1).trim();
          if (optKey === "port") {
            const parsed = parseInt(optVal, 10);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
              port = parsed;
            }
          } else if (optKey === "identityfile") {
            keyPath = optVal;
          } else if (optKey === "user") {
            username = optVal;
          }
        }
      }
    }
    // Other flags taking arguments: skip their value token
    else if (singleArgOptions.has(token)) {
      i++; // skip next argument
    }
    // Non-option positional argument (target: [user@]host[:port])
    else if (!token.startsWith("-")) {
      if (!host) {
        let target = token;

        // Check for user@
        const atIdx = target.indexOf("@");
        if (atIdx !== -1) {
          username = target.slice(0, atIdx);
          target = target.slice(atIdx + 1);
        }

        // Check for host:port (including IPv6 [::1]:22 format)
        if (target.startsWith("[") && target.includes("]:")) {
          const closeBracket = target.indexOf("]:");
          host = target.slice(1, closeBracket);
          const parsedPort = parseInt(target.slice(closeBracket + 2), 10);
          if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535 && !port) {
            port = parsedPort;
          }
        } else if (target.includes(":") && target.split(":").length === 2) {
          const colonIdx = target.indexOf(":");
          host = target.slice(0, colonIdx);
          const parsedPort = parseInt(target.slice(colonIdx + 1), 10);
          if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535 && !port) {
            port = parsedPort;
          }
        } else {
          host = target;
        }
      }
    }

    i++;
  }

  if (!host) {
    return {
      success: false,
      error: "Could not identify host/IP. Please check the SSH command syntax.",
    };
  }

  const finalUsername = username || "root";
  const finalPort = port || 22;
  const authType: "password" | "private_key" = keyPath ? "private_key" : "password";
  const name = `${finalUsername}@${host}${finalPort !== 22 ? `:${finalPort}` : ""}`;

  return {
    success: true,
    data: {
      host,
      port: finalPort,
      username: finalUsername,
      keyPath: keyPath || "",
      authType,
      name,
    },
  };
}
