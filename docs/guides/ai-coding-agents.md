# Using AIR with AI Coding Agents

How coding agents (ChatGPT, Claude, Gemini, Cursor, Copilot, Cline) interact with AIR for high-velocity, reliable software generation.

---

## 🎯 The Agent Problem AIR Solves

Conventional AI code generation ("vibe coding") suffers from:
1. **Context Bloat**: Emitting full React/TypeScript components, Tailwind classes, and server API handlers consumes thousands of output tokens per prompt.
2. **Hallucinations in Plumbing**: Agents make subtle bugs in pagination state, focus trapping, form dirty tracking, and responsive layout queries.
3. **Huge Code Diffs**: Humans must review 500+ line diffs across multiple files for minor feature additions.

### How AIR Changes the Workflow

```
+-----------------------------------------------------------------------------+
| CONVENTIONAL AI WORKFLOW (High token cost, large diffs, brittle)            |
| Prompt -> LLM generates 10 files (React, CSS, SQL, Redux, API) -> Errors   |
+-----------------------------------------------------------------------------+

+-----------------------------------------------------------------------------+
| AIR AI-FIRST WORKFLOW (Compact token cost, deterministic, reviewable)       |
| Prompt -> LLM generates 25 lines of .air -> AIR Compiler verifies -> App   |
+-----------------------------------------------------------------------------+
```

---

## 💬 Vendor-Neutral Agent Prompt Examples

You can prompt your AI assistant directly with high-level business requirements:

### Prompt 1: New Resource Definition
> *"Create an AIR resource for Warehouses with a code, name, geographic region enum (North America, Europe, Asia-Pacific), and active boolean status. Make it manageable and accessible by operators."*

**Expected Agent Output:**
```air
resource warehouses label=name
field warehouses.code text required min=3 unique
field warehouses.name text required min=2
field warehouses.region enum values=NorthAmerica,Europe,AsiaPacific required default=NorthAmerica
field warehouses.status enum values=Active,Inactive required default=Active

manage warehouses lifecycle=archive
access warehouses view=role:operator|role:admin edit=role:operator|role:admin
```

---

### Prompt 2: Adding a Guarded Workflow
> *"Add an expense approval workflow to expenses where employees can submit Draft expenses, and managers can approve or reject them. Rejections must require a comment."*

**Expected Agent Output:**
```air
process expenses state=status initial=Draft terminal=Approved,Rejected history touch=updated_at
transition expenses.submit from=Draft to=Submitted action=submit by=owner:submitter event=submitted
transition expenses.approve from=Submitted to=Approved action=approve by=role:manager separate=submitter event=approved
transition expenses.reject from=Submitted to=Rejected action=reject by=role:manager separate=submitter comment=required event=rejected
```

---

### Prompt 3: Full Application Generation
> *"Generate a complete AIR application for a Fleet Manager with vehicles, mileage, status lifecycle, and overview statistics."*

**Expected Agent Output:**
```air
air version=2
app fleet_manager title="Fleet Manager" subtitle="Vehicle tracking and maintenance lifecycle" initial=overview
theme mode=dark accent=blue
capability storage.local

resource vehicles label=license_plate
field vehicles.license_plate text required unique min=5
field vehicles.model text required
field vehicles.mileage integer required default=0
field vehicles.status enum values=Available,InService,Maintenance,Retired required default=Available
field vehicles.last_inspected date required default=today

manage vehicles lifecycle=archive
access vehicles view=role:admin|role:driver edit=role:admin

process vehicles state=status initial=Available terminal=Retired
transition vehicles.dispatch from=Available to=InService action=dispatch by=role:admin event=dispatched
transition vehicles.return from=InService to=Available action=return by=role:admin event=returned
transition vehicles.service from=Available,InService to=Maintenance action=service by=role:admin comment=required event=serviced
transition vehicles.release from=Maintenance to=Available action=release by=role:admin event=released
transition vehicles.retire from=Available,Maintenance to=Retired action=retire by=role:admin comment=required event=retired

overview
insight vehicles.total op=count field=license_plate label="Total Vehicles"
insight vehicles.available op=count field=license_plate where="status==Available" label="Available Fleet"
```

---

## 🔍 First-Class Human Reviewability

Because AIR changes are compact semantic diffs, humans can easily verify:
- Did the AI set the right access permissions (`access view=... edit=...`)?
- Are the transition authority policies correct (`by=role:manager separate=submitter`)?
- Are constraints properly enforced (`unique`, `min=...`, `required`)?

The human reviews **business truth**, while the compiler guarantees **mechanics and layout**.
