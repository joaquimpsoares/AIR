use crate::model::{
    Action, BinaryOp, Expr, Node, Program, Screen, StateDef, Template, TemplatePart, UnaryOp, Value,
};
use crate::{AirError, Phase};

const MAGIC: &[u8; 4] = b"AIR1";
const MAX_ITEMS: usize = 100_000;
const MAX_STRING: usize = 1_048_576;
const MAX_DEPTH: usize = 128;

pub(crate) fn encode(program: &Program) -> Vec<u8> {
    let mut writer = Writer(Vec::new());
    writer.0.extend_from_slice(MAGIC);
    writer.string(&program.name);
    writer.items(&program.states, |writer, state| {
        writer.string(&state.name);
        writer.value(&state.initial);
    });
    writer.u16(program.start);
    writer.items(&program.screens, |writer, screen| {
        writer.string(&screen.name);
        writer.nodes(&screen.body);
    });
    writer.0
}

pub(crate) fn decode(bytes: &[u8]) -> Result<Program, AirError> {
    let mut reader = Reader { bytes, cursor: 0 };
    if reader.take(4)? != MAGIC {
        return Err(error("invalid AIR binary magic"));
    }
    let name = reader.string()?;
    let states = reader.items(|reader| {
        Ok(StateDef {
            name: reader.string()?,
            initial: reader.value()?,
        })
    })?;
    let start = reader.u16()?;
    let screens = reader.items(|reader| {
        Ok(Screen {
            name: reader.string()?,
            body: reader.nodes(0)?,
        })
    })?;
    if reader.cursor != bytes.len() {
        return Err(error("trailing bytes after AIR program"));
    }
    let program = Program {
        name,
        states,
        start,
        screens,
    };
    program.verify()?;
    Ok(program)
}

struct Writer(Vec<u8>);

impl Writer {
    fn u8(&mut self, value: u8) {
        self.0.push(value);
    }

    fn u16(&mut self, value: u16) {
        self.0.extend_from_slice(&value.to_le_bytes());
    }

    fn u32(&mut self, value: u32) {
        self.0.extend_from_slice(&value.to_le_bytes());
    }

    fn string(&mut self, value: &str) {
        self.u32(value.len() as u32);
        self.0.extend_from_slice(value.as_bytes());
    }

    fn items<T>(&mut self, values: &[T], mut write: impl FnMut(&mut Self, &T)) {
        self.u32(values.len() as u32);
        for value in values {
            write(self, value);
        }
    }

    fn value(&mut self, value: &Value) {
        match value {
            Value::Text(value) => {
                self.u8(0);
                self.string(value);
            }
            Value::Number(value) => {
                self.u8(1);
                self.0.extend_from_slice(&value.to_le_bytes());
            }
            Value::Bool(value) => {
                self.u8(2);
                self.u8(u8::from(*value));
            }
        }
    }

    fn nodes(&mut self, nodes: &[Node]) {
        self.items(nodes, |writer, node| writer.node(node));
    }

    fn node(&mut self, node: &Node) {
        match node {
            Node::Text(template) => {
                self.u8(0);
                self.template(template);
            }
            Node::Button { id, label, actions } => {
                self.u8(1);
                self.u32(*id);
                self.template(label);
                self.actions(actions);
            }
            Node::Input {
                id,
                label,
                state,
                actions,
            } => {
                self.u8(2);
                self.u32(*id);
                self.template(label);
                self.u16(*state);
                self.actions(actions);
            }
            Node::Row(children) => {
                self.u8(3);
                self.nodes(children);
            }
            Node::Column(children) => {
                self.u8(4);
                self.nodes(children);
            }
            Node::If {
                condition,
                then_branch,
                else_branch,
            } => {
                self.u8(5);
                self.expr(condition);
                self.nodes(then_branch);
                self.nodes(else_branch);
            }
        }
    }

    fn template(&mut self, template: &Template) {
        self.items(&template.parts, |writer, part| match part {
            TemplatePart::Literal(value) => {
                writer.u8(0);
                writer.string(value);
            }
            TemplatePart::State(id) => {
                writer.u8(1);
                writer.u16(*id);
            }
        });
    }

    fn actions(&mut self, actions: &[Action]) {
        self.items(actions, |writer, action| match action {
            Action::Set(id, expression) => {
                writer.u8(0);
                writer.u16(*id);
                writer.expr(expression);
            }
            Action::Navigate(id) => {
                writer.u8(1);
                writer.u16(*id);
            }
        });
    }

    fn expr(&mut self, expr: &Expr) {
        match expr {
            Expr::Value(value) => {
                self.u8(0);
                self.value(value);
            }
            Expr::State(id) => {
                self.u8(1);
                self.u16(*id);
            }
            Expr::Event => self.u8(2),
            Expr::Unary(op, inner) => {
                self.u8(3);
                self.u8(match op {
                    UnaryOp::Not => 0,
                    UnaryOp::Negate => 1,
                });
                self.expr(inner);
            }
            Expr::Binary(left, op, right) => {
                self.u8(4);
                self.u8(binary_tag(*op));
                self.expr(left);
                self.expr(right);
            }
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    cursor: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, len: usize) -> Result<&'a [u8], AirError> {
        let end = self
            .cursor
            .checked_add(len)
            .ok_or_else(|| error("binary offset overflow"))?;
        let value = self
            .bytes
            .get(self.cursor..end)
            .ok_or_else(|| error("truncated AIR binary"))?;
        self.cursor = end;
        Ok(value)
    }

