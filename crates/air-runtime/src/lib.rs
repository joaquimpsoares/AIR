//! Small Wasm ABI around the deterministic AIR runtime.
//!
//! A native shell reads the JSON view tree and sends click/change events. The
//! app itself contains only prevalidated AIR bytecode and this Rust runtime.

use air_core::{Event, Program, Runtime, V2Program, V2Runtime};
use std::sync::{Mutex, OnceLock};

const OK: u32 = 0;
const ERROR: u32 = 1;

struct Host {
    runtime: Option<Runtime>,
    v2: Option<V2Program>,
    v2_runtime: Option<V2Runtime>,
    view: Vec<u8>,
    buffer: Vec<u8>,
    error: Vec<u8>,
}

impl Host {
    fn new() -> Self {
        Self {
            runtime: None,
            v2: None,
            v2_runtime: None,
            view: Vec::new(),
            buffer: Vec::new(),
            error: b"AIR program not loaded".to_vec(),
        }
    }

    fn refresh(&mut self) {
        if let Some(runtime) = self.runtime.as_ref() {
            match runtime.view_json() {
                Ok(view) => {
                    self.view = view.into_bytes();
                    self.error.clear();
                }
                Err(error) => self.error = error.to_string().into_bytes(),
            }
        } else if let Some(program) = self.v2.as_ref() {
            match program.canonical_json() {
                Ok(model) => {
                    self.view = model.into_bytes();
                    self.error.clear();
                }
                Err(error) => self.error = error.to_string().into_bytes(),
            }
        } else {
            self.error = b"AIR program not loaded".to_vec();
        }
    }

    fn dispatch(&mut self, event: Event) -> u32 {
        let Some(runtime) = self.runtime.as_mut() else {
            self.error = if self.v2.is_some() {
                b"AIR v2 uses semantic data/action host calls; AIR1 click/change events are unsupported".to_vec()
            } else {
                b"AIR program not loaded".to_vec()
            };
            return ERROR;
        };
        match runtime.dispatch(event) {
            Ok(()) => {
                self.refresh();
                if self.error.is_empty() {
                    OK
                } else {
                    ERROR
                }
            }
            Err(error) => {
                self.error = error.to_string().into_bytes();
                ERROR
            }
        }
    }
}

fn host() -> &'static Mutex<Host> {
    static HOST: OnceLock<Mutex<Host>> = OnceLock::new();
    HOST.get_or_init(|| Mutex::new(Host::new()))
}

#[no_mangle]
pub extern "C" fn air_init() -> u32 {
    let mut host = host().lock().unwrap();
    if let Some(runtime) = host.runtime.as_mut() {
        runtime.reset();
    } else if host.v2.is_none() {
        host.error = b"AIR program not loaded".to_vec();
        return ERROR;
    }
    host.refresh();
    if host.error.is_empty() {
        OK
    } else {
        ERROR
    }
}

#[no_mangle]
pub extern "C" fn air_click(target: u32) -> u32 {
    host().lock().unwrap().dispatch(Event::Click { target })
}

/// Resizes the shared transfer buffer and returns its address in Wasm memory.
/// The host uses it for either `air_load` or `air_change`.
#[no_mangle]
pub extern "C" fn air_buffer(len: u32) -> *mut u8 {
    let mut host = host().lock().unwrap();
    host.buffer.resize(len as usize, 0);
    host.buffer.as_mut_ptr()
}

/// Loads compiler-validated AIR bytecode copied from the `air.program` custom
/// section. The decoder repeats structural checks as a defense at the boundary.
#[no_mangle]
pub extern "C" fn air_load(len: u32) -> u32 {
    let mut host = host().lock().unwrap();
    let len = len as usize;
    if len > host.buffer.len() {
        host.error = b"program length exceeds shared buffer".to_vec();
        return ERROR;
    }
    let bytes = host.buffer[..len].to_vec();
    if bytes.starts_with(b"AIR2") {
        match V2Program::from_bytes(&bytes) {
            Ok(program) => {
                host.runtime = None;
                host.v2_runtime = None;
                host.v2 = Some(program);
                host.refresh();
                return if host.error.is_empty() { OK } else { ERROR };
            }
            Err(error) => {
                host.error = error.to_string().into_bytes();
                return ERROR;
            }
        }
    }
    match Program::from_bytes(&bytes) {
        Ok(program) => {
            host.runtime = Some(Runtime::new(program));
            host.v2 = None;
            host.v2_runtime = None;
            host.refresh();
            if host.error.is_empty() {
                OK
            } else {
                ERROR
            }
        }
        Err(error) => {
            host.error = error.to_string().into_bytes();
            ERROR
        }
    }
}

