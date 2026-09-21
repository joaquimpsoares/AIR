//! Compiler and deterministic runtime for the AIR intermediate representation.
//!
//! AIR deliberately has no escape hatch to arbitrary code. Source is parsed,
//! name-resolved, and type-checked before it can be encoded for the runtime.

mod binary;
mod compiler;
mod error;
mod lexer;
mod model;
mod parser;
mod runtime;
pub mod v2;
mod v2_runtime;

pub use compiler::compile;
pub use error::{AirError, Phase};
pub use model::{Program, Value, ValueType};
pub use runtime::{Event, Runtime, RuntimeError};
pub use v2::{
    compile_v2, compile_v2_with_extensions, explain_v2, is_v2_source, workflow_v2, SemanticIr,
    V2Error, V2Program,
};
pub use v2_runtime::{V2Principal, V2Runtime, V2TransitionResult};
