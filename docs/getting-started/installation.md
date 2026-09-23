# Installation & Requirements

Follow this verified guide to set up AIR on your local machine.

---

## 📋 Prerequisites

Before installing AIR, ensure you have the following installed:
- **Node.js**: Version `18.0.0` or higher (recommended: Node 20+ LTS).
- **npm**: Version `9.0.0` or higher (bundled with Node.js).
- **Git**: For cloning the repository.
- *(Optional)* **Rust toolchain** (`cargo`): Only required if building the WebAssembly/Rust runtime kernel from source.

Verify your environment:
```bash
node --version
npm --version
git --version
```

---

## 📥 1. Clone the Repository

Clone the canonical AIR repository from GitHub:

```bash
git clone https://github.com/joaquimpsoares/AIR.git
cd AIR
```

---

## 📦 2. Install Dependencies

Install the project dependencies:

```bash
npm install
```

---

## 🔍 3. Verify the Installation

Run the automated test suite to confirm the platform is operational:

```bash
npm test
```

You should see all 345+ tests pass cleanly.

---

## 🛠️ 4. Test the CLI

Run the AIR CLI to verify command availability:

```bash
node tools/air-cli.mjs status
```

Or run validation on a canonical example:

```bash
node tools/air-cli.mjs check showcase/customer-manager/app.air
```

Expected output:
```
valid AIR v2: customer_manager
```

---

## 🌐 5. Start the Local Showcase Server

Launch the development server:

```bash
npm run dev
```

Open your browser and navigate to:
👉 **`http://127.0.0.1:4173/`**

---

## 🚀 Next Step
- **[Create Your First Application](first-application.md)**
