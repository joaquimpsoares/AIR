use air_core::{compile, Phase};

fn validation_error(source: &str, expected: &str) {
    let error = compile(source).expect_err("program should fail validation");
    assert_eq!(error.phase, Phase::Validate);
    assert!(
        error.message.contains(expected),
        "expected {:?} to contain {expected:?}",
        error.message
    );
}

#[test]
fn unknown_state_in_set_is_a_hard_error() {
    validation_error(
        r#"app bad { start main; screen main { button "Go" { set missing = 1; } } }"#,
        "unknown state `missing`",
    );
}

#[test]
fn unknown_state_in_template_is_a_hard_error() {
    validation_error(
        r#"app bad { start main; screen main { text "{missing}"; } }"#,
        "unknown state `missing`",
    );
}

#[test]
fn unknown_start_screen_is_a_hard_error() {
    validation_error(
        r#"app bad { start missing; screen main { text "x"; } }"#,
        "unknown screen `missing`",
    );
}

#[test]
fn unknown_navigation_screen_is_a_hard_error() {
    validation_error(
        r#"app bad { start main; screen main { button "Go" { navigate missing; } } }"#,
        "unknown screen `missing`",
    );
}

#[test]
fn duplicate_names_are_rejected() {
    validation_error(
        r#"app bad {
            state x: text = "a";
            state x: text = "b";
            start main;
            screen main { text "x"; }
        }"#,
        "duplicate state `x`",
    );
    validation_error(
        r#"app bad {
            start main;
            screen main { text "x"; }
            screen main { text "y"; }
        }"#,
        "duplicate screen `main`",
    );
}

#[test]
fn assignments_are_statically_typed() {
    validation_error(
        r#"app bad {
            state count: number = 0;
            start main;
            screen main { button "Go" { set count = "many"; } }
        }"#,
        "expects number, found text",
    );
}

#[test]
fn conditions_must_be_bool() {
    validation_error(
        r#"app bad {
            state count: number = 0;
            start main;
            screen main { if count { text "x"; } }
        }"#,
        "if condition expects bool, found number",
    );
}

#[test]
fn event_is_scoped_to_input_handlers() {
    validation_error(
        r#"app bad {
            state value: text = "";
            start main;
            screen main { button "Go" { set value = event; } }
        }"#,
        "`event` is only available",
    );
}

#[test]
fn bool_state_cannot_back_a_text_input() {
    validation_error(
        r#"app bad {
            state enabled: bool = false;
            start main;
            screen main { input "Enabled" value enabled { set enabled = event; } }
        }"#,
        "cannot edit bool state",
    );
}

#[test]
fn declarations_require_matching_initial_types() {
    validation_error(
        r#"app bad {
            state count: number = "zero";
            start main;
            screen main { text "x"; }
        }"#,
        "declared number but initialized with text",
    );
}

#[test]
fn malformed_source_is_not_treated_as_validation_success() {
    let error = compile("app broken {").unwrap_err();
    assert_eq!(error.phase, Phase::Parse);
}
