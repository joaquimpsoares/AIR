//! Deterministic AIR v2 semantic execution over the canonical IR.

use crate::v2::{
    ClauseIr, ComputedIr, ConditionIr, ConditionPathStepIr, ConditionTermIr, DurationIr, FieldIr,
    OperandIr, PolicyIr, PolicyTermIr, ProcessIr, ReferenceStepIr, SemanticIr, TransitionIr,
    V2Error,
};
use json::JsonValue as Value;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V2Principal {
    pub actor: Option<String>,
    pub id: Option<String>,
    pub roles: Vec<String>,
}

impl Default for V2Principal {
    fn default() -> Self {
        Self {
            actor: None,
            id: None,
            roles: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct V2TransitionResult {
    pub record: Value,
    pub events: Vec<Value>,
    pub completed: bool,
    pub approvals: u32,
    pub approvals_required: u32,
}

pub struct V2Runtime {
    pub ir: SemanticIr,
    records: HashMap<String, Vec<Value>>,
    pub principal: V2Principal,
    clock: String,
}

fn object(entries: Vec<(&str, Value)>) -> Value {
    let mut result = Value::new_object();
    for (key, value) in entries {
        result[key] = value;
    }
    result
}

fn execute_error(code: &str, path: Option<String>, message: impl Into<String>) -> V2Error {
    V2Error {
        code: code.into(),
        phase: "execute".into(),
        location: None,
        path,
        message: message.into(),
    }
}

fn is_blank(value: &Value) -> bool {
    value.is_null() || value.as_str().is_some_and(|text| text.trim().is_empty())
}

impl V2Runtime {
    pub fn new(
        ir: SemanticIr,
        seed: Value,
        principal: V2Principal,
        clock: impl Into<String>,
    ) -> Result<Self, V2Error> {
        if !seed.is_object() {
            return Err(V2Error {
                code: "AIR_DATA_INVALID".into(),
                phase: "data".into(),
                location: None,
                path: None,
                message: "seed must be an object".into(),
            });
        }
        let clock = clock.into();
        parse_timestamp(&clock).ok_or_else(|| {
            execute_error(
                "AIR_TIME_INVALID",
                None,
                "clock must be an ISO UTC timestamp",
            )
        })?;
        let mut records = HashMap::new();
        for resource in &ir.resources {
            let input = &seed[&resource.id];
            if !input.is_null() && !input.is_array() {
                return Err(V2Error {
                    code: "AIR_DATA_INVALID".into(),
                    phase: "data".into(),
                    location: None,
                    path: Some(format!("seed.{}", resource.id)),
                    message: "resource seed must be an array".into(),
                });
            }
            let mut output = Vec::new();
            for raw in input.members() {
                if !raw.is_object() || raw["id"].as_str().is_none() {
                    return Err(V2Error {
                        code: "AIR_DATA_INVALID".into(),
                        phase: "data".into(),
                        location: None,
                        path: Some(format!("seed.{}", resource.id)),
                        message: "record requires string id".into(),
                    });
                }
                let mut record = raw.clone();
                for field in resource
                    .fields
                    .iter()
                    .filter(|field| field.computed.is_none())
                {
                    if record[&field.id].is_null() {
                        record[&field.id] = default_value(field, &clock);
                    }
                }
                output.push(record);
            }
            let mut ids = HashSet::new();
            if output
                .iter()
                .any(|record| !ids.insert(record["id"].as_str().unwrap().to_string()))
            {
                return Err(V2Error {
                    code: "AIR_DATA_INVALID".into(),
                    phase: "data".into(),
                    location: None,
                    path: Some(format!("seed.{}", resource.id)),
                    message: "duplicate record id".into(),
                });
            }
            records.insert(resource.id.clone(), output);
        }
        let runtime = Self {
            ir,
            records,
            principal,
            clock,
        };
        for resource in &runtime.ir.resources {
            for record in runtime.records.get(&resource.id).unwrap() {
                runtime.validate(&resource.id, record)?;
            }
        }
        Ok(runtime)
    }

    pub fn from_json(
        ir: SemanticIr,
        seed: &str,
        principal: V2Principal,
        clock: impl Into<String>,
    ) -> Result<Self, V2Error> {
        let value = json::parse(seed).map_err(|error| V2Error {
            code: "AIR_DATA_INVALID".into(),
            phase: "data".into(),
            location: None,
            path: None,
            message: error.to_string(),
        })?;
        Self::new(ir, value, principal, clock)
    }

    pub fn from_context_json(ir: SemanticIr, input: &str) -> Result<Self, V2Error> {
        let value = json::parse(input).map_err(|error| V2Error {
            code: "AIR_DATA_INVALID".into(),
            phase: "data".into(),
            location: None,
            path: None,
            message: error.to_string(),
        })?;
        let principal = principal_from_json(&value["principal"]);
        let clock = value["clock"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_TIME_INVALID", None, "context requires clock"))?;
        Self::new(ir, value["seed"].clone(), principal, clock)
    }

    pub fn transition_request_json(&mut self, input: &str) -> Result<String, V2Error> {
        let value = json::parse(input)
            .map_err(|error| execute_error("AIR_EXEC_INPUT", None, error.to_string()))?;
        if !value["principal"].is_null() {
            self.principal = principal_from_json(&value["principal"]);
        }
        let resource = value["resource"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_EXEC_INPUT", None, "request requires resource"))?;
        let id = value["id"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_EXEC_INPUT", None, "request requires id"))?;
        let action = value["action"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_EXEC_INPUT", None, "request requires action"))?;
        let result = self.transition(
            resource,
            id,
            action,
            value["comment"].as_str().unwrap_or(""),
        )?;
        Ok(json::stringify(object(vec![
            ("record", result.record),
            ("events", Value::Array(result.events)),
            ("completed", result.completed.into()),
            ("approvals", result.approvals.into()),
            ("approvalsRequired", result.approvals_required.into()),
        ])))
    }

    pub fn status_request_json(&self, input: &str) -> Result<String, V2Error> {
        let value = json::parse(input)
            .map_err(|error| execute_error("AIR_EXEC_INPUT", None, error.to_string()))?;
        let resource = value["resource"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_EXEC_INPUT", None, "request requires resource"))?;
        let id = value["id"]
            .as_str()
            .ok_or_else(|| execute_error("AIR_EXEC_INPUT", None, "request requires id"))?;
        Ok(json::stringify(self.workflow_status(resource, id)?))
    }

    pub fn get(&self, resource: &str, id: &str) -> Option<Value> {
        self.records
            .get(resource)?
            .iter()
            .find(|record| record["id"] == id)
            .cloned()
    }

    pub fn history(&self, resource: &str, id: &str) -> Result<Vec<Value>, V2Error> {
        let record = self.get(resource, id).ok_or_else(|| {
            execute_error(
                "AIR_EXEC_NOT_FOUND",
                Some(format!("{resource}.{id}")),
                "record not found",
            )
        })?;
        Ok(record["_air_history"].members().cloned().collect())
    }

    pub fn transition(
        &mut self,
        resource: &str,
        id: &str,
        action: &str,
        comment: &str,
    ) -> Result<V2TransitionResult, V2Error> {
        let process = self.process(resource)?.clone();
        let existing = self.get(resource, id).ok_or_else(|| {
            execute_error(
                "AIR_EXEC_NOT_FOUND",
                Some(format!("{resource}.{id}")),
                "record not found",
            )
        })?;
        let state = existing[&process.state].as_str().unwrap_or("");
        let state_candidates: Vec<&TransitionIr> = process
            .transitions
            .iter()
            .filter(|transition| {
                !transition.automatic
                    && transition.action == action
                    && transition.from.iter().any(|from| from == state)
            })
            .collect();
        if state_candidates.is_empty() {
            return Err(execute_error(
                "AIR_EXEC_ACTION_UNAVAILABLE",
                Some(format!("process.{resource}")),
                format!("action `{action}` is unavailable from {state}"),
            ));
        }
        let mut candidates = Vec::new();
        let mut denied_reason = "condition";
        for transition in state_candidates {
            match self.transition_allowed(transition, &existing, false) {
                Ok(true) => candidates.push(transition),
                Ok(false) => denied_reason = "condition",
                Err(error) if error.code == "AIR_EXEC_DENIED" => denied_reason = "authority",
                Err(error) => return Err(error),
            }
        }
        if candidates.is_empty() {
            return Err(execute_error(
                "AIR_EXEC_DENIED",
                Some(format!("transition.{resource}.{action}")),
                format!("transition denied: {denied_reason}"),
            ));
        }
        if candidates.len() > 1 {
            return Err(execute_error(
                "AIR_EXEC_ACTION_AMBIGUOUS",
                Some(format!("process.{resource}")),
                "multiple requested transitions match",
            ));
        }
        let transition = candidates[0];
        if transition.comment == "required" && comment.trim().is_empty() {
            return Err(execute_error(
                "AIR_EXEC_COMMENT_REQUIRED",
                Some(format!("transition.{}", transition.address)),
                "comment is required",
            ));
        }
        let history: Vec<Value> = existing["_air_history"].members().cloned().collect();
        let entered_at = history.iter().rposition(|entry| {
            entry["completed"] == true && entry["to"] == state && entry["from"] != entry["to"]
        });
        let evidence: Vec<&Value> = history
            .iter()
            .skip(entered_at.map_or(0, |index| index + 1))
            .filter(|entry| entry["transition"] == transition.address)
            .collect();
        if transition.distinct {
            let actor = self
                .principal
                .actor
                .as_deref()
                .filter(|value| !value.is_empty());
            let actor_id = self
                .principal
                .id
                .as_deref()
                .filter(|value| !value.is_empty());
            if actor.is_none() || actor_id.is_none() {
                return Err(execute_error(
                    "AIR_EXEC_IDENTITY_REQUIRED",
                    Some(format!("transition.{}", transition.address)),
                    "distinct approval requires actor identity",
                ));
            }
            if evidence.iter().any(|entry| {
                entry["actor"]["actor"] == actor.unwrap()
                    && entry["actor"]["id"] == actor_id.unwrap()
            }) {
                return Err(execute_error(
                    "AIR_EXEC_DISTINCT_REQUIRED",
                    Some(format!("transition.{}", transition.address)),
                    "a different actor is required",
                ));
            }
        }
        let completed = evidence.len() as u32 + 1 >= transition.approvals;
        let previous = state.to_string();
        let mut record = existing.clone();
        if completed {
            record[&process.state] = transition.to.clone().into();
        }
        if let Some(touch) = &process.touch {
            record[touch] = self.clock[..10].into();
        }
        let mut events = Vec::new();
        if process.history {
            let event = self.history_entry(
                &record,
                transition,
                &previous,
                if completed { &transition.to } else { &previous },
                completed,
                comment,
                false,
            );
            append_history(&mut record, event.clone());
            events.push(event);
        }
        self.validate(resource, &record)?;
        if completed {
            record = self.stabilize(&process, record, &mut events)?;
        }
        self.replace(resource, id, record.clone())?;
        Ok(V2TransitionResult {
            record,
            events,
            completed,
            approvals: (evidence.len() as u32 + 1).min(transition.approvals),
            approvals_required: transition.approvals,
        })
    }

    pub fn workflow_status(&self, resource: &str, id: &str) -> Result<Value, V2Error> {
        let process = self.process(resource)?;
        let record = self.get(resource, id).ok_or_else(|| {
            execute_error(
                "AIR_EXEC_NOT_FOUND",
                Some(format!("{resource}.{id}")),
                "record not found",
            )
        })?;
        let state = record[&process.state].as_str().unwrap_or("");
        let Some(deadline) = process
            .deadlines
            .iter()
            .find(|deadline| deadline.state == state)
        else {
            return Ok(object(vec![
                ("status", Value::Null),
                ("deadline", Value::Null),
                ("overdue", false.into()),
                ("escalationRequired", false.into()),
            ]));
        };
        let entered = record["_air_history"].members().rev().find(|entry| {
            entry["completed"] == true && entry["to"] == state && entry["from"] != entry["to"]
        });
        let fallback = process
            .touch
            .as_ref()
            .and_then(|field| record[field].as_str())
            .or_else(|| record["created"].as_str());
        let start = entered
            .and_then(|entry| entry["at"].as_str())
            .map(str::to_string)
            .or_else(|| fallback.map(|date| format!("{date}T00:00:00.000Z")));
        let due = start
            .as_deref()
            .and_then(|value| duration_end(value, &deadline.after));
        let overdue = due
            .as_deref()
            .zip(parse_timestamp(&self.clock))
            .is_some_and(|(due, now)| now > parse_timestamp(due).unwrap());
        let escalation_required = overdue && deadline.escalation == "required";
        Ok(object(vec![
            (
                "status",
                if escalation_required {
                    "EscalationRequired"
                } else if overdue {
                    "Overdue"
                } else {
                    "OnTime"
                }
                .into(),
            ),
            ("deadline", due.map(Value::String).unwrap_or(Value::Null)),
            ("overdue", overdue.into()),
            ("escalationRequired", escalation_required.into()),
            ("rule", format!("{resource}.{}", deadline.id).into()),
        ]))
    }

    fn process(&self, resource: &str) -> Result<&ProcessIr, V2Error> {
        self.ir
            .processes
            .iter()
            .find(|process| process.resource == resource)
            .ok_or_else(|| {
                execute_error(
                    "AIR_EXEC_NO_PROCESS",
                    Some(format!("resource.{resource}")),
                    "resource has no process",
                )
            })
    }

    fn replace(&mut self, resource: &str, id: &str, replacement: Value) -> Result<(), V2Error> {
        let records = self.records.get_mut(resource).ok_or_else(|| {
            execute_error(
                "AIR_EXEC_NOT_FOUND",
                Some(format!("resource.{resource}")),
                "unknown resource",
            )
        })?;
        let target = records
            .iter_mut()
            .find(|record| record["id"] == id)
            .ok_or_else(|| {
                execute_error(
                    "AIR_EXEC_NOT_FOUND",
                    Some(format!("{resource}.{id}")),
                    "record not found",
                )
            })?;
        *target = replacement;
        Ok(())
    }

    fn transition_allowed(
        &self,
        transition: &TransitionIr,
        record: &Value,
        system: bool,
    ) -> Result<bool, V2Error> {
        if !self.evaluate_condition(
            &transition.condition,
            &transition.address.split('.').next().unwrap(),
            record,
        )? {
            return Ok(false);
        }
        if !self.policy_matches(&transition.authority, record, system) {
            return Err(execute_error(
                "AIR_EXEC_DENIED",
                Some(format!("transition.{}", transition.address)),
                "transition authority denied",
            ));
        }
        if !system {
            for separation in &transition.separate {
                let protected = self.resolve_reference_path(record, &separation.path);
                if self.principal.actor.as_deref() == Some(&separation.actor)
                    && self.principal.id.as_deref() == protected.as_deref()
                {
                    return Err(execute_error(
                        "AIR_EXEC_DENIED",
                        Some(format!("transition.{}", transition.address)),
                        "separation of duty",
                    ));
                }
            }
        }
        let history: Vec<&Value> = record["_air_history"].members().collect();
        if transition
            .unless_events
            .iter()
            .any(|event| history.iter().any(|entry| entry["event"] == event.as_str()))
        {
            return Ok(false);
        }
        if let Some(within) = &transition.within {
            let event = transition
                .since
                .as_deref()
                .unwrap()
                .strip_prefix("event:")
                .unwrap();
            let Some(since) = history
                .iter()
                .rev()
                .find(|entry| entry["event"] == event)
                .and_then(|entry| entry["at"].as_str())
            else {
                return Ok(false);
            };
            let Some(end) = duration_end(since, within).and_then(|value| parse_timestamp(&value))
            else {
                return Ok(false);
            };
            if parse_timestamp(&self.clock).unwrap() > end {
                return Ok(false);
            }
        }
        Ok(true)
    }

    fn policy_matches(&self, policy: &PolicyIr, record: &Value, system: bool) -> bool {
        policy.any_of.iter().any(|term| match term {
            PolicyTermIr::System => system,
            _ if system => false,
            PolicyTermIr::Any => true,
            PolicyTermIr::Role { role } => self.principal.roles.contains(role),
            PolicyTermIr::Self_ { actor } => {
                self.principal.actor.as_deref() == Some(actor)
                    && self.principal.id.as_deref() == record["id"].as_str()
            }
            PolicyTermIr::Owner { actor, path } => {
                self.principal.actor.as_deref() == Some(actor)
                    && self.principal.id == self.resolve_reference_path(record, path)
            }
        })
    }

    fn resolve_reference_path(&self, record: &Value, path: &[ReferenceStepIr]) -> Option<String> {
        let mut current = record.clone();
        for (index, step) in path.iter().enumerate() {
            let id = current[&step.field].as_str()?.to_string();
            if index + 1 == path.len() {
                return Some(id);
            }
            current = self.get(&step.reference, &id)?;
        }
        None
    }

    fn resolve_condition_path(
        &self,
        resource: &str,
        record: &Value,
        path: &[ConditionPathStepIr],
    ) -> Result<Value, V2Error> {
        let mut current_resource = resource.to_string();
        let mut current = record.clone();
        for (index, step) in path.iter().enumerate() {
            let definition = self
                .ir
                .resources
                .iter()
                .find(|candidate| candidate.id == current_resource)
                .and_then(|candidate| candidate.fields.iter().find(|field| field.id == step.field))
                .unwrap();
            let value = if definition.computed.is_some() {
                self.computed_value(definition, &current)?
            } else {
                current[&step.field].clone()
            };
            if index + 1 == path.len() {
                return Ok(value);
            }
            let Some(id) = value.as_str() else {
                return Ok(Value::Null);
            };
            current_resource = step.reference.clone().unwrap();
            let Some(target) = self.get(&current_resource, id) else {
                return Ok(Value::Null);
            };
            current = target;
        }
        Ok(Value::Null)
    }

    fn operand(
        &self,
        resource: &str,
        record: &Value,
        operand: &OperandIr,
    ) -> Result<Value, V2Error> {
        let mut values = Vec::new();
        for term in &operand.terms {
            values.push(match term {
                ConditionTermIr::Literal { value, .. }
                | ConditionTermIr::Parameter { value, .. } => value.clone(),
                ConditionTermIr::Path { path, .. } => {
                    self.resolve_condition_path(resource, record, path)?
                }
            });
        }
        if values.iter().any(is_blank) {
            return Ok(Value::Null);
        }
        if values.len() == 1 {
            return Ok(values.remove(0));
        }
        let mut total = 0.0;
        for value in values {
            total += value.as_f64().ok_or_else(|| {
                execute_error(
                    "AIR_EXEC_TYPE",
                    None,
                    "numeric operand contained non-number",
                )
            })?;
        }
        Ok(total.into())
    }

    fn evaluate_condition(
        &self,
        condition: &ConditionIr,
        resource: &str,
        record: &Value,
    ) -> Result<bool, V2Error> {
        match condition {
            ConditionIr::Constant { value } => Ok(*value),
            ConditionIr::Or { alternatives } => {
                for clauses in alternatives {
                    let mut all = true;
                    for clause in clauses {
                        if !self.evaluate_clause(clause, resource, record)? {
                            all = false;
                            break;
                        }
                    }
                    if all {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
        }
    }

    fn evaluate_clause(
        &self,
        clause: &ClauseIr,
        resource: &str,
        record: &Value,
    ) -> Result<bool, V2Error> {
        let left = self.operand(resource, record, &clause.left)?;
        let right = self.operand(resource, record, &clause.right)?;
        if left.is_null() || right.is_null() {
            return Ok(false);
        }
        let order = if matches!(clause.value_type.as_str(), "number" | "money") {
            left.as_f64()
                .zip(right.as_f64())
                .map(|(left, right)| left.partial_cmp(&right).unwrap())
        } else {
            left.as_str()
                .zip(right.as_str())
                .map(|(left, right)| left.cmp(right))
        };
        let equal = left == right
            || matches!(clause.value_type.as_str(), "number" | "money")
                && left.as_f64() == right.as_f64();
        Ok(match clause.operator.as_str() {
            "==" => equal,
            "!=" => !equal,
            ">" => order.is_some_and(|order| order.is_gt()),
            ">=" => order.is_some_and(|order| order.is_ge()),
            "<" => order.is_some_and(|order| order.is_lt()),
            "<=" => order.is_some_and(|order| order.is_le()),
            _ => false,
        })
    }

    fn computed_value(&self, field: &FieldIr, owner: &Value) -> Result<Value, V2Error> {
        match field.computed.as_ref().unwrap() {
            ComputedIr::Workflow => Ok(Value::Null),
            ComputedIr::Aggregate {
                operation,
                source,
                group,
                field,
                where_,
                window,
                date,
            } => {
                let mut rows: Vec<&Value> = self
                    .records
                    .get(source)
                    .into_iter()
                    .flatten()
                    .filter(|record| {
                        record[group] == owner["id"] && record["_archived_at"].is_null()
                    })
                    .filter(|record| {
                        self.ir
                            .resources
                            .iter()
                            .find(|resource| resource.id == *source)
                            .and_then(|resource| resource.access.as_ref())
                            .map_or(true, |access| {
                                self.policy_matches(&access.view, record, false)
                            })
                    })
                    .filter(|record| {
                        where_.as_ref().map_or(true, |condition| {
                            self.evaluate_condition(condition, source, record)
                                .unwrap_or(false)
                        })
                    })
                    .filter(|record| {
                        window.as_deref() != Some("month")
                            || date
                                .as_ref()
                                .and_then(|field| record[field].as_str())
                                .is_some_and(|value| value.starts_with(&self.clock[..7]))
                    })
                    .collect();
                if operation == "count" {
                    return Ok((rows.len() as u32).into());
                }
                let numbers: Vec<f64> = rows
                    .drain(..)
                    .filter_map(|record| field.as_ref().and_then(|field| record[field].as_f64()))
                    .collect();
                let sum: f64 = numbers.iter().sum();
                Ok(if operation == "sum" {
                    sum.into()
                } else {
                    (if numbers.is_empty() {
                        0.0
                    } else {
                        sum / numbers.len() as f64
                    })
                    .into()
                })
            }
        }
    }

    fn validate(&self, resource_id: &str, record: &Value) -> Result<(), V2Error> {
        let resource = self
            .ir
            .resources
            .iter()
            .find(|resource| resource.id == resource_id)
            .ok_or_else(|| execute_error("AIR_EXEC_NOT_FOUND", None, "resource not found"))?;
        for field in resource
            .fields
            .iter()
            .filter(|field| field.computed.is_none())
        {
            if field.required && is_blank(&record[&field.id]) {
                return Err(execute_error(
                    "AIR_EXEC_VALIDATION",
                    Some(format!("field.{resource_id}.{}", field.id)),
                    format!("{} is required", field.label),
                ));
            }
        }
        for invariant in self
            .ir
            .invariants
            .iter()
            .filter(|invariant| invariant.resource == resource_id)
        {
            if self.evaluate_condition(&invariant.condition, resource_id, record)? {
                for field in &invariant.required {
                    if is_blank(&record[field]) {
                        return Err(execute_error(
                            "AIR_EXEC_AUTO_VALIDATION",
                            Some(format!("invariant.{}", invariant.address)),
                            format!("{field} is required"),
                        ));
                    }
                }
            }
        }
        Ok(())
    }

    fn stabilize(
        &self,
        process: &ProcessIr,
        mut record: Value,
        events: &mut Vec<Value>,
    ) -> Result<Value, V2Error> {
        let maximum = process.transitions.len() + 1;
        for _ in 0..maximum {
            let state = record[&process.state].as_str().unwrap_or("");
            let mut candidates = Vec::new();
            for transition in process.transitions.iter().filter(|transition| {
                transition.automatic && transition.from.iter().any(|from| from == state)
            }) {
                if self
                    .transition_allowed(transition, &record, true)
                    .unwrap_or(false)
                {
                    candidates.push(transition);
                }
            }
            if candidates.is_empty() {
                return Ok(record);
            }
            if candidates.len() > 1 {
                return Err(execute_error(
                    "AIR_EXEC_AUTO_AMBIGUOUS",
                    Some(format!("process.{}", process.resource)),
                    "multiple automatic transitions match",
                ));
            }
            let transition = candidates[0];
            let previous = state.to_string();
            record[&process.state] = transition.to.clone().into();
            if let Some(touch) = &process.touch {
                record[touch] = self.clock[..10].into();
            }
            if process.history {
                let event = self.history_entry(
                    &record,
                    transition,
                    &previous,
                    &transition.to,
                    true,
                    "",
                    true,
                );
                append_history(&mut record, event.clone());
                events.push(event);
            }
            self.validate(&process.resource, &record)?;
        }
        Err(execute_error(
            "AIR_EXEC_AUTO_CYCLE",
            Some(format!("process.{}", process.resource)),
            "automatic transition cycle detected",
        ))
    }

    fn history_entry(
        &self,
        record: &Value,
        transition: &TransitionIr,
        from: &str,
        to: &str,
        completed: bool,
        comment: &str,
        system: bool,
    ) -> Value {
        let count = record["_air_history"].len() + 1;
        let roles = if system {
            Vec::new()
        } else {
            self.principal.roles.clone()
        };
        object(vec![
            (
                "id",
                format!("{}:h{count}", record["id"].as_str().unwrap()).into(),
            ),
            ("transition", transition.address.clone().into()),
            ("event", transition.event.clone().into()),
            ("action", transition.action.clone().into()),
            ("from", from.into()),
            ("to", to.into()),
            (
                "actor",
                object(vec![
                    (
                        "actor",
                        if system {
                            "system".into()
                        } else {
                            self.principal
                                .actor
                                .clone()
                                .map(Value::String)
                                .unwrap_or(Value::Null)
                        },
                    ),
                    (
                        "id",
                        if system {
                            "system".into()
                        } else {
                            self.principal
                                .id
                                .clone()
                                .map(Value::String)
                                .unwrap_or(Value::Null)
                        },
                    ),
                    (
                        "roles",
                        Value::Array(roles.into_iter().map(Value::String).collect()),
                    ),
                ]),
            ),
            ("at", self.clock.clone().into()),
            ("comment", comment.into()),
            ("completed", completed.into()),
        ])
    }
}

fn principal_from_json(value: &Value) -> V2Principal {
    V2Principal {
        actor: value["actor"].as_str().map(str::to_string),
        id: value["id"].as_str().map(str::to_string),
        roles: value["roles"]
            .members()
            .filter_map(|role| role.as_str().map(str::to_string))
            .collect(),
    }
}

fn default_value(field: &FieldIr, clock: &str) -> Value {
    match field.default.as_deref() {
        Some("today") => clock[..10].into(),
        Some(value) if matches!(field.value_type.as_str(), "number" | "money") => {
            value.parse::<f64>().unwrap_or(0.0).into()
        }
        Some("true") if field.value_type == "bool" => true.into(),
        Some("false") if field.value_type == "bool" => false.into(),
        Some(value) => value.into(),
        None if field.value_type == "bool" => false.into(),
        None => "".into(),
    }
}

fn append_history(record: &mut Value, entry: Value) {
    if !record["_air_history"].is_array() {
        record["_air_history"] = Value::new_array();
    }
    record["_air_history"].push(entry).unwrap();
}

fn parse_timestamp(value: &str) -> Option<i64> {
    if value.len() < 10 {
        return None;
    }
    let year = value[0..4].parse::<i32>().ok()?;
    let month = value[5..7].parse::<u32>().ok()?;
    let day = value[8..10].parse::<u32>().ok()?;
    let mut milliseconds = days_from_civil(year, month, day) * 86_400_000;
    if value.len() >= 19 {
        milliseconds += value[11..13].parse::<i64>().ok()? * 3_600_000;
        milliseconds += value[14..16].parse::<i64>().ok()? * 60_000;
        milliseconds += value[17..19].parse::<i64>().ok()? * 1_000;
        if value.len() >= 23 && &value[19..20] == "." {
            milliseconds += value[20..23].parse::<i64>().ok()?;
        }
    }
    Some(milliseconds)
}

fn duration_end(start: &str, duration: &DurationIr) -> Option<String> {
    let mut milliseconds = parse_timestamp(start)?;
    if duration.unit == "h" {
        milliseconds += duration.amount as i64 * 3_600_000;
    } else if duration.unit == "d" {
        milliseconds += duration.amount as i64 * 86_400_000;
    } else {
        let mut remaining = duration.amount;
        while remaining > 0 {
            milliseconds += 86_400_000;
            let day = (milliseconds.div_euclid(86_400_000) + 4).rem_euclid(7);
            if day != 0 && day != 6 {
                remaining -= 1;
            }
        }
    }
    Some(format_timestamp(milliseconds))
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year - i32::from(month <= 2);
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let adjusted_month = month as i32 + if month > 2 { -3 } else { 9 };
    let doy = (153 * adjusted_month + 2) / 5 + day as i32 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe - 719468) as i64
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let days = days + 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let mut year = yoe as i32 + era as i32 * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += i32::from(month <= 2);
    (year, month as u32, day as u32)
}

fn format_timestamp(milliseconds: i64) -> String {
    let days = milliseconds.div_euclid(86_400_000);
    let within = milliseconds.rem_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    let hour = within / 3_600_000;
    let minute = within % 3_600_000 / 60_000;
    let second = within % 60_000 / 1_000;
    let millis = within % 1_000;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utc_civil_time_round_trips() {
        for value in [
            "1970-01-01T00:00:00.000Z",
            "2026-09-18T12:00:00.000Z",
            "2000-02-29T23:59:59.999Z",
        ] {
            assert_eq!(format_timestamp(parse_timestamp(value).unwrap()), value);
        }
    }
}
