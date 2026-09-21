use crate::model::{
    Action, BinaryOp, Expr, Node, Program, Template, TemplatePart, UnaryOp, Value, ValueType,
};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    Click { target: u32 },
    Change { target: u32, value: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeError {
    message: String,
}

impl RuntimeError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl fmt::Display for RuntimeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for RuntimeError {}

#[derive(Debug, Clone)]
pub struct Runtime {
    program: Program,
    state: Vec<Value>,
    screen: u16,
}

#[derive(Clone)]
enum ActiveControl {
    Button(Vec<Action>),
    Input {
        value_type: ValueType,
        actions: Vec<Action>,
    },
}

impl Runtime {
    pub fn new(program: Program) -> Self {
        let state = program
            .states
            .iter()
            .map(|state| state.initial.clone())
            .collect();
        let screen = program.start;
        Self {
            program,
            state,
            screen,
        }
    }

    pub fn reset(&mut self) {
        self.state = self
            .program
            .states
            .iter()
            .map(|state| state.initial.clone())
            .collect();
        self.screen = self.program.start;
    }

    pub fn current_screen(&self) -> &str {
        &self.program.screens[usize::from(self.screen)].name
    }

    pub fn state(&self, name: &str) -> Result<&Value, RuntimeError> {
        self.program
            .states
            .iter()
            .position(|state| state.name == name)
            .map(|index| &self.state[index])
            .ok_or_else(|| RuntimeError::new(format!("unknown state `{name}`")))
    }

    pub fn visible_control_id(&self, label: &str) -> Result<Option<u32>, RuntimeError> {
        find_label(
            &self.program.screens[usize::from(self.screen)].body,
            label,
            &self.state,
        )
    }

    pub fn dispatch(&mut self, event: Event) -> Result<(), RuntimeError> {
        let target = match &event {
            Event::Click { target } | Event::Change { target, .. } => *target,
        };
        let control = find_control(
            &self.program.screens[usize::from(self.screen)].body,
            target,
            &self.state,
        )?
        .ok_or_else(|| {
            RuntimeError::new(format!(
                "control {target} is unknown or inactive on screen `{}`",
                self.current_screen()
            ))
        })?;

        let (actions, event_value) = match (control, event) {
            (ActiveControl::Button(actions), Event::Click { .. }) => (actions, None),
            (
                ActiveControl::Input {
                    value_type,
                    actions,
                },
                Event::Change { value, .. },
            ) => (actions, Some(parse_input(value_type, value)?)),
            (ActiveControl::Button(_), Event::Change { .. }) => {
                return Err(RuntimeError::new("change event sent to a button"))
            }
            (ActiveControl::Input { .. }, Event::Click { .. }) => {
                return Err(RuntimeError::new("click event sent to an input"))
            }
        };

        // Events are transactions: all expressions and actions must succeed
        // before any observable state or navigation is committed.
        let mut next_state = self.state.clone();
        let mut next_screen = self.screen;
        for action in actions {
            match action {
                Action::Set(id, expr) => {
                    let value = evaluate(&expr, &next_state, event_value.as_ref())?;
                    next_state[usize::from(id)] = value;
                }
                Action::Navigate(id) => next_screen = id,
            }
        }
        self.state = next_state;
        self.screen = next_screen;
        Ok(())
    }

    pub fn view_json(&self) -> Result<String, RuntimeError> {
        let screen = &self.program.screens[usize::from(self.screen)];
        let mut output = String::new();
        output.push_str("{\"app\":");
        json_string(&mut output, &self.program.name);
        output.push_str(",\"screen\":");
        json_string(&mut output, &screen.name);
        output.push_str(",\"nodes\":[");
        render_nodes(&mut output, &screen.body, &self.state, &mut true)?;
        output.push_str("]}");
        Ok(output)
    }
}

fn parse_input(value_type: ValueType, value: String) -> Result<Value, RuntimeError> {
    match value_type {
        ValueType::Text => Ok(Value::Text(value)),
        ValueType::Number => {
            let parsed = value
                .trim()
                .parse::<f64>()
                .map_err(|_| RuntimeError::new(format!("`{value}` is not a valid number")))?;
            if parsed.is_finite() {
                Ok(Value::Number(parsed))
            } else {
                Err(RuntimeError::new("numbers must be finite"))
            }
        }
        ValueType::Bool => Err(RuntimeError::new("bool inputs are not supported")),
    }
}

fn find_control(
    nodes: &[Node],
    target: u32,
    state: &[Value],
) -> Result<Option<ActiveControl>, RuntimeError> {
    for node in nodes {
        let found = match node {
            Node::Button { id, actions, .. } if *id == target => {
                Some(ActiveControl::Button(actions.clone()))
            }
            Node::Input {
                id,
                state: state_id,
                actions,
                ..
            } if *id == target => Some(ActiveControl::Input {
                value_type: state[usize::from(*state_id)].value_type(),
                actions: actions.clone(),
            }),
            Node::Row(children) | Node::Column(children) => find_control(children, target, state)?,
            Node::If {
                condition,
                then_branch,
                else_branch,
            } => {
                let branch = if expect_bool(evaluate(condition, state, None)?)? {
                    then_branch
                } else {
                    else_branch
                };
                find_control(branch, target, state)?
            }
            _ => None,
        };
        if found.is_some() {
            return Ok(found);
        }
    }
    Ok(None)
}

fn find_label(nodes: &[Node], target: &str, state: &[Value]) -> Result<Option<u32>, RuntimeError> {
    for node in nodes {
        let found = match node {
            Node::Button { id, label, .. } | Node::Input { id, label, .. }
                if render_template(label, state) == target =>
            {
                Some(*id)
            }
            Node::Row(children) | Node::Column(children) => find_label(children, target, state)?,
            Node::If {
                condition,
                then_branch,
                else_branch,
            } => {
                let branch = if expect_bool(evaluate(condition, state, None)?)? {
                    then_branch
                } else {
                    else_branch
                };
                find_label(branch, target, state)?
            }
            _ => None,
        };
        if found.is_some() {
            return Ok(found);
        }
    }
    Ok(None)
}

fn evaluate(expr: &Expr, state: &[Value], event: Option<&Value>) -> Result<Value, RuntimeError> {
    match expr {
        Expr::Value(value) => Ok(value.clone()),
        Expr::State(id) => Ok(state[usize::from(*id)].clone()),
        Expr::Event => event
            .cloned()
            .ok_or_else(|| RuntimeError::new("event value is unavailable")),
        Expr::Unary(UnaryOp::Not, inner) => {
            Ok(Value::Bool(!expect_bool(evaluate(inner, state, event)?)?))
        }
        Expr::Unary(UnaryOp::Negate, inner) => {
            number_result(-expect_number(evaluate(inner, state, event)?)?)
        }
        Expr::Binary(left, BinaryOp::And, right) => {
            let left = expect_bool(evaluate(left, state, event)?)?;
            if !left {
                Ok(Value::Bool(false))
            } else {
                Ok(Value::Bool(expect_bool(evaluate(right, state, event)?)?))
            }
        }
        Expr::Binary(left, BinaryOp::Or, right) => {
            let left = expect_bool(evaluate(left, state, event)?)?;
            if left {
                Ok(Value::Bool(true))
            } else {
                Ok(Value::Bool(expect_bool(evaluate(right, state, event)?)?))
            }
        }
        Expr::Binary(left, op, right) => {
            let left = evaluate(left, state, event)?;
            let right = evaluate(right, state, event)?;
            match op {
                BinaryOp::Add => number_result(expect_number(left)? + expect_number(right)?),
                BinaryOp::Subtract => number_result(expect_number(left)? - expect_number(right)?),
                BinaryOp::Multiply => number_result(expect_number(left)? * expect_number(right)?),
                BinaryOp::Divide => {
                    let divisor = expect_number(right)?;
                    if divisor == 0.0 {
                        Err(RuntimeError::new("division by zero"))
                    } else {
                        number_result(expect_number(left)? / divisor)
                    }
                }
                BinaryOp::Equal => Ok(Value::Bool(left == right)),
                BinaryOp::NotEqual => Ok(Value::Bool(left != right)),
                BinaryOp::Less => Ok(Value::Bool(expect_number(left)? < expect_number(right)?)),
                BinaryOp::LessEqual => {
                    Ok(Value::Bool(expect_number(left)? <= expect_number(right)?))
                }
                BinaryOp::Greater => Ok(Value::Bool(expect_number(left)? > expect_number(right)?)),
                BinaryOp::GreaterEqual => {
                    Ok(Value::Bool(expect_number(left)? >= expect_number(right)?))
                }
                BinaryOp::And | BinaryOp::Or => unreachable!(),
            }
        }
    }
}

fn expect_number(value: Value) -> Result<f64, RuntimeError> {
    match value {
        Value::Number(value) => Ok(value),
        other => Err(RuntimeError::new(format!(
            "expected number at runtime, found {}",
            other.value_type().name()
        ))),
    }
}

fn expect_bool(value: Value) -> Result<bool, RuntimeError> {
    match value {
        Value::Bool(value) => Ok(value),
        other => Err(RuntimeError::new(format!(
            "expected bool at runtime, found {}",
            other.value_type().name()
        ))),
    }
}

fn number_result(value: f64) -> Result<Value, RuntimeError> {
    if value.is_finite() {
        Ok(Value::Number(value))
    } else {
        Err(RuntimeError::new(
            "number operation produced a non-finite result",
        ))
    }
}

fn render_nodes(
    output: &mut String,
    nodes: &[Node],
    state: &[Value],
    first: &mut bool,
) -> Result<(), RuntimeError> {
    for node in nodes {
        if let Node::If {
            condition,
            then_branch,
            else_branch,
        } = node
        {
            let branch = if expect_bool(evaluate(condition, state, None)?)? {
                then_branch
            } else {
                else_branch
            };
            render_nodes(output, branch, state, first)?;
            continue;
        }
        if !*first {
            output.push(',');
        }
        *first = false;
        match node {
            Node::Text(template) => {
                output.push_str("{\"kind\":\"text\",\"text\":");
                json_string(output, &render_template(template, state));
                output.push('}');
            }
            Node::Button { id, label, .. } => {
                output.push_str("{\"kind\":\"button\",\"id\":");
                output.push_str(&id.to_string());
                output.push_str(",\"label\":");
                json_string(output, &render_template(label, state));
                output.push('}');
            }
            Node::Input {
                id,
                label,
                state: state_id,
                ..
            } => {
                let value = &state[usize::from(*state_id)];
                output.push_str("{\"kind\":\"input\",\"id\":");
                output.push_str(&id.to_string());
                output.push_str(",\"label\":");
                json_string(output, &render_template(label, state));
                output.push_str(",\"value\":");
                json_string(output, &value.display());
                output.push_str(",\"input_type\":");
                json_string(output, value.value_type().name());
                output.push('}');
            }
            Node::Row(children) | Node::Column(children) => {
                let kind = if matches!(node, Node::Row(_)) {
                    "row"
                } else {
                    "column"
                };
                output.push_str("{\"kind\":");
                json_string(output, kind);
                output.push_str(",\"children\":[");
                render_nodes(output, children, state, &mut true)?;
                output.push_str("]}");
            }
            Node::If { .. } => unreachable!(),
        }
    }
    Ok(())
}

fn render_template(template: &Template, state: &[Value]) -> String {
    let mut output = String::new();
    for part in &template.parts {
        match part {
            TemplatePart::Literal(value) => output.push_str(value),
            TemplatePart::State(id) => output.push_str(&state[usize::from(*id)].display()),
        }
    }
    output
}

fn json_string(output: &mut String, value: &str) {
    output.push('"');
    for ch in value.chars() {
        match ch {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            ch if ch < ' ' => {
                use fmt::Write;
                write!(output, "\\u{:04x}", ch as u32).unwrap();
            }
            ch => output.push(ch),
        }
    }
    output.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compile;

    #[test]
    fn json_escaping_is_stable() {
        let program = compile(
            r#"app escaping {
                state value: text = "a\"b\\c\n";
                start main;
                screen main { text "{value}"; }
            }"#,
        )
        .unwrap();
        assert_eq!(
            Runtime::new(program).view_json().unwrap(),
            "{\"app\":\"escaping\",\"screen\":\"main\",\"nodes\":[{\"kind\":\"text\",\"text\":\"a\\\"b\\\\c\\n\"}]}"
        );
    }

    #[test]
    fn number_format_is_canonical() {
        assert_eq!(crate::model::format_number(-0.0), "0");
        assert_eq!(crate::model::format_number(12.0), "12");
        assert_eq!(crate::model::format_number(1.25), "1.25");
    }
}
