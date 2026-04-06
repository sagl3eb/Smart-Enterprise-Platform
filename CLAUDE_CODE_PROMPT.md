# SEP — Smart Enterprise Platform | Claude Code Reference

## Student: Saqqaf Al-Yazidi (TP075880) | FYP APU 2025
## Repo: https://github.com/sagl3eb/Smart-Enterprise-Platform

---

## PROJECT OVERVIEW

Web-based enterprise management platform for SMEs with 9 modules, AI chatbot, and ML predictive analytics. Multi-tenant with organization-based module access control. Admin/employee view switching.

## TECH STACK

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Recharts + Zustand + Axios (port 5173)
- **Backend**: Node.js 20 + Express.js + Prisma ORM + TypeScript + PostgreSQL 15 (port 3000)
- **ML Service**: Python 3.11+ + FastAPI + scikit-learn + Prophet (port 8000)
- **Auth**: JWT (access + refresh tokens) + bcrypt
- **DB**: PostgreSQL 15 (port 5432)

## DEFAULT LOGIN
```
Email: admin@sep.com
Password: admin123456
```

## STARTUP COMMANDS (Windows, user has Python 3.14 via `py` command)
```
docker-compose up postgres -d
cd backend && npm run dev
cd frontend && npm run dev
cd ml-service && py -m uvicorn app.main:app --reload --port 8000
```

---

## ARCHITECTURE

### Roles: super_admin, admin, manager, employee, viewer
### Multi-tenant: Organizations → OrgModules → UserModuleAccess
### Admin/Employee View: viewModeStore toggles between admin oversight pages and employee operational pages

