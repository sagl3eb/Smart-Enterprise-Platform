# SEP — Smart Enterprise Platform

**Integration of Machine Learning and Predictive Analytics in a Smart Enterprise Platform for Automated and Optimized Decision-Making**

TP075880 | Saqqaf Al-Yazidi | Asia Pacific University FYP 2025

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### 1. Database
```bash
docker-compose up postgres -d
```

### 2. Backend
```bash
cd backend
npm install
npx prisma generate --schema=src/prisma/schema.prisma
npx prisma db push --schema=src/prisma/schema.prisma
npx tsx src/prisma/seed.ts
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. ML Service
```bash
cd ml-service
pip install -r requirements.txt
python -m app.data.generate_data
uvicorn app.main:app --reload --port 8000
```

### Default Login
```
Email: admin@sep.com
Password: admin123456
```

---

## Architecture

| Service | Port | Technology |
|---------|------|------------|
| Frontend | 5173 | React 18 + TypeScript + Tailwind + Recharts |
| Backend | 3000 | Express.js + Prisma + TypeScript |
| ML Service | 8000 | FastAPI + scikit-learn + Prophet |
| Database | 5432 | PostgreSQL 15 |

## 9 Modules

1. **HR Management** — Employee CRUD, attendance, leave management, performance reviews, training, org chart
2. **Finance** — Budgets, transactions, financial reports, cost centers, variance analysis
3. **Accounting** — Chart of accounts, journal entries, invoices with line items, payments, tax records
4. **ICT Management** — Asset inventory, software licenses, IT tickets with workflow, network monitoring
5. **Construction Logistics** — Projects with milestones, tasks, materials, equipment fleet, site reports
6. **Workforce Analytics** — Attrition risk dashboard, satisfaction trends, department comparison, surveys
7. **Predictive Analytics** — ML model dashboard, 90-day forecasting, anomaly detection
8. **Alerts & Optimization** — Alert rules engine, alert feed, optimization suggestions
9. **Dashboard & KPIs** — Executive dashboard, KPI cards with sparklines, cross-module summary

**Plus:** AI Chatbot, Auth (RBAC), Multi-tenant Organization Management, Module Access Control, Settings

## Key Features

- **Multi-tenant**: Organizations with configurable module access
- **RBAC**: super_admin, admin, manager, employee, viewer roles
- **ML-powered**: Random Forest attrition prediction, Prophet forecasting, Isolation Forest anomaly detection
- **Rule-based chatbot**: NLP intent matching, queries backend APIs
- **Alert engine**: Configurable rules with cooldown, evaluates live metrics
- **Dark mode**: Full dark theme with always-dark sidebar
- **Responsive**: Works on desktop and tablet

## Tech Stack

React 18 · TypeScript · Tailwind CSS · Recharts · Zustand · Axios · Zod · Node.js 20 · Express.js · Prisma ORM · PostgreSQL 15 · JWT Auth · Python 3.11 · FastAPI · scikit-learn · Prophet · Docker
