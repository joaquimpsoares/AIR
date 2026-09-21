use crate::{AirError, Phase};

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Token {
    pub(crate) kind: TokenKind,
    pub(crate) offset: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum TokenKind {
    Ident(String),
    Number(f64),
    String(String),
    LBrace,
    RBrace,
    LParen,
    RParen,
    Colon,
    Semicolon,
    Equal,
    EqualEqual,
    Bang,
    BangEqual,
    Plus,
    Minus,
    Star,
    Slash,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    AndAnd,
    OrOr,
    Eof,
}

pub(crate) fn lex(source: &str) -> Result<Vec<Token>, AirError> {
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut cursor = 0;
    while cursor < bytes.len() {
        let start = cursor;
        match bytes[cursor] {
            b' ' | b'\t' | b'\r' | b'\n' => cursor += 1,
            b'#' => {
                while cursor < bytes.len() && bytes[cursor] != b'\n' {
                    cursor += 1;
                }
            }
            b'/' if bytes.get(cursor + 1) == Some(&b'/') => {
                while cursor < bytes.len() && bytes[cursor] != b'\n' {
                    cursor += 1;
                }
            }
            b'{' => single(&mut tokens, &mut cursor, TokenKind::LBrace),
            b'}' => single(&mut tokens, &mut cursor, TokenKind::RBrace),
            b'(' => single(&mut tokens, &mut cursor, TokenKind::LParen),
            b')' => single(&mut tokens, &mut cursor, TokenKind::RParen),
            b':' => single(&mut tokens, &mut cursor, TokenKind::Colon),
            b';' => single(&mut tokens, &mut cursor, TokenKind::Semicolon),
            b'+' => single(&mut tokens, &mut cursor, TokenKind::Plus),
            b'-' => single(&mut tokens, &mut cursor, TokenKind::Minus),
            b'*' => single(&mut tokens, &mut cursor, TokenKind::Star),
            b'/' => single(&mut tokens, &mut cursor, TokenKind::Slash),
            b'=' => pair(
                bytes,
                &mut tokens,
                &mut cursor,
                b'=',
                TokenKind::EqualEqual,
                TokenKind::Equal,
            ),
            b'!' => pair(
                bytes,
                &mut tokens,
                &mut cursor,
                b'=',
                TokenKind::BangEqual,
                TokenKind::Bang,
            ),
            b'<' => pair(
                bytes,
                &mut tokens,
                &mut cursor,
                b'=',
                TokenKind::LessEqual,
                TokenKind::Less,
            ),
            b'>' => pair(
                bytes,
                &mut tokens,
                &mut cursor,
                b'=',
                TokenKind::GreaterEqual,
                TokenKind::Greater,
            ),
            b'&' if bytes.get(cursor + 1) == Some(&b'&') => {
                cursor += 2;
                tokens.push(Token {
                    kind: TokenKind::AndAnd,
                    offset: start,
                });
            }
            b'|' if bytes.get(cursor + 1) == Some(&b'|') => {
                cursor += 2;
                tokens.push(Token {
                    kind: TokenKind::OrOr,
                    offset: start,
                });
            }
            b'"' => tokens.push(Token {
                kind: TokenKind::String(read_string(source, &mut cursor)?),
                offset: start,
            }),
            byte if is_ident_start(byte) => {
                cursor += 1;
                while cursor < bytes.len() && is_ident_continue(bytes[cursor]) {
                    cursor += 1;
                }
                tokens.push(Token {
                    kind: TokenKind::Ident(source[start..cursor].to_owned()),
                    offset: start,
                });
            }
            byte if byte.is_ascii_digit() => {
                cursor += 1;
                while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                    cursor += 1;
                }
                if bytes.get(cursor) == Some(&b'.') {
                    cursor += 1;
                    if !bytes.get(cursor).is_some_and(u8::is_ascii_digit) {
                        return Err(error("a decimal point must be followed by a digit", cursor));
                    }
                    while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                        cursor += 1;
                    }
                }
                let value = source[start..cursor]
                    .parse::<f64>()
                    .map_err(|_| error("invalid number", start))?;
                if !value.is_finite() {
                    return Err(error("numbers must be finite", start));
                }
                tokens.push(Token {
                    kind: TokenKind::Number(value),
                    offset: start,
                });
            }
            _ => {
                return Err(error(
                    format!(
                        "unexpected character {:?}",
                        source[start..].chars().next().unwrap()
                    ),
                    start,
                ))
            }
        }
    }
    tokens.push(Token {
        kind: TokenKind::Eof,
        offset: source.len(),
    });
    Ok(tokens)
}

fn single(tokens: &mut Vec<Token>, cursor: &mut usize, kind: TokenKind) {
    tokens.push(Token {
        kind,
        offset: *cursor,
    });
    *cursor += 1;
}

fn pair(
    bytes: &[u8],
    tokens: &mut Vec<Token>,
    cursor: &mut usize,
    second: u8,
    paired: TokenKind,
    single_kind: TokenKind,
) {
    let start = *cursor;
    *cursor += 1;
    let kind = if bytes.get(*cursor) == Some(&second) {
        *cursor += 1;
        paired
    } else {
        single_kind
    };
    tokens.push(Token {
        kind,
        offset: start,
    });
}

fn read_string(source: &str, cursor: &mut usize) -> Result<String, AirError> {
    let bytes = source.as_bytes();
    let start = *cursor;
    *cursor += 1;
    let mut value = String::new();
    while *cursor < bytes.len() {
        match bytes[*cursor] {
            b'"' => {
                *cursor += 1;
                return Ok(value);
            }
            b'\\' => {
                *cursor += 1;
                let escaped = match bytes.get(*cursor) {
                    Some(b'"') => '"',
                    Some(b'\\') => '\\',
                    Some(b'n') => '\n',
                    Some(b'r') => '\r',
                    Some(b't') => '\t',
                    Some(_) => return Err(error("unsupported string escape", *cursor)),
                    None => return Err(error("unterminated string escape", *cursor)),
                };
                value.push(escaped);
                *cursor += 1;
            }
            byte if byte < 0x20 => return Err(error("control character in string", *cursor)),
            _ => {
                let ch = source[*cursor..].chars().next().unwrap();
                value.push(ch);
                *cursor += ch.len_utf8();
            }
        }
    }
    Err(error("unterminated string", start))
}

fn is_ident_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'_'
}

fn is_ident_continue(byte: u8) -> bool {
    is_ident_start(byte) || byte.is_ascii_digit()
}

fn error(message: impl Into<String>, offset: usize) -> AirError {
    AirError::new(Phase::Lex, message, Some(offset))
}
