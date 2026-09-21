//! AIR v2 compiler, canonical semantic IR, and AIR2 bytecode.
//!
//! This module is intentionally separate from the experimental AIR1 screen VM.
//! It implements `spec/AIR-V2.md` and is consumed by both the native CLI and
//! the Wasm package boundary.

use json::JsonValue as Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fmt;

const AIR2_MAGIC: &[u8; 4] = b"AIR2";
const AIR2_MAJOR: u8 = 2;
const AIR2_MINOR: u8 = 0;
const MAX_PAYLOAD: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V2Location {
    pub line: usize,
    pub column: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V2Error {
    pub code: String,
    pub phase: String,
    pub location: Option<V2Location>,
    pub path: Option<String>,
    pub message: String,
}

impl V2Error {
    fn new(
        code: &str,
        phase: &str,
        line: Option<usize>,
        path: Option<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            phase: phase.into(),
            location: line.map(|line| V2Location { line, column: None }),
            path,
            message: message.into(),
        }
    }
}

impl fmt::Display for V2Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(location) = &self.location {
            write!(
                formatter,
                "{} [{}] at line {}: {}",
                self.phase, self.code, location.line, self.message
            )
        } else {
            write!(
                formatter,
                "{} [{}]: {}",
                self.phase, self.code, self.message
            )
        }
    }
}

impl std::error::Error for V2Error {}

