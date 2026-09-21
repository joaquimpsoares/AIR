use crate::{AirError, Phase};
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValueType {
    Text,
    Number,
    Bool,
}

impl ValueType {
    pub fn name(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Number => "number",
            Self::Bool => "bool",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Text(String),
    Number(f64),
    Bool(bool),
}

impl Value {
    pub fn value_type(&self) -> ValueType {
        match self {
            Self::Text(_) => ValueType::Text,
            Self::Number(_) => ValueType::Number,
            Self::Bool(_) => ValueType::Bool,
        }
    }

    pub(crate) fn display(&self) -> String {
        match self {
            Self::Text(value) => value.clone(),
            Self::Number(value) => format_number(*value),
            Self::Bool(value) => value.to_string(),
        }
    }
}

pub(crate) fn format_number(value: f64) -> String {
    if value == 0.0 {
        return "0".into();
    }
    if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{value:.0}")
    } else {
        value.to_string()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Program {
    pub(crate) name: String,
    pub(crate) states: Vec<StateDef>,
    pub(crate) start: u16,
    pub(crate) screens: Vec<Screen>,
}

impl Program {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn state_names(&self) -> impl Iterator<Item = &str> {
        self.states.iter().map(|state| state.name.as_str())
    }

    pub fn screen_names(&self) -> impl Iterator<Item = &str> {
        self.screens.iter().map(|screen| screen.name.as_str())
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        crate::binary::encode(self)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, AirError> {
        crate::binary::decode(bytes)
    }

    pub(crate) fn verify(&self) -> Result<(), AirError> {
        if self.screens.is_empty() {
            return Err(decode_error("program has no screens"));
        }
        if usize::from(self.start) >= self.screens.len() {
            return Err(decode_error("start screen index is out of bounds"));
        }
        let mut controls = HashSet::new();
        for screen in &self.screens {
            verify_nodes(
                &screen.body,
                self.states.len(),
                self.screens.len(),
                &mut controls,
            )?;
        }
        Ok(())
    }
}

fn decode_error(message: impl Into<String>) -> AirError {
    AirError::new(Phase::Decode, message, None)
}

fn verify_nodes(
    nodes: &[Node],
    state_count: usize,
    screen_count: usize,
    controls: &mut HashSet<u32>,
) -> Result<(), AirError> {
    for node in nodes {
        match node {
            Node::Text(template) => verify_template(template, state_count)?,
            Node::Button { id, label, actions } => {
                if *id == 0 || !controls.insert(*id) {
                    return Err(decode_error("control IDs must be non-zero and unique"));
                }
                verify_template(label, state_count)?;
                verify_actions(actions, state_count, screen_count)?;
            }
            Node::Input {
                id,
                label,
                state,
                actions,
            } => {
                if *id == 0 || !controls.insert(*id) {
                    return Err(decode_error("control IDs must be non-zero and unique"));
                }
                verify_template(label, state_count)?;
                let state = usize::from(*state);
                if state >= state_count {
                    return Err(decode_error("input state index is out of bounds"));
                }
                verify_actions(actions, state_count, screen_count)?;
            }
            Node::Row(children) | Node::Column(children) => {
                verify_nodes(children, state_count, screen_count, controls)?
            }
            Node::If {
                condition,
                then_branch,
                else_branch,
            } => {
                verify_expr(condition, state_count)?;
                verify_nodes(then_branch, state_count, screen_count, controls)?;
                verify_nodes(else_branch, state_count, screen_count, controls)?;
            }
        }
    }
    Ok(())
}

fn verify_template(template: &Template, state_count: usize) -> Result<(), AirError> {
    for part in &template.parts {
        if let TemplatePart::State(id) = part {
            if usize::from(*id) >= state_count {
                return Err(decode_error("template state index is out of bounds"));
            }
        }
    }
    Ok(())
}

fn verify_actions(
    actions: &[Action],
    state_count: usize,
    screen_count: usize,
) -> Result<(), AirError> {
    for action in actions {
        match action {
            Action::Set(id, expr) => {
                if usize::from(*id) >= state_count {
                    return Err(decode_error("set state index is out of bounds"));
                }
                verify_expr(expr, state_count)?;
            }
            Action::Navigate(id) if usize::from(*id) >= screen_count => {
                return Err(decode_error("navigation screen index is out of bounds"));
            }
            Action::Navigate(_) => {}
        }
    }
    Ok(())
}

fn verify_expr(expr: &Expr, state_count: usize) -> Result<(), AirError> {
    match expr {
        Expr::State(id) if usize::from(*id) >= state_count => {
            Err(decode_error("expression state index is out of bounds"))
        }
        Expr::Unary(_, inner) => verify_expr(inner, state_count),
        Expr::Binary(left, _, right) => {
            verify_expr(left, state_count)?;
            verify_expr(right, state_count)
        }
        _ => Ok(()),
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct StateDef {
    pub(crate) name: String,
    pub(crate) initial: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Screen {
    pub(crate) name: String,
    pub(crate) body: Vec<Node>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Node {
    Text(Template),
    Button {
        id: u32,
        label: Template,
        actions: Vec<Action>,
    },
    Input {
        id: u32,
        label: Template,
        state: u16,
        actions: Vec<Action>,
    },
    Row(Vec<Node>),
    Column(Vec<Node>),
    If {
        condition: Expr,
        then_branch: Vec<Node>,
        else_branch: Vec<Node>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Template {
    pub(crate) parts: Vec<TemplatePart>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum TemplatePart {
    Literal(String),
    State(u16),
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Action {
    Set(u16, Expr),
    Navigate(u16),
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Expr {
    Value(Value),
    State(u16),
    Event,
    Unary(UnaryOp, Box<Expr>),
    Binary(Box<Expr>, BinaryOp, Box<Expr>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UnaryOp {
    Not,
    Negate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BinaryOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    Equal,
    NotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    And,
    Or,
}
