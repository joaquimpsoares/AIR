# Writing AIR by Hand

A step-by-step tutorial on constructing an AIR application incrementally from scratch.

---

## 🪜 Step 1: App Header & Header Declarations

Every AIR file begins with the compiler version and application metadata:

```air
air version=2
app project_tracker title="Project Tracker" subtitle="Team deliverables and milestones" initial=overview
theme mode=dark accent=violet
capability storage.local
# ... resources and management added in steps below
```

---

## 🪜 Step 2: Define a Resource and Scalar Fields

Declare the data structure for projects:

```air
resource projects label=name
field projects.name text required min=3
field projects.client text required
field projects.budget money currency=USD required default=0
field projects.status enum values=Planning,Active,Completed,OnHold required default=Planning
field projects.start_date date required default=today
field projects.deadline date required default=today
```

---

## 🪜 Step 3: Enable Managed UI & Access Controls

Expose full CRUD, search, filter, and drawer support:

```air
manage projects lifecycle=archive
access projects view=role:admin|role:lead|role:member edit=role:admin|role:lead
```

---

## 🪜 Step 4: Add Workflows & State Transitions

Define state progression with role-based authority:

```air
process projects state=status initial=Planning terminal=Completed,OnHold
transition projects.activate from=Planning to=Active action=activate by=role:lead event=activated
transition projects.complete from=Active to=Completed action=complete by=role:lead event=completed
transition projects.hold from=Planning,Active to=OnHold action=put_on_hold by=role:lead comment=required event=held
```

---

## 🪜 Step 5: Add Visual Highlights & Dashboard Insights

Add UI cues and overview analytics:

```air
highlight projects.active when="status==Active" tone=positive
highlight projects.on_hold when="status==OnHold" tone=warning

overview
insight projects.total op=count field=name label="Total Projects"
insight projects.total_budget op=sum field=budget label="Total Budget Allocated"
```

---

## 🪜 Step 6: Complete Assembled Application

Here is the complete assembled `app.air` file:

```air
air version=2
app project_tracker title="Project Tracker" subtitle="Team deliverables and milestones" initial=overview
theme mode=dark accent=violet
capability storage.local

resource projects label=name
field projects.name text required min=3
field projects.client text required
field projects.budget money currency=USD required default=0
field projects.status enum values=Planning,Active,Completed,OnHold required default=Planning
field projects.start_date date required default=today
field projects.deadline date required default=today

manage projects lifecycle=archive
access projects view=role:admin|role:lead|role:member edit=role:admin|role:lead

process projects state=status initial=Planning terminal=Completed,OnHold
transition projects.activate from=Planning to=Active action=activate by=role:lead event=activated
transition projects.complete from=Active to=Completed action=complete by=role:lead event=completed
transition projects.hold from=Planning,Active to=OnHold action=put_on_hold by=role:lead comment=required event=held

highlight projects.active when="status==Active" tone=positive
highlight projects.on_hold when="status==OnHold" tone=warning

overview
insight projects.total op=count field=name label="Total Projects"
insight projects.total_budget op=sum field=budget label="Total Budget Allocated"
```

---

## 🪜 Step 7: Validate & Run Your Application

Run the validation check:

```bash
node tools/air-cli.mjs check app.air
```

You now have a fully functional application with CRUD tables, modal forms, responsive cards, edit drawers, state machines, and metric cards in fewer than 30 lines of declarative code.
