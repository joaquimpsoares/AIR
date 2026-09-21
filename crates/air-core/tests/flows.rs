use air_core::{compile, Event, Runtime, Value};

const HELLO: &str = include_str!("../../../samples/hello.air");
const CALCULATOR: &str = include_str!("../../../samples/calculator.air");
const NOTES: &str = include_str!("../../../samples/notes.air");

fn click(runtime: &mut Runtime, label: &str) {
    let target = runtime.visible_control_id(label).unwrap().unwrap();
    runtime.dispatch(Event::Click { target }).unwrap();
}

fn change(runtime: &mut Runtime, label: &str, value: &str) {
    let target = runtime.visible_control_id(label).unwrap().unwrap();
    runtime
        .dispatch(Event::Change {
            target,
            value: value.to_owned(),
        })
        .unwrap();
}

#[test]
fn hello_settings_flow_updates_the_home_screen() {
    let mut runtime = Runtime::new(compile(HELLO).unwrap());
    assert_eq!(runtime.current_screen(), "home");
    assert!(runtime.view_json().unwrap().contains("Hello, Joaquim"));

    click(&mut runtime, "Settings");
    assert_eq!(runtime.current_screen(), "settings");
    assert!(runtime
        .view_json()
        .unwrap()
        .contains("\"value\":\"Joaquim\""));

    change(&mut runtime, "Name", "Jo");
    click(&mut runtime, "Save");
    assert_eq!(runtime.current_screen(), "home");
    assert!(runtime.view_json().unwrap().contains("Hello, Jo"));
    assert_eq!(runtime.state("name").unwrap(), &Value::Text("Jo".into()));
}

#[test]
fn hello_cancel_discards_the_draft() {
    let mut runtime = Runtime::new(compile(HELLO).unwrap());
    click(&mut runtime, "Settings");
    change(&mut runtime, "Name", "Discard me");
    click(&mut runtime, "Cancel");
    assert!(runtime.view_json().unwrap().contains("Hello, Joaquim"));
    click(&mut runtime, "Settings");
    assert_eq!(
        runtime.state("draft_name").unwrap(),
        &Value::Text("Joaquim".into())
    );
}

#[test]
fn calculator_evaluates_all_four_operations() {
    let mut runtime = Runtime::new(compile(CALCULATOR).unwrap());
    change(&mut runtime, "Left", "12");
    change(&mut runtime, "Right", "4");

    for (operation, expected) in [
        ("Add", 16.0),
        ("Subtract", 8.0),
        ("Multiply", 48.0),
        ("Divide", 3.0),
    ] {
        click(&mut runtime, operation);
        assert_eq!(runtime.state("result").unwrap(), &Value::Number(expected));
    }
    assert!(runtime.view_json().unwrap().contains("12 / 4 = 3"));
}

#[test]
fn failed_events_are_atomic() {
    let mut runtime = Runtime::new(compile(CALCULATOR).unwrap());
    change(&mut runtime, "Left", "12");
    change(&mut runtime, "Right", "0");
    let divide = runtime.visible_control_id("Divide").unwrap().unwrap();
    let error = runtime
        .dispatch(Event::Click { target: divide })
        .unwrap_err();
    assert_eq!(error.message(), "division by zero");
    assert_eq!(runtime.state("operator").unwrap(), &Value::Text("+".into()));
    assert_eq!(runtime.state("result").unwrap(), &Value::Number(0.0));
}

#[test]
fn malformed_number_does_not_change_state() {
    let mut runtime = Runtime::new(compile(CALCULATOR).unwrap());
    let left = runtime.visible_control_id("Left").unwrap().unwrap();
    let error = runtime
        .dispatch(Event::Change {
            target: left,
            value: "twelve".into(),
        })
        .unwrap_err();
    assert!(error.message().contains("not a valid number"));
    assert_eq!(runtime.state("left").unwrap(), &Value::Number(0.0));
}

#[test]
fn notes_conditional_controls_are_inactive_when_hidden() {
    let mut runtime = Runtime::new(compile(NOTES).unwrap());
    assert!(runtime.view_json().unwrap().contains("No saved note"));
    // IDs are assigned at compile time; Clear is stable ID 3 even while hidden.
    let error = runtime.dispatch(Event::Click { target: 3 }).unwrap_err();
    assert!(error.message().contains("unknown or inactive"));

    change(&mut runtime, "Note", "Buy milk");
    click(&mut runtime, "Save");
    assert!(runtime.view_json().unwrap().contains("Saved: Buy milk"));
    click(&mut runtime, "Clear");
    assert!(runtime.view_json().unwrap().contains("No saved note"));
}

#[test]
fn the_same_event_trace_is_deterministic() {
    fn trace() -> Vec<String> {
        let mut runtime = Runtime::new(compile(HELLO).unwrap());
        let mut views = vec![runtime.view_json().unwrap()];
        click(&mut runtime, "Settings");
        views.push(runtime.view_json().unwrap());
        change(&mut runtime, "Name", "Ada");
        views.push(runtime.view_json().unwrap());
        click(&mut runtime, "Save");
        views.push(runtime.view_json().unwrap());
        views
    }
    assert_eq!(trace(), trace());
}

#[test]
fn binary_encoding_is_stable_and_round_trips() {
    let first = compile(HELLO).unwrap();
    let second = compile(HELLO).unwrap();
    let bytes = first.to_bytes();
    assert_eq!(bytes, second.to_bytes());
    let decoded = air_core::Program::from_bytes(&bytes).unwrap();
    assert_eq!(decoded.to_bytes(), bytes);
    assert_eq!(
        Runtime::new(first).view_json().unwrap(),
        Runtime::new(decoded).view_json().unwrap()
    );
}

#[test]
fn corrupt_binary_is_rejected() {
    let mut bytes = compile(HELLO).unwrap().to_bytes();
    bytes[0] = b'X';
    let error = air_core::Program::from_bytes(&bytes).unwrap_err();
    assert!(error.message.contains("magic"));

    let mut bytes = compile(HELLO).unwrap().to_bytes();
    bytes.push(0);
    let error = air_core::Program::from_bytes(&bytes).unwrap_err();
    assert!(error.message.contains("trailing bytes"));
}
