# SEP — System Health Checklist

End-to-end manual test pass for the **Smart Enterprise Platform**. Walk this top-to-bottom; each tickbox is one observable behaviour. If a step fails, stop and fix before continuing — later steps assume earlier ones pass.

Legend: `[ ]` = to test · `[x]` = verified · `[!]` = failing (needs fix)

---

## 0. Bring the stack up

```bash
# from project root
docker-compose up -d postgres
cd backend && npm install && npm run prisma:generate && npm run prisma:push && npm run prisma:seed && npm run dev
# new terminal
cd frontend && npm install && npm run dev
# new terminal
cd ml-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
# (optional) for chatbot conversational fallback
ollama pull llama3.2 && ollama serve
```

- [ ] **Postgres** — `docker ps` shows `sep-postgres` healthy on `:5432`
- [ ] **Backend** — `curl http://localhost:3000/api/v1/health` → `{"success":true,...}`
- [ ] **ML service** — `curl http://localhost:8000/health` → `{"status":"healthy"}` (or wrapped under `data`)
- [ ] **Frontend** — browser loads `http://localhost:5173` cleanly (no blank page, no console errors)
- [ ] **Ollama (optional)** — `curl http://localhost:11434/api/tags` lists `llama3.2`

> *If a service won't come up:* `docker-compose logs <service>` or check the port isn't held by another process (`netstat -ano | findstr :3000`).

---

## 1. Seed data — what you should see after `npm run prisma:seed`

The seed is **idempotent** (run it as many times as you like). It creates four organizations:

| Org | Slug | Login (admin) | Purpose |
|---|---|---|---|
| **SEP** (host) | `sep` | `super@sep.com` / `super123456` | Platform-level super admin |
| **Nova Digital** | `nova` | `admin@nova.com` / `admin123456` | Demo SaaS tenant |
| **APU — Asia Pacific University** | `apu` | `admin@apu.com` / `admin123456` | Education tenant (the FYP host) |
| **IBM HR Analytics** | `ibm` | `admin@ibm.com` / `admin123456` | Loaded from the IBM HR attrition CSV (~150 rows) |

Every seeded employee account that gets a login has the default password **`employee123`**.

- [ ] All four orgs visible in **Settings → Organizations** when logged in as `super@sep.com`
- [ ] Each org shows a non-zero user count
- [ ] Re-running `npm run prisma:seed` finishes without errors and does not duplicate users

---

## 2. Authentication & session

- [ ] Login with `super@sep.com` / `super123456` → lands on `/dashboard`
- [ ] Login with **wrong password** → inline error on the form, NOT a redirect loop
- [ ] Login with **non-existent email** → inline error
- [ ] Hard-refresh on a protected page → stays logged in (refresh-token interceptor)
- [ ] Logout → returns to `/login` and clears local state
- [ ] Login with `admin@apu.com` → only sees APU users / employees, never SEP or Nova data

> *If failing:* check [frontend/src/api/client.ts](frontend/src/api/client.ts) — the auth interceptor must skip `/auth/login` and `/auth/refresh`.

---

## 3. Role-based dashboard

- [ ] Logged in as **admin** → executive KPI cards, cross-module summary
- [ ] **ViewSwitch** in the topbar toggles to **employee** view → shows "Welcome back, …" + quick-action cards
- [ ] Logged in as **non-admin employee** → only sees the employee dashboard, no toggle
- [ ] KPI cards show real counts (not zeros), sparklines render

---

## 4. Employee quick actions (employee view)

- [ ] **Apply for Leave** opens modal → submitting creates a pending leave request (visible under HR → Leave Approvals)
- [ ] **New IT Ticket** opens modal → submitting creates a ticket with auto-numbered `TKT-XXXXXX`
- [ ] **My Leaves** page lists own requests with status
- [ ] **My Tickets** page lists own tickets
- [ ] **My Assets** page lists assets assigned to the user
- [ ] **Employee Directory** lists colleagues in the same org

---

## 5. HR module (3-tab layout)

`/hr` shows a **sub-nav** (`HRSubNav`) with three tabs: **Employees**, **Leave Approvals**, **Job Roles**.

### 5a. Employees (`/hr/employees`)
- [ ] List loads with pagination
- [ ] Search by name / email / employee code filters live
- [ ] **Add Employee** modal — Role dropdown is populated from `/hr/job-roles?isActive=true`
- [ ] Creating an employee with department + job role → row appears
- [ ] Creating an employee **auto-provisions a login user** (default password `employee123`)
- [ ] Edit updates fields; Delete soft-deletes (or hard-deletes if no FK)
- [ ] Pagination next/prev works

