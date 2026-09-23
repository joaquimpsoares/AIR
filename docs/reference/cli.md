# AIR CLI Reference

Complete reference for all verified CLI commands in `tools/air-cli.mjs`.

---

## 🛠️ Command Invocation

Run the CLI using Node.js directly:
```bash
node tools/air-cli.mjs <command> [arguments]
```
Or through npm script:
```bash
npm run air -- <command> [arguments]
```

---

## 📋 Available Commands

### 1. `air check <app.air>`
- **Purpose**: Parse and semantically validate an `.air` source file.
- **Syntax**: `node tools/air-cli.mjs check <path/to/app.air>`
- **Example**:
  ```bash
  node tools/air-cli.mjs check showcase/customer-manager/app.air
  ```
- **Output**: `valid AIR v2: customer_manager`
- **Failure**: Returns exit code 1 with line number, error code, and failure diagnostic.

---

### 2. `air explain <app.air>`
- **Purpose**: Output a human-readable summary of declared resources, management screens, access policies, and overview insights.
- **Syntax**: `node tools/air-cli.mjs explain <path/to/app.air>`
- **Example**:
  ```bash
  node tools/air-cli.mjs explain showcase/approval-workflow/app.air
  ```

---

### 3. `air workflow <app.air>`
- **Purpose**: Output ASCII diagram of state machines, transitions, authority roles, and separation of duty rules.
- **Syntax**: `node tools/air-cli.mjs workflow <path/to/app.air>`
- **Example**:
  ```bash
  node tools/air-cli.mjs workflow showcase/approval-workflow/app.air
  ```

---

### 4. `air diff <old.air> <new.air>`
- **Purpose**: Generate a high-level semantic diff between two AIR definitions.
- **Syntax**: `node tools/air-cli.mjs diff <old.air> <new.air>`
- **Example**:
  ```bash
  node tools/air-cli.mjs diff showcase/customer-manager/app.air showcase/approval-workflow/app.air
  ```

---

### 5. `air status`
- **Purpose**: Report active runtime health, adapter status, and memory cache diagnostics.
- **Syntax**: `node tools/air-cli.mjs status`

---

### 6. `air inspect capabilities <app.air>`
- **Purpose**: List all system capabilities required by the application (e.g. `storage.local`, `auth.rbac`, `temporal.intervals`).
- **Syntax**: `node tools/air-cli.mjs inspect capabilities <app.air>`

---

### 7. `air security status`
- **Purpose**: Check active security invariants and incident audit logs.
- **Syntax**: `node tools/air-cli.mjs security status`
