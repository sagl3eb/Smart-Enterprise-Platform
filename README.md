# SEP — Smart Enterprise Platform

**Integration of Machine Learning and Predictive Analytics in a Smart Enterprise Platform for Automated and Optimised Decision-Making**

TP075880 · Saqqaf Al-Yazidi · Asia Pacific University FYP 2025

A multi-tenant ERP-style web platform with nine integrated modules, ML-driven predictive analytics, a hybrid intent + LLM chatbot, and full role-based access control.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev outside Docker)
- Python 3.11+ (for the ML service outside Docker)
- (Optional) [Ollama](https://ollama.com) with `llama3.2` for the chatbot's conversational fallback

### Option A — full stack via Docker (recommended)

```bash
docker-compose up -d --build
```

App: `http://localhost:5173` · API: `http://localhost:3000/api/v1` · ML: `http://localhost:8000`

### Option B — local dev

```bash
# 1. Database
docker-compose up -d postgres

# 2. Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev

# 4. ML service (new terminal)
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 5. Ollama (optional, for chatbot LLM fallback)
ollama pull llama3.2
ollama serve
```

### Default Logins (after seeding)

| Role | Email | Password | Tenant |
|---|---|---|---|
| Super Admin | `super@sep.com` | `super123456` | SEP (host) |
| Admin | `admin@apu.com` | `admin123456` | APU |
| Admin | `admin@nova.com` | `admin123456` | Nova Digital |
| Admin | `admin@ibm.com` | `admin123456` | IBM HR Analytics |
| Employee (any seeded) | *as listed in seed* | `employee123` | various |

The seed (`npm run prisma:seed`) is **idempotent** — re-run it any time without creating duplicates.

---

## Architecture

| Service | Port | Tech |
|---|---|---|
| Frontend | 5173 | React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Zustand · Axios · Zod |
| Backend  | 3000 | Node.js 20 · Express.js · TypeScript · Prisma ORM · JWT · Winston · node-cron |
| ML       | 8000 | Python 3.11 · FastAPI · scikit-learn · Prophet · pandas |
| Database | 5432 | PostgreSQL 15 |
| Chatbot LLM (optional) | 11434 | Ollama · `llama3.2` |

---

## 9 Modules

1. **HR Management** — employees, departments, job roles (with levels IC → C-Level), leave requests/approvals, attendance, performance, training. Employees auto-provisioned with a login on creation.
2. **Finance** — fiscal-year budgets, budget categories, transactions (income/expense), variance analysis.
3. **Accounting** — chart of accounts, double-entry journals (debits = credits enforced), invoices with line items + tax, payments that **deduct from a Finance budget category** by `budgetCategoryId`.
4. **ICT Management** — asset inventory, software licences, IT tickets (auto-numbered `TKT-XXXXXX`) with workflow open → in_progress → resolved → closed.
5. **Construction Logistics** — projects, milestones, tasks, materials, equipment fleet, site reports.
6. **Workforce Analytics** — attrition risk dashboard, satisfaction trends, surveys, IBM HR Analytics dataset.
7. **Predictive Analytics** — Random Forest / Gradient Boosting / Logistic Regression for attrition, Prophet for 90-day forecasting, Isolation Forest for anomaly detection.
8. **Alerts & Optimisation** — rule-based alert engine with cooldown; suggestion generator scans every module for anomalies (overruns, backlogs, slippage, attrition risk).
9. **Dashboard & KPIs** — executive KPI cards, sparklines, cross-module summary; admin/employee dashboards via `ViewSwitch`.

**Plus:** AI Chatbot · Multi-tenant Organizations · RBAC · Per-user Module Access · Settings · Dark mode.

---

## Key Features

- **Multi-tenant** — every domain table carries `organizationId`. Four orgs seeded out of the box: SEP (host), Nova Digital, APU, IBM HR Analytics.
- **RBAC** — `super_admin`, `admin`, `manager`, `employee`, `viewer`. Module access is grantable per-user **and** per-organization.
- **Hybrid chatbot** — intent matcher runs first (instant, DB-backed), confirmation flow for actions like "create a ticket", Ollama LLM fallback for conversational queries.
- **ML pipeline** — `train all models` endpoint persists models to a Docker volume; comparison view shows accuracy / precision / recall / F1.
- **Alert engine** — configurable rules with cooldown, evaluates live metrics, produces both alerts and actionable suggestions.
- **Dual dashboard** — `ViewSwitch` flips an admin between the executive view and the employee workspace; non-admins only ever see the employee view.
- **Dark mode** — full light/dark theming with a permanently-dark sidebar; charts, tables, and modals all themed.
- **Idempotent seed** — re-runnable without duplicates; cleans up legacy demo data automatically.

---

## Repo layout

```
backend/    Express + Prisma + TypeScript API
  src/
    controllers/    one per module
    routes/         one per module
    services/       business logic
    middleware/     auth, RBAC, error handling
    prisma/         schema.prisma + seed.ts + client wrapper
    utils/          jwt, validators, logger
frontend/   React + Vite + Tailwind SPA
  src/
    api/            axios client + auth interceptor
    components/     layout (Sidebar, Topbar, PageWrapper) + ui (Card, Modal) + charts
    pages/          one folder per module
    store/          Zustand stores (auth, theme, view-mode)
ml-service/ FastAPI + scikit-learn + Prophet
  app/
    services/       attrition_model.py · forecast_model.py · anomaly_model.py
    data/           CSV training data (revenue, headcount, tickets, …)
    models/         persisted model artefacts (Docker volume)
docker-compose.yml
SYSTEM_CHECKLIST.md  end-to-end manual test pass
```

---

## Daily commands

```bash
# Backend
cd backend
npm run dev               # tsx watch
npm run prisma:seed       # idempotent reseed
npm run prisma:studio     # browse the DB
npx tsc --noEmit          # type-check

# Frontend
cd frontend
npm run dev               # Vite dev server
npm run build             # production bundle
npx tsc --noEmit          # type-check

# Docker
docker-compose up -d --build
docker-compose logs -f backend
docker-compose down       # keeps volumes
```

---

## Tech Stack

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Zustand · Axios · Zod · Node.js 20 · Express.js · Prisma · PostgreSQL 15 · JWT · Winston · Python 3.11 · FastAPI · scikit-learn · Prophet · Docker · Ollama (optional)
