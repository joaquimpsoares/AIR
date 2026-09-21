use crate::model::{
    Action, BinaryOp, Expr, Node, Program, Screen, StateDef, Template, TemplatePart, UnaryOp,
    ValueType,
};
use crate::parser::{self, SourceAction, SourceExpr, SourceNode, SourceProgram};
use crate::{AirError, Phase};
use std::collections::HashMap;

pub fn compile(source: &str) -> Result<Program, AirError> {
    let source = parser::parse(source)?;
    Compiler::new(&source)?.finish(source)
}

struct Compiler {
    states: HashMap<String, (u16, ValueType)>,
    screens: HashMap<String, u16>,
    next_control: u32,
}

impl Compiler {
    fn new(source: &SourceProgram) -> Result<Self, AirError> {
        if source.states.len() > u16::MAX as usize {
            return Err(error("too many state declarations"));
        }
        if source.screens.len() > u16::MAX as usize {
            return Err(error("too many screen declarations"));
        }
        let mut states = HashMap::new();
        for (index, state) in source.states.iter().enumerate() {
            if state.initial.value_type() != state.value_type {
                return Err(error(format!(
                    "state `{}` is declared {} but initialized with {}",
                    state.name,
                    state.value_type.name(),
                    state.initial.value_type().name()
                )));
            }
            if states
                .insert(state.name.clone(), (index as u16, state.value_type))
                .is_some()
            {
                return Err(error(format!("duplicate state `{}`", state.name)));
            }
        }
        let mut screens = HashMap::new();
        for (index, screen) in source.screens.iter().enumerate() {
            if screens.insert(screen.name.clone(), index as u16).is_some() {
                return Err(error(format!("duplicate screen `{}`", screen.name)));
            }
        }
        if screens.is_empty() {
            return Err(error("an app must declare at least one screen"));
        }
        Ok(Self {
            states,
            screens,
            next_control: 1,
        })
    }

    fn finish(mut self, source: SourceProgram) -> Result<Program, AirError> {
        let start_name = source
            .start
            .ok_or_else(|| error("missing `start` declaration"))?;
        let start = self.screen_id(&start_name)?;
        let states = source
            .states
            .into_iter()
            .map(|state| StateDef {
                name: state.name,
                initial: state.initial,
            })
            .collect();
        let mut screens = Vec::with_capacity(source.screens.len());
        for screen in source.screens {
            let body = self.nodes(screen.body, None)?;
            screens.push(Screen {
                name: screen.name,
                body,
            });
        }
        let program = Program {
            name: source.name,
            states,
            start,
            screens,
        };
        program.verify().map_err(|err| error(err.message))?;
        Ok(program)
    }

    fn nodes(
        &mut self,
        nodes: Vec<SourceNode>,
        event_type: Option<ValueType>,
    ) -> Result<Vec<Node>, AirError> {
        nodes
            .into_iter()
            .map(|node| self.node(node, event_type))
            .collect()
    }

    fn node(&mut self, node: SourceNode, event_type: Option<ValueType>) -> Result<Node, AirError> {
        match node {
            SourceNode::Text(value) => Ok(Node::Text(self.template(value)?)),
            SourceNode::Button { label, actions } => {
                let id = self.control_id()?;
                Ok(Node::Button {
                    id,
                    label: self.template(label)?,
                    actions: self.actions(actions, None)?,
                })
            }
            SourceNode::Input {
                label,
                state,
                actions,
            } => {
                let (state_id, state_type) = self.state(&state)?;
                if state_type == ValueType::Bool {
                    return Err(error(format!(
                        "input `{}` cannot edit bool state `{state}`",
                        label
                    )));
                }
                let id = self.control_id()?;
                Ok(Node::Input {
                    id,
                    label: self.template(label)?,
                    state: state_id,
                    actions: self.actions(actions, Some(state_type))?,
                })
            }
            SourceNode::Row(children) => Ok(Node::Row(self.nodes(children, event_type)?)),
            SourceNode::Column(children) => Ok(Node::Column(self.nodes(children, event_type)?)),
            SourceNode::If {
                condition,
                then_branch,
                else_branch,
            } => {
                let (condition, condition_type) = self.expr(condition, event_type)?;
                self.expect_type(condition_type, ValueType::Bool, "if condition")?;
                Ok(Node::If {
                    condition,
                    then_branch: self.nodes(then_branch, event_type)?,
                    else_branch: self.nodes(else_branch, event_type)?,
                })
            }
        }
    }

    fn actions(
        &mut self,
        actions: Vec<SourceAction>,
        event_type: Option<ValueType>,
    ) -> Result<Vec<Action>, AirError> {
        actions
            .into_iter()
            .map(|action| match action {
                SourceAction::Set(name, source_expr) => {
                    let (id, target_type) = self.state(&name)?;
                    let (expr, actual_type) = self.expr(source_expr, event_type)?;
                    self.expect_type(actual_type, target_type, &format!("set `{name}`"))?;
                    Ok(Action::Set(id, expr))
                }
                SourceAction::Navigate(name) => Ok(Action::Navigate(self.screen_id(&name)?)),
            })
            .collect()
    }