#[derive(Debug, Clone, PartialEq)]
pub struct SemanticIr {
    pub schema: String,
    pub version: u32,
    pub app: AppIr,
    pub theme: ThemeIr,
    pub capabilities: Vec<String>,
    pub resources: Vec<ResourceIr>,
    pub parameters: Vec<ParameterIr>,
    pub rules: Vec<RuleIr>,
    pub invariants: Vec<InvariantIr>,
    pub processes: Vec<ProcessIr>,
    pub overview: Option<OverviewIr>,
    pub extensions: Vec<ExtensionIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AppIr {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub initial: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ThemeIr {
    pub mode: String,
    pub accent: String,
    pub density: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResourceIr {
    pub id: String,
    pub singular: String,
    pub plural: String,
    pub icon: String,
    pub label_field: String,
    pub actor: bool,
    pub fields: Vec<FieldIr>,
    pub management: Option<ManagementIr>,
    pub access: Option<AccessIr>,
    pub experience: Option<ExperienceIr>,
    pub highlights: Vec<HighlightIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FieldIr {
    pub id: String,
    pub value_type: String,
    pub label: String,
    pub required: bool,
    pub unique: bool,
    pub values: Vec<String>,
    pub reference: Option<String>,
    pub default: Option<String>,
    pub min: u32,
    pub placeholder: String,
    pub long: bool,
    pub currency: Option<String>,
    pub computed: Option<ComputedIr>,
    pub read_only: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ComputedIr {
    Workflow,
    Aggregate {
        operation: String,
        source: String,
        group: String,
        field: Option<String>,
        where_: Option<ConditionIr>,
        window: Option<String>,
        date: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ManagementIr {
    pub create: Value,
    pub edit: Value,
    pub delete: Value,
    pub lifecycle: String,
    pub page_size: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AccessIr {
    pub view: PolicyIr,
    pub create: PolicyIr,
    pub edit: PolicyIr,
    pub delete: PolicyIr,
    pub archive: PolicyIr,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExperienceIr {
    pub columns: Vec<String>,
    pub search: Vec<String>,
    pub filters: Vec<String>,
    pub sort: Vec<String>,
    pub page_size: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HighlightIr {
    pub id: String,
    pub field: String,
    pub value: String,
    pub tone: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolicyIr {
    pub any_of: Vec<PolicyTermIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PolicyTermIr {
    Any,
    System,
    Role {
        role: String,
    },
    Self_ {
        actor: String,
    },
    Owner {
        actor: String,
        path: Vec<ReferenceStepIr>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReferenceStepIr {
    pub field: String,
    pub reference: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConditionIr {
    Constant { value: bool },
    Or { alternatives: Vec<Vec<ClauseIr>> },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ClauseIr {
    pub left: OperandIr,
    pub operator: String,
    pub right: OperandIr,
    pub value_type: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OperandIr {
    pub value_type: String,
    pub currency: Option<String>,
    pub terms: Vec<ConditionTermIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConditionTermIr {
    Literal {
        value_type: String,
        value: Value,
        currency: Option<String>,
        reference: Option<String>,
    },
    Parameter {
        id: String,
        value_type: String,
        value: Value,
        currency: Option<String>,
    },
    Path {
        value_type: String,
        currency: Option<String>,
        reference: Option<String>,
        path: Vec<ConditionPathStepIr>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ConditionPathStepIr {
    pub resource: String,
    pub field: String,
    pub reference: Option<String>,
    pub computed: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParameterIr {
    pub address: String,
    pub resource: String,
    pub id: String,
    pub value_type: String,
    pub value: Value,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DurationIr {
    pub amount: u32,
    pub unit: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RuleIr {
    pub id: String,
    pub address: String,
    pub resource: String,
    pub field: String,
    pub from: String,
    pub to: String,
    pub since: String,
    pub after: DurationIr,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProcessIr {
    pub resource: String,
    pub state: String,
    pub initial: String,
    pub states: Vec<String>,
    pub terminal: Vec<String>,
    pub history: bool,
    pub touch: Option<String>,
    pub transitions: Vec<TransitionIr>,
    pub deadlines: Vec<DeadlineIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TransitionIr {
    pub id: String,
    pub address: String,
    pub from: Vec<String>,
    pub to: String,
    pub action: String,
    pub authority: PolicyIr,
    pub automatic: bool,
    pub condition: ConditionIr,
    pub comment: String,
    pub approvals: u32,
    pub distinct: bool,
    pub separate: Vec<SeparationIr>,
    pub event: String,
    pub within: Option<DurationIr>,
    pub since: Option<String>,
    pub unless_events: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SeparationIr {
    pub actor: String,
    pub path: Vec<ReferenceStepIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InvariantIr {
    pub address: String,
    pub resource: String,
    pub id: String,
    pub condition: ConditionIr,
    pub required: Vec<String>,
    pub immutable: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DeadlineIr {
    pub id: String,
    pub state: String,
    pub after: DurationIr,
    pub escalation: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OverviewIr {
    pub title: String,
    pub metrics: Vec<MetricIr>,
    pub lists: Vec<ListIr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MetricIr {
    pub id: String,
    pub address: String,
    pub source: String,
    pub operation: String,
    pub field: Option<String>,
    pub group: Option<String>,
    pub where_: Option<MetricWhereIr>,
    pub label: String,
    pub tone: String,
    pub format: String,
    pub inferred: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MetricWhereIr {
    FieldEquals { field: String, value: String },
    Constant { value: bool },
    Or { alternatives: Vec<Vec<ClauseIr>> },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ListIr {
    pub id: String,
    pub address: String,
    pub source: String,
    pub title: String,
    pub columns: Vec<String>,
    pub sort: Vec<String>,
    pub limit: u32,
    pub where_: Option<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExtensionIr {
    pub id: String,
    pub module: String,
    pub slot: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct V2Program {
    pub ir: SemanticIr,
}

impl V2Program {
    pub fn canonical_json(&self) -> Result<String, V2Error> {
        Ok(json::stringify(semantic_json(&self.ir)))
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, V2Error> {
        let payload = self.canonical_json()?.into_bytes();
        if payload.len() > MAX_PAYLOAD || payload.len() > u32::MAX as usize {
            return Err(V2Error::new(
                "AIR_BYTECODE_LIMIT",
                "bytecode",
                None,
                None,
                "AIR2 payload exceeds limit",
            ));
        }
        let mut output = Vec::with_capacity(payload.len() + 10);
        output.extend_from_slice(AIR2_MAGIC);
        output.push(AIR2_MAJOR);
        output.push(AIR2_MINOR);
        output.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        output.extend_from_slice(&payload);
        Ok(output)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, V2Error> {
        if bytes.len() < 10
            || &bytes[..4] != AIR2_MAGIC
            || bytes[4] != AIR2_MAJOR
            || bytes[5] != AIR2_MINOR
        {
            return Err(V2Error::new(
                "AIR_BYTECODE_VERSION",
                "bytecode",
                None,
                None,
                "unsupported AIR bytecode magic or version",
            ));
        }
        let length = u32::from_be_bytes(bytes[6..10].try_into().unwrap()) as usize;
        if length > MAX_PAYLOAD || bytes.len() != length + 10 {
            return Err(V2Error::new(
                "AIR_BYTECODE_LENGTH",
                "bytecode",
                None,
                None,
                "AIR2 payload length mismatch",
            ));
        }
        let source = std::str::from_utf8(&bytes[10..]).map_err(|error| {
            V2Error::new(
                "AIR_BYTECODE_JSON",
                "bytecode",
                None,
                None,
                error.to_string(),
            )
        })?;
        let value = json::parse(source).map_err(|error| {
            V2Error::new(
                "AIR_BYTECODE_JSON",
                "bytecode",
                None,
                None,
                error.to_string(),
            )
        })?;
        let ir = semantic_from_json(&value)?;
        verify_ir(&ir)?;
        Ok(Self { ir })
    }
}

fn object(entries: Vec<(&str, Value)>) -> Value {
    let mut value = Value::new_object();
    for (key, entry) in entries {
        value[key] = entry;
    }
    value
}

fn strings(values: &[String]) -> Value {
    Value::Array(values.iter().cloned().map(Value::String).collect())
}

fn values<T>(entries: &[T], convert: impl Fn(&T) -> Value) -> Value {
    Value::Array(entries.iter().map(convert).collect())
}

fn optional_string(value: &Option<String>) -> Value {
    value.clone().map(Value::String).unwrap_or(Value::Null)
}

fn optional<T>(value: &Option<T>, convert: impl Fn(&T) -> Value) -> Value {
    value.as_ref().map(convert).unwrap_or(Value::Null)
}

fn semantic_json(ir: &SemanticIr) -> Value {
    object(vec![
        ("schema", ir.schema.clone().into()),
        ("version", ir.version.into()),
        (
            "app",
            object(vec![
                ("id", ir.app.id.clone().into()),
                ("title", ir.app.title.clone().into()),
                ("subtitle", ir.app.subtitle.clone().into()),
                ("initial", ir.app.initial.clone().into()),
            ]),
        ),
        (
            "theme",
            object(vec![
                ("mode", ir.theme.mode.clone().into()),
                ("accent", ir.theme.accent.clone().into()),
                ("density", ir.theme.density.clone().into()),
            ]),
        ),
        ("capabilities", strings(&ir.capabilities)),
        ("resources", values(&ir.resources, resource_json)),
        (
            "parameters",
            values(&ir.parameters, |parameter| {
                object(vec![
                    ("address", parameter.address.clone().into()),
                    ("resource", parameter.resource.clone().into()),
                    ("id", parameter.id.clone().into()),
                    ("type", parameter.value_type.clone().into()),
                    ("value", parameter.value.clone()),
                    ("label", parameter.label.clone().into()),
                ])
            }),
        ),
        (
            "rules",
            values(&ir.rules, |rule| {
                object(vec![
                    ("id", rule.id.clone().into()),
                    ("address", rule.address.clone().into()),
                    ("resource", rule.resource.clone().into()),
                    ("field", rule.field.clone().into()),
                    ("from", rule.from.clone().into()),
                    ("to", rule.to.clone().into()),
                    ("since", rule.since.clone().into()),
                    ("after", duration_json(&rule.after)),
                ])
            }),
        ),
        ("invariants", values(&ir.invariants, invariant_json)),
        ("processes", values(&ir.processes, process_json)),
        ("overview", optional(&ir.overview, overview_json)),
        (
            "extensions",
            values(&ir.extensions, |extension| {
                object(vec![
                    ("id", extension.id.clone().into()),
                    ("module", extension.module.clone().into()),
                    ("slot", extension.slot.clone().into()),
                ])
            }),
        ),
    ])
}

fn resource_json(resource: &ResourceIr) -> Value {
    object(vec![
        ("id", resource.id.clone().into()),
        ("singular", resource.singular.clone().into()),
        ("plural", resource.plural.clone().into()),
        ("icon", resource.icon.clone().into()),
        ("labelField", resource.label_field.clone().into()),
        ("actor", resource.actor.into()),
        ("fields", values(&resource.fields, field_json)),
        (
            "management",
            optional(&resource.management, |management| {
                object(vec![
                    ("create", management.create.clone()),
                    ("edit", management.edit.clone()),
                    ("delete", management.delete.clone()),
                    ("lifecycle", management.lifecycle.clone().into()),
                    ("pageSize", management.page_size.into()),
                ])
            }),
        ),
        (
            "access",
            optional(&resource.access, |access| {
                object(vec![
                    ("view", policy_json(&access.view)),
                    ("create", policy_json(&access.create)),
                    ("edit", policy_json(&access.edit)),
                    ("delete", policy_json(&access.delete)),
                    ("archive", policy_json(&access.archive)),
                ])
            }),
        ),
        (
            "experience",
            optional(&resource.experience, |experience| {
                object(vec![
                    ("columns", strings(&experience.columns)),
                    ("search", strings(&experience.search)),
                    ("filters", strings(&experience.filters)),
                    ("sort", strings(&experience.sort)),
                    ("pageSize", experience.page_size.into()),
                ])
            }),
        ),
        (
            "highlights",
            values(&resource.highlights, |highlight| {
                object(vec![
                    ("id", highlight.id.clone().into()),
                    ("field", highlight.field.clone().into()),
                    ("value", highlight.value.clone().into()),
                    ("tone", highlight.tone.clone().into()),
                ])
            }),
        ),
    ])
}

fn field_json(field: &FieldIr) -> Value {
    object(vec![
        ("id", field.id.clone().into()),
        ("type", field.value_type.clone().into()),
        ("label", field.label.clone().into()),
        ("required", field.required.into()),
        ("unique", field.unique.into()),
        ("values", strings(&field.values)),
        ("ref", optional_string(&field.reference)),
        ("default", optional_string(&field.default)),
        ("min", field.min.into()),
        ("placeholder", field.placeholder.clone().into()),
        ("long", field.long.into()),
        ("currency", optional_string(&field.currency)),
        ("computed", optional(&field.computed, computed_json)),
        ("readOnly", field.read_only.into()),
    ])
}

fn computed_json(computed: &ComputedIr) -> Value {
    match computed {
        ComputedIr::Workflow => object(vec![("kind", "workflow".into())]),
        ComputedIr::Aggregate {
            operation,
            source,
            group,
            field,
            where_,
            window,
            date,
        } => object(vec![
            ("kind", "aggregate".into()),
            ("operation", operation.clone().into()),
            ("source", source.clone().into()),
            ("group", group.clone().into()),
            ("field", optional_string(field)),
            ("where", optional(where_, condition_json)),
            ("window", optional_string(window)),
            ("date", optional_string(date)),
        ]),
    }
}

fn policy_json(policy: &PolicyIr) -> Value {
    object(vec![(
        "anyOf",
        values(&policy.any_of, |term| match term {
            PolicyTermIr::Any => object(vec![("kind", "any".into())]),
            PolicyTermIr::System => object(vec![("kind", "system".into())]),
            PolicyTermIr::Role { role } => {
                object(vec![("kind", "role".into()), ("role", role.clone().into())])
            }
            PolicyTermIr::Self_ { actor } => object(vec![
                ("kind", "self".into()),
                ("actor", actor.clone().into()),
            ]),
            PolicyTermIr::Owner { actor, path } => object(vec![
                ("kind", "owner".into()),
                ("actor", actor.clone().into()),
                ("path", values(path, reference_step_json)),
            ]),
        }),
    )])
}

fn reference_step_json(step: &ReferenceStepIr) -> Value {
    object(vec![
        ("field", step.field.clone().into()),
        ("ref", step.reference.clone().into()),
    ])
}

fn condition_json(condition: &ConditionIr) -> Value {
    match condition {
        ConditionIr::Constant { value } => object(vec![
            ("kind", "constant".into()),
            ("value", (*value).into()),
        ]),
        ConditionIr::Or { alternatives } => object(vec![
            ("kind", "or".into()),
            (
                "alternatives",
                Value::Array(
                    alternatives
                        .iter()
                        .map(|clauses| values(clauses, clause_json))
                        .collect(),
                ),
            ),
        ]),
    }
}

fn clause_json(clause: &ClauseIr) -> Value {
    object(vec![
        ("left", operand_json(&clause.left)),
        ("operator", clause.operator.clone().into()),
        ("right", operand_json(&clause.right)),
        ("type", clause.value_type.clone().into()),
    ])
}

fn operand_json(operand: &OperandIr) -> Value {
    object(vec![
        ("type", operand.value_type.clone().into()),
        ("currency", optional_string(&operand.currency)),
        ("terms", values(&operand.terms, condition_term_json)),
    ])
}

fn condition_term_json(term: &ConditionTermIr) -> Value {
    match term {
        ConditionTermIr::Literal {
            value_type,
            value,
            currency,
            reference,
        } => object(vec![
            ("kind", "literal".into()),
            ("type", value_type.clone().into()),
            ("value", value.clone()),
            ("currency", optional_string(currency)),
            ("ref", optional_string(reference)),
        ]),
        ConditionTermIr::Parameter {
            id,
            value_type,
            value,
            currency,
        } => object(vec![
            ("kind", "parameter".into()),
            ("id", id.clone().into()),
            ("type", value_type.clone().into()),
            ("value", value.clone()),
            ("currency", optional_string(currency)),
        ]),
        ConditionTermIr::Path {
            value_type,
            currency,
            reference,
            path,
        } => object(vec![
            ("kind", "path".into()),
            ("type", value_type.clone().into()),
            ("currency", optional_string(currency)),
            ("ref", optional_string(reference)),
            (
                "path",
                values(path, |step| {
                    object(vec![
                        ("resource", step.resource.clone().into()),
                        ("field", step.field.clone().into()),
                        ("ref", optional_string(&step.reference)),
                        ("computed", step.computed.into()),
                    ])
                }),
            ),
        ]),
    }
}

fn duration_json(duration: &DurationIr) -> Value {
    object(vec![
        ("amount", duration.amount.into()),
        ("unit", duration.unit.clone().into()),
    ])
}

fn invariant_json(invariant: &InvariantIr) -> Value {
    object(vec![
        ("address", invariant.address.clone().into()),
        ("resource", invariant.resource.clone().into()),
        ("id", invariant.id.clone().into()),
        ("condition", condition_json(&invariant.condition)),
        ("required", strings(&invariant.required)),
        ("immutable", strings(&invariant.immutable)),
    ])
}

fn process_json(process: &ProcessIr) -> Value {
    object(vec![
        ("resource", process.resource.clone().into()),
        ("state", process.state.clone().into()),
        ("initial", process.initial.clone().into()),
        ("states", strings(&process.states)),
        ("terminal", strings(&process.terminal)),
        ("history", process.history.into()),
        ("touch", optional_string(&process.touch)),
        ("transitions", values(&process.transitions, transition_json)),
        (
            "deadlines",
            values(&process.deadlines, |deadline| {
                object(vec![
                    ("id", deadline.id.clone().into()),
                    ("state", deadline.state.clone().into()),
                    ("after", duration_json(&deadline.after)),
                    ("escalation", deadline.escalation.clone().into()),
                ])
            }),
        ),
    ])
}

fn transition_json(transition: &TransitionIr) -> Value {
    object(vec![
        ("id", transition.id.clone().into()),
        ("address", transition.address.clone().into()),
        ("from", strings(&transition.from)),
        ("to", transition.to.clone().into()),
        ("action", transition.action.clone().into()),
        ("authority", policy_json(&transition.authority)),
        ("automatic", transition.automatic.into()),
        ("condition", condition_json(&transition.condition)),
        ("comment", transition.comment.clone().into()),
        ("approvals", transition.approvals.into()),
        ("distinct", transition.distinct.into()),
        (
            "separate",
            values(&transition.separate, |separation| {
                object(vec![
                    ("actor", separation.actor.clone().into()),
                    ("path", values(&separation.path, reference_step_json)),
                ])
            }),
        ),
        ("event", transition.event.clone().into()),
        ("within", optional(&transition.within, duration_json)),
        ("since", optional_string(&transition.since)),
        ("unlessEvents", strings(&transition.unless_events)),
    ])
}

fn metric_where_json(where_: &MetricWhereIr) -> Value {
    match where_ {
        MetricWhereIr::FieldEquals { field, value } => object(vec![
            ("kind", "field-equals".into()),
            ("field", field.clone().into()),
            ("value", value.clone().into()),
        ]),
        MetricWhereIr::Constant { value } => object(vec![
            ("kind", "constant".into()),
            ("value", (*value).into()),
        ]),
        MetricWhereIr::Or { alternatives } => object(vec![
            ("kind", "or".into()),
            (
                "alternatives",
                Value::Array(
                    alternatives
                        .iter()
                        .map(|clauses| values(clauses, clause_json))
                        .collect(),
                ),
            ),
        ]),
    }
}

fn overview_json(overview: &OverviewIr) -> Value {
    object(vec![
        ("title", overview.title.clone().into()),
        (
            "metrics",
            values(&overview.metrics, |metric| {
                object(vec![
                    ("id", metric.id.clone().into()),
                    ("address", metric.address.clone().into()),
                    ("source", metric.source.clone().into()),
                    ("operation", metric.operation.clone().into()),
                    ("field", optional_string(&metric.field)),
                    ("group", optional_string(&metric.group)),
                    ("where", optional(&metric.where_, metric_where_json)),
                    ("label", metric.label.clone().into()),
                    ("tone", metric.tone.clone().into()),
                    ("format", metric.format.clone().into()),
                    ("inferred", metric.inferred.into()),
                ])
            }),
        ),
        (
            "lists",
            values(&overview.lists, |list| {
                object(vec![
                    ("id", list.id.clone().into()),
                    ("address", list.address.clone().into()),
                    ("source", list.source.clone().into()),
                    ("title", list.title.clone().into()),
                    ("columns", strings(&list.columns)),
                    ("sort", strings(&list.sort)),
                    ("limit", list.limit.into()),
                    ("where", list.where_.clone().unwrap_or(Value::Null)),
                ])
            }),
        ),
    ])
}

fn decode_error(path: &str, message: impl Into<String>) -> V2Error {
    V2Error::new(
        "AIR_BYTECODE_INVALID",
        "bytecode",
        None,
        Some(path.into()),
        message,
    )
}

fn text_at(value: &Value, key: &str, path: &str) -> Result<String, V2Error> {
    value[key]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| decode_error(path, format!("`{key}` must be a string")))
}

fn optional_text_at(value: &Value, key: &str, path: &str) -> Result<Option<String>, V2Error> {
    if value[key].is_null() {
        Ok(None)
    } else {
        text_at(value, key, path).map(Some)
    }
}

fn bool_at(value: &Value, key: &str, path: &str) -> Result<bool, V2Error> {
    value[key]
        .as_bool()
        .ok_or_else(|| decode_error(path, format!("`{key}` must be a boolean")))
}

fn u32_at(value: &Value, key: &str, path: &str) -> Result<u32, V2Error> {
    value[key]
        .as_u32()
        .ok_or_else(|| decode_error(path, format!("`{key}` must be a u32")))
}

fn strings_at(value: &Value, key: &str, path: &str) -> Result<Vec<String>, V2Error> {
    if !value[key].is_array() {
        return Err(decode_error(path, format!("`{key}` must be an array")));
    }
    value[key]
        .members()
        .map(|entry| {
            entry
                .as_str()
                .map(str::to_string)
                .ok_or_else(|| decode_error(path, format!("`{key}` entries must be strings")))
        })
        .collect()
}

fn map_array<T>(
    value: &Value,
    key: &str,
    path: &str,
    parse: impl Fn(&Value, &str) -> Result<T, V2Error>,
) -> Result<Vec<T>, V2Error> {
    if !value[key].is_array() {
        return Err(decode_error(path, format!("`{key}` must be an array")));
    }
    value[key]
        .members()
        .enumerate()
        .map(|(index, entry)| parse(entry, &format!("{path}.{key}[{index}]")))
        .collect()
}

fn parse_duration_json(value: &Value, path: &str) -> Result<DurationIr, V2Error> {
    Ok(DurationIr {
        amount: u32_at(value, "amount", path)?,
        unit: text_at(value, "unit", path)?,
    })
}

fn parse_reference_step_json(value: &Value, path: &str) -> Result<ReferenceStepIr, V2Error> {
    Ok(ReferenceStepIr {
        field: text_at(value, "field", path)?,
        reference: text_at(value, "ref", path)?,
    })
}

fn parse_policy_json(value: &Value, path: &str) -> Result<PolicyIr, V2Error> {
    Ok(PolicyIr {
        any_of: map_array(value, "anyOf", path, |term, term_path| {
            match text_at(term, "kind", term_path)?.as_str() {
                "any" => Ok(PolicyTermIr::Any),
                "system" => Ok(PolicyTermIr::System),
                "role" => Ok(PolicyTermIr::Role {
                    role: text_at(term, "role", term_path)?,
                }),
                "self" => Ok(PolicyTermIr::Self_ {
                    actor: text_at(term, "actor", term_path)?,
                }),
                "owner" => Ok(PolicyTermIr::Owner {
                    actor: text_at(term, "actor", term_path)?,
                    path: map_array(term, "path", term_path, parse_reference_step_json)?,
                }),
                kind => Err(decode_error(
                    term_path,
                    format!("unknown policy term `{kind}`"),
                )),
            }
        })?,
    })
}

fn parse_condition_path_step_json(
    value: &Value,
    path: &str,
) -> Result<ConditionPathStepIr, V2Error> {
    Ok(ConditionPathStepIr {
        resource: text_at(value, "resource", path)?,
        field: text_at(value, "field", path)?,
        reference: optional_text_at(value, "ref", path)?,
        computed: bool_at(value, "computed", path)?,
    })
}

fn parse_condition_term_json(value: &Value, path: &str) -> Result<ConditionTermIr, V2Error> {
    match text_at(value, "kind", path)?.as_str() {
        "literal" => Ok(ConditionTermIr::Literal {
            value_type: text_at(value, "type", path)?,
            value: value["value"].clone(),
            currency: optional_text_at(value, "currency", path)?,
            reference: optional_text_at(value, "ref", path)?,
        }),
        "parameter" => Ok(ConditionTermIr::Parameter {
            id: text_at(value, "id", path)?,
            value_type: text_at(value, "type", path)?,
            value: value["value"].clone(),
            currency: optional_text_at(value, "currency", path)?,
        }),
        "path" => Ok(ConditionTermIr::Path {
            value_type: text_at(value, "type", path)?,
            currency: optional_text_at(value, "currency", path)?,
            reference: optional_text_at(value, "ref", path)?,
            path: map_array(value, "path", path, parse_condition_path_step_json)?,
        }),
        kind => Err(decode_error(
            path,
            format!("unknown condition term `{kind}`"),
        )),
    }
}

fn parse_operand_json(value: &Value, path: &str) -> Result<OperandIr, V2Error> {
    Ok(OperandIr {
        value_type: text_at(value, "type", path)?,
        currency: optional_text_at(value, "currency", path)?,
        terms: map_array(value, "terms", path, parse_condition_term_json)?,
    })
}

fn parse_clause_json(value: &Value, path: &str) -> Result<ClauseIr, V2Error> {
    Ok(ClauseIr {
        left: parse_operand_json(&value["left"], &format!("{path}.left"))?,
        operator: text_at(value, "operator", path)?,
        right: parse_operand_json(&value["right"], &format!("{path}.right"))?,
        value_type: text_at(value, "type", path)?,
    })
}

fn parse_alternatives_json(value: &Value, path: &str) -> Result<Vec<Vec<ClauseIr>>, V2Error> {
    if !value["alternatives"].is_array() {
        return Err(decode_error(path, "alternatives must be an array"));
    }
    value["alternatives"]
        .members()
        .enumerate()
        .map(|(index, clauses)| {
            if !clauses.is_array() {
                return Err(decode_error(path, "condition conjunction must be an array"));
            }
            clauses
                .members()
                .enumerate()
                .map(|(clause_index, clause)| {
                    parse_clause_json(
                        clause,
                        &format!("{path}.alternatives[{index}][{clause_index}]"),
                    )
                })
                .collect()
        })
        .collect()
}

fn parse_condition_json(value: &Value, path: &str) -> Result<ConditionIr, V2Error> {
    match text_at(value, "kind", path)?.as_str() {
        "constant" => Ok(ConditionIr::Constant {
            value: bool_at(value, "value", path)?,
        }),
        "or" => Ok(ConditionIr::Or {
            alternatives: parse_alternatives_json(value, path)?,
        }),
        kind => Err(decode_error(
            path,
            format!("unknown condition kind `{kind}`"),
        )),
    }
}

fn parse_computed_json(value: &Value, path: &str) -> Result<Option<ComputedIr>, V2Error> {
    if value.is_null() {
        return Ok(None);
    }
    match text_at(value, "kind", path)?.as_str() {
        "workflow" => Ok(Some(ComputedIr::Workflow)),
        "aggregate" => Ok(Some(ComputedIr::Aggregate {
            operation: text_at(value, "operation", path)?,
            source: text_at(value, "source", path)?,
            group: text_at(value, "group", path)?,
            field: optional_text_at(value, "field", path)?,
            where_: if value["where"].is_null() {
                None
            } else {
                Some(parse_condition_json(
                    &value["where"],
                    &format!("{path}.where"),
                )?)
            },
            window: optional_text_at(value, "window", path)?,
            date: optional_text_at(value, "date", path)?,
        })),
        kind => Err(decode_error(
            path,
            format!("unknown computed kind `{kind}`"),
        )),
    }
}

fn parse_field_json(value: &Value, path: &str) -> Result<FieldIr, V2Error> {
    Ok(FieldIr {
        id: text_at(value, "id", path)?,
        value_type: text_at(value, "type", path)?,
        label: text_at(value, "label", path)?,
        required: bool_at(value, "required", path)?,
        unique: bool_at(value, "unique", path)?,
        values: strings_at(value, "values", path)?,
        reference: optional_text_at(value, "ref", path)?,
        default: optional_text_at(value, "default", path)?,
        min: u32_at(value, "min", path)?,
        placeholder: text_at(value, "placeholder", path)?,
        long: bool_at(value, "long", path)?,
        currency: optional_text_at(value, "currency", path)?,
        computed: parse_computed_json(&value["computed"], &format!("{path}.computed"))?,
        read_only: bool_at(value, "readOnly", path)?,
    })
}

fn parse_resource_json(value: &Value, path: &str) -> Result<ResourceIr, V2Error> {
    let management = if value["management"].is_null() {
        None
    } else {
        Some(ManagementIr {
            create: value["management"]["create"].clone(),
            edit: value["management"]["edit"].clone(),
            delete: value["management"]["delete"].clone(),
            lifecycle: text_at(&value["management"], "lifecycle", path)?,
            page_size: u32_at(&value["management"], "pageSize", path)?,
        })
    };
    let access = if value["access"].is_null() {
        None
    } else {
        Some(AccessIr {
            view: parse_policy_json(&value["access"]["view"], path)?,
            create: parse_policy_json(&value["access"]["create"], path)?,
            edit: parse_policy_json(&value["access"]["edit"], path)?,
            delete: parse_policy_json(&value["access"]["delete"], path)?,
            archive: parse_policy_json(&value["access"]["archive"], path)?,
        })
    };
    let experience = if value["experience"].is_null() {
        None
    } else {
        Some(ExperienceIr {
            columns: strings_at(&value["experience"], "columns", path)?,
            search: strings_at(&value["experience"], "search", path)?,
            filters: strings_at(&value["experience"], "filters", path)?,
            sort: strings_at(&value["experience"], "sort", path)?,
            page_size: u32_at(&value["experience"], "pageSize", path)?,
        })
    };
    Ok(ResourceIr {
        id: text_at(value, "id", path)?,
        singular: text_at(value, "singular", path)?,
        plural: text_at(value, "plural", path)?,
        icon: text_at(value, "icon", path)?,
        label_field: text_at(value, "labelField", path)?,
        actor: bool_at(value, "actor", path)?,
        fields: map_array(value, "fields", path, parse_field_json)?,
        management,
        access,
        experience,
        highlights: map_array(value, "highlights", path, |entry, entry_path| {
            Ok(HighlightIr {
                id: text_at(entry, "id", entry_path)?,
                field: text_at(entry, "field", entry_path)?,
                value: text_at(entry, "value", entry_path)?,
                tone: text_at(entry, "tone", entry_path)?,
            })
        })?,
    })
}

fn parse_invariant_json(value: &Value, path: &str) -> Result<InvariantIr, V2Error> {
    Ok(InvariantIr {
        address: text_at(value, "address", path)?,
        resource: text_at(value, "resource", path)?,
        id: text_at(value, "id", path)?,
        condition: parse_condition_json(&value["condition"], &format!("{path}.condition"))?,
        required: strings_at(value, "required", path)?,
        immutable: strings_at(value, "immutable", path)?,
    })
}

fn parse_transition_json(value: &Value, path: &str) -> Result<TransitionIr, V2Error> {
    Ok(TransitionIr {
        id: text_at(value, "id", path)?,
        address: text_at(value, "address", path)?,
        from: strings_at(value, "from", path)?,
        to: text_at(value, "to", path)?,
        action: text_at(value, "action", path)?,
        authority: parse_policy_json(&value["authority"], &format!("{path}.authority"))?,
        automatic: bool_at(value, "automatic", path)?,
        condition: parse_condition_json(&value["condition"], &format!("{path}.condition"))?,
        comment: text_at(value, "comment", path)?,
        approvals: u32_at(value, "approvals", path)?,
        distinct: bool_at(value, "distinct", path)?,
        separate: map_array(value, "separate", path, |entry, entry_path| {
            Ok(SeparationIr {
                actor: text_at(entry, "actor", entry_path)?,
                path: map_array(entry, "path", entry_path, parse_reference_step_json)?,
            })
        })?,
        event: text_at(value, "event", path)?,
        within: if value["within"].is_null() {
            None
        } else {
            Some(parse_duration_json(
                &value["within"],
                &format!("{path}.within"),
            )?)
        },
        since: optional_text_at(value, "since", path)?,
        unless_events: strings_at(value, "unlessEvents", path)?,
    })
}

fn parse_process_json(value: &Value, path: &str) -> Result<ProcessIr, V2Error> {
    Ok(ProcessIr {
        resource: text_at(value, "resource", path)?,
        state: text_at(value, "state", path)?,
        initial: text_at(value, "initial", path)?,
        states: strings_at(value, "states", path)?,
        terminal: strings_at(value, "terminal", path)?,
        history: bool_at(value, "history", path)?,
        touch: optional_text_at(value, "touch", path)?,
        transitions: map_array(value, "transitions", path, parse_transition_json)?,
        deadlines: map_array(value, "deadlines", path, |entry, entry_path| {
            Ok(DeadlineIr {
                id: text_at(entry, "id", entry_path)?,
                state: text_at(entry, "state", entry_path)?,
                after: parse_duration_json(&entry["after"], &format!("{entry_path}.after"))?,
                escalation: text_at(entry, "escalation", entry_path)?,
            })
        })?,
    })
}

fn parse_metric_where_json(value: &Value, path: &str) -> Result<MetricWhereIr, V2Error> {
    match text_at(value, "kind", path)?.as_str() {
        "field-equals" => Ok(MetricWhereIr::FieldEquals {
            field: text_at(value, "field", path)?,
            value: text_at(value, "value", path)?,
        }),
        "constant" => Ok(MetricWhereIr::Constant {
            value: bool_at(value, "value", path)?,
        }),
        "or" => Ok(MetricWhereIr::Or {
            alternatives: parse_alternatives_json(value, path)?,
        }),
        kind => Err(decode_error(
            path,
            format!("unknown metric predicate `{kind}`"),
        )),
    }
}

fn parse_overview_json(value: &Value, path: &str) -> Result<OverviewIr, V2Error> {
    Ok(OverviewIr {
        title: text_at(value, "title", path)?,
        metrics: map_array(value, "metrics", path, |entry, entry_path| {
            Ok(MetricIr {
                id: text_at(entry, "id", entry_path)?,
                address: text_at(entry, "address", entry_path)?,
                source: text_at(entry, "source", entry_path)?,
                operation: text_at(entry, "operation", entry_path)?,
                field: optional_text_at(entry, "field", entry_path)?,
                group: optional_text_at(entry, "group", entry_path)?,
                where_: if entry["where"].is_null() {
                    None
                } else {
                    Some(parse_metric_where_json(
                        &entry["where"],
                        &format!("{entry_path}.where"),
                    )?)
                },
                label: text_at(entry, "label", entry_path)?,
                tone: text_at(entry, "tone", entry_path)?,
                format: text_at(entry, "format", entry_path)?,
                inferred: bool_at(entry, "inferred", entry_path)?,
            })
        })?,
        lists: map_array(value, "lists", path, |entry, entry_path| {
            Ok(ListIr {
                id: text_at(entry, "id", entry_path)?,
                address: text_at(entry, "address", entry_path)?,
                source: text_at(entry, "source", entry_path)?,
                title: text_at(entry, "title", entry_path)?,
                columns: strings_at(entry, "columns", entry_path)?,
                sort: strings_at(entry, "sort", entry_path)?,
                limit: u32_at(entry, "limit", entry_path)?,
                where_: if entry["where"].is_null() {
                    None
                } else {
                    Some(entry["where"].clone())
                },
            })
        })?,
    })
}

fn semantic_from_json(value: &Value) -> Result<SemanticIr, V2Error> {
    let path = "semantic";
    Ok(SemanticIr {
        schema: text_at(value, "schema", path)?,
        version: u32_at(value, "version", path)?,
        app: AppIr {
            id: text_at(&value["app"], "id", "app")?,
            title: text_at(&value["app"], "title", "app")?,
            subtitle: text_at(&value["app"], "subtitle", "app")?,
            initial: text_at(&value["app"], "initial", "app")?,
        },
        theme: ThemeIr {
            mode: text_at(&value["theme"], "mode", "theme")?,
            accent: text_at(&value["theme"], "accent", "theme")?,
            density: text_at(&value["theme"], "density", "theme")?,
        },
        capabilities: strings_at(value, "capabilities", path)?,
        resources: map_array(value, "resources", path, parse_resource_json)?,
        parameters: map_array(value, "parameters", path, |entry, entry_path| {
            Ok(ParameterIr {
                address: text_at(entry, "address", entry_path)?,
                resource: text_at(entry, "resource", entry_path)?,
                id: text_at(entry, "id", entry_path)?,
                value_type: text_at(entry, "type", entry_path)?,
                value: entry["value"].clone(),
                label: text_at(entry, "label", entry_path)?,
            })
        })?,
        rules: map_array(value, "rules", path, |entry, entry_path| {
            Ok(RuleIr {
                id: text_at(entry, "id", entry_path)?,
                address: text_at(entry, "address", entry_path)?,
                resource: text_at(entry, "resource", entry_path)?,
                field: text_at(entry, "field", entry_path)?,
                from: text_at(entry, "from", entry_path)?,
                to: text_at(entry, "to", entry_path)?,
                since: text_at(entry, "since", entry_path)?,
                after: parse_duration_json(&entry["after"], &format!("{entry_path}.after"))?,
            })
        })?,
        invariants: map_array(value, "invariants", path, parse_invariant_json)?,
        processes: map_array(value, "processes", path, parse_process_json)?,
        overview: if value["overview"].is_null() {
            None
        } else {
            Some(parse_overview_json(&value["overview"], "overview")?)
        },
        extensions: map_array(value, "extensions", path, |entry, entry_path| {
            Ok(ExtensionIr {
                id: text_at(entry, "id", entry_path)?,
                module: text_at(entry, "module", entry_path)?,
                slot: text_at(entry, "slot", entry_path)?,
            })
        })?,
    })
}

pub fn is_v2_source(source: &str) -> bool {
    source
        .lines()
        .map(strip_comment)
        .map(str::trim)
        .find(|line| !line.is_empty())
        == Some("air version=2")
}

#[derive(Debug, Clone)]
struct Declaration {
    kind: String,
    id: Option<String>,
    props: BTreeMap<String, Option<String>>,
    line: usize,
}

fn declaration_path(declaration: &Declaration) -> String {
    match &declaration.id {
        Some(id) => format!("{}.{}", declaration.kind, id),
        None => declaration.kind.clone(),
    }
}

fn strip_comment(line: &str) -> &str {
    let mut quoted = false;
    let mut escaped = false;
    for (offset, character) in line.char_indices() {
        if escaped {
            escaped = false;
        } else if character == '\\' && quoted {
            escaped = true;
        } else if character == '"' {
            quoted = !quoted;
        } else if character == '#' && !quoted {
            return &line[..offset];
        }
    }
    line
}

fn tokenize(line: &str, line_number: usize) -> Result<Vec<String>, V2Error> {
    let mut tokens = Vec::new();
    let mut token = String::new();
    let mut quoted = false;
    let mut escaped = false;
    let mut started = false;
    for character in strip_comment(line).chars() {
        if escaped {
            token.push(match character {
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                '"' => '"',
                '\\' => '\\',
                _ => {
                    return Err(V2Error::new(
                        "AIR_PARSE_ESCAPE",
                        "parse",
                        Some(line_number),
                        None,
                        format!("unsupported escape \\{character}"),
                    ))
                }
            });
            escaped = false;
        } else if character == '\\' && quoted {
            escaped = true;
            started = true;
        } else if character == '"' {
            quoted = !quoted;
            started = true;
        } else if character.is_whitespace() && !quoted {
            if started {
                tokens.push(std::mem::take(&mut token));
                started = false;
            }
        } else {
            token.push(character);
            started = true;
        }
    }
    if quoted || escaped {
        return Err(V2Error::new(
            "AIR_PARSE_UNTERMINATED_STRING",
            "parse",
            Some(line_number),
            None,
            "unterminated quoted string",
        ));
    }
    if started {
        tokens.push(token);
    }
    Ok(tokens)
}

fn allowed_properties(kind: &str) -> &'static [&'static str] {
    match kind {
        "air" => &["version"],
        "app" => &["title", "subtitle", "initial"],
        "theme" => &["mode", "accent", "density"],
        "capability" | "actor" => &[],
        "resource" => &["singular", "plural", "icon", "label"],
        "field" => &[
            "type",
            "label",
            "required",
            "unique",
            "values",
            "ref",
            "default",
            "min",
            "placeholder",
            "long",
            "currency",
        ],
        "manage" => &["create", "edit", "delete", "lifecycle", "page_size"],
        "access" => &["view", "create", "edit", "delete", "archive"],
        "overview" => &["title"],
        "insight" => &[
            "op", "field", "source", "group", "where", "window", "date", "label", "tone",
        ],
        "rule" => &["field", "from", "to", "after", "since"],
        "highlight" => &["when", "tone"],
        "parameter" => &["value", "label"],
        "process" => &["state", "initial", "terminal", "history", "touch"],
        "transition" => &[
            "from",
            "to",
            "action",
            "by",
            "when",
            "automatic",
            "comment",
            "approvals",
            "distinct",
            "separate",
            "event",
            "within",
            "since",
            "unless_event",
        ],
        "invariant" => &["when", "require", "immutable"],
        "deadline" => &["state", "after", "escalation"],
        "extension" => &["module", "slot"],
        _ => &[],
    }
}

fn parse_declarations(source: &str) -> Result<Vec<Declaration>, V2Error> {
    let known: HashSet<&str> = [
        "air",
        "app",
        "theme",
        "capability",
        "resource",
        "actor",
        "field",
        "manage",
        "access",
        "overview",
        "insight",
        "rule",
        "highlight",
        "parameter",
        "process",
        "transition",
        "invariant",
        "deadline",
        "extension",
    ]
    .into_iter()
    .collect();
    let id_kinds: HashSet<&str> = [
        "app",
        "capability",
        "resource",
        "actor",
        "field",
        "manage",
        "access",
        "insight",
        "rule",
        "highlight",
        "parameter",
        "process",
        "transition",
        "invariant",
        "deadline",
        "extension",
    ]
    .into_iter()
    .collect();
    let mut declarations = Vec::new();
    for (index, line) in source.lines().enumerate() {
        let line_number = index + 1;
        let mut tokens = tokenize(line, line_number)?;
        if tokens.is_empty() {
            continue;
        }
        let kind = tokens.remove(0);
        if !known.contains(kind.as_str()) {
            return Err(V2Error::new(
                "AIR_PARSE_UNKNOWN_DECLARATION",
                "parse",
                Some(line_number),
                Some(kind.clone()),
                format!("unknown declaration `{kind}`"),
            ));
        }
        let id = if id_kinds.contains(kind.as_str()) {
            if tokens.first().map_or(true, |value| value.contains('=')) {
                return Err(V2Error::new(
                    "AIR_PARSE_MISSING_ID",
                    "parse",
                    Some(line_number),
                    Some(kind.clone()),
                    format!("`{kind}` requires an ID"),
                ));
            }
            Some(tokens.remove(0))
        } else {
            None
        };
        if let Some(id) = &id {
            let mut chars = id.chars();
            if !matches!(chars.next(), Some('a'..='z'))
                || !chars.all(|character| {
                    character.is_ascii_lowercase()
                        || character.is_ascii_digit()
                        || matches!(character, '_' | '.' | '-')
                })
            {
                return Err(V2Error::new(
                    "AIR_PARSE_INVALID_ID",
                    "parse",
                    Some(line_number),
                    Some(format!("{kind}.{id}")),
                    format!("invalid ID `{id}`"),
                ));
            }
        }
        let mut props = BTreeMap::new();
        if kind == "field" && tokens.first().is_some_and(|value| !value.contains('=')) {
            props.insert("type".into(), Some(tokens.remove(0)));
        }
        for token in tokens {
            let (key, value) = match token.split_once('=') {
                Some((key, value)) if !value.is_empty() => {
                    (key.to_string(), Some(value.to_string()))
                }
                Some((key, _)) => {
                    return Err(V2Error::new(
                        "AIR_VALIDATE_UNKNOWN_PROPERTY",
                        "validate",
                        Some(line_number),
                        id.as_ref().map(|id| format!("{kind}.{id}")),
                        format!("property `{key}` cannot be empty"),
                    ))
                }
                None => (token, None),
            };
            if props.insert(key.clone(), value).is_some() {
                return Err(V2Error::new(
                    "AIR_VALIDATE_UNKNOWN_PROPERTY",
                    "validate",
                    Some(line_number),
                    id.as_ref().map(|id| format!("{kind}.{id}")),
                    format!("duplicate property `{key}`"),
                ));
            }
        }
        for key in props.keys() {
            if !allowed_properties(&kind).contains(&key.as_str()) {
                return Err(V2Error::new(
                    "AIR_VALIDATE_UNKNOWN_PROPERTY",
                    "validate",
                    Some(line_number),
                    id.as_ref().map(|id| format!("{kind}.{id}")),
                    format!("unknown {kind} property `{key}`"),
                ));
            }
        }
        declarations.push(Declaration {
            kind,
            id,
            props,
            line: line_number,
        });
    }
    Ok(declarations)
}

fn string_prop(
    declaration: &Declaration,
    key: &str,
    fallback: Option<&str>,
) -> Result<Option<String>, V2Error> {
    match declaration.props.get(key) {
        None => Ok(fallback.map(str::to_string)),
        Some(Some(value)) => Ok(Some(value.clone())),
        Some(None) => Err(V2Error::new(
            "AIR_VALIDATE_PROPERTY_VALUE",
            "validate",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` requires a value"),
        )),
    }
}

fn required_prop(declaration: &Declaration, key: &str) -> Result<String, V2Error> {
    string_prop(declaration, key, None)?.ok_or_else(|| {
        V2Error::new(
            "AIR_VALIDATE_REQUIRED_PROPERTY",
            "validate",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("`{}` requires {key}=...", declaration.kind),
        )
    })
}

fn bool_prop(declaration: &Declaration, key: &str, fallback: bool) -> Result<bool, V2Error> {
    match declaration.props.get(key) {
        None => Ok(fallback),
        Some(None) => Ok(true),
        Some(Some(value)) if value == "true" => Ok(true),
        Some(Some(value)) if value == "false" => Ok(false),
        _ => Err(V2Error::new(
            "AIR_TYPE_BOOLEAN",
            "type",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` expects true or false"),
        )),
    }
}

fn integer_prop(
    declaration: &Declaration,
    key: &str,
    fallback: Option<u32>,
    minimum: u32,
) -> Result<Option<u32>, V2Error> {
    let Some(raw) = string_prop(declaration, key, None)? else {
        return Ok(fallback);
    };
    let value = raw.parse::<u32>().map_err(|_| {
        V2Error::new(
            "AIR_TYPE_INTEGER",
            "type",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` expects an integer"),
        )
    })?;
    if value < minimum {
        return Err(V2Error::new(
            "AIR_TYPE_INTEGER",
            "type",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` expects >= {minimum}"),
        ));
    }
    Ok(Some(value))
}

fn list_prop(declaration: &Declaration, key: &str) -> Result<Vec<String>, V2Error> {
    let Some(value) = string_prop(declaration, key, None)? else {
        return Ok(Vec::new());
    };
    let result: Vec<String> = value.split(',').map(str::to_string).collect();
    if result.iter().any(String::is_empty) {
        return Err(V2Error::new(
            "AIR_VALIDATE_LIST",
            "validate",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` contains an empty item"),
        ));
    }
    Ok(result)
}

fn owned_id(declaration: &Declaration) -> Result<(String, String), V2Error> {
    let id = declaration.id.as_ref().unwrap();
    let parts: Vec<&str> = id.split('.').collect();
    if parts.len() != 2 || parts.iter().any(|part| part.is_empty()) {
        return Err(V2Error::new(
            "AIR_VALIDATE_OWNED_ID",
            "validate",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("`{}` ID must be owner.local_id", declaration.kind),
        ));
    }
    Ok((parts[0].into(), parts[1].into()))
}

fn title_case(value: &str) -> String {
    value
        .split(|character| character == '_' || character == '-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn singularize(value: &str) -> String {
    if value.ends_with("ies") && value.len() > 3 {
        return format!("{}y", &value[..value.len() - 3]);
    }
    if ["sses", "shes", "ches", "xes"]
        .iter()
        .any(|suffix| value.ends_with(suffix))
    {
        return value[..value.len() - 2].to_string();
    }
    if value.ends_with('s') && !value.ends_with("ss") {
        return value[..value.len() - 1].to_string();
    }
    value.to_string()
}

fn parse_scalar(raw: &str) -> Value {
    if raw == "true" {
        return Value::Boolean(true);
    }
    if raw == "false" {
        return Value::Boolean(false);
    }
    if let Ok(value) = raw.parse::<f64>() {
        if value.is_finite() {
            return Value::from(value);
        }
    }
    Value::String(raw.into())
}

fn scalar_type(value: &Value) -> String {
    match value {
        Value::Number(_) => "number",
        Value::Boolean(_) => "bool",
        _ => "text",
    }
    .into()
}

fn sorted_unique(mut values: Vec<String>) -> Vec<String> {
    values.sort();
    values.dedup();
    values
}

fn tone_at(index: usize) -> String {
    ["violet", "blue", "emerald", "amber"][index % 4].into()
}

fn field_index(resource: &ResourceIr, id: &str) -> Option<usize> {
    resource.fields.iter().position(|field| field.id == id)
}

fn resource_index(resources: &[ResourceIr], id: &str) -> Option<usize> {
    resources.iter().position(|resource| resource.id == id)
}

fn permission_value(declaration: &Declaration, key: &str) -> Result<Value, V2Error> {
    match declaration.props.get(key) {
        None | Some(None) => Ok(Value::Boolean(true)),
        Some(Some(value)) if value == "true" => Ok(Value::Boolean(true)),
        Some(Some(value)) if value == "false" => Ok(Value::Boolean(false)),
        Some(Some(value)) if valid_simple_id(value) => Ok(Value::String(value.clone())),
        _ => Err(V2Error::new(
            "AIR_TYPE_PERMISSION",
            "type",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("property `{key}` expects true, false, or a role ID"),
        )),
    }
}

fn valid_simple_id(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some('a'..='z'))
        && chars.all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '_' | '-')
        })
}

fn policy_from_management(value: &Value) -> PolicyIr {
    let terms = match value {
        Value::Boolean(true) => vec![PolicyTermIr::Any],
        Value::Boolean(false) => Vec::new(),
        Value::String(role) => vec![PolicyTermIr::Role { role: role.clone() }],
        _ => Vec::new(),
    };
    PolicyIr { any_of: terms }
}

fn resolve_reference_path(
    raw: &str,
    declaration: &Declaration,
    resource_id: &str,
    resources: &[ResourceIr],
    actors: &HashSet<String>,
) -> Result<(Vec<ReferenceStepIr>, String), V2Error> {
    let mut current_id = resource_id.to_string();
    let mut steps = Vec::new();
    for segment in raw.split('.') {
        let Some(resource) = resources.iter().find(|resource| resource.id == current_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("unknown path resource `{current_id}`"),
            ));
        };
        let Some(field) = resource.fields.iter().find(|field| field.id == segment) else {
            return Err(V2Error::new(
                "AIR_REF_INVALID_ACTOR_PATH",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!(
                    "actor path requires reference field `{}.{segment}`",
                    resource.id
                ),
            ));
        };
        if field.value_type != "ref" {
            return Err(V2Error::new(
                "AIR_REF_INVALID_ACTOR_PATH",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!(
                    "actor path requires reference field `{}.{segment}`",
                    resource.id
                ),
            ));
        }
        let target = field.reference.clone().unwrap();
        steps.push(ReferenceStepIr {
            field: segment.into(),
            reference: target.clone(),
        });
        current_id = target;
    }
    if !actors.contains(&current_id) {
        return Err(V2Error::new(
            "AIR_REF_INVALID_ACTOR_PATH",
            "resolve",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("path `{resource_id}.{raw}` must end at an actor resource"),
        ));
    }
    Ok((steps, current_id))
}

fn canonical_policy_sort(policy: &mut PolicyIr) {
    policy.any_of.sort_by_key(|term| format!("{term:?}"));
    policy.any_of.dedup_by(|left, right| left == right);
}

fn parse_policy(
    raw: Option<&str>,
    declaration: &Declaration,
    resource_id: &str,
    resources: &[ResourceIr],
    actors: &HashSet<String>,
    allow_system: bool,
) -> Result<PolicyIr, V2Error> {
    let raw = raw.unwrap_or("true");
    if raw == "true" {
        return Ok(PolicyIr {
            any_of: vec![PolicyTermIr::Any],
        });
    }
    if raw == "false" {
        return Ok(PolicyIr { any_of: Vec::new() });
    }
    if raw == "system" {
        if allow_system {
            return Ok(PolicyIr {
                any_of: vec![PolicyTermIr::System],
            });
        }
        return Err(V2Error::new(
            "AIR_REF_INVALID_AUTHORITY",
            "resolve",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            "system is not an access principal",
        ));
    }
    let mut terms = Vec::new();
    for term in raw.split('|') {
        if term == "self" {
            if !actors.contains(resource_id) {
                return Err(V2Error::new(
                    "AIR_REF_INVALID_ACTOR_PATH",
                    "resolve",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("self policy requires actor resource `{resource_id}`"),
                ));
            }
            terms.push(PolicyTermIr::Self_ {
                actor: resource_id.into(),
            });
            continue;
        }
        let Some((kind, value)) = term.split_once(':') else {
            return Err(V2Error::new(
                "AIR_REF_INVALID_POLICY",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("invalid access term `{term}`"),
            ));
        };
        match kind {
            "role" if valid_simple_id(value) => {
                terms.push(PolicyTermIr::Role { role: value.into() })
            }
            "owner" => {
                let (path, actor) =
                    resolve_reference_path(value, declaration, resource_id, resources, actors)?;
                terms.push(PolicyTermIr::Owner { actor, path });
            }
            _ => {
                return Err(V2Error::new(
                    "AIR_REF_INVALID_POLICY",
                    "resolve",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("unknown access term `{kind}`"),
                ))
            }
        }
    }
    let mut policy = PolicyIr { any_of: terms };
    canonical_policy_sort(&mut policy);
    Ok(policy)
}

fn term_type(term: &ConditionTermIr) -> (&str, Option<&str>) {
    match term {
        ConditionTermIr::Literal {
            value_type,
            currency,
            ..
        }
        | ConditionTermIr::Parameter {
            value_type,
            currency,
            ..
        }
        | ConditionTermIr::Path {
            value_type,
            currency,
            ..
        } => (value_type, currency.as_deref()),
    }
}

fn numeric_type(value_type: &str) -> bool {
    matches!(value_type, "number" | "money")
}

fn parse_operand(
    raw: &str,
    side: &str,
    declaration: &Declaration,
    resource_id: &str,
    resources: &[ResourceIr],
    parameters: &[ParameterIr],
) -> Result<OperandIr, V2Error> {
    let parts: Vec<&str> = raw.split('+').collect();
    if parts.iter().any(|part| part.is_empty()) {
        return Err(V2Error::new(
            "AIR_PARSE_CONDITION",
            "parse",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("invalid condition operand `{raw}`"),
        ));
    }
    let mut terms = Vec::new();
    for part in parts {
        if let Some(id) = part.strip_prefix('@') {
            let Some(parameter) = parameters
                .iter()
                .find(|parameter| parameter.resource == resource_id && parameter.id == id)
            else {
                return Err(V2Error::new(
                    "AIR_REF_UNKNOWN_PARAMETER",
                    "resolve",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("condition references unknown parameter `{resource_id}.{id}`"),
                ));
            };
            terms.push(ConditionTermIr::Parameter {
                id: id.into(),
                value_type: parameter.value_type.clone(),
                value: parameter.value.clone(),
                currency: None,
            });
            continue;
        }
        let scalar = parse_scalar(part);
        if !matches!(&scalar, Value::String(value) if value == part) {
            terms.push(ConditionTermIr::Literal {
                value_type: scalar_type(&scalar),
                value: scalar,
                currency: None,
                reference: None,
            });
            continue;
        }
        let segments: Vec<&str> = part.split('.').collect();
        let mut current_id = resource_id.to_string();
        let mut path = Vec::new();
        let mut final_field: Option<&FieldIr> = None;
        for (index, segment) in segments.iter().enumerate() {
            let resource = resources
                .iter()
                .find(|resource| resource.id == current_id)
                .unwrap();
            let Some(field) = resource.fields.iter().find(|field| field.id == *segment) else {
                if side == "right" && segments.len() == 1 {
                    terms.push(ConditionTermIr::Literal {
                        value_type: "text".into(),
                        value: Value::String(part.into()),
                        currency: None,
                        reference: None,
                    });
                    final_field = None;
                    break;
                }
                return Err(V2Error::new(
                    "AIR_REF_UNKNOWN_FIELD",
                    "resolve",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!(
                        "condition references unknown field `{}.{segment}`",
                        resource.id
                    ),
                ));
            };
            path.push(ConditionPathStepIr {
                resource: resource.id.clone(),
                field: field.id.clone(),
                reference: field.reference.clone(),
                computed: field.computed.is_some(),
            });
            final_field = Some(field);
            if index + 1 < segments.len() {
                if field.value_type != "ref" {
                    return Err(V2Error::new(
                        "AIR_REF_UNKNOWN_FIELD",
                        "resolve",
                        Some(declaration.line),
                        Some(declaration_path(declaration)),
                        format!("condition path `{part}` crosses non-reference field"),
                    ));
                }
                current_id = field.reference.clone().unwrap();
            }
        }
        if let Some(field) = final_field {
            terms.push(ConditionTermIr::Path {
                value_type: field.value_type.clone(),
                currency: field.currency.clone(),
                reference: field.reference.clone(),
                path,
            });
        }
    }
    let (value_type, currency) = if terms.len() == 1 {
        let (value_type, currency) = term_type(&terms[0]);
        (value_type.to_string(), currency.map(str::to_string))
    } else {
        if terms.iter().any(|term| !numeric_type(term_type(term).0)) {
            return Err(V2Error::new(
                "AIR_TYPE_CONDITION_MISMATCH",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("condition numeric operand `{raw}` contains non-numeric terms"),
            ));
        }
        let currencies: BTreeSet<String> = terms
            .iter()
            .filter_map(|term| {
                let (kind, currency) = term_type(term);
                (kind == "money")
                    .then(|| currency.map(str::to_string))
                    .flatten()
            })
            .collect();
        if currencies.len() > 1 {
            return Err(V2Error::new(
                "AIR_TYPE_CONDITION_MISMATCH",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "condition combines different currencies",
            ));
        }
        (
            if terms.iter().any(|term| term_type(term).0 == "money") {
                "money"
            } else {
                "number"
            }
            .into(),
            currencies.into_iter().next(),
        )
    };
    Ok(OperandIr {
        value_type,
        currency,
        terms,
    })
}

fn promote_literal(
    operand: &mut OperandIr,
    other: &OperandIr,
    declaration: &Declaration,
    resources: &[ResourceIr],
) -> Result<(), V2Error> {
    if operand.value_type != "text"
        || operand.terms.len() != 1
        || !matches!(
            other.value_type.as_str(),
            "text" | "email" | "phone" | "enum" | "date" | "ref"
        )
    {
        return Ok(());
    }
    let ConditionTermIr::Literal {
        value_type,
        value,
        reference,
        ..
    } = &mut operand.terms[0]
    else {
        return Ok(());
    };
    let Value::String(text) = value else {
        return Ok(());
    };
    if other.value_type == "date"
        && !(text.len() == 10 && text.as_bytes()[4] == b'-' && text.as_bytes()[7] == b'-')
    {
        return Err(V2Error::new(
            "AIR_TYPE_CONDITION_MISMATCH",
            "type",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            "condition date literal must use YYYY-MM-DD",
        ));
    }
    if other.value_type == "enum" {
        if let Some(ConditionTermIr::Path { path, .. }) = other.terms.first() {
            let final_step = path.last().unwrap();
            let values = resources
                .iter()
                .find(|resource| resource.id == final_step.resource)
                .and_then(|resource| {
                    resource
                        .fields
                        .iter()
                        .find(|field| field.id == final_step.field)
                })
                .map(|field| &field.values)
                .unwrap();
            if !values.iter().any(|value| value == text) {
                return Err(V2Error::new(
                    "AIR_TYPE_CONDITION_MISMATCH",
                    "type",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("condition enum literal `{text}` is outside the declared values"),
                ));
            }
        }
    }
    *value_type = other.value_type.clone();
    if let Some(ConditionTermIr::Path {
        reference: other_ref,
        ..
    }) = other.terms.first()
    {
        *reference = other_ref.clone();
    }
    operand.value_type = other.value_type.clone();
    Ok(())
}

fn comparison_parts(raw: &str) -> Option<(&str, &str, &str)> {
    for (index, _) in raw.char_indices().skip(1) {
        for operator in [">=", "<=", "==", "!=", ">", "<"] {
            if raw[index..].starts_with(operator) {
                let right = &raw[index + operator.len()..];
                if !right.is_empty() {
                    return Some((&raw[..index], operator, right));
                }
            }
        }
    }
    None
}

fn numeric_literal_value(operand: &OperandIr) -> Option<f64> {
    if operand.terms.len() != 1 {
        return None;
    }
    match &operand.terms[0] {
        ConditionTermIr::Literal { value, .. } | ConditionTermIr::Parameter { value, .. } => {
            value.as_f64()
        }
        _ => None,
    }
}

fn path_key(operand: &OperandIr) -> Option<String> {
    if operand.terms.len() != 1 {
        return None;
    }
    match &operand.terms[0] {
        ConditionTermIr::Path { path, .. } => Some(
            path.iter()
                .map(|step| step.field.as_str())
                .collect::<Vec<_>>()
                .join("."),
        ),
        _ => None,
    }
}

fn parse_condition(
    raw: &str,
    declaration: &Declaration,
    resource_id: &str,
    resources: &[ResourceIr],
    parameters: &[ParameterIr],
) -> Result<ConditionIr, V2Error> {
    if raw == "true" {
        return Ok(ConditionIr::Constant { value: true });
    }
    if raw == "false" {
        return Ok(ConditionIr::Constant { value: false });
    }
    let normalized = if raw.matches(':').count() == 1
        && !raw
            .chars()
            .any(|character| matches!(character, '|' | '&' | '>' | '<' | '=' | '!'))
    {
        raw.replacen(':', "==", 1)
    } else {
        raw.to_string()
    };
    let mut alternatives = Vec::new();
    for alternative in normalized.split('|') {
        if alternative.is_empty() {
            return Err(V2Error::new(
                "AIR_PARSE_CONDITION",
                "parse",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "condition has an empty alternative",
            ));
        }
        let mut clauses = Vec::new();
        for raw_clause in alternative.split('&') {
            let Some((left_raw, operator, right_raw)) = comparison_parts(raw_clause) else {
                return Err(V2Error::new(
                    "AIR_PARSE_CONDITION",
                    "parse",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("condition clause `{raw_clause}` requires a comparison"),
                ));
            };
            let mut left = parse_operand(
                left_raw,
                "left",
                declaration,
                resource_id,
                resources,
                parameters,
            )?;
            let mut right = parse_operand(
                right_raw,
                "right",
                declaration,
                resource_id,
                resources,
                parameters,
            )?;
            promote_literal(&mut left, &right, declaration, resources)?;
            promote_literal(&mut right, &left, declaration, resources)?;
            let numeric = numeric_type(&left.value_type) && numeric_type(&right.value_type);
            let equality = matches!(operator, "==" | "!=");
            let value_type = if numeric {
                if left.value_type == "money"
                    && right.value_type == "money"
                    && left.currency.is_some()
                    && right.currency.is_some()
                    && left.currency != right.currency
                {
                    return Err(V2Error::new(
                        "AIR_TYPE_CONDITION_MISMATCH",
                        "type",
                        Some(declaration.line),
                        Some(declaration_path(declaration)),
                        "condition compares different currencies",
                    ));
                }
                if left.value_type == "money" || right.value_type == "money" {
                    "money"
                } else {
                    "number"
                }
            } else if left.value_type == right.value_type && (equality || left.value_type == "date")
            {
                if !equality && left.value_type != "date" {
                    return Err(V2Error::new(
                        "AIR_TYPE_CONDITION_MISMATCH",
                        "type",
                        Some(declaration.line),
                        Some(declaration_path(declaration)),
                        format!("operator `{operator}` requires numeric or date operands"),
                    ));
                }
                left.value_type.as_str()
            } else {
                return Err(V2Error::new(
                    "AIR_TYPE_CONDITION_MISMATCH",
                    "type",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!(
                        "condition requires compatible operands, found {} and {}",
                        left.value_type, right.value_type
                    ),
                ));
            }
            .to_string();
            clauses.push(ClauseIr {
                left,
                operator: operator.into(),
                right,
                value_type,
            });
        }
        let mut bounds: HashMap<String, (f64, f64)> = HashMap::new();
        for clause in &clauses {
            let (Some(key), Some(value)) =
                (path_key(&clause.left), numeric_literal_value(&clause.right))
            else {
                continue;
            };
            let entry = bounds
                .entry(key.clone())
                .or_insert((f64::NEG_INFINITY, f64::INFINITY));
            match clause.operator.as_str() {
                ">" => entry.0 = entry.0.max(value + f64::EPSILON),
                ">=" => entry.0 = entry.0.max(value),
                "<" => entry.1 = entry.1.min(value - f64::EPSILON),
                "<=" => entry.1 = entry.1.min(value),
                "==" => {
                    entry.0 = entry.0.max(value);
                    entry.1 = entry.1.min(value);
                }
                _ => {}
            }
            if entry.0 > entry.1 {
                return Err(V2Error::new(
                    "AIR_PROCESS_CONTRADICTORY_GUARD",
                    "process",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("condition contains contradictory bounds for `{key}`"),
                ));
            }
        }
        clauses.sort_by_key(|clause| format!("{clause:?}"));
        alternatives.push(clauses);
    }
    alternatives.sort_by_key(|clauses| format!("{clauses:?}"));
    Ok(ConditionIr::Or { alternatives })
}

fn parse_duration(
    raw: &str,
    business: bool,
    declaration: &Declaration,
) -> Result<DurationIr, V2Error> {
    let unit = if business && raw.ends_with("bd") {
        "bd"
    } else if raw.ends_with('d') {
        "d"
    } else if raw.ends_with('h') {
        "h"
    } else {
        ""
    };
    let digits = raw.strip_suffix(unit).unwrap_or(raw);
    let amount = digits.parse::<u32>().unwrap_or(0);
    if unit.is_empty() || amount == 0 || (!business && unit == "bd") {
        return Err(V2Error::new(
            "AIR_VALIDATE_DURATION",
            "validate",
            Some(declaration.line),
            Some(declaration_path(declaration)),
            format!("invalid duration `{raw}`"),
        ));
    }
    Ok(DurationIr {
        amount,
        unit: unit.into(),
    })
}

fn infer_columns(resource: &ResourceIr) -> Vec<String> {
    let mut selected = vec![resource.label_field.clone()];
    let predicates: [fn(&FieldIr) -> bool; 5] = [
        |field| matches!(field.value_type.as_str(), "email" | "ref"),
        |field| field.value_type == "enum",
        |field| numeric_type(&field.value_type),
        |field| field.value_type == "date",
        |field| field.value_type == "phone" || (field.value_type == "text" && !field.long),
    ];
    for predicate in predicates {
        for field in &resource.fields {
            if selected.len() >= 6 {
                return selected;
            }
            if !selected.contains(&field.id) && predicate(field) {
                selected.push(field.id.clone());
            }
        }
    }
    selected
}

fn infer_sort(resource: &ResourceIr) -> Vec<String> {
    let mut values = vec![resource.label_field.clone()];
    for field in &resource.fields {
        let value = if field.value_type == "date" {
            Some(format!("-{}", field.id))
        } else if field.id != resource.label_field
            && (field.value_type == "enum" || numeric_type(&field.value_type))
        {
            Some(field.id.clone())
        } else {
            None
        };
        if let Some(value) = value {
            if !values.contains(&value) {
                values.push(value);
            }
        }
    }
    values
}

pub fn compile_v2(source: &str) -> Result<V2Program, V2Error> {
    compile_v2_with_extensions(source, &[])
}

pub fn compile_v2_with_extensions(
    source: &str,
    allowed_extensions: &[&str],
) -> Result<V2Program, V2Error> {
    let declarations = parse_declarations(source)?;
    let mut singleton_seen = HashSet::new();
    for declaration in &declarations {
        if matches!(declaration.kind.as_str(), "air" | "theme" | "overview")
            && !singleton_seen.insert(declaration.kind.clone())
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("only one `{}` declaration is allowed", declaration.kind),
            ));
        }
    }
    let air = declarations
        .iter()
        .find(|declaration| declaration.kind == "air")
        .ok_or_else(|| {
            V2Error::new(
                "AIR_VALIDATE_VERSION",
                "validate",
                None,
                None,
                "missing `air version=2` declaration",
            )
        })?;
    if integer_prop(air, "version", None, 1)? != Some(2) {
        return Err(V2Error::new(
            "AIR_VALIDATE_VERSION",
            "validate",
            Some(air.line),
            Some("air".into()),
            "unsupported AIR version",
        ));
    }
    let app_declarations: Vec<&Declaration> = declarations
        .iter()
        .filter(|declaration| declaration.kind == "app")
        .collect();
    if app_declarations.len() != 1 {
        return Err(V2Error::new(
            "AIR_VALIDATE_DUPLICATE_ID",
            "validate",
            app_declarations.get(1).map(|declaration| declaration.line),
            Some("app".into()),
            if app_declarations.is_empty() {
                "missing `app` declaration"
            } else {
                "only one `app` declaration is allowed"
            },
        ));
    }
    let app_declaration = app_declarations[0];
    let app_id = app_declaration.id.clone().unwrap();
    let app_title = string_prop(app_declaration, "title", Some(&title_case(&app_id)))?.unwrap();
    let app_subtitle = string_prop(app_declaration, "subtitle", Some(""))?.unwrap();
    let explicit_initial = string_prop(app_declaration, "initial", None)?;

    let mut theme = ThemeIr {
        mode: "system".into(),
        accent: "violet".into(),
        density: "comfortable".into(),
    };
    if let Some(declaration) = declarations
        .iter()
        .find(|declaration| declaration.kind == "theme")
    {
        theme.mode = string_prop(declaration, "mode", Some("system"))?.unwrap();
        theme.accent = string_prop(declaration, "accent", Some("violet"))?.unwrap();
        theme.density = string_prop(declaration, "density", Some("comfortable"))?.unwrap();
        if !["light", "dark", "system"].contains(&theme.mode.as_str())
            || !["violet", "blue", "emerald", "rose", "amber"].contains(&theme.accent.as_str())
            || !["compact", "comfortable"].contains(&theme.density.as_str())
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_THEME",
                "validate",
                Some(declaration.line),
                Some("theme".into()),
                "invalid theme value",
            ));
        }
    }

    let mut capabilities = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "capability")
    {
        let id = declaration.id.clone().unwrap();
        if id != "storage.local" && !id.starts_with("extension.load.") {
            return Err(V2Error::new(
                "AIR_VALIDATE_CAPABILITY",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("unsupported capability `{id}`"),
            ));
        }
        if capabilities.contains(&id) {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("duplicate capability `{id}`"),
            ));
        }
        capabilities.push(id);
    }
    capabilities.sort();

    let mut resources = Vec::new();
    let mut resource_lines = HashMap::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "resource")
    {
        let id = declaration.id.clone().unwrap();
        if resource_index(&resources, &id).is_some() {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("duplicate resource ID `{id}`"),
            ));
        }
        resource_lines.insert(id.clone(), declaration.line);
        resources.push(ResourceIr {
            id: id.clone(),
            singular: string_prop(
                declaration,
                "singular",
                Some(&title_case(&singularize(&id))),
            )?
            .unwrap(),
            plural: string_prop(declaration, "plural", Some(&title_case(&id)))?.unwrap(),
            icon: string_prop(declaration, "icon", Some("collection"))?.unwrap(),
            label_field: string_prop(declaration, "label", None)?.unwrap_or_default(),
            actor: false,
            fields: Vec::new(),
            management: None,
            access: None,
            experience: None,
            highlights: Vec::new(),
        });
    }

    let field_types = [
        "text", "email", "phone", "enum", "date", "ref", "number", "money", "bool",
    ];
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "field")
    {
        let (owner, id) = owned_id(declaration)?;
        let Some(resource_position) = resource_index(&resources, &owner) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("field owner `{owner}` is not a resource"),
            ));
        };
        if field_index(&resources[resource_position], &id).is_some() {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("duplicate field ID `{id}`"),
            ));
        }
        let value_type = string_prop(declaration, "type", None)?
            .or_else(|| declaration.props.contains_key("ref").then(|| "ref".into()))
            .ok_or_else(|| {
                V2Error::new(
                    "AIR_VALIDATE_REQUIRED_PROPERTY",
                    "validate",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "field requires a type",
                )
            })?;
        if !field_types.contains(&value_type.as_str()) {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("unknown field type `{value_type}`"),
            ));
        }
        let values = list_prop(declaration, "values")?;
        let reference = string_prop(declaration, "ref", None)?;
        let currency = string_prop(declaration, "currency", None)?;
        let long = bool_prop(declaration, "long", false)?;
        if value_type == "enum" && values.is_empty() || value_type != "enum" && !values.is_empty() {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "enum fields require values and other fields reject them",
            ));
        }
        if value_type == "ref" && reference.is_none() || value_type != "ref" && reference.is_some()
        {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "reference fields require ref and other fields reject it",
            ));
        }
        if let Some(target) = &reference {
            if resource_index(&resources, target).is_none() {
                return Err(V2Error::new(
                    "AIR_REF_UNKNOWN_RESOURCE",
                    "resolve",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    format!("unknown referenced resource `{target}`"),
                ));
            }
        }
        if value_type == "money" && currency.is_none()
            || value_type != "money" && currency.is_some()
        {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "money fields require currency and other fields reject it",
            ));
        }
        if let Some(currency) = &currency {
            if currency.len() != 3
                || !currency
                    .chars()
                    .all(|character| character.is_ascii_uppercase())
            {
                return Err(V2Error::new(
                    "AIR_TYPE_FIELD",
                    "type",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "currency expects three uppercase letters",
                ));
            }
        }
        if long && value_type != "text" {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "only text fields accept long",
            ));
        }
        resources[resource_position].fields.push(FieldIr {
            id: id.clone(),
            value_type,
            label: string_prop(declaration, "label", Some(&title_case(&id)))?.unwrap(),
            required: bool_prop(declaration, "required", false)?,
            unique: bool_prop(declaration, "unique", false)?,
            values,
            reference,
            default: string_prop(declaration, "default", None)?,
            min: integer_prop(declaration, "min", Some(0), 0)?.unwrap(),
            placeholder: string_prop(declaration, "placeholder", Some(""))?.unwrap(),
            long,
            currency,
            computed: None,
            read_only: false,
        });
    }
    for resource in &mut resources {
        if resource.fields.is_empty() {
            return Err(V2Error::new(
                "AIR_VALIDATE_RESOURCE_EMPTY",
                "validate",
                resource_lines.get(&resource.id).copied(),
                Some(format!("resource.{}", resource.id)),
                format!("resource `{}` has no fields", resource.id),
            ));
        }
        if resource.label_field.is_empty() {
            resource.label_field = resource
                .fields
                .iter()
                .find(|field| field.value_type == "text" && !field.long)
                .or_else(|| {
                    resource
                        .fields
                        .iter()
                        .find(|field| field.value_type == "email")
                })
                .unwrap_or(&resource.fields[0])
                .id
                .clone();
        }
        if field_index(resource, &resource.label_field).is_none() {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                None,
                None,
                format!(
                    "resource `{}` has unknown label field `{}`",
                    resource.id, resource.label_field
                ),
            ));
        }
    }

    let mut actors = HashSet::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "actor")
    {
        let id = declaration.id.clone().unwrap();
        let Some(index) = resource_index(&resources, &id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("actor target `{id}` is not a resource"),
            ));
        };
        if !actors.insert(id.clone()) {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("duplicate actor resource `{id}`"),
            ));
        }
        resources[index].actor = true;
    }

    let mut parameters = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "parameter")
    {
        let (resource, id) = owned_id(declaration)?;
        if resource_index(&resources, &resource).is_none() {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("parameter owner `{resource}` is not a resource"),
            ));
        }
        if parameters
            .iter()
            .any(|parameter: &ParameterIr| parameter.resource == resource && parameter.id == id)
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "duplicate parameter ID",
            ));
        }
        let raw = required_prop(declaration, "value")?;
        let value = parse_scalar(&raw);
        parameters.push(ParameterIr {
            address: format!("{resource}.{id}"),
            resource,
            id: id.clone(),
            value_type: scalar_type(&value),
            value,
            label: string_prop(declaration, "label", Some(&title_case(&id)))?.unwrap(),
        });
    }

    let mut managed_ids = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "manage")
    {
        let id = declaration.id.clone().unwrap();
        let Some(index) = resource_index(&resources, &id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("manage target `{id}` is not a resource"),
            ));
        };
        if resources[index].management.is_some() {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "duplicate manage ID",
            ));
        }
        let lifecycle = string_prop(declaration, "lifecycle", Some("delete"))?.unwrap();
        if !matches!(lifecycle.as_str(), "delete" | "archive") {
            return Err(V2Error::new(
                "AIR_VALIDATE_LIFECYCLE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "manage lifecycle expects delete or archive",
            ));
        }
        let page_size = integer_prop(declaration, "page_size", None, 1)?
            .unwrap_or(if theme.density == "compact" { 12 } else { 8 });
        let management = ManagementIr {
            create: permission_value(declaration, "create")?,
            edit: permission_value(declaration, "edit")?,
            delete: permission_value(declaration, "delete")?,
            lifecycle,
            page_size,
        };
        let access = AccessIr {
            view: PolicyIr {
                any_of: vec![PolicyTermIr::Any],
            },
            create: policy_from_management(&management.create),
            edit: policy_from_management(&management.edit),
            delete: policy_from_management(&management.delete),
            archive: policy_from_management(&management.delete),
        };
        resources[index].management = Some(management);
        resources[index].access = Some(access);
        managed_ids.push(id);
    }
    if managed_ids.is_empty() {
        return Err(V2Error::new(
            "AIR_VALIDATE_NO_MANAGEMENT",
            "validate",
            None,
            None,
            "application has no managed resources",
        ));
    }

    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "access")
    {
        let id = declaration.id.clone().unwrap();
        let Some(index) = resource_index(&resources, &id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("access target `{id}` is not a resource"),
            ));
        };
        if resources[index].management.is_none() {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("access target `{id}` is not managed"),
            ));
        }
        let mut updates = Vec::new();
        for (action, value) in &declaration.props {
            let raw = value.as_deref().unwrap_or("true");
            updates.push((
                action.clone(),
                parse_policy(Some(raw), declaration, &id, &resources, &actors, false)?,
            ));
        }
        let access = resources[index].access.as_mut().unwrap();
        for (action, policy) in updates {
            match action.as_str() {
                "view" => access.view = policy,
                "create" => access.create = policy,
                "edit" => access.edit = policy,
                "delete" => access.delete = policy,
                "archive" => access.archive = policy,
                _ => unreachable!(),
            }
        }
    }

    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "highlight")
    {
        let (owner, id) = owned_id(declaration)?;
        let Some(index) = resource_index(&resources, &owner) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "highlight owner is not a resource",
            ));
        };
        let predicate = required_prop(declaration, "when")?;
        let Some((field, value)) = predicate.split_once(':') else {
            return Err(V2Error::new(
                "AIR_PARSE_CONDITION",
                "parse",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "highlight when expects field:value",
            ));
        };
        if field_index(&resources[index], field).is_none() {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "highlight references unknown field",
            ));
        }
        let tone = string_prop(declaration, "tone", Some("accent"))?.unwrap();
        if !["accent", "positive", "warning", "danger", "neutral"].contains(&tone.as_str()) {
            return Err(V2Error::new(
                "AIR_VALIDATE_HIGHLIGHT",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "unknown highlight tone",
            ));
        }
        resources[index].highlights.push(HighlightIr {
            id,
            field: field.into(),
            value: value.into(),
            tone,
        });
    }

    let mut rules = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "rule")
    {
        let (owner, id) = owned_id(declaration)?;
        let Some(index) = resource_index(&resources, &owner) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "rule owner is not a resource",
            ));
        };
        let field_id = required_prop(declaration, "field")?;
        let since = required_prop(declaration, "since")?;
        let Some(field_position) = field_index(&resources[index], &field_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "rule references unknown field",
            ));
        };
        if resources[index]
            .fields
            .iter()
            .find(|field| field.id == since)
            .is_none_or(|field| field.value_type != "date")
        {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "rule since must reference a date field",
            ));
        }
        let from = required_prop(declaration, "from")?;
        let to = required_prop(declaration, "to")?;
        let field = &mut resources[index].fields[field_position];
        if field.value_type == "enum" {
            if !field.values.contains(&from) {
                return Err(V2Error::new(
                    "AIR_TYPE_ENUM",
                    "type",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "rule from value is outside enum",
                ));
            }
            if !field.values.contains(&to) {
                field.values.push(to.clone());
            }
        }
        rules.push(RuleIr {
            id,
            address: declaration.id.clone().unwrap(),
            resource: owner,
            field: field_id,
            from,
            to,
            since,
            after: parse_duration(&required_prop(declaration, "after")?, false, declaration)?,
        });
    }

    // Relationship-grouped insights are inferred read-only owner fields before
    // conditions and processes are resolved so their paths are type-checkable.
    for declaration in declarations.iter().filter(|declaration| {
        declaration.kind == "insight" && declaration.props.contains_key("source")
    }) {
        let (owner_id, id) = owned_id(declaration)?;
        let Some(owner_index) = resource_index(&resources, &owner_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight owner is not a resource",
            ));
        };
        let source_id = required_prop(declaration, "source")?;
        let Some(source_index) = resource_index(&resources, &source_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight source is not a resource",
            ));
        };
        let group = required_prop(declaration, "group")?;
        let Some(group_field) = resources[source_index]
            .fields
            .iter()
            .find(|field| field.id == group)
        else {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight group field is missing",
            ));
        };
        if group_field.value_type != "ref"
            || group_field.reference.as_deref() != Some(owner_id.as_str())
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight group must reference owner",
            ));
        }
        let operation = string_prop(declaration, "op", Some("count"))?.unwrap();
        let aggregate_field_id = string_prop(declaration, "field", None)?;
        let aggregate_field = aggregate_field_id.as_ref().and_then(|id| {
            resources[source_index]
                .fields
                .iter()
                .find(|field| field.id == *id)
        });
        if !["count", "sum", "average"].contains(&operation.as_str())
            || operation != "count"
                && aggregate_field.is_none_or(|field| !numeric_type(&field.value_type))
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "aggregate operation requires a numeric field",
            ));
        }
        let where_raw = string_prop(declaration, "where", None)?;
        let condition = where_raw
            .as_ref()
            .map(|raw| parse_condition(raw, declaration, &source_id, &resources, &parameters))
            .transpose()?;
        let window = string_prop(declaration, "window", None)?;
        let date = string_prop(declaration, "date", None)?;
        if window.as_deref().is_some_and(|value| value != "month")
            || window.is_some()
                && date
                    .as_ref()
                    .and_then(|id| {
                        resources[source_index]
                            .fields
                            .iter()
                            .find(|field| field.id == *id)
                    })
                    .is_none_or(|field| field.value_type != "date")
            || window.is_none() && date.is_some()
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invalid aggregate window/date",
            ));
        }
        let field_type = if aggregate_field.is_some_and(|field| field.value_type == "money") {
            "money"
        } else {
            "number"
        };
        let currency = aggregate_field.and_then(|field| field.currency.clone());
        if field_index(&resources[owner_index], &id).is_some() {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight conflicts with field",
            ));
        }
        resources[owner_index].fields.push(FieldIr {
            id: id.clone(),
            value_type: field_type.into(),
            label: string_prop(declaration, "label", Some(&title_case(&id)))?.unwrap(),
            required: false,
            unique: false,
            values: Vec::new(),
            reference: None,
            default: None,
            min: 0,
            placeholder: String::new(),
            long: false,
            currency,
            computed: Some(ComputedIr::Aggregate {
                operation,
                source: source_id,
                group,
                field: aggregate_field_id,
                where_: condition,
                window,
                date,
            }),
            read_only: true,
        });
    }

    let mut processes = Vec::new();
    let mut process_lines = HashMap::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "process")
    {
        let resource_id = declaration.id.clone().unwrap();
        let Some(resource_position) = resource_index(&resources, &resource_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process target is not a resource",
            ));
        };
        if processes
            .iter()
            .any(|process: &ProcessIr| process.resource == resource_id)
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "duplicate process",
            ));
        }
        let state_id = required_prop(declaration, "state")?;
        let Some(state_position) = field_index(&resources[resource_position], &state_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process state field is missing",
            ));
        };
        if resources[resource_position].fields[state_position].value_type != "enum" {
            return Err(V2Error::new(
                "AIR_TYPE_FIELD",
                "type",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process state must be enum",
            ));
        }
        let initial = required_prop(declaration, "initial")?;
        let states = resources[resource_position].fields[state_position]
            .values
            .clone();
        if !states.contains(&initial) {
            return Err(V2Error::new(
                "AIR_PROCESS_UNKNOWN_STATE",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process initial state is outside enum",
            ));
        }
        let terminal = sorted_unique(list_prop(declaration, "terminal")?);
        if terminal.iter().any(|state| !states.contains(state)) {
            return Err(V2Error::new(
                "AIR_PROCESS_UNKNOWN_STATE",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process terminal state is outside enum",
            ));
        }
        let touch = string_prop(declaration, "touch", None)?;
        if touch.as_ref().is_some_and(|id| {
            resources[resource_position]
                .fields
                .iter()
                .find(|field| field.id == *id)
                .is_none_or(|field| field.value_type != "date")
        }) {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_FIELD",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "process touch must reference date field",
            ));
        }
        if resources[resource_position].fields[state_position]
            .default
            .is_none()
        {
            resources[resource_position].fields[state_position].default = Some(initial.clone());
        }
        process_lines.insert(resource_id.clone(), declaration.line);
        processes.push(ProcessIr {
            resource: resource_id,
            state: state_id,
            initial,
            states,
            terminal,
            history: bool_prop(declaration, "history", false)?,
            touch,
            transitions: Vec::new(),
            deadlines: Vec::new(),
        });
    }

    let mut transition_addresses = HashSet::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "transition")
    {
        let (resource_id, id) = owned_id(declaration)?;
        let Some(process_position) = processes
            .iter()
            .position(|process| process.resource == resource_id)
        else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "transition owner has no process",
            ));
        };
        if !transition_addresses.insert(declaration.id.clone().unwrap()) {
            return Err(V2Error::new(
                "AIR_VALIDATE_DUPLICATE_ID",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "duplicate transition ID",
            ));
        }
        let from = sorted_unique(list_prop(declaration, "from")?);
        if from.is_empty() {
            return Err(V2Error::new(
                "AIR_PROCESS_UNKNOWN_STATE",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "transition requires from",
            ));
        }
        let to = required_prop(declaration, "to")?;
        if from
            .iter()
            .chain(std::iter::once(&to))
            .any(|state| !processes[process_position].states.contains(state))
        {
            return Err(V2Error::new(
                "AIR_PROCESS_UNKNOWN_STATE",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "transition references nonexistent state",
            ));
        }
        let automatic = bool_prop(declaration, "automatic", false)?;
        let action = string_prop(declaration, "action", automatic.then_some(id.as_str()))?
            .ok_or_else(|| {
                V2Error::new(
                    "AIR_VALIDATE_TRANSITION",
                    "validate",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "requested transition requires action",
                )
            })?;
        let by_raw =
            string_prop(declaration, "by", automatic.then_some("system"))?.ok_or_else(|| {
                V2Error::new(
                    "AIR_VALIDATE_TRANSITION",
                    "validate",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "requested transition requires authority",
                )
            })?;
        let authority = parse_policy(
            Some(&by_raw),
            declaration,
            &resource_id,
            &resources,
            &actors,
            true,
        )?;
        let is_system = authority.any_of == vec![PolicyTermIr::System];
        if automatic != is_system {
            return Err(V2Error::new(
                "AIR_VALIDATE_TRANSITION",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "automatic transitions require system; requested transitions forbid it",
            ));
        }
        let approvals = integer_prop(declaration, "approvals", Some(1), 1)?.unwrap();
        let distinct = bool_prop(declaration, "distinct", false)?;
        if distinct && approvals < 2 || automatic && (approvals != 1 || distinct) {
            return Err(V2Error::new(
                "AIR_PROCESS_APPROVAL_CARDINALITY",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invalid approval cardinality",
            ));
        }
        let comment = string_prop(declaration, "comment", Some("none"))?.unwrap();
        if !["none", "optional", "required"].contains(&comment.as_str()) {
            return Err(V2Error::new(
                "AIR_VALIDATE_TRANSITION",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invalid comment policy",
            ));
        }
        let mut separate = Vec::new();
        for raw in list_prop(declaration, "separate")? {
            let (path, actor) =
                resolve_reference_path(&raw, declaration, &resource_id, &resources, &actors)?;
            if authority.any_of.iter().any(
                |term| matches!(term, PolicyTermIr::Owner { path: owner, .. } if *owner == path),
            ) {
                return Err(V2Error::new(
                    "AIR_PROCESS_IMPOSSIBLE_SEPARATION",
                    "process",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "authority and separation require the same actor",
                ));
            }
            separate.push(SeparationIr { actor, path });
        }
        separate.sort_by_key(|value| format!("{value:?}"));
        let within_raw = string_prop(declaration, "within", None)?;
        let since = string_prop(declaration, "since", None)?;
        if within_raw.is_some()
            && since
                .as_ref()
                .is_none_or(|value| !value.starts_with("event:") || value.len() == 6)
            || within_raw.is_none() && since.is_some()
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_DURATION",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "transition within and since must occur together",
            ));
        }
        let when_raw = string_prop(declaration, "when", Some("true"))?.unwrap();
        let condition = parse_condition(
            &when_raw,
            declaration,
            &resource_id,
            &resources,
            &parameters,
        )?;
        let transition = TransitionIr {
            id: id.clone(),
            address: declaration.id.clone().unwrap(),
            from,
            to,
            action,
            authority,
            automatic,
            condition,
            comment,
            approvals,
            distinct,
            separate,
            event: string_prop(declaration, "event", Some(&id))?.unwrap(),
            within: within_raw
                .as_ref()
                .map(|raw| parse_duration(raw, true, declaration))
                .transpose()?,
            since,
            unless_events: sorted_unique(list_prop(declaration, "unless_event")?),
        };
        processes[process_position].transitions.push(transition);
    }

    let mut invariants = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "invariant")
    {
        let (resource_id, id) = owned_id(declaration)?;
        let Some(resource_position) = resource_index(&resources, &resource_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invariant owner is not a resource",
            ));
        };
        let required = sorted_unique(list_prop(declaration, "require")?);
        let immutable = sorted_unique(list_prop(declaration, "immutable")?);
        if required.is_empty() && immutable.is_empty() {
            return Err(V2Error::new(
                "AIR_VALIDATE_INVARIANT",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invariant requires an effect",
            ));
        }
        for field_id in required
            .iter()
            .chain(immutable.iter().filter(|id| id.as_str() != "*"))
        {
            if resources[resource_position]
                .fields
                .iter()
                .find(|field| field.id == *field_id)
                .is_none_or(|field| field.computed.is_some())
            {
                return Err(V2Error::new(
                    "AIR_VALIDATE_INVARIANT",
                    "validate",
                    Some(declaration.line),
                    Some(declaration_path(declaration)),
                    "invariant references unknown stored field",
                ));
            }
        }
        invariants.push(InvariantIr {
            address: declaration.id.clone().unwrap(),
            resource: resource_id.clone(),
            id,
            condition: parse_condition(
                &required_prop(declaration, "when")?,
                declaration,
                &resource_id,
                &resources,
                &parameters,
            )?,
            required,
            immutable,
        });
    }

    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "deadline")
    {
        let (resource_id, id) = owned_id(declaration)?;
        let Some(process_position) = processes
            .iter()
            .position(|process| process.resource == resource_id)
        else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "deadline owner has no process",
            ));
        };
        let state = required_prop(declaration, "state")?;
        if !processes[process_position].states.contains(&state) {
            return Err(V2Error::new(
                "AIR_PROCESS_UNKNOWN_STATE",
                "process",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "deadline references nonexistent state",
            ));
        }
        let escalation = string_prop(declaration, "escalation", Some("none"))?.unwrap();
        if !["none", "required"].contains(&escalation.as_str()) {
            return Err(V2Error::new(
                "AIR_VALIDATE_DEADLINE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invalid deadline escalation",
            ));
        }
        processes[process_position].deadlines.push(DeadlineIr {
            id,
            state,
            after: parse_duration(&required_prop(declaration, "after")?, true, declaration)?,
            escalation,
        });
    }

    validate_processes(&mut processes, &mut resources, &process_lines)?;

    for resource in &mut resources {
        if let Some(management) = &resource.management {
            resource.experience = Some(ExperienceIr {
                columns: infer_columns(resource),
                search: resource
                    .fields
                    .iter()
                    .filter(|field| matches!(field.value_type.as_str(), "text" | "email" | "phone"))
                    .map(|field| field.id.clone())
                    .collect(),
                filters: resource
                    .fields
                    .iter()
                    .filter(|field| matches!(field.value_type.as_str(), "enum" | "ref" | "bool"))
                    .map(|field| field.id.clone())
                    .collect(),
                sort: infer_sort(resource),
                page_size: management.page_size,
            });
        }
    }

    let overview_declaration = declarations
        .iter()
        .find(|declaration| declaration.kind == "overview");
    let mut overview = if let Some(declaration) = overview_declaration {
        let managed: Vec<&ResourceIr> = managed_ids
            .iter()
            .map(|id| {
                resources
                    .iter()
                    .find(|resource| resource.id == *id)
                    .unwrap()
            })
            .collect();
        let mut metrics = Vec::new();
        for resource in managed.iter().take(3) {
            metrics.push(MetricIr {
                id: format!("{}_total", resource.id),
                address: format!("inferred.{}_total", resource.id),
                source: resource.id.clone(),
                operation: "count".into(),
                field: None,
                group: None,
                where_: None,
                label: format!("Total {}", resource.plural.to_lowercase()),
                tone: tone_at(metrics.len()),
                format: "number".into(),
                inferred: true,
            });
        }
        if let Some(primary) = managed.last() {
            if let Some(status) = primary
                .fields
                .iter()
                .find(|field| field.id == "status")
                .filter(|field| field.value_type == "enum")
                .or_else(|| {
                    primary
                        .fields
                        .iter()
                        .find(|field| field.value_type == "enum")
                })
            {
                for value in &status.values {
                    if metrics.len() >= 4 {
                        break;
                    }
                    metrics.push(MetricIr {
                        id: format!("{}_{}_{}", primary.id, status.id, value.to_lowercase()),
                        address: format!(
                            "inferred.{}_{}_{}",
                            primary.id,
                            status.id,
                            value.to_lowercase()
                        ),
                        source: primary.id.clone(),
                        operation: "count".into(),
                        field: None,
                        group: None,
                        where_: Some(MetricWhereIr::FieldEquals {
                            field: status.id.clone(),
                            value: value.clone(),
                        }),
                        label: format!(
                            "{} {}",
                            value.replace('_', " "),
                            primary.plural.to_lowercase()
                        ),
                        tone: tone_at(metrics.len()),
                        format: "number".into(),
                        inferred: true,
                    });
                }
            }
        }
        let lists = managed
            .iter()
            .take(2)
            .map(|resource| {
                let date = resource
                    .fields
                    .iter()
                    .find(|field| field.value_type == "date");
                ListIr {
                    id: resource.id.clone(),
                    address: format!("inferred.{}", resource.id),
                    source: resource.id.clone(),
                    title: resource.plural.clone(),
                    columns: infer_columns(resource).into_iter().take(5).collect(),
                    sort: vec![date
                        .map(|field| format!("-{}", field.id))
                        .unwrap_or_else(|| resource.label_field.clone())],
                    limit: 5,
                    where_: None,
                }
            })
            .collect();
        Some(OverviewIr {
            title: string_prop(declaration, "title", Some("Overview"))?.unwrap(),
            metrics,
            lists,
        })
    } else {
        None
    };

    for declaration in declarations.iter().filter(|declaration| {
        declaration.kind == "insight" && !declaration.props.contains_key("source")
    }) {
        let Some(page) = overview.as_mut() else {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight requires overview",
            ));
        };
        let (resource_id, id) = owned_id(declaration)?;
        let Some(resource) = resources.iter().find(|resource| resource.id == resource_id) else {
            return Err(V2Error::new(
                "AIR_REF_UNKNOWN_RESOURCE",
                "resolve",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight owner is not a resource",
            ));
        };
        let operation = string_prop(declaration, "op", Some("sum"))?.unwrap();
        let field_id = string_prop(declaration, "field", None)?;
        let field = field_id
            .as_ref()
            .and_then(|id| resource.fields.iter().find(|field| field.id == *id));
        if !["count", "sum", "average"].contains(&operation.as_str())
            || operation != "count" && field.is_none_or(|field| !numeric_type(&field.value_type))
        {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "insight operation requires numeric field",
            ));
        }
        let group = string_prop(declaration, "group", None)?;
        if group.as_ref().is_some_and(|id| {
            resource
                .fields
                .iter()
                .find(|field| field.id == *id)
                .is_none_or(|field| !matches!(field.value_type.as_str(), "enum" | "ref" | "bool"))
        }) {
            return Err(V2Error::new(
                "AIR_VALIDATE_AGGREGATE",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                "invalid overview insight group",
            ));
        }
        let where_ = string_prop(declaration, "where", None)?
            .map(|raw| parse_condition(&raw, declaration, &resource_id, &resources, &parameters))
            .transpose()?
            .map(condition_to_metric);
        let format = if group.is_some() {
            "breakdown"
        } else if field.is_some_and(|field| field.value_type == "money") {
            "money"
        } else {
            "number"
        };
        let default_label = field.map_or_else(
            || {
                format!(
                    "{} {}",
                    title_case(&operation),
                    resource.plural.to_lowercase()
                )
            },
            |field| format!("{} {}", title_case(&operation), field.label.to_lowercase()),
        );
        page.metrics.push(MetricIr {
            id,
            address: declaration.id.clone().unwrap(),
            source: resource_id,
            operation,
            field: field_id,
            group,
            where_,
            label: string_prop(declaration, "label", Some(&default_label))?.unwrap(),
            tone: string_prop(declaration, "tone", Some(&tone_at(page.metrics.len())))?.unwrap(),
            format: format.into(),
            inferred: false,
        });
    }

    let initial = explicit_initial
        .or_else(|| overview.as_ref().map(|_| "overview".into()))
        .unwrap_or_else(|| managed_ids[0].clone());
    if initial != "overview" && !managed_ids.contains(&initial)
        || initial == "overview" && overview.is_none()
    {
        return Err(V2Error::new(
            "AIR_REF_UNKNOWN_PAGE",
            "resolve",
            None,
            Some("app.initial".into()),
            format!("app initial page `{initial}` does not exist"),
        ));
    }

    let mut extensions = Vec::new();
    for declaration in declarations
        .iter()
        .filter(|declaration| declaration.kind == "extension")
    {
        let id = declaration.id.clone().unwrap();
        let capability = format!("extension.load.{id}");
        if !capabilities.contains(&capability) {
            return Err(V2Error::new(
                "AIR_VALIDATE_CAPABILITY",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("extension requires capability `{capability}`"),
            ));
        }
        let module = required_prop(declaration, "module")?;
        if !allowed_extensions.contains(&module.as_str()) {
            return Err(V2Error::new(
                "AIR_EXTENSION_NOT_ALLOWED",
                "validate",
                Some(declaration.line),
                Some(declaration_path(declaration)),
                format!("extension module `{module}` is not allowed by this host"),
            ));
        }
        extensions.push(ExtensionIr {
            id,
            module,
            slot: string_prop(declaration, "slot", Some("page"))?.unwrap(),
        });
    }

    let ir = SemanticIr {
        schema: "air.semantic-ir".into(),
        version: 2,
        app: AppIr {
            id: app_id,
            title: app_title,
            subtitle: app_subtitle,
            initial,
        },
        theme,
        capabilities,
        resources,
        parameters,
        rules,
        invariants,
        processes,
        overview,
        extensions,
    };
    verify_ir(&ir)?;
    Ok(V2Program { ir })
}

fn condition_to_metric(condition: ConditionIr) -> MetricWhereIr {
    match condition {
        ConditionIr::Constant { value } => MetricWhereIr::Constant { value },
        ConditionIr::Or { alternatives } => MetricWhereIr::Or { alternatives },
    }
}

fn validate_processes(
    processes: &mut [ProcessIr],
    resources: &mut [ResourceIr],
    process_lines: &HashMap<String, usize>,
) -> Result<(), V2Error> {
    for process in processes {
        let mut signatures = HashSet::new();
        for transition in &process.transitions {
            let signature = format!(
                "{:?}{:?}",
                (
                    &transition.from,
                    &transition.to,
                    &transition.action,
                    &transition.authority,
                    transition.automatic,
                    &transition.condition,
                    &transition.comment,
                    transition.approvals,
                ),
                (
                    transition.distinct,
                    &transition.separate,
                    &transition.within,
                    &transition.since,
                    &transition.unless_events,
                )
            );
            if !signatures.insert(signature) {
                return Err(V2Error::new(
                    "AIR_PROCESS_DUPLICATE_TRANSITION",
                    "process",
                    None,
                    None,
                    format!(
                        "process `{}` has duplicate transition semantics",
                        process.resource
                    ),
                ));
            }
            if transition
                .from
                .iter()
                .any(|state| process.terminal.contains(state))
            {
                return Err(V2Error::new(
                    "AIR_PROCESS_TERMINAL_OUTGOING",
                    "process",
                    None,
                    None,
                    "terminal process state has outgoing transition",
                ));
            }
        }
        let mut reachable: HashSet<String> = [process.initial.clone()].into_iter().collect();
        loop {
            let size = reachable.len();
            for transition in &process.transitions {
                if transition
                    .from
                    .iter()
                    .any(|state| reachable.contains(state))
                {
                    reachable.insert(transition.to.clone());
                }
            }
            if reachable.len() == size {
                break;
            }
        }
        let unreachable: Vec<String> = process
            .states
            .iter()
            .filter(|state| !reachable.contains(*state))
            .cloned()
            .collect();
        if !unreachable.is_empty() {
            return Err(V2Error::new(
                "AIR_PROCESS_UNREACHABLE_STATE",
                "process",
                None,
                None,
                format!(
                    "process `{}` has unreachable states: {}",
                    process.resource,
                    unreachable.join(", ")
                ),
            ));
        }
        let dead: Vec<String> = process
            .states
            .iter()
            .filter(|state| {
                !process.terminal.contains(*state)
                    && !process
                        .transitions
                        .iter()
                        .any(|transition| transition.from.contains(*state))
            })
            .cloned()
            .collect();
        if !dead.is_empty() {
            return Err(V2Error::new(
                "AIR_PROCESS_DEAD_END",
                "process",
                None,
                None,
                format!(
                    "process has non-terminal states without exits: {}",
                    dead.join(", ")
                ),
            ));
        }
        let mut edges: HashMap<String, Vec<String>> = process
            .states
            .iter()
            .map(|state| (state.clone(), Vec::new()))
            .collect();
        for transition in process.transitions.iter().filter(|transition| {
            transition.automatic && transition.condition == (ConditionIr::Constant { value: true })
        }) {
            for from in &transition.from {
                edges.get_mut(from).unwrap().push(transition.to.clone());
            }
        }
        fn visit(
            state: &str,
            edges: &HashMap<String, Vec<String>>,
            visiting: &mut HashSet<String>,
            visited: &mut HashSet<String>,
        ) -> bool {
            if visiting.contains(state) {
                return true;
            }
            if visited.contains(state) {
                return false;
            }
            visiting.insert(state.into());
            if edges
                .get(state)
                .unwrap()
                .iter()
                .any(|next| visit(next, edges, visiting, visited))
            {
                return true;
            }
            visiting.remove(state);
            visited.insert(state.into());
            false
        }
        let mut visiting = HashSet::new();
        let mut visited = HashSet::new();
        if process
            .states
            .iter()
            .any(|state| visit(state, &edges, &mut visiting, &mut visited))
        {
            return Err(V2Error::new(
                "AIR_PROCESS_STATIC_AUTO_CYCLE",
                "process",
                None,
                Some(format!("process.{}", process.resource)),
                "unconditional automatic transition cycle",
            ));
        }
        if !process.deadlines.is_empty() {
            let resource = resources
                .iter_mut()
                .find(|resource| resource.id == process.resource)
                .unwrap();
            if field_index(resource, "workflow_status").is_some() {
                return Err(V2Error::new(
                    "AIR_VALIDATE_DUPLICATE_ID",
                    "validate",
                    process_lines.get(&process.resource).copied(),
                    Some(format!("process.{}", process.resource)),
                    "workflow_status field already exists",
                ));
            }
            resource.fields.push(FieldIr {
                id: "workflow_status".into(),
                value_type: "enum".into(),
                label: "Workflow Status".into(),
                required: false,
                unique: false,
                values: vec![
                    "OnTime".into(),
                    "Overdue".into(),
                    "EscalationRequired".into(),
                ],
                reference: None,
                default: None,
                min: 0,
                placeholder: String::new(),
                long: false,
                currency: None,
                computed: Some(ComputedIr::Workflow),
                read_only: true,
            });
        }
    }
    Ok(())
}

pub fn verify_ir(ir: &SemanticIr) -> Result<(), V2Error> {
    if ir.schema != "air.semantic-ir" || ir.version != 2 {
        return Err(V2Error::new(
            "AIR_BYTECODE_VERSION",
            "bytecode",
            None,
            None,
            "unsupported semantic IR schema/version",
        ));
    }
    let mut resources = HashSet::new();
    for resource in &ir.resources {
        if !resources.insert(&resource.id) {
            return Err(V2Error::new(
                "AIR_BYTECODE_INVALID",
                "bytecode",
                None,
                Some(format!("resource.{}", resource.id)),
                "duplicate resource",
            ));
        }
        let mut fields = HashSet::new();
        for field in &resource.fields {
            if !fields.insert(&field.id) {
                return Err(V2Error::new(
                    "AIR_BYTECODE_INVALID",
                    "bytecode",
                    None,
                    Some(format!("field.{}.{}", resource.id, field.id)),
                    "duplicate field",
                ));
            }
        }
        if !fields.contains(&resource.label_field) {
            return Err(V2Error::new(
                "AIR_BYTECODE_INVALID",
                "bytecode",
                None,
                Some(format!("resource.{}", resource.id)),
                "unknown label field",
            ));
        }
    }
    for resource in &ir.resources {
        for field in &resource.fields {
            if let Some(reference) = &field.reference {
                if !resources.contains(&reference) {
                    return Err(V2Error::new(
                        "AIR_BYTECODE_INVALID",
                        "bytecode",
                        None,
                        Some(format!("field.{}.{}", resource.id, field.id)),
                        "unknown referenced resource",
                    ));
                }
            }
        }
    }
    Ok(())
}

pub fn explain_v2(ir: &SemanticIr) -> String {
    let mut lines = vec![format!("{} ({})", ir.app.title, ir.app.id)];
    for resource in &ir.resources {
        lines.push(format!(
            "- {}: {}",
            resource.plural,
            resource
                .fields
                .iter()
                .map(|field| {
                    format!(
                        "{}:{}{}",
                        field.id,
                        field.value_type,
                        if field.required { " required" } else { "" }
                    )
                })
                .collect::<Vec<_>>()
                .join(", ")
        ));
        if resource.actor {
            lines.push(format!("  Actor identity: {}", resource.id));
        }
        if let Some(management) = &resource.management {
            lines.push(format!("  Managed experience: list, detail, create, edit, {}, validation, search, filter, sort, pagination, responsive and accessible states", management.lifecycle));
        }
    }
    for parameter in &ir.parameters {
        lines.push(format!(
            "- Parameter {} ({}): {}",
            parameter.label,
            parameter.address,
            json::stringify(parameter.value.clone())
        ));
    }
    for process in &ir.processes {
        lines.push(format!(
            "- Process {}: {} begins {}; terminal {}; {}",
            process.resource,
            process.state,
            process.initial,
            process.terminal.join(", "),
            if process.history {
                "semantic history enabled"
            } else {
                "history disabled"
            }
        ));
        for transition in &process.transitions {
            lines.push(format!(
                "  {} -> {}: {}; emits {}",
                transition.from.join(" or "),
                transition.to,
                if transition.automatic {
                    "automatic".into()
                } else {
                    format!("action {}", transition.action)
                },
                transition.event
            ));
        }
        for deadline in &process.deadlines {
            lines.push(format!(
                "  Deadline {}: {}{}; escalation {}",
                deadline.state, deadline.after.amount, deadline.after.unit, deadline.escalation
            ));
        }
    }
    lines.join("\n")
}

pub fn workflow_v2(ir: &SemanticIr) -> String {
    fn node(resource: &str, state: &str) -> String {
        format!("{resource}_{state}")
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || character == '_' {
                    character
                } else {
                    '_'
                }
            })
            .collect()
    }
    let mut lines = vec!["flowchart TD".to_string()];
    for process in &ir.processes {
        for state in &process.states {
            lines.push(format!(
                "  {}[\"{}\"]",
                node(&process.resource, state),
                state
            ));
        }
        for transition in &process.transitions {
            let label = if transition.automatic {
                "automatic"
            } else {
                &transition.action
            };
            for from in &transition.from {
                lines.push(format!(
                    "  {} -->|\"{}\"| {}",
                    node(&process.resource, from),
                    label,
                    node(&process.resource, &transition.to)
                ));
            }
        }
        for state in &process.terminal {
            lines.push(format!("  {}:::terminal", node(&process.resource, state)));
        }
    }
    if ir.processes.is_empty() {
        lines.push("  none[\"No declared processes\"]".into());
    }
    lines.push("  classDef terminal stroke-width:3px".into());
    lines.join("\n")
}