### 5b. Leave Approvals (`/hr/leave-approvals`)
- [ ] Stat cards at top show real counts (pending, this week)
- [ ] Each row shows employee + dates + reason
- [ ] **Approve** → row disappears, status flips to `approved`
- [ ] **Reject** prompts for reason → status flips to `rejected`
- [ ] Empty state appears cleanly when there are no pending requests

### 5c. Job Roles (`/hr/job-roles`)
- [ ] Table lists title / level (IC, Lead, Manager, Director, VP, C-Level) / department / active flag
- [ ] **Add Role** opens modal; created role appears in the table AND in Add Employee dropdown
- [ ] Edit updates inline; Delete hard-deletes when unused, soft-deletes (`isActive=false`) when in use
- [ ] Active/Inactive filter at the top filters the table

### 5d. Admin HR (`/hr/admin`)
- [ ] 5 stat cards (employees, departments, job roles, pending leaves, active leaves)
- [ ] **Departments** section — full CRUD
- [ ] **Job Roles** section — same CRUD as `/hr/job-roles`
- [ ] **Leave Approvals** section — inline approve/reject

---

## 6. Finance module

- [ ] **Budget** page loads current fiscal-year allocations grouped by category
- [ ] Money values display correctly — **no Decimal overflow / NaN**
- [ ] **Transactions** list filters by category + type (income/expense)
- [ ] Creating a transaction updates the matching budget category's `spentAmount` by the same value
- [ ] **Admin Finance** dashboard shows utilisation charts that render in both light and dark mode

---

## 7. Accounting module

- [ ] **Chart of Accounts** renders the tree; create/update an account works
- [ ] **Journal Entries** — create new entry; debits **must equal** credits or save is blocked
- [ ] **Invoices** list filters by status (draft / sent / paid / overdue)
- [ ] Create a sales invoice with multiple line items → totals calculate (subtotal + tax = total)
- [ ] Open an invoice → **Record Payment** modal has a **Budget Category** dropdown
- [ ] Selecting a category and recording a payment → **Finance budget `spentAmount` increases by the paid amount**
- [ ] Decimal columns display with 2 d.p., no overflow

> *If the budget doesn't deduct:* confirm `budgetCategoryId` is in the POST body and the matching `BudgetCategory` exists for the **current** fiscal year.

---

## 8. ICT module

- [ ] **Assets** list loads with status filter (active / maintenance / retired)
- [ ] Create / edit / delete an asset works (admin only)
- [ ] **IT Tickets** list filters by status & priority
- [ ] Create new ticket → ticket number `TKT-XXXXXX` auto-generated
- [ ] Updating status (open → in_progress → resolved → closed) reflects immediately
- [ ] Assigning a ticket to a user works

---

## 9. Construction / Projects module

- [ ] **Projects** list loads with status filter
- [ ] Create new project with milestones works
- [ ] Progress bar renders correctly against milestones completed vs total
- [ ] **Admin Construction** page shows project budget summary table

---

## 10. Workforce Analytics

- [ ] **Attrition Dashboard** loads with risk distribution chart (high / medium / low)
- [ ] **Satisfaction Trends** line chart renders without overflowing the card
- [ ] **Surveys** list renders; survey detail page loads
- [ ] Charts respect light/dark theme — labels readable in both

---

## 11. Predictive Analytics (ML service)

- [ ] Page loads; model metrics section appears (or the empty state "no models trained yet")
- [ ] **Train All Models** → status message indicates training in progress
- [ ] Training completes within ~10 minutes on first run (do **not** treat early "Network Error" as failure — wait)
- [ ] After training, the model comparison table populates with accuracy / precision / recall / F1
- [ ] **Generate Forecast** → Prophet 90-day forecast chart renders historical + predicted points
- [ ] **Run Anomaly Detection** → Isolation Forest highlights outlier points

> *If "Network Error":* confirm `http://localhost:8000/health` returns 200, then `docker-compose up -d --build ml-service`.

---

## 12. Alerts & Suggestions

- [ ] **Alert Center** has two tabs: **Alerts** and **Suggestions**
- [ ] Alerts tab shows unread items; marking as read updates the topbar badge
- [ ] **Generate Suggestions** scans modules and creates suggestion cards (budget overrun, ticket backlog, leave bottleneck, project slippage, attrition risk, overdue invoices)
- [ ] Dismiss / resolve buttons on a suggestion update the row state

---

## 13. Chatbot

- [ ] Chatbot page loads with a welcome message
- [ ] **DB-backed intents (instant)**:
   - [ ] `how many employees?` → returns headcount
   - [ ] `show open tickets` → returns ticket summary
   - [ ] `pending leaves` → returns leave count