### Frontend Design System
- **Brand**: "SEP" — purple accent (#5B21B6), always-dark sidebar (#13102A)
- **Light BG**: #F8F7FF, **Dark BG**: #0E0B1F
- **Border radius**: 10px-16px, serif font for numbers, DM Sans for body
- **localStorage keys**: sep-tokens, sep-user

---

## FILE STRUCTURE (110+ files)

### Backend (backend/src/)
```
index.ts                        — Express entry, route registration
prisma/schema.prisma            — All models (40+ tables) including Organization, OrgModule, UserModuleAccess
prisma/seed.ts                  — Seeds roles, default org, admin user, modules, leave types
prisma/client.ts                — Prisma singleton
middleware/auth.ts               — JWT verification, populates req.user
middleware/rbac.ts               — requireRole(), requireMinRole()
utils/jwt.ts                    — generateAccessToken, generateRefreshToken, verify
utils/response.ts               — sendSuccess, sendCreated, sendError, sendBadRequest, sendPaginated
utils/logger.ts                  — Winston logger
services/auth.ts                 — login, createUser, listUsers, updateModuleAccess, org management (NO public register)
services/hr.ts                   — employees CRUD, departments, attendance, leave requests, performance reviews, training, org chart, stats
services/finance.ts              — budget categories, annual budgets, transactions CRUD, financial reports, cost centers, variance analysis
services/accounting.ts           — chart of accounts, journal entries (debit=credit enforcement), invoices with line items, payments, tax records, trial balance
services/ict.ts                  — assets CRUD, software licenses, IT tickets (status workflow: open→in_progress→resolved→closed), network devices, system health
services/construction.ts         — projects CRUD, milestones, tasks with subtasks, materials with stock management, material requests, equipment fleet, site reports
services/workforce.ts            — attrition predictions, workforce snapshots, satisfaction trends, department comparison, surveys with questions/responses/results
services/alerts.ts               — alert rules engine with cooldown, alerts feed, optimization suggestions, evaluateAlertRules
services/dashboard.ts            — KPI definitions/snapshots, latest KPIs with sparklines, dashboard layouts/widgets, executive summary
services/chatbot.ts              — PARTIALLY BUILT (processMessage, matchIntent, formatApiResponse, sessions) — needs controller + routes
controllers/                     — 9 controllers matching services (chatbot controller NOT YET CREATED)
routes/                          — 9 route files (chatbot routes NOT YET CREATED, predictive routes NOT YET CREATED)
```

**IMPORTANT**: In index.ts, chatbot and predictive routes are COMMENTED OUT (lines 56, 59, 68, 71). They need:
1. chatbot controller + routes to be created
2. predictive controller + routes to be created (proxies to ML service)
3. Both to be uncommented in index.ts

### Frontend (frontend/src/)
```
main.tsx                         — All routing with ViewSwitch for admin/employee, ThemeProvider
api/client.ts                    — Axios with Bearer token injection + refresh token rotation + retry queue
store/authStore.ts               — Auth with org + moduleAccess + hasModuleAccess()
store/viewModeStore.ts           — Admin/employee toggle (admin | employee)
store/themeStore.ts              — Dark/light mode, sep-theme localStorage
store/alertStore.ts              — Global alert state + unread count
types/index.ts                   — All TypeScript interfaces for every module
utils/formatters.ts              — Currency, date, relative time, initials, severity/status colors, MODULES constant

components/layout/Sidebar.tsx    — Always-dark, "S" logo, module-filtered nav, admin panel link
components/layout/Topbar.tsx     — Search, view mode toggle (orange Admin/purple Employee), theme, alerts, profile dropdown
components/layout/PageWrapper.tsx — Sidebar + Topbar + content area
components/layout/AuthLayout.tsx — Split-screen login with gradient branding
components/ui/Card.tsx           — Card, CardHeader, CardBody, Badge (6 variants), StatCard, LoadingSpinner, EmptyState
components/ui/Modal.tsx          — Modal, FormInput, FormSelect, FormTextarea, Button (4 variants), ConfirmDialog, Toast
components/charts/Charts.tsx     — LineChartWidget, AreaChartWidget, BarChartWidget, DonutChartWidget, Sparkline

pages/auth/Login.tsx             — Login only (no register — admin creates users)
pages/dashboard/Dashboard.tsx    — 8 KPI cards, revenue chart, ticket donut, dept chart, alerts feed

— EMPLOYEE VIEWS (operational CRUD):
pages/hr/EmployeeList.tsx        — Create/edit/view/delete employees with modal forms
pages/finance/Budget.tsx         — Create budgets + categories, charts, detail table
pages/finance/Transactions.tsx   — Create/edit/delete transactions
pages/accounting/Invoices.tsx    — Create with line items, record payments, status transitions
pages/accounting/ChartOfAccounts.tsx — Create accounts, search, type filter
pages/ict/Assets.tsx             — Create/edit/delete assets
pages/ict/Tickets.tsx            — Create tickets, status workflow (Start→Resolve→Close)
pages/construction/Projects.tsx  — Create/edit, progress update (+10%), status transitions

— ADMIN VIEWS (oversight dashboards):
pages/hr/AdminHR.tsx             — Dept management, headcount chart, leave approval table
pages/finance/AdminFinance.tsx   — Variance analysis, budget chart, cost centers, report generation
pages/accounting/AdminAccounting.tsx — Trial balance, invoice summary donut
pages/ict/AdminICT.tsx           — Asset/ticket stats, license usage bars, priority breakdown
pages/construction/AdminConstruction.tsx — Project portfolio, budget chart, low stock alerts

— SHARED PAGES (same for both views):
pages/workforce/AttritionDashboard.tsx — Risk donut, dept breakdown, top factors, comparison
pages/workforce/SatisfactionTrends.tsx — Monthly trends, dept satisfaction, overtime charts
pages/workforce/Surveys.tsx      — Create surveys with questions, respond, view results
pages/predictive/PredictiveAnalytics.tsx — 3 tabs: models, forecast (calls ML service), anomaly
pages/alerts/AlertCenter.tsx     — 3 tabs: feed (mark/resolve), rules (create/toggle/evaluate), suggestions
pages/chatbot/Chatbot.tsx        — Chat interface with typing indicator, suggestions, local fallback
pages/settings/Settings.tsx      — 5 tabs: Profile, Security, Appearance, User Management (admin), Organization (admin)
```

### ML Service (ml-service/app/)
```
main.py                          — FastAPI with 4 routers
routers/attrition.py             — Train, predict, batch predict, feature importance
routers/forecasting.py           — Forecast endpoint, sample data endpoint
routers/anomaly.py               — Detect anomalies in time series
routers/health.py                — Health check + model status
services/attrition_model.py      — Random Forest (200 trees, 7 features, auto-train)
services/forecast_model.py       — Prophet with linear regression fallback, 90-day forecasts
services/anomaly_model.py        — Isolation Forest with rolling features
schemas/models.py                — Pydantic request/response models
data/generate_data.py            — Synthetic data generator (6 CSV datasets)
```

### Config
```
docker-compose.yml               — 4 services (postgres, backend, ml-service, frontend)
database/schema_full.sql          — Full SQL with organizations + module access tables
frontend/index.html               — SEP title, viewport fix, favicon.svg
frontend/public/favicon.svg       — Purple "S" icon
requirements.txt                  — Updated for Python 3.14 compatibility
.env files                        — root + backend
```

---

## PENDING / INCOMPLETE ITEMS

### Must Fix:
1. **Chatbot backend incomplete** — `services/chatbot.ts` exists but `controllers/chatbot.ts` and `routes/chatbot.ts` need to be created. Then uncomment chatbot routes in `index.ts` (lines 59, 71).
2. **Predictive routes missing** — Need `controllers/predictive.ts` and `routes/predictive.ts` that proxy requests to the ML service at localhost:8000. Then uncomment in `index.ts` (lines 56, 68).
3. **Register.tsx still exists** — `frontend/src/pages/auth/Register.tsx` should be deleted (unused since registration was removed).

### Nice to Have:
4. **GitHub README** still shows "Nexus" in some places — user needs to push latest code.
5. **User mentioned wanting FYP Chapter 4 diagrams** (system architecture, use case, ERD, etc.) — hasn't chosen which ones yet.
6. **Some sub-pages** still use PlaceholderPage component for rarely-accessed routes.

---

## DESIGN PATTERNS

### Backend:
- Service → Controller → Route pattern
- All responses use `utils/response.ts` wrappers: `sendSuccess(res, data, message)`, `sendPaginated(res, data, meta, message)`
- Pagination: `?page=1&limit=15` → returns `{ data, meta: { total, page, limit, totalPages } }`
- Error class: `AuthError(message, statusCode)` in auth service

### Frontend:
- Each page fetches from API, falls back to hardcoded data if backend unavailable
- CRUD pattern: `fetchData()` via `useCallback`, modal state (`showForm`, `editingId`, `form`), `handleSave()`, `Toast` notifications
- `ViewSwitch` component in main.tsx: `<ViewSwitch admin={<AdminPage />} employee={<EmployeePage />} />`
- Zustand stores: authStore (user + tokens + moduleAccess), themeStore (dark/light), viewModeStore (admin/employee), alertStore

### Prisma:
- Schema at `backend/src/prisma/schema.prisma` (40+ models)
- Generate: `npx prisma generate --schema=src/prisma/schema.prisma`
- Push: `npx prisma db push --schema=src/prisma/schema.prisma`
- Seed: `npx tsx src/prisma/seed.ts`
