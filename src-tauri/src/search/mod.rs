use base64::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use crate::connection::ConnectionManager;
use crate::core::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchLineMatch {
    pub line_number: usize,
    pub column_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchFileMatch {
    pub path: String,
    pub relative_path: String,
    pub matches: Vec<SearchLineMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchResult {
    pub query: String,
    pub total_matches: usize,
    pub total_files: usize,
    pub files: Vec<SearchFileMatch>,
    pub truncated: bool,
    pub duration_ms: u64,
    pub engine_used: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SearchParams {
    pub server_id: String,
    pub root_path: String,
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub is_regex: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub max_results: Option<usize>,
}

pub struct SearchService;

impl SearchService {
    /// Constructs a safe, self-contained shell command string that tries:
    /// 1. ripgrep (`rg`) -> fastest, multithreaded, respects .gitignore
    /// 2. `git grep`     -> zero-install on Git repos, respects .gitignore
    /// 3. standard `grep`-> 100% universal fallback
    pub fn build_search_script(params: &SearchParams) -> String {
        let safe_root = params.root_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
        let query_b64 = BASE64_STANDARD.encode(params.query.as_bytes());
        let limit = params.max_results.unwrap_or(1000);
        let limit_plus_one = limit + 1;

        // Flags for rg
        let mut rg_flags = String::new();
        if params.case_sensitive {
            rg_flags.push_str("-s ");
        } else {
            rg_flags.push_str("-i ");
        }
        if params.whole_word {
            rg_flags.push_str("-w ");
        }
        if !params.is_regex {
            rg_flags.push_str("-F ");
        }

        // Flags for git grep
        let mut git_flags = String::new();
        if !params.case_sensitive {
            git_flags.push_str("-i ");
        }
        if params.whole_word {
            git_flags.push_str("-w ");
        }
        if !params.is_regex {
            git_flags.push_str("-F ");
        } else {
            git_flags.push_str("-E ");
        }

        // Flags for grep
        let mut grep_flags = String::new();
        if !params.case_sensitive {
            grep_flags.push_str("-i ");
        }
        if params.whole_word {
            grep_flags.push_str("-w ");
        }
        if !params.is_regex {
            grep_flags.push_str("-F ");
        } else {
            grep_flags.push_str("-E ");
        }

        // Include globs
        let mut rg_includes = String::new();
        let mut git_includes = String::new();
        let mut grep_includes = String::new();
        if let Some(ref inc) = params.include_pattern {
            for raw_pat in inc.split([',', ';']) {
                let pat = raw_pat.trim().replace(['\'', '"', ';', '&', '|', '`', '$'], "");
                if !pat.is_empty() {
                    rg_includes.push_str(&format!("-g '{}' ", pat));
                    git_includes.push_str(&format!("'{}' ", pat));
                    grep_includes.push_str(&format!("--include='{}' ", pat));
                }
            }
        }

        // Exclude globs
        let mut rg_excludes = String::new();
        let mut git_excludes = String::new();
        let mut grep_excludes = String::new();
        if let Some(ref exc) = params.exclude_pattern {
            for raw_pat in exc.split([',', ';']) {
                let pat = raw_pat.trim().replace(['\'', '"', ';', '&', '|', '`', '$'], "");
                if !pat.is_empty() {
                    rg_excludes.push_str(&format!("-g '!{}' -g '!{}/**' ", pat, pat));
                    git_excludes.push_str(&format!("':(exclude){}' ", pat));
                    grep_excludes.push_str(&format!("--exclude='{}' --exclude-dir='{}' ", pat, pat));
                }
            }
        }

        // Default exclusions for plain grep
        let default_grep_excludes = "--exclude-dir={.git,node_modules,target,dist,build,.cache,.next,vendor}";

        format!(
            r#"cd "{root}" || exit 1
Q=$(printf "%s" "{b64}" | base64 -d)
if command -v rg >/dev/null 2>&1; then
    echo "===ENGINE:ripgrep==="
    rg --line-number --column --no-heading --color=never {rg_flags}{rg_includes}{rg_excludes}-- "$Q" . 2>/dev/null | head -n {limit_plus_one}
elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "===ENGINE:git-grep==="
    git grep -n -I {git_flags}"$Q" -- {git_includes}{git_excludes} 2>/dev/null | head -n {limit_plus_one}
else
    echo "===ENGINE:grep==="
    grep -rn -I {grep_flags}{default_grep_excludes} {grep_includes}{grep_excludes}-- "$Q" . 2>/dev/null | head -n {limit_plus_one}
fi"#,
            root = safe_root,
            b64 = query_b64,
            rg_flags = rg_flags,
            rg_includes = rg_includes,
            rg_excludes = rg_excludes,
            git_flags = git_flags,
            git_includes = git_includes,
            git_excludes = git_excludes,
            grep_flags = grep_flags,
            default_grep_excludes = default_grep_excludes,
            grep_includes = grep_includes,
            grep_excludes = grep_excludes,
            limit_plus_one = limit_plus_one
        )
    }

    pub fn parse_search_output(
        raw_output: &str,
        query: &str,
        case_sensitive: bool,
        root_path: &str,
        limit: usize,
    ) -> (Vec<SearchFileMatch>, usize, usize, bool, String) {
        let mut engine_used = "ripgrep".to_string();
        let mut file_map: HashMap<String, Vec<SearchLineMatch>> = HashMap::new();
        let mut file_order: Vec<String> = Vec::new();
        let mut total_matches = 0usize;
        let mut is_truncated = false;

        let normalized_query = if case_sensitive {
            query.to_string()
        } else {
            query.to_lowercase()
        };

        for line in raw_output.lines() {
            let trimmed = line.trim_end();
            if trimmed.is_empty() {
                continue;
            }
            if trimmed.starts_with("===ENGINE:") && trimmed.ends_with("===") {
                engine_used = trimmed
                    .trim_start_matches("===ENGINE:")
                    .trim_end_matches("===")
                    .to_string();
                continue;
            }

            if total_matches >= limit {
                is_truncated = true;
                break;
            }

            // Line format could be:
            // 1) <path>:<line>:<col>:<content> (from rg)
            // 2) <path>:<line>:<content>       (from git grep / grep)
            if let Some((path_str, line_num, col_num, content)) = Self::parse_line(trimmed) {
                let clean_rel_path = path_str
                    .strip_prefix("./")
                    .unwrap_or(path_str)
                    .to_string();

                let mut match_start = 0usize;
                let mut match_end = 0usize;

                if !query.is_empty() {
                    let search_target = if case_sensitive {
                        content.clone()
                    } else {
                        content.to_lowercase()
                    };

                    if let Some(idx) = search_target.find(&normalized_query) {
                        match_start = idx;
                        match_end = idx + query.len();
                    } else if col_num > 0 && col_num <= content.len() {
                        match_start = col_num - 1;
                        match_end = (match_start + query.len()).min(content.len());
                    }
                }

                let line_match = SearchLineMatch {
                    line_number: line_num,
                    column_number: col_num,
                    line_content: content,
                    match_start,
                    match_end,
                };

                if !file_map.contains_key(&clean_rel_path) {
                    file_order.push(clean_rel_path.clone());
                }
                file_map.entry(clean_rel_path).or_default().push(line_match);
                total_matches += 1;
            }
        }

        let normalized_root = root_path.trim_end_matches('/');
        let files: Vec<SearchFileMatch> = file_order
            .into_iter()
            .map(|rel| {
                let abs_path = if rel.starts_with('/') {
                    rel.clone()
                } else {
                    format!("{}/{}", normalized_root, rel)
                };
                let matches = file_map.remove(&rel).unwrap_or_default();
                SearchFileMatch {
                    path: abs_path,
                    relative_path: rel,
                    matches,
                }
            })
            .collect();

        let total_files = files.len();
        (files, total_matches, total_files, is_truncated, engine_used)
    }

    fn parse_line(line: &str) -> Option<(&str, usize, usize, String)> {
        // Find the first ':'
        let colon1 = line.find(':')?;
        let path = &line[..colon1];

        // Find the second ':'
        let rest1 = &line[colon1 + 1..];
        let colon2 = rest1.find(':')?;
        let line_num_str = &rest1[..colon2];
        let line_num = line_num_str.parse::<usize>().ok()?;

        let rest2 = &rest1[colon2 + 1..];
        // Check if rest2 has a column number (e.g. from rg: "15:content")
        if let Some(colon3) = rest2.find(':') {
            let possible_col_str = &rest2[..colon3];
            if let Ok(col_num) = possible_col_str.parse::<usize>() {
                let content = rest2[colon3 + 1..].to_string();
                return Some((path, line_num, col_num, content));
            }
        }

        // Otherwise (git grep / grep), column is 1 and content is all of rest2
        Some((path, line_num, 1, rest2.to_string()))
    }

    pub async fn search_in_files(
        connection: &ConnectionManager,
        params: SearchParams,
    ) -> Result<SearchResult> {
        let trimmed_query = params.query.trim();
        if trimmed_query.is_empty() {
            return Ok(SearchResult {
                query: params.query,
                total_matches: 0,
                total_files: 0,
                files: Vec::new(),
                truncated: false,
                duration_ms: 0,
                engine_used: "none".to_string(),
            });
        }

        let start_time = Instant::now();
        let script = Self::build_search_script(&params);
        let limit = params.max_results.unwrap_or(1000);

        let output = connection
            .exec_command(&params.server_id, &script)
            .await
            .map_err(|e| AppError::Internal(format!("Search command failed: {}", e)))?;

        let duration_ms = start_time.elapsed().as_millis() as u64;

        let (files, total_matches, total_files, truncated, engine_used) =
            Self::parse_search_output(
                &output,
                trimmed_query,
                params.case_sensitive,
                &params.root_path,
                limit,
            );

        Ok(SearchResult {
            query: params.query,
            total_matches,
            total_files,
            files,
            truncated,
            duration_ms,
            engine_used,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rg_output_format() {
        let raw = r#"===ENGINE:ripgrep===
./src/App.tsx:52:11:  const { openFile } = useEditorStore();
./src/stores/editorStore.ts:71:3:  openFile: async (serverId: string) => {
"#;
        let (files, total_matches, total_files, truncated, engine) =
            SearchService::parse_search_output(raw, "openFile", false, "/home/remora", 100);

        assert_eq!(engine, "ripgrep");
        assert_eq!(total_files, 2);
        assert_eq!(total_matches, 2);
        assert!(!truncated);
        assert_eq!(files[0].relative_path, "src/App.tsx");
        assert_eq!(files[0].path, "/home/remora/src/App.tsx");
        assert_eq!(files[0].matches[0].line_number, 52);
        assert_eq!(files[0].matches[0].column_number, 11);
        assert_eq!(files[0].matches[0].match_start, 10);
        assert_eq!(files[0].matches[0].match_end, 18);
    }

    #[test]
    fn test_parse_git_grep_and_grep_output_format() {
        let raw = r#"===ENGINE:git-grep===
src/App.tsx:52:  const { openFile } = useEditorStore();
src/components/Editor.tsx:120:    openFile(id, path);
"#;
        let (files, total_matches, total_files, truncated, engine) =
            SearchService::parse_search_output(raw, "openFile", false, "/var/www/app", 100);

        assert_eq!(engine, "git-grep");
        assert_eq!(total_files, 2);
        assert_eq!(total_matches, 2);
        assert!(!truncated);
        assert_eq!(files[0].relative_path, "src/App.tsx");
        assert_eq!(files[0].path, "/var/www/app/src/App.tsx");
        assert_eq!(files[0].matches[0].line_number, 52);
        assert_eq!(files[0].matches[0].column_number, 1);
        assert_eq!(files[0].matches[0].match_start, 10);
        assert_eq!(files[0].matches[0].match_end, 18);
    }

    #[test]
    fn test_search_output_truncation() {
        let raw = r#"===ENGINE:grep===
./a.txt:1:foo
./b.txt:2:foo
./c.txt:3:foo
"#;
        let (files, total_matches, total_files, truncated, _) =
            SearchService::parse_search_output(raw, "foo", false, "/root", 2);

        assert_eq!(total_matches, 2);
        assert_eq!(total_files, 2);
        assert!(truncated);
        assert_eq!(files.len(), 2);
    }
}