- [ ] **Action intents with confirmation flow**:
   - [ ] `create an IT ticket for VPN issues` → bot asks for confirmation (NOT a generic LLM reply)
   - [ ] Reply `yes` → ticket actually created (visible in IT Tickets)
   - [ ] Reply `cancel` → action aborted cleanly
   - [ ] Same flow works for `apply for leave …`
- [ ] **Ollama fallback** (if `OLLAMA_URL` reachable):
   - [ ] Conversational question (`tell me about this platform`) → LLM reply (slower, a few seconds)
- [ ] **Ollama down**: intents and DB queries still work — only conversational fallback is unavailable

---

## 14. Multi-tenant Organizations

- [ ] Logged in as `super@sep.com` → can see all four seeded orgs in Settings → Organizations
- [ ] Logged in as `admin@apu.com` → only sees APU's users / employees / departments
- [ ] Switching to `admin@nova.com` → sees Nova's data, never APU's
- [ ] Switching to `admin@ibm.com` → sees IBM HR Analytics data (≈150 employees from CSV)
- [ ] **Create new organization** (super_admin only) — admin email + password optional; backend auto-creates the admin if not provided and returns `adminPassword` once
- [ ] Duplicate slug → 409 with a clean error
- [ ] **Eye button** on org row → Organization Detail modal: name / slug / contact / modules list / users table

---

## 15. Settings

### 15a. Profile & security
- [ ] Update name / email persists
- [ ] Change password requires current password and rejects wrong ones

### 15b. User management (admin)
- [ ] Create / deactivate / activate / delete user works
- [ ] **Module Access** (Shield button) — toggles persist across reload
- [ ] **Eye button** → User Detail modal: full name / email / role / org / `passwordHash` / linked employee record / module access (effective + raw grants)

### 15c. Module access enforcement
- [ ] Disabling a module for a user → that user no longer sees it in the sidebar after re-login
- [ ] Disabling a module for the org → the module disappears for **all** users in that org

---

## 16. Theme / UI polish

- [ ] **Light mode** — all text readable on light surfaces, no invisible labels
- [ ] **Dark mode** toggle — no flash on switch; persists across reload
- [ ] Sidebar stays dark in both themes (intentional)
- [ ] Tables, stat cards, modals, badges, charts all legible in both modes
- [ ] Recharts tooltips visible in both modes
- [ ] No layout overflow on the standard 1440 / 1920 desktop widths
- [ ] Branding strings consistent ("SEP — Smart Enterprise Platform", APU FYP 2025)

---

## 17. Type-check & build smoke test

```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
cd backend  && npx prisma migrate status --schema=src/prisma/schema.prisma
```

- [ ] Backend type-check: clean
- [ ] Frontend type-check: clean
- [ ] Prisma schema in sync with the database

Optional ML smoke:
```bash
curl http://localhost:8000/predict/attrition/models/comparison
curl http://localhost:8000/predict/forecast/sample/revenue
```

---

## 18. Docker full-stack run

```bash
docker-compose up -d --build
docker-compose ps
```

- [ ] All four containers reach `healthy`: `sep-postgres`, `sep-backend`, `sep-ml-service`, `sep-frontend`
- [ ] App reachable at `http://localhost:5173`
- [ ] Backend logs show seed completed (or skipped if already seeded) on first boot
- [ ] Stopping with `docker-compose down` leaves volumes intact (`pg_data`, `ml_models`)

---

## 19. Common red flags

| Symptom | Likely cause |
|---|---|
| Login redirects with no error message | Auth interceptor catching the login 401 — should be skipped for `/auth/login` |
| Train Models → "Network Error" instantly | ML service down or front-end timeout < 60s |
| Chatbot gives prose where it should ask for confirmation | Intent matcher not running before Ollama fallback |
| Budget doesn't drop after invoice payment | `budgetCategoryId` not sent, or category is in a different fiscal year |
| Decimal column shows `NaN` / overflow | Money field exceeds Prisma `Decimal(precision, scale)` — check the schema |
| Dark-mode label invisible | Arbitrary hex colour without a `dark:` override (see [frontend/src/index.css](frontend/src/index.css)) |
| Employee sees admin view | `ViewSwitch` not gating on `useAuthStore.user.role.name` |
| Job Roles dropdown empty | Seed didn't run — `cd backend && npm run prisma:seed` |
| `prisma:seed` fails with EPERM on Windows | Dev server holding the Prisma DLL lock — stop `npm run dev` first |
| ML models won't load after `docker-compose up` | `ml_models` volume empty — train once via the UI |
| Chatbot shows "thinking…" forever | Ollama not running OR `OLLAMA_URL` unreachable from container — set `OLLAMA_URL=http://host.docker.internal:11434` |

---

## 20. Cleanup notes

These are gitignored and safe to delete between test passes:

```bash
# from project root
rm -rf backend/logs/*.log backend/dist
```