#[no_mangle]
pub extern "C" fn air_change(target: u32, len: u32) -> u32 {
    let mut host = host().lock().unwrap();
    let len = len as usize;
    if len > host.buffer.len() {
        host.error = b"input length exceeds shared buffer".to_vec();
        return ERROR;
    }
    let value = match std::str::from_utf8(&host.buffer[..len]) {
        Ok(value) => value.to_owned(),
        Err(_) => {
            host.error = b"input is not valid UTF-8".to_vec();
            return ERROR;
        }
    };
    host.dispatch(Event::Change { target, value })
}

fn buffer_text(host: &mut Host, len: u32) -> Result<String, u32> {
    let len = len as usize;
    if len > host.buffer.len() {
        host.error = b"input length exceeds shared buffer".to_vec();
        return Err(ERROR);
    }
    match std::str::from_utf8(&host.buffer[..len]) {
        Ok(value) => Ok(value.to_owned()),
        Err(_) => {
            host.error = b"input is not valid UTF-8".to_vec();
            Err(ERROR)
        }
    }
}

/// Starts the AIR v2 semantic runtime. The shared buffer contains JSON with
/// `seed`, `principal`, and an ISO UTC `clock`.
#[no_mangle]
pub extern "C" fn air_v2_start(len: u32) -> u32 {
    let mut host = host().lock().unwrap();
    let input = match buffer_text(&mut host, len) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let Some(program) = host.v2.as_ref() else {
        host.error = b"AIR v2 program not loaded".to_vec();
        return ERROR;
    };
    match V2Runtime::from_context_json(program.ir.clone(), &input) {
        Ok(runtime) => {
            host.v2_runtime = Some(runtime);
            host.error.clear();
            OK
        }
        Err(error) => {
            host.error = error.to_string().into_bytes();
            ERROR
        }
    }
}

/// Executes one requested AIR v2 transition. The result JSON is exposed through
/// `air_view_ptr`/`air_view_len`; failures are atomic and use the error buffer.
#[no_mangle]
pub extern "C" fn air_v2_transition(len: u32) -> u32 {
    let mut host = host().lock().unwrap();
    let input = match buffer_text(&mut host, len) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let Some(runtime) = host.v2_runtime.as_mut() else {
        host.error = b"AIR v2 runtime not started".to_vec();
        return ERROR;
    };
    match runtime.transition_request_json(&input) {
        Ok(result) => {
            host.view = result.into_bytes();
            host.error.clear();
            OK
        }
        Err(error) => {
            host.error = error.to_string().into_bytes();
            ERROR
        }
    }
}

#[no_mangle]
pub extern "C" fn air_v2_status(len: u32) -> u32 {
    let mut host = host().lock().unwrap();
    let input = match buffer_text(&mut host, len) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let Some(runtime) = host.v2_runtime.as_ref() else {
        host.error = b"AIR v2 runtime not started".to_vec();
        return ERROR;
    };
    match runtime.status_request_json(&input) {
        Ok(result) => {
            host.view = result.into_bytes();
            host.error.clear();
            OK
        }
        Err(error) => {
            host.error = error.to_string().into_bytes();
            ERROR
        }
    }
}

#[no_mangle]
pub extern "C" fn air_view_ptr() -> *const u8 {
    host().lock().unwrap().view.as_ptr()
}

#[no_mangle]
pub extern "C" fn air_view_len() -> u32 {
    host().lock().unwrap().view.len() as u32
}

#[no_mangle]
pub extern "C" fn air_error_ptr() -> *const u8 {
    host().lock().unwrap().error.as_ptr()
}

#[no_mangle]
pub extern "C" fn air_error_len() -> u32 {
    host().lock().unwrap().error.len() as u32
}

#[no_mangle]
pub extern "C" fn air_abi_version() -> u32 {
    2
}