    fn u8(&mut self) -> Result<u8, AirError> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16, AirError> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }

    fn u32(&mut self) -> Result<u32, AirError> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn string(&mut self) -> Result<String, AirError> {
        let len = self.length(MAX_STRING, "string")?;
        let bytes = self.take(len)?;
        String::from_utf8(bytes.to_vec()).map_err(|_| error("AIR binary contains invalid UTF-8"))
    }

    fn length(&mut self, max: usize, kind: &str) -> Result<usize, AirError> {
        let len = self.u32()? as usize;
        if len > max {
            Err(error(format!("{kind} length exceeds limit")))
        } else {
            Ok(len)
        }
    }

    fn items<T>(
        &mut self,
        mut read: impl FnMut(&mut Self) -> Result<T, AirError>,
    ) -> Result<Vec<T>, AirError> {
        let len = self.length(MAX_ITEMS, "list")?;
        let mut values = Vec::with_capacity(len.min(4096));
        for _ in 0..len {
            values.push(read(self)?);
        }
        Ok(values)
    }

    fn value(&mut self) -> Result<Value, AirError> {
        match self.u8()? {
            0 => Ok(Value::Text(self.string()?)),
            1 => {
                let value = f64::from_le_bytes(self.take(8)?.try_into().unwrap());
                if !value.is_finite() {
                    Err(error("AIR binary contains a non-finite number"))
                } else {
                    Ok(Value::Number(value))
                }
            }
            2 => match self.u8()? {
                0 => Ok(Value::Bool(false)),
                1 => Ok(Value::Bool(true)),
                _ => Err(error("invalid bool value")),
            },
            _ => Err(error("unknown value tag")),
        }
    }

    fn nodes(&mut self, depth: usize) -> Result<Vec<Node>, AirError> {
        if depth > MAX_DEPTH {
            return Err(error("view nesting exceeds limit"));
        }
        let len = self.length(MAX_ITEMS, "node list")?;
        let mut nodes = Vec::with_capacity(len.min(4096));
        for _ in 0..len {
            nodes.push(self.node(depth + 1)?);
        }
        Ok(nodes)
    }

    fn node(&mut self, depth: usize) -> Result<Node, AirError> {
        match self.u8()? {
            0 => Ok(Node::Text(self.template()?)),
            1 => Ok(Node::Button {
                id: self.u32()?,
                label: self.template()?,
                actions: self.actions(depth)?,
            }),
            2 => Ok(Node::Input {
                id: self.u32()?,
                label: self.template()?,
                state: self.u16()?,
                actions: self.actions(depth)?,
            }),
            3 => Ok(Node::Row(self.nodes(depth)?)),
            4 => Ok(Node::Column(self.nodes(depth)?)),
            5 => Ok(Node::If {
                condition: self.expr(depth)?,
                then_branch: self.nodes(depth)?,
                else_branch: self.nodes(depth)?,
            }),
            _ => Err(error("unknown node tag")),
        }
    }

    fn template(&mut self) -> Result<Template, AirError> {
        Ok(Template {
            parts: self.items(|reader| match reader.u8()? {
                0 => Ok(TemplatePart::Literal(reader.string()?)),
                1 => Ok(TemplatePart::State(reader.u16()?)),
                _ => Err(error("unknown template part tag")),
            })?,
        })
    }

    fn actions(&mut self, depth: usize) -> Result<Vec<Action>, AirError> {
        self.items(|reader| match reader.u8()? {
            0 => Ok(Action::Set(reader.u16()?, reader.expr(depth)?)),
            1 => Ok(Action::Navigate(reader.u16()?)),
            _ => Err(error("unknown action tag")),
        })
    }

    fn expr(&mut self, depth: usize) -> Result<Expr, AirError> {
        if depth > MAX_DEPTH {
            return Err(error("expression nesting exceeds limit"));
        }
        Ok(match self.u8()? {
            0 => Expr::Value(self.value()?),
            1 => Expr::State(self.u16()?),
            2 => Expr::Event,
            3 => {
                let op = match self.u8()? {
                    0 => UnaryOp::Not,
                    1 => UnaryOp::Negate,
                    _ => return Err(error("unknown unary operator tag")),
                };
                Expr::Unary(op, Box::new(self.expr(depth + 1)?))
            }
            4 => {
                let op = binary_op(self.u8()?)?;
                let left = self.expr(depth + 1)?;
                let right = self.expr(depth + 1)?;
                Expr::Binary(Box::new(left), op, Box::new(right))
            }
            _ => return Err(error("unknown expression tag")),
        })
    }
}

fn binary_tag(op: BinaryOp) -> u8 {
    match op {
        BinaryOp::Add => 0,
        BinaryOp::Subtract => 1,
        BinaryOp::Multiply => 2,
        BinaryOp::Divide => 3,
        BinaryOp::Equal => 4,
        BinaryOp::NotEqual => 5,
        BinaryOp::Less => 6,
        BinaryOp::LessEqual => 7,
        BinaryOp::Greater => 8,
        BinaryOp::GreaterEqual => 9,
        BinaryOp::And => 10,
        BinaryOp::Or => 11,
    }
}

fn binary_op(tag: u8) -> Result<BinaryOp, AirError> {
    Ok(match tag {
        0 => BinaryOp::Add,
        1 => BinaryOp::Subtract,
        2 => BinaryOp::Multiply,
        3 => BinaryOp::Divide,
        4 => BinaryOp::Equal,
        5 => BinaryOp::NotEqual,
        6 => BinaryOp::Less,
        7 => BinaryOp::LessEqual,
        8 => BinaryOp::Greater,
        9 => BinaryOp::GreaterEqual,
        10 => BinaryOp::And,
        11 => BinaryOp::Or,
        _ => return Err(error("unknown binary operator tag")),
    })
}

fn error(message: impl Into<String>) -> AirError {
    AirError::new(Phase::Decode, message, None)
}
