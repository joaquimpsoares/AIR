use air_core::{compile_v2, V2Principal, V2Program, V2Runtime};
use json::JsonValue;
use std::{
    fs,
    path::{Path, PathBuf},
};

fn corpus() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../conformance")
}

fn names(directory: &Path, suffix: &str) -> Vec<PathBuf> {
    let mut values: Vec<_> = fs::read_dir(directory)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.file_name()
                .unwrap()
                .to_string_lossy()
                .ends_with(suffix)
        })
        .collect();
    values.sort();
    values
}

#[test]
fn valid_fixtures_match_shared_canonical_ir() {
    for source in names(&corpus().join("valid"), ".air") {
        let program = compile_v2(&fs::read_to_string(&source).unwrap())
            .unwrap_or_else(|error| panic!("{}: {error}", source.display()));
        let expected =
            json::parse(&fs::read_to_string(source.with_extension("expected.json")).unwrap())
                .unwrap();
        let actual = json::parse(&program.canonical_json().unwrap()).unwrap();
        assert_eq!(actual, expected, "{}", source.display());
        let bytes = program.to_bytes().unwrap();
        let decoded = V2Program::from_bytes(&bytes).unwrap();
        assert_eq!(
            decoded.ir,
            program.ir,
            "{} AIR2 round trip",
            source.display()
        );
        assert_eq!(
            decoded.to_bytes().unwrap(),
            bytes,
            "{} deterministic AIR2",
            source.display()
        );
    }
}

#[test]
fn invalid_fixtures_match_stable_error_contract() {
    for source in names(&corpus().join("invalid"), ".air") {
        let expected =
            json::parse(&fs::read_to_string(source.with_extension("error.json")).unwrap()).unwrap();
        let error =
            compile_v2(&fs::read_to_string(&source).unwrap()).expect_err(source.to_str().unwrap());
        assert_eq!(
            error.code,
            expected["code"].as_str().unwrap(),
            "{} code",
            source.display()
        );
        assert_eq!(
            error.phase,
            expected["phase"].as_str().unwrap(),
            "{} phase",
            source.display()
        );
        assert_eq!(
            error.location.as_ref().map(|location| location.line),
            expected["line"].as_usize(),
            "{} line",
            source.display()
        );
        assert_eq!(
            error.path.as_deref(),
            expected["path"].as_str(),
            "{} path",
            source.display()
        );
    }
}

#[test]
fn canonical_pairs_compile_to_identical_structures() {
    for manifest_path in names(&corpus().join("canonical"), ".pair.json") {
        let manifest = json::parse(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
        let directory = manifest_path.parent().unwrap();
        let programs: Vec<JsonValue> = manifest["sources"]
            .members()
            .map(|source| {
                let program = compile_v2(
                    &fs::read_to_string(directory.join(source.as_str().unwrap())).unwrap(),
                )
                .unwrap();
                json::parse(&program.canonical_json().unwrap()).unwrap()
            })
            .collect();
        for value in &programs[1..] {
            assert_eq!(value, &programs[0], "{}", manifest_path.display());
        }
    }
}

#[test]
fn all_reference_apps_compile_and_round_trip_air2() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    for name in ["customer-manager", "expense-approval", "content-publishing"] {
        let program =
            compile_v2(&fs::read_to_string(root.join(format!("apps/{name}.air"))).unwrap())
                .unwrap();
        assert_eq!(
            V2Program::from_bytes(&program.to_bytes().unwrap())
                .unwrap()
                .ir,
            program.ir,
            "{name}"
        );
    }
}

fn object(entries: Vec<(&str, JsonValue)>) -> JsonValue {
    let mut value = JsonValue::new_object();
    for (key, entry) in entries {
        value[key] = entry;
    }
    value
}

fn principal(value: &JsonValue) -> V2Principal {
    V2Principal {
        actor: value["actor"].as_str().map(str::to_string),
        id: value["id"].as_str().map(str::to_string),
        roles: value["roles"]
            .members()
            .filter_map(|role| role.as_str().map(str::to_string))
            .collect(),
    }
}

fn project_event(event: &JsonValue) -> JsonValue {
    object(vec![
        ("transition", event["transition"].clone()),
        ("event", event["event"].clone()),
        ("from", event["from"].clone()),
        ("to", event["to"].clone()),
        ("actor", event["actor"].clone()),
        ("at", event["at"].clone()),
        ("comment", event["comment"].clone()),
        ("completed", event["completed"].clone()),
    ])
}

#[test]
fn execution_fixtures_match_shared_results() {
    let directory = corpus().join("execution");
    for case_path in names(&directory, ".case.json") {
        let case = json::parse(&fs::read_to_string(&case_path).unwrap()).unwrap();
        let source = fs::read_to_string(directory.join(case["program"].as_str().unwrap())).unwrap();
        let program = compile_v2(&source).unwrap();
        let seed = if let Some(seed_file) = case["seedFile"].as_str() {
            json::parse(&fs::read_to_string(directory.join(seed_file)).unwrap()).unwrap()
        } else {
            case["seed"].clone()
        };
        let mut runtime = V2Runtime::new(
            program.ir,
            seed,
            principal(&case["principal"]),
            case["clock"].as_str().unwrap(),
        )
        .unwrap();
        let mut actual = JsonValue::new_array();
        for step in case["steps"].members() {
            if !step["principal"].is_null() {
                runtime.principal = principal(&step["principal"]);
            }
            match step["op"].as_str().unwrap() {
                "transition" => {
                    let resource = step["resource"].as_str().unwrap();
                    let id = step["id"].as_str().unwrap();
                    let state_field = runtime
                        .ir
                        .processes
                        .iter()
                        .find(|process| process.resource == resource)
                        .unwrap()
                        .state
                        .clone();
                    match runtime.transition(
                        resource,
                        id,
                        step["action"].as_str().unwrap(),
                        step["input"]["comment"].as_str().unwrap_or(""),
                    ) {
                        Ok(result) => actual
                            .push(object(vec![
                                ("op", "transition".into()),
                                ("allowed", true.into()),
                                ("completed", result.completed.into()),
                                ("state", result.record[&state_field].clone()),
                                ("approvals", result.approvals.into()),
                                ("approvalsRequired", result.approvals_required.into()),
                                (
                                    "events",
                                    JsonValue::Array(
                                        result.events.iter().map(project_event).collect(),
                                    ),
                                ),
                            ]))
                            .unwrap(),
                        Err(error) => actual
                            .push(object(vec![
                                ("op", "transition".into()),
                                ("allowed", false.into()),
                                ("code", error.code.into()),
                                ("phase", error.phase.into()),
                                (
                                    "state",
                                    runtime.get(resource, id).unwrap()[&state_field].clone(),
                                ),
                                (
                                    "historyLength",
                                    (runtime.history(resource, id).unwrap().len() as u32).into(),
                                ),
                            ]))
                            .unwrap(),
                    }
                }
                "status" => {
                    let mut status = runtime
                        .workflow_status(
                            step["resource"].as_str().unwrap(),
                            step["id"].as_str().unwrap(),
                        )
                        .unwrap();
                    status.insert("op", "status").unwrap();
                    actual.push(status).unwrap();
                }
                operation => panic!("unknown operation {operation}"),
            }
        }
        let expected_path = PathBuf::from(
            case_path
                .to_string_lossy()
                .replace(".case.json", ".expected.json"),
        );
        let expected = json::parse(&fs::read_to_string(expected_path).unwrap()).unwrap();
        assert_eq!(actual, expected, "{}", case_path.display());
    }
}
