#!/bin/sh
set -eu

if command -v cc >/dev/null 2>&1; then
  cargo build -p air-cli
  exec cargo test --workspace
fi

if rustup target list --installed | grep -qx x86_64-unknown-linux-musl; then
  CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=rust-lld \
    cargo build --target x86_64-unknown-linux-musl -p air-cli
  CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=rust-lld \
    exec cargo test --workspace --target x86_64-unknown-linux-musl
fi

exec cargo test --workspace
