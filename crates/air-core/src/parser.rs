use crate::lexer::{lex, Token, TokenKind};
use crate::model::{BinaryOp, UnaryOp, Value, ValueType};
use crate::{AirError, Phase};

#[derive(Debug)]
pub(crate) struct SourceProgram {
    pub(crate) name: String,
    pub(crate) states: Vec<SourceState>,
    pub(crate) start: Option<String>,
    pub(crate) screens: Vec<SourceScreen>,
}

#[derive(Debug)]
pub(crate) struct SourceState {
    pub(crate) name: String,
    pub(crate) value_type: ValueType,
    pub(crate) initial: Value,
}

#[derive(Debug)]
pub(crate) struct SourceScreen {
    pub(crate) name: String,
    pub(crate) body: Vec<SourceNode>,
}

#[derive(Debug)]
pub(crate) enum SourceNode {
    Text(String),
    Button {
        label: String,
        actions: Vec<SourceAction>,
    },
    Input {
        label: String,
        state: String,
        actions: Vec<SourceAction>,
    },
    Row(Vec<SourceNode>),
    Column(Vec<SourceNode>),
    If {
        condition: SourceExpr,
        then_branch: Vec<SourceNode>,
        else_branch: Vec<SourceNode>,
    },
}

#[derive(Debug)]
pub(crate) enum SourceAction {
    Set(String, SourceExpr),
    Navigate(String),
}

#[derive(Debug)]
pub(crate) enum SourceExpr {
    Value(Value),
    Name(String),
    Event,
    Unary(UnaryOp, Box<SourceExpr>),
    Binary(Box<SourceExpr>, BinaryOp, Box<SourceExpr>),
}

pub(crate) fn parse(source: &str) -> Result<SourceProgram, AirError> {
    Parser::new(lex(source)?).program()
}

