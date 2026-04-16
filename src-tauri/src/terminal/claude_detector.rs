use regex::Regex;
use std::sync::LazyLock;
use std::time::Instant;

const DEBOUNCE_MS: u128 = 100;
const BUFFER_MAX_LINES: usize = 20;

#[derive(Clone, PartialEq, Debug)]
pub enum ClaudeState {
    Inactive,
    Idle,
    Thinking,
    Generating,
    ToolUse,
    Error,
}

impl ClaudeState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ClaudeState::Inactive => "inactive",
            ClaudeState::Idle => "idle",
            ClaudeState::Thinking => "thinking",
            ClaudeState::Generating => "generating",
            ClaudeState::ToolUse => "tool_use",
            ClaudeState::Error => "error",
        }
    }
}

static ANSI_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(\x07|\x1b\\)").unwrap()
});

static CLAUDE_LAUNCH_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^\s*[$>]\s+claude\b").unwrap()
});

static BARE_PROMPT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^\s*[$>]\s*$").unwrap()
});

static ERROR_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)error").unwrap(),
        Regex::new(r"(?i)failed").unwrap(),
        Regex::new(r"(?i)exception").unwrap(),
    ]
});

static TOOL_USE_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)\btool\b").unwrap(),
        Regex::new(r"(?i)\bread\b.*file").unwrap(),
        Regex::new(r"(?i)\bwrite\b.*file").unwrap(),
        Regex::new(r"(?i)\bedit\b").unwrap(),
        Regex::new(r"(?i)\bbash\b").unwrap(),
        Regex::new(r"(?i)\bgrep\b").unwrap(),
        Regex::new(r"(?i)\bglob\b").unwrap(),
    ]
});

static THINKING_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)thinking").unwrap(),
        Regex::new(r"\.\.\.\s*$").unwrap(),
    ]
});

static GENERATING_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)generating").unwrap(),
        Regex::new(r"(?i)writing").unwrap(),
    ]
});

pub struct ClaudeDetector {
    state: ClaudeState,
    is_claude_active: bool,
    line_buffer: Vec<String>,
    pending_state: Option<ClaudeState>,
    last_change: Instant,
}

impl ClaudeDetector {
    pub fn new() -> Self {
        Self {
            state: ClaudeState::Inactive,
            is_claude_active: false,
            line_buffer: Vec::new(),
            pending_state: None,
            last_change: Instant::now(),
        }
    }

    /// Process PTY output chunk. Returns Some(new_state) when state changed after debounce.
    pub fn process_output(&mut self, data: &str) -> Option<ClaudeState> {
        let clean = strip_ansi(data);

        for line in clean.split('\n') {
            if !line.is_empty() {
                self.line_buffer.push(line.to_string());
            }
        }
        if self.line_buffer.len() > BUFFER_MAX_LINES {
            let excess = self.line_buffer.len() - BUFFER_MAX_LINES;
            self.line_buffer.drain(..excess);
        }

        let buffered = self.line_buffer.join("\n");

        if !self.is_claude_active {
            if CLAUDE_LAUNCH_RE.is_match(&buffered) {
                self.is_claude_active = true;
                return self.set_state(ClaudeState::Idle);
            }
            return None;
        }

        if BARE_PROMPT_RE.is_match(&clean) {
            self.is_claude_active = false;
            return self.set_state(ClaudeState::Inactive);
        }

        let start = self.line_buffer.len().saturating_sub(5);
        let recent_text = self.line_buffer[start..].join("\n");
        let new_state = detect_state(&recent_text);

        if new_state != self.state {
            return self.set_state(new_state);
        }

        // Check if pending state should be emitted (debounce elapsed)
        self.try_flush_pending()
    }

    pub fn get_state(&self) -> &ClaudeState {
        &self.state
    }

    fn set_state(&mut self, new_state: ClaudeState) -> Option<ClaudeState> {
        self.pending_state = Some(new_state);
        self.last_change = Instant::now();
        self.try_flush_pending()
    }

    fn try_flush_pending(&mut self) -> Option<ClaudeState> {
        if let Some(ref pending) = self.pending_state {
            if self.last_change.elapsed().as_millis() >= DEBOUNCE_MS && *pending != self.state {
                let emitted = pending.clone();
                self.state = emitted.clone();
                self.pending_state = None;
                return Some(emitted);
            }
        }
        None
    }
}

fn detect_state(text: &str) -> ClaudeState {
    if ERROR_PATTERNS.iter().any(|p| p.is_match(text)) {
        return ClaudeState::Error;
    }
    if TOOL_USE_PATTERNS.iter().any(|p| p.is_match(text)) {
        return ClaudeState::ToolUse;
    }
    if THINKING_PATTERNS.iter().any(|p| p.is_match(text)) {
        return ClaudeState::Thinking;
    }
    if GENERATING_PATTERNS.iter().any(|p| p.is_match(text)) {
        return ClaudeState::Generating;
    }
    ClaudeState::Idle
}

fn strip_ansi(s: &str) -> String {
    ANSI_RE.replace_all(s, "").to_string()
}
