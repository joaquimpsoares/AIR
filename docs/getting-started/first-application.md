# Your First Application

In this tutorial, you will create, validate, and run a complete Task Management application from scratch.

---

## 📝 1. Create the AIR Source File

Create a file named `app.air`:

```air
air version=2
app task_manager title="Task Manager" subtitle="Personal and team task tracker" initial=overview
theme mode=dark accent=blue
capability storage.local

resource tasks label=title
field tasks.title text required min=2
field tasks.assignee text required
field tasks.priority enum values=Low,Medium,High,Urgent required default=Medium
field tasks.status enum values=Todo,InProgress,Done required default=Todo
field tasks.due_date date required default=today
field tasks.notes text long

manage tasks lifecycle=archive
access tasks view=role:admin|role:user edit=role:admin|role:user

process tasks state=status initial=Todo terminal=Done
transition tasks.start from=Todo to=InProgress action=start by=role:user event=started
transition tasks.complete from=InProgress to=Done action=complete by=role:user event=completed

highlight tasks.urgent when="priority==Urgent" tone=danger
highlight tasks.done when="status==Done" tone=positive

overview
insight tasks.total op=count field=title label="Total Tasks"
```

---

## 🔍 2. Validate the AIR Source

Validate syntax, type definitions, state transitions, and access rules:

```bash
node tools/air-cli.mjs check app.air
```

Expected output:
```
valid AIR v2: task_manager
```

---

## 📋 3. Inspect the Compiled Application

Inspect what AIR derived automatically from your declarations:

```bash
node tools/air-cli.mjs explain app.air
```

Expected output:
```
Task Manager (task_manager)
- Tasks: title:text required, assignee:text required, priority:enum required, status:enum required, due_date:date required, notes:text
  Managed experience: list, detail, create, edit, archive, validation, search, filter, sort, pagination, responsive and accessible states
  Access: view by admin role or user role; create by any user; edit by admin role or user role; delete by any user; archive by any user
- Insight tasks.total: count tasks.title
```

---

## 🖼️ 4. (Optional) Provide Initial Seed Data

Create `seed.json` to prepopulate records for testing:

```json
{
  "tasks": [
    {
      "id": "tsk_01",
      "title": "Set up production CI pipeline",
      "assignee": "Alex Rivera",
      "priority": "High",
      "status": "InProgress",
      "due_date": "2026-04-01",
      "notes": "Configure automated benchmark checks and linting."
    },
    {
      "id": "tsk_02",
      "title": "Design security audit policy",
      "assignee": "Sarah Chen",
      "priority": "Urgent",
      "status": "Todo",
      "due_date": "2026-03-30",
      "notes": "Review RBAC roles and transition guards."
    }
  ]
}
```

---

## 🌐 5. Run in the Interactive Showcase

You can paste your `app.air` source directly into the **Live AIR Editor** in the Showcase at:
👉 **`http://127.0.0.1:4173/examples`**

The interface will instantly render:
- Interactive dashboard with `Total Tasks` metric
- Sortable, filterable tasks table
- Auto-generated Create / Edit modal forms and drawers
- State transitions (`Start`, `Complete`) with guarded authority
- Color-coded priority highlights (`Urgent` = red tone)
- Automatic mobile card layout when resized

---

## 🚀 Next Step
- **[Project Directory Structure](project-structure.md)**
