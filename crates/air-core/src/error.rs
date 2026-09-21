use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Lex,
    Parse,
    Validate,
    Decode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AirError {
    pub phase: Phase,
    pub message: String,
    pub offset: Option<usize>,
}

impl AirError {
    pub(crate) fn new(phase: Phase, message: impl Into<String>, offset: Option<usize>) -> Self {
        Self {
            phase,
            message: message.into(),
            offset,
        }
    }
}

impl fmt::Display for AirError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let phase = match self.phase {
            Phase::Lex => "lex error",
            Phase::Parse => "parse error",
            Phase::Validate => "validation error",
            Phase::Decode => "decode error",
        };
        if let Some(offset) = self.offset {
            write!(f, "{phase} at byte {offset}: {}", self.message)
        } else {
            write!(f, "{phase}: {}", self.message)
        }
    }
}

impl std::error::Error for AirError {}