struct Parser {
    tokens: Vec<Token>,
    cursor: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, cursor: 0 }
    }

    fn program(mut self) -> Result<SourceProgram, AirError> {
        self.keyword("app")?;
        let name = self.ident("app name")?;
        self.take(TokenKind::LBrace, "`{` after app name")?;
        let mut states = Vec::new();
        let mut start = None;
        let mut screens = Vec::new();
        while !self.at(&TokenKind::RBrace) {
            if self.at_keyword("state") {
                states.push(self.state()?);
            } else if self.at_keyword("start") {
                self.advance();
                if start.is_some() {
                    return Err(self.error("only one start declaration is allowed"));
                }
                start = Some(self.ident("start screen name")?);
                self.take(TokenKind::Semicolon, "`;` after start screen")?;
            } else if self.at_keyword("screen") {
                screens.push(self.screen()?);
            } else {
                return Err(self.error("expected `state`, `start`, or `screen`"));
            }
        }
        self.advance();
        self.take(TokenKind::Eof, "end of input")?;
        Ok(SourceProgram {
            name,
            states,
            start,
            screens,
        })
    }

    fn state(&mut self) -> Result<SourceState, AirError> {
        self.keyword("state")?;
        let name = self.ident("state name")?;
        self.take(TokenKind::Colon, "`:` after state name")?;
        let type_name = self.ident("state type")?;
        let value_type = match type_name.as_str() {
            "text" => ValueType::Text,
            "number" => ValueType::Number,
            "bool" => ValueType::Bool,
            _ => return Err(self.error(format!("unknown state type `{type_name}`"))),
        };
        self.take(TokenKind::Equal, "`=` after state type")?;
        let initial = self.literal()?;
        self.take(TokenKind::Semicolon, "`;` after state declaration")?;
        Ok(SourceState {
            name,
            value_type,
            initial,
        })
    }

    fn screen(&mut self) -> Result<SourceScreen, AirError> {
        self.keyword("screen")?;
        let name = self.ident("screen name")?;
        let body = self.node_block()?;
        Ok(SourceScreen { name, body })
    }

    fn node_block(&mut self) -> Result<Vec<SourceNode>, AirError> {
        self.take(TokenKind::LBrace, "`{` to start view block")?;
        let mut nodes = Vec::new();
        while !self.at(&TokenKind::RBrace) {
            nodes.push(self.node()?);
        }
        self.advance();
        Ok(nodes)
    }

    fn node(&mut self) -> Result<SourceNode, AirError> {
        if self.at_keyword("text") {
            self.advance();
            let text = self.string("text value")?;
            self.take(TokenKind::Semicolon, "`;` after text")?;
            Ok(SourceNode::Text(text))
        } else if self.at_keyword("button") {
            self.advance();
            let label = self.string("button label")?;
            let actions = self.action_block()?;
            Ok(SourceNode::Button { label, actions })
        } else if self.at_keyword("input") {
            self.advance();
            let label = self.string("input label")?;
            self.keyword("value")?;
            let state = self.ident("input state name")?;
            let actions = self.action_block()?;
            Ok(SourceNode::Input {
                label,
                state,
                actions,
            })
        } else if self.at_keyword("row") {
            self.advance();
            Ok(SourceNode::Row(self.node_block()?))
        } else if self.at_keyword("column") {
            self.advance();
            Ok(SourceNode::Column(self.node_block()?))
        } else if self.at_keyword("if") {
            self.advance();
            let condition = self.expression()?;
            let then_branch = self.node_block()?;
            let else_branch = if self.at_keyword("else") {
                self.advance();
                self.node_block()?
            } else {
                Vec::new()
            };
            Ok(SourceNode::If {
                condition,
                then_branch,
                else_branch,
            })
        } else {
            Err(self.error("expected `text`, `button`, `input`, `row`, `column`, or `if`"))
        }
    }

    fn action_block(&mut self) -> Result<Vec<SourceAction>, AirError> {
        self.take(TokenKind::LBrace, "`{` to start action block")?;
        let mut actions = Vec::new();
        while !self.at(&TokenKind::RBrace) {
            if self.at_keyword("set") {
                self.advance();
                let name = self.ident("state name after `set`")?;
                self.take(TokenKind::Equal, "`=` in set action")?;
                let expr = self.expression()?;
                self.take(TokenKind::Semicolon, "`;` after set action")?;
                actions.push(SourceAction::Set(name, expr));
            } else if self.at_keyword("navigate") {
                self.advance();
                let screen = self.ident("screen name after `navigate`")?;
                self.take(TokenKind::Semicolon, "`;` after navigate action")?;
                actions.push(SourceAction::Navigate(screen));
            } else {
                return Err(self.error("expected `set` or `navigate` action"));
            }
        }
        self.advance();
        Ok(actions)
    }

    fn expression(&mut self) -> Result<SourceExpr, AirError> {
        self.binary(1)
    }

    fn binary(&mut self, min_precedence: u8) -> Result<SourceExpr, AirError> {
        let mut left = self.unary()?;
        loop {
            let Some((op, precedence)) = self.binary_operator() else {
                break;
            };
            if precedence < min_precedence {
                break;
            }
            self.advance();
            let right = self.binary(precedence + 1)?;
            left = SourceExpr::Binary(Box::new(left), op, Box::new(right));
        }
        Ok(left)
    }

    fn unary(&mut self) -> Result<SourceExpr, AirError> {
        if self.at(&TokenKind::Bang) {
            self.advance();
            return Ok(SourceExpr::Unary(UnaryOp::Not, Box::new(self.unary()?)));
        }
        if self.at(&TokenKind::Minus) {
            self.advance();
            return Ok(SourceExpr::Unary(UnaryOp::Negate, Box::new(self.unary()?)));
        }
        self.primary()
    }

    fn primary(&mut self) -> Result<SourceExpr, AirError> {
        if self.at(&TokenKind::LParen) {
            self.advance();
            let expression = self.expression()?;
            self.take(TokenKind::RParen, "`)` after expression")?;
            return Ok(expression);
        }
        match self.current().kind.clone() {
            TokenKind::String(value) => {
                self.advance();
                Ok(SourceExpr::Value(Value::Text(value)))
            }
            TokenKind::Number(value) => {
                self.advance();
                Ok(SourceExpr::Value(Value::Number(value)))
            }
            TokenKind::Ident(name) if name == "true" || name == "false" => {
                self.advance();
                Ok(SourceExpr::Value(Value::Bool(name == "true")))
            }
            TokenKind::Ident(name) if name == "event" => {
                self.advance();
                Ok(SourceExpr::Event)
            }
            TokenKind::Ident(name) => {
                self.advance();
                Ok(SourceExpr::Name(name))
            }
            _ => Err(self.error("expected expression")),
        }
    }

    fn literal(&mut self) -> Result<Value, AirError> {
        let negative = self.at(&TokenKind::Minus);
        if negative {
            self.advance();
        }
        match self.current().kind.clone() {
            TokenKind::String(value) if !negative => {
                self.advance();
                Ok(Value::Text(value))
            }
            TokenKind::Number(value) => {
                self.advance();
                Ok(Value::Number(if negative { -value } else { value }))
            }
            TokenKind::Ident(name) if !negative && (name == "true" || name == "false") => {
                self.advance();
                Ok(Value::Bool(name == "true"))
            }
            _ => Err(self.error("state initializer must be a text, number, or bool literal")),
        }
    }

    fn binary_operator(&self) -> Option<(BinaryOp, u8)> {
        Some(match self.current().kind {
            TokenKind::OrOr => (BinaryOp::Or, 1),
            TokenKind::AndAnd => (BinaryOp::And, 2),
            TokenKind::EqualEqual => (BinaryOp::Equal, 3),
            TokenKind::BangEqual => (BinaryOp::NotEqual, 3),
            TokenKind::Less => (BinaryOp::Less, 4),
            TokenKind::LessEqual => (BinaryOp::LessEqual, 4),
            TokenKind::Greater => (BinaryOp::Greater, 4),
            TokenKind::GreaterEqual => (BinaryOp::GreaterEqual, 4),
            TokenKind::Plus => (BinaryOp::Add, 5),
            TokenKind::Minus => (BinaryOp::Subtract, 5),
            TokenKind::Star => (BinaryOp::Multiply, 6),
            TokenKind::Slash => (BinaryOp::Divide, 6),
            _ => return None,
        })
    }

    fn keyword(&mut self, expected: &str) -> Result<(), AirError> {
        if self.at_keyword(expected) {
            self.advance();
            Ok(())
        } else {
            Err(self.error(format!("expected `{expected}`")))
        }
    }

    fn ident(&mut self, description: &str) -> Result<String, AirError> {
        match self.current().kind.clone() {
            TokenKind::Ident(value) => {
                self.advance();
                Ok(value)
            }
            _ => Err(self.error(format!("expected {description}"))),
        }
    }

    fn string(&mut self, description: &str) -> Result<String, AirError> {
        match self.current().kind.clone() {
            TokenKind::String(value) => {
                self.advance();
                Ok(value)
            }
            _ => Err(self.error(format!("expected {description}"))),
        }
    }

    fn take(&mut self, kind: TokenKind, description: &str) -> Result<(), AirError> {
        if self.at(&kind) {
            self.advance();
            Ok(())
        } else {
            Err(self.error(format!("expected {description}")))
        }
    }

    fn at(&self, kind: &TokenKind) -> bool {
        std::mem::discriminant(&self.current().kind) == std::mem::discriminant(kind)
    }

    fn at_keyword(&self, keyword: &str) -> bool {
        matches!(&self.current().kind, TokenKind::Ident(value) if value == keyword)
    }

    fn current(&self) -> &Token {
        &self.tokens[self.cursor]
    }

    fn advance(&mut self) {
        if self.cursor + 1 < self.tokens.len() {
            self.cursor += 1;
        }
    }

    fn error(&self, message: impl Into<String>) -> AirError {
        AirError::new(Phase::Parse, message, Some(self.current().offset))
    }
}