    fn expr(
        &self,
        source: SourceExpr,
        event_type: Option<ValueType>,
    ) -> Result<(Expr, ValueType), AirError> {
        match source {
            SourceExpr::Value(value) => {
                let value_type = value.value_type();
                Ok((Expr::Value(value), value_type))
            }
            SourceExpr::Name(name) => {
                let (id, value_type) = self.state(&name)?;
                Ok((Expr::State(id), value_type))
            }
            SourceExpr::Event => {
                let value_type = event_type.ok_or_else(|| {
                    error("`event` is only available inside an input action or conditional")
                })?;
                Ok((Expr::Event, value_type))
            }
            SourceExpr::Unary(op, source_inner) => {
                let (inner, actual) = self.expr(*source_inner, event_type)?;
                let expected = match op {
                    UnaryOp::Not => ValueType::Bool,
                    UnaryOp::Negate => ValueType::Number,
                };
                self.expect_type(actual, expected, "unary expression")?;
                Ok((Expr::Unary(op, Box::new(inner)), expected))
            }
            SourceExpr::Binary(source_left, op, source_right) => {
                let (left, left_type) = self.expr(*source_left, event_type)?;
                let (right, right_type) = self.expr(*source_right, event_type)?;
                let result = match op {
                    BinaryOp::Add | BinaryOp::Subtract | BinaryOp::Multiply | BinaryOp::Divide => {
                        self.expect_type(left_type, ValueType::Number, "left arithmetic operand")?;
                        self.expect_type(
                            right_type,
                            ValueType::Number,
                            "right arithmetic operand",
                        )?;
                        ValueType::Number
                    }
                    BinaryOp::Less
                    | BinaryOp::LessEqual
                    | BinaryOp::Greater
                    | BinaryOp::GreaterEqual => {
                        self.expect_type(left_type, ValueType::Number, "left comparison operand")?;
                        self.expect_type(
                            right_type,
                            ValueType::Number,
                            "right comparison operand",
                        )?;
                        ValueType::Bool
                    }
                    BinaryOp::Equal | BinaryOp::NotEqual => {
                        self.expect_type(right_type, left_type, "equality operands")?;
                        ValueType::Bool
                    }
                    BinaryOp::And | BinaryOp::Or => {
                        self.expect_type(left_type, ValueType::Bool, "left logical operand")?;
                        self.expect_type(right_type, ValueType::Bool, "right logical operand")?;
                        ValueType::Bool
                    }
                };
                Ok((Expr::Binary(Box::new(left), op, Box::new(right)), result))
            }
        }
    }

    fn template(&self, source: String) -> Result<Template, AirError> {
        let mut parts = Vec::new();
        let mut literal = String::new();
        let chars: Vec<char> = source.chars().collect();
        let mut cursor = 0;
        while cursor < chars.len() {
            match chars[cursor] {
                '{' if chars.get(cursor + 1) == Some(&'{') => {
                    literal.push('{');
                    cursor += 2;
                }
                '}' if chars.get(cursor + 1) == Some(&'}') => {
                    literal.push('}');
                    cursor += 2;
                }
                '{' => {
                    if !literal.is_empty() {
                        parts.push(TemplatePart::Literal(std::mem::take(&mut literal)));
                    }
                    let end = chars[cursor + 1..]
                        .iter()
                        .position(|ch| *ch == '}')
                        .map(|position| position + cursor + 1)
                        .ok_or_else(|| error("unclosed `{` in text template"))?;
                    let name: String = chars[cursor + 1..end].iter().collect();
                    if name.is_empty()
                        || !name.as_bytes()[0].is_ascii_alphabetic() && name.as_bytes()[0] != b'_'
                        || !name
                            .as_bytes()
                            .iter()
                            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
                    {
                        return Err(error(format!("invalid template state name `{name}`")));
                    }
                    let (id, _) = self.state(&name)?;
                    parts.push(TemplatePart::State(id));
                    cursor = end + 1;
                }
                '}' => return Err(error("unmatched `}` in text template")),
                ch => {
                    literal.push(ch);
                    cursor += 1;
                }
            }
        }
        if !literal.is_empty() || parts.is_empty() {
            parts.push(TemplatePart::Literal(literal));
        }
        Ok(Template { parts })
    }

    fn state(&self, name: &str) -> Result<(u16, ValueType), AirError> {
        self.states
            .get(name)
            .copied()
            .ok_or_else(|| error(format!("unknown state `{name}`")))
    }

    fn screen_id(&self, name: &str) -> Result<u16, AirError> {
        self.screens
            .get(name)
            .copied()
            .ok_or_else(|| error(format!("unknown screen `{name}`")))
    }

    fn control_id(&mut self) -> Result<u32, AirError> {
        let id = self.next_control;
        self.next_control = self
            .next_control
            .checked_add(1)
            .ok_or_else(|| error("too many controls"))?;
        Ok(id)
    }

    fn expect_type(
        &self,
        actual: ValueType,
        expected: ValueType,
        context: &str,
    ) -> Result<(), AirError> {
        if actual == expected {
            Ok(())
        } else {
            Err(error(format!(
                "{context} expects {}, found {}",
                expected.name(),
                actual.name()
            )))
        }
    }
}

fn error(message: impl Into<String>) -> AirError {
    AirError::new(Phase::Validate, message, None)
}
