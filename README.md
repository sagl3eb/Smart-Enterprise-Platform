# Nexus — Smart Enterprise Platform

**Integration of Machine Learning and Predictive Analytics in a Smart Enterprise Platform for Automated and Optimized Decision-Making**

TP075880 | Saqqaf Al-Yazidi | Asia Pacific University FYP 2025

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for ML service local development)

### Run with Docker

```bash
docker-compose up --build
```

Services will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- ML Service: http://localhost:8000
- PostgreSQL: localhost:5432

### Local Development

**Backend:**
```bash
cd backend
npm install
npx prisma generate --schema=src/prisma/schema.prisma
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**ML Service:**
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Architecture

| Service | Port | Technology |
|---------|------|------------|
| Frontend | 5173 | React 18 + TypeScript + Tailwind |
| Backend | 3000 | Express.js + Prisma + TypeScript |
| ML Service | 8000 | FastAPI + scikit-learn + Prophet |
| Database | 5432 | PostgreSQL 15 |

## Modules
1. HR Management
2. Finance
3. Accounting
4. ICT Management
5. Construction Logistics
6. Workforce Analytics
7. Predictive Analytics
8. Alerts & Optimization
9. Dashboard & KPIs

Plus: Chatbot, Auth (RBAC), Settings
