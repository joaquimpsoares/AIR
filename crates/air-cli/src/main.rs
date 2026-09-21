use air_core::{
    compile, compile_v2, explain_v2, is_v2_source, workflow_v2, Program, Runtime, V2Program,
};
use std::{
    env,
    error::Error,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn main() {
    if let Err(error) = run() {
        eprintln!("airc: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();
    match args.as_slice() {
        [_, command, source] if command == "check" => {
            match load(source)? {
                Loaded::V1(program) => println!("ok: {} ({} states, {} screens)", program.name(), program.state_names().count(), program.screen_names().count()),
                Loaded::V2(program) => println!("ok: AIR v2 {} ({} resources, {} processes)", program.ir.app.id, program.ir.resources.len(), program.ir.processes.len()),
            }
        }
        [_, command, source] if command == "render" => {
            match load(source)? {
                Loaded::V1(program) => println!("{}", Runtime::new(program).view_json()?),
                Loaded::V2(_) => return Err("render is an AIR1 compatibility command; AIR v2 exposes a semantic presentation model".into()),
            }
        }
        [_, command, source] if command == "explain" => {
            let Loaded::V2(program) = load(source)? else { return Err("explain requires AIR v2 source".into()); };
            println!("{}", explain_v2(&program.ir));
        }
        [_, command, source] if command == "workflow" => {
            let Loaded::V2(program) = load(source)? else { return Err("workflow requires AIR v2 source".into()); };
            println!("{}", workflow_v2(&program.ir));
        }
        [_, command, source, flag, output] if command == "compile" && flag == "-o" => {
            let bytes = match load(source)? {
                Loaded::V1(program) => program.to_bytes(),
                Loaded::V2(program) => program.to_bytes()?,
            };
            write_output(Path::new(output), &bytes)?;
            println!("wrote {} bytes to {output}", bytes.len());
        }
        [_, command, source] if command == "inspect" => {
            let bytes = fs::read(source)?;
            if bytes.starts_with(b"AIR2") {
                println!("{}", V2Program::from_bytes(&bytes)?.canonical_json()?);
            } else if bytes.starts_with(b"AIR1") {
                let program = Program::from_bytes(&bytes)?;
                println!("AIR1 {} ({} states, {} screens)", program.name(), program.state_names().count(), program.screen_names().count());
            } else {
                return Err("unsupported AIR bytecode magic".into());
            }
        }
        [_, command, source, flag, output] if command == "build-wasm" && flag == "-o" => {
            build_wasm(Path::new(source), Path::new(output))?;
        }
        _ => {
            return Err(
                "usage: airc check APP.air | compile APP.air -o APP.airb | inspect APP.airb | explain APP.air | workflow APP.air | build-wasm APP.air -o APP.wasm"
                    .into(),
            )
        }
    }
    Ok(())
}

enum Loaded {
    V1(Program),
    V2(V2Program),
}

fn load(path: &str) -> Result<Loaded, Box<dyn Error>> {
    let source = fs::read_to_string(path)?;
    if is_v2_source(&source) {
        Ok(Loaded::V2(compile_v2(&source)?))
    } else {
        Ok(Loaded::V1(compile(&source)?))
    }
}

fn write_output(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)?;
    Ok(())
}

fn build_wasm(source: &Path, output: &Path) -> Result<(), Box<dyn Error>> {
    let source = source.canonicalize()?;
    let text = fs::read_to_string(&source)?;
    let bytes = if is_v2_source(&text) {
        compile_v2(&text)?.to_bytes()?
    } else {
        compile(&text)?.to_bytes()
    }; // Fail before invoking Cargo.

    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()?;
    let status = Command::new("cargo")
        .current_dir(&workspace)
        .args([
            "build",
            "--quiet",
            "--release",
            "--target",
            "wasm32-unknown-unknown",
            "-p",
            "air-runtime",
        ])
        .status()?;
    if !status.success() {
        return Err(
            "Rust Wasm build failed; install the wasm32-unknown-unknown target with rustup".into(),
        );
    }
    let built = workspace.join("target/wasm32-unknown-unknown/release/air_runtime.wasm");
    let mut wasm = fs::read(&built)?;
    append_custom_section(&mut wasm, "air.program", &bytes);
    if let Some(parent) = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, wasm)?;
    println!("wrote {}", output.display());
    Ok(())
}

fn append_custom_section(wasm: &mut Vec<u8>, name: &str, payload: &[u8]) {
    let mut section = Vec::with_capacity(name.len() + payload.len() + 8);
    encode_leb128(name.len() as u32, &mut section);
    section.extend_from_slice(name.as_bytes());
    section.extend_from_slice(payload);
    wasm.push(0); // WebAssembly custom section ID.
    encode_leb128(section.len() as u32, wasm);
    wasm.extend_from_slice(&section);
}

fn encode_leb128(mut value: u32, output: &mut Vec<u8>) {
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        output.push(byte);
        if value == 0 {
            break;
        }
    }
}
