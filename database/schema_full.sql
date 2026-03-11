-- ============================================================
-- SMART ENTERPRISE PLATFORM — COMPLETE PostgreSQL Schema
-- TP075880 | Saqqaf Saleh Saqqaf Al-Yazidi
-- All 9 Modules: HR · Finance · Accounting · ICT Management ·
-- Construction Logistics · Workforce Analytics · Predictive
-- Analytics · Alerts & Optimization · Interactive Chatbot
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 0. AUTH & USERS
-- ============================================================

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role_id       INT REFERENCES roles(id),
  department    VARCHAR(100),
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 1. HR MODULE
-- ============================================================

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  manager_id  UUID REFERENCES users(id),
  cost_center VARCHAR(50),
  budget      NUMERIC(15,2) DEFAULT 0,
  headcount   INT DEFAULT 0,
  location    VARCHAR(150),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id),
  employee_code       VARCHAR(50) UNIQUE NOT NULL,
  full_name           VARCHAR(255) NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  phone               VARCHAR(30),
  department_id       INT REFERENCES departments(id),
  job_title           VARCHAR(150),
  employment_type     VARCHAR(50) CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  hire_date           DATE NOT NULL,
  termination_date    DATE,
  salary              NUMERIC(12,2),
  performance_score   NUMERIC(3,1) CHECK (performance_score BETWEEN 0 AND 5),
  satisfaction_score  NUMERIC(3,1) CHECK (satisfaction_score BETWEEN 0 AND 5),
  years_at_company    NUMERIC(5,2) GENERATED ALWAYS AS (
                        EXTRACT(YEAR FROM AGE(COALESCE(termination_date, CURRENT_DATE), hire_date)) +
                        EXTRACT(MONTH FROM AGE(COALESCE(termination_date, CURRENT_DATE), hire_date)) / 12.0
                      ) STORED,
  overtime_hours_avg  NUMERIC(5,2) DEFAULT 0,
  num_projects        INT DEFAULT 0,
  last_promotion_date DATE,
  manager_id          UUID REFERENCES employees(id),
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_documents (
  id            SERIAL PRIMARY KEY,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  doc_type      VARCHAR(50),   -- 'contract','id','certificate','appraisal'
  file_name     VARCHAR(255),
  file_path     TEXT,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leave_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  days_allowed INT DEFAULT 0,
  is_paid     BOOLEAN DEFAULT TRUE
);

CREATE TABLE leave_requests (
  id            SERIAL PRIMARY KEY,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INT REFERENCES leave_types(id),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_attendance (
  id            SERIAL PRIMARY KEY,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  check_in      TIME,
  check_out     TIME,
  status        VARCHAR(30) CHECK (status IN ('present','absent','late','half_day','remote','leave')),
  hours_worked  NUMERIC(4,2),
  notes         TEXT,
  UNIQUE (employee_id, date)
);

CREATE TABLE performance_reviews (
  id              SERIAL PRIMARY KEY,
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES users(id),
  review_period   VARCHAR(50),
  score           NUMERIC(3,1) CHECK (score BETWEEN 0 AND 5),
  strengths       TEXT,
  improvements    TEXT,
  goals_next      TEXT,
  status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  review_date     DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE training_programs (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  provider      VARCHAR(150),
  duration_hrs  INT,
  cost          NUMERIC(10,2),
  start_date    DATE,
  end_date      DATE,
  is_mandatory  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_trainings (
  id             SERIAL PRIMARY KEY,
  employee_id    UUID REFERENCES employees(id) ON DELETE CASCADE,
  training_id    INT REFERENCES training_programs(id),
  status         VARCHAR(30) CHECK (status IN ('enrolled','in_progress','completed','failed')),
  completion_date DATE,
  score          NUMERIC(5,2),
  certificate_url TEXT
);

-- ============================================================
-- 2. FINANCE MODULE
-- ============================================================

CREATE TABLE budget_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  type        VARCHAR(30) CHECK (type IN ('revenue','expense','capex','opex')),
  parent_id   INT REFERENCES budget_categories(id),
  description TEXT
);

CREATE TABLE annual_budgets (
  id              SERIAL PRIMARY KEY,
  department_id   INT REFERENCES departments(id),
  category_id     INT REFERENCES budget_categories(id),
  fiscal_year     INT NOT NULL,
  quarter         INT CHECK (quarter BETWEEN 1 AND 4),
  allocated_amount NUMERIC(15,2) NOT NULL,
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','locked')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id              SERIAL PRIMARY KEY,
  reference_no    VARCHAR(100) UNIQUE NOT NULL,
  type            VARCHAR(30) CHECK (type IN ('income','expense','transfer','adjustment')),
  amount          NUMERIC(15,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'USD',
  category_id     INT REFERENCES budget_categories(id),
  department_id   INT REFERENCES departments(id),
  description     TEXT,
  transaction_date DATE NOT NULL,
  recorded_by     UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','voided')),
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE financial_reports (
  id              SERIAL PRIMARY KEY,
  report_type     VARCHAR(50),   -- 'income_statement','balance_sheet','cash_flow'
  period_start    DATE,
  period_end      DATE,
  data            JSONB,
  generated_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cost_centers (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(150) NOT NULL,
  department_id INT REFERENCES departments(id),
  manager_id    UUID REFERENCES users(id),
  budget_limit  NUMERIC(15,2),
  is_active     BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 3. ACCOUNTING MODULE
-- ============================================================

CREATE TABLE chart_of_accounts (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  account_type  VARCHAR(50) CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  parent_id     INT REFERENCES chart_of_accounts(id),
  is_active     BOOLEAN DEFAULT TRUE,
  description   TEXT
);

CREATE TABLE journal_entries (
  id              SERIAL PRIMARY KEY,
  entry_number    VARCHAR(100) UNIQUE NOT NULL,
  description     TEXT,
  entry_date      DATE NOT NULL,
  posted_by       UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  reference_id    INT,
  reference_type  VARCHAR(50),   -- 'invoice','payment','expense'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id              SERIAL PRIMARY KEY,
  journal_id      INT REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id      INT REFERENCES chart_of_accounts(id),
  debit           NUMERIC(15,2) DEFAULT 0,
  credit          NUMERIC(15,2) DEFAULT 0,
  description     TEXT,
  cost_center_id  INT REFERENCES cost_centers(id)
);

CREATE TABLE invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(100) UNIQUE NOT NULL,
  invoice_type    VARCHAR(20) CHECK (invoice_type IN ('sales','purchase')),
  vendor_client   VARCHAR(255),
  issue_date      DATE NOT NULL,
  due_date        DATE,
  subtotal        NUMERIC(15,2) DEFAULT 0,
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  total_amount    NUMERIC(15,2) DEFAULT 0,
  paid_amount     NUMERIC(15,2) DEFAULT 0,
  status          VARCHAR(30) CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
  id            SERIAL PRIMARY KEY,
  invoice_id    INT REFERENCES invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3),
  unit_price    NUMERIC(15,2),
  tax_rate      NUMERIC(5,2) DEFAULT 0,
  line_total    NUMERIC(15,2)
);

CREATE TABLE payments (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT REFERENCES invoices(id),
  amount          NUMERIC(15,2) NOT NULL,
  payment_date    DATE NOT NULL,
  method          VARCHAR(50),   -- 'bank_transfer','cash','cheque','card'
  reference       VARCHAR(150),
  notes           TEXT,
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tax_records (
  id              SERIAL PRIMARY KEY,
  period          VARCHAR(50),
  tax_type        VARCHAR(50),   -- 'VAT','income_tax','payroll_tax'
  taxable_amount  NUMERIC(15,2),
  tax_rate        NUMERIC(5,2),
  tax_amount      NUMERIC(15,2),
  status          VARCHAR(20) CHECK (status IN ('calculated','filed','paid')),
  due_date        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ICT MANAGEMENT MODULE
-- ============================================================

CREATE TABLE assets (
  id              SERIAL PRIMARY KEY,
  asset_tag       VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(100),   -- 'hardware','software','network','peripheral'
  brand           VARCHAR(100),
  model           VARCHAR(150),
  serial_number   VARCHAR(150) UNIQUE,
  purchase_date   DATE,
  purchase_cost   NUMERIC(12,2),
  current_value   NUMERIC(12,2),
  warranty_expiry DATE,
  location        VARCHAR(150),
  assigned_to     UUID REFERENCES employees(id),
  status          VARCHAR(30) CHECK (status IN ('active','inactive','maintenance','retired','disposed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE software_licenses (
  id              SERIAL PRIMARY KEY,
  software_name   VARCHAR(255) NOT NULL,
  vendor          VARCHAR(150),
  license_key     TEXT,
  license_type    VARCHAR(50),   -- 'perpetual','subscription','open_source'
  seats           INT,
  used_seats      INT DEFAULT 0,
  purchase_date   DATE,
  expiry_date     DATE,
  cost_per_year   NUMERIC(12,2),
  status          VARCHAR(20) CHECK (status IN ('active','expired','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE it_tickets (
  id              SERIAL PRIMARY KEY,
  ticket_number   VARCHAR(100) UNIQUE NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),   -- 'hardware','software','network','access','other'
  priority        VARCHAR(20) CHECK (priority IN ('low','medium','high','critical')),
  status          VARCHAR(30) CHECK (status IN ('open','in_progress','pending','resolved','closed')),
  submitted_by    UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  asset_id        INT REFERENCES assets(id),
  resolution      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ
);

CREATE TABLE network_devices (
  id              SERIAL PRIMARY KEY,
  hostname        VARCHAR(150) UNIQUE NOT NULL,
  device_type     VARCHAR(50),   -- 'server','router','switch','firewall','workstation'
  ip_address      INET,
  mac_address     MACADDR,
  location        VARCHAR(150),
  os              VARCHAR(100),
  status          VARCHAR(20) CHECK (status IN ('online','offline','maintenance')),
  last_seen       TIMESTAMPTZ,
  cpu_usage_pct   NUMERIC(5,2),
  ram_usage_pct   NUMERIC(5,2),
  disk_usage_pct  NUMERIC(5,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_health_logs (
  id            SERIAL PRIMARY KEY,
  device_id     INT REFERENCES network_devices(id),
  cpu_pct       NUMERIC(5,2),
  ram_pct       NUMERIC(5,2),
  disk_pct      NUMERIC(5,2),
  response_ms   NUMERIC(8,2),
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CONSTRUCTION LOGISTICS MODULE
-- ============================================================

CREATE TABLE projects (
  id              SERIAL PRIMARY KEY,
  project_code    VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  client          VARCHAR(255),
  location        VARCHAR(255),
  project_type    VARCHAR(100),   -- 'residential','commercial','infrastructure'
  status          VARCHAR(30) CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  start_date      DATE,
  end_date        DATE,
  actual_end_date DATE,
  budget          NUMERIC(15,2),
  spent_amount    NUMERIC(15,2) DEFAULT 0,
  manager_id      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_milestones (
  id              SERIAL PRIMARY KEY,
  project_id      INT REFERENCES projects(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  due_date        DATE,
  completed_date  DATE,
  status          VARCHAR(20) CHECK (status IN ('pending','in_progress','completed','delayed')),
  completion_pct  NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE project_tasks (
  id              SERIAL PRIMARY KEY,
  project_id      INT REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id    INT REFERENCES project_milestones(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  assigned_to     UUID REFERENCES employees(id),
  priority        VARCHAR(20) CHECK (priority IN ('low','medium','high','critical')),
  status          VARCHAR(30) CHECK (status IN ('todo','in_progress','review','done','blocked')),
  start_date      DATE,
  due_date        DATE,
  estimated_hrs   NUMERIC(6,2),
  actual_hrs      NUMERIC(6,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE materials (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(100),
  unit            VARCHAR(50),   -- 'kg','m','m2','m3','unit','litre'
  unit_cost       NUMERIC(12,2),
  stock_quantity  NUMERIC(10,3) DEFAULT 0,
  reorder_level   NUMERIC(10,3) DEFAULT 0,
  supplier        VARCHAR(255),
  lead_time_days  INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_requests (
  id              SERIAL PRIMARY KEY,
  project_id      INT REFERENCES projects(id),
  material_id     INT REFERENCES materials(id),
  requested_qty   NUMERIC(10,3),
  approved_qty    NUMERIC(10,3),
  unit_cost       NUMERIC(12,2),
  total_cost      NUMERIC(15,2),
  request_date    DATE NOT NULL,
  required_date   DATE,
  status          VARCHAR(20) CHECK (status IN ('pending','approved','ordered','delivered','cancelled')),
  requested_by    UUID REFERENCES employees(id),
  approved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment_fleet (
  id              SERIAL PRIMARY KEY,
  equipment_code  VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(100),   -- 'crane','excavator','mixer','generator'
  model           VARCHAR(150),
  purchase_date   DATE,
  purchase_cost   NUMERIC(15,2),
  current_project INT REFERENCES projects(id),
  status          VARCHAR(30) CHECK (status IN ('available','in_use','maintenance','retired')),
  last_maintenance DATE,
  next_maintenance DATE,
  operating_hours NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_reports (
  id              SERIAL PRIMARY KEY,
  project_id      INT REFERENCES projects(id),
  report_date     DATE NOT NULL,
  weather         VARCHAR(50),
  workers_present INT,
  work_done       TEXT,
  issues          TEXT,
  photos          TEXT[],
  submitted_by    UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. WORKFORCE ANALYTICS MODULE
-- ============================================================

CREATE TABLE attrition_predictions (
  id              SERIAL PRIMARY KEY,
  employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
  risk_score      NUMERIC(5,4) NOT NULL,
  risk_level      VARCHAR(20) CHECK (risk_level IN ('low','medium','high','critical')),
  top_factors     JSONB,
  recommended_action TEXT,
  predicted_at    TIMESTAMPTZ DEFAULT NOW(),
  model_version   VARCHAR(50)
);

CREATE TABLE workforce_snapshots (
  id              SERIAL PRIMARY KEY,
  snapshot_date   DATE UNIQUE NOT NULL,
  total_employees INT,
  active_employees INT,
  new_hires       INT,
  terminations    INT,
  avg_performance NUMERIC(4,2),
  avg_satisfaction NUMERIC(4,2),
  avg_tenure_yrs  NUMERIC(5,2),
  headcount_by_dept JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workforce_surveys (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  is_anonymous    BOOLEAN DEFAULT TRUE,
  status          VARCHAR(20) CHECK (status IN ('draft','active','closed')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE survey_questions (
  id            SERIAL PRIMARY KEY,
  survey_id     INT REFERENCES workforce_surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) CHECK (question_type IN ('rating','multiple_choice','text','boolean')),
  options       JSONB,
  order_num     INT
);

CREATE TABLE survey_responses (
  id            SERIAL PRIMARY KEY,
  survey_id     INT REFERENCES workforce_surveys(id) ON DELETE CASCADE,
  employee_id   UUID REFERENCES employees(id),
  question_id   INT REFERENCES survey_questions(id),
  answer        TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PREDICTIVE ANALYTICS MODULE
-- ============================================================

CREATE TABLE ml_models (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  model_type      VARCHAR(100),
  algorithm       VARCHAR(100),
  target_variable VARCHAR(150),
  features        JSONB,
  hyperparameters JSONB,
  metrics         JSONB,          -- {"accuracy":0.87,"f1":0.84,"rmse":null}
  model_path      TEXT,
  is_active       BOOLEAN DEFAULT FALSE,
  trained_at      TIMESTAMPTZ,
  training_rows   INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE model_versions (
  id              SERIAL PRIMARY KEY,
  model_id        INT REFERENCES ml_models(id),
  version         VARCHAR(50) NOT NULL,
  metrics         JSONB,
  model_path      TEXT,
  is_champion     BOOLEAN DEFAULT FALSE,
  deployed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prediction_logs (
  id              SERIAL PRIMARY KEY,
  model_id        INT REFERENCES ml_models(id),
  model_version   VARCHAR(50),
  input_data      JSONB NOT NULL,
  output_data     JSONB NOT NULL,
  confidence      NUMERIC(5,4),
  latency_ms      INT,
  requested_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forecasts (
  id              SERIAL PRIMARY KEY,
  metric_name     VARCHAR(150) NOT NULL,
  module          VARCHAR(100),
  forecast_date   DATE NOT NULL,
  horizon_days    INT,
  predicted_val   NUMERIC(15,4),
  lower_bound     NUMERIC(15,4),
  upper_bound     NUMERIC(15,4),
  actual_val      NUMERIC(15,4),
  model_id        INT REFERENCES ml_models(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE anomaly_detections (
  id              SERIAL PRIMARY KEY,
  metric_name     VARCHAR(150),
  module          VARCHAR(100),
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  anomaly_score   NUMERIC(6,4),
  expected_val    NUMERIC(15,4),
  actual_val      NUMERIC(15,4),
  deviation_pct   NUMERIC(8,2),
  is_confirmed    BOOLEAN,
  reviewed_by     UUID REFERENCES users(id)
);

-- ============================================================
-- 8. ALERTS & OPTIMIZATION MODULE
-- ============================================================

CREATE TABLE alert_rules (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  module          VARCHAR(100),
  metric          VARCHAR(150),
  condition       VARCHAR(50) CHECK (condition IN ('gt','lt','gte','lte','eq','anomaly')),
  threshold       NUMERIC(15,4),
  severity        VARCHAR(20) CHECK (severity IN ('info','warning','critical')),
  is_active       BOOLEAN DEFAULT TRUE,
  cooldown_mins   INT DEFAULT 60,
  notify_roles    TEXT[],
  notify_emails   TEXT[],
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id              SERIAL PRIMARY KEY,
  rule_id         INT REFERENCES alert_rules(id),
  title           VARCHAR(255) NOT NULL,
  message         TEXT,
  severity        VARCHAR(20) CHECK (severity IN ('info','warning','critical')),
  module          VARCHAR(100),
  metric_value    NUMERIC(15,4),
  context_data    JSONB,
  is_read         BOOLEAN DEFAULT FALSE,
  is_resolved     BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  triggered_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_recipients (
  id          SERIAL PRIMARY KEY,
  alert_id    INT REFERENCES alerts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  read_at     TIMESTAMPTZ
);

CREATE TABLE optimization_suggestions (
  id              SERIAL PRIMARY KEY,
  module          VARCHAR(100),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  expected_impact TEXT,
  priority        VARCHAR(20) CHECK (priority IN ('low','medium','high')),
  status          VARCHAR(30) CHECK (status IN ('pending','accepted','rejected','implemented')),
  generated_by    VARCHAR(50),   -- 'ml_model','rule_engine','manual'
  source_data     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. DASHBOARD & KPI MODULE
-- ============================================================

CREATE TABLE kpi_definitions (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) UNIQUE NOT NULL,
  description   TEXT,
  unit          VARCHAR(50),
  format        VARCHAR(30),    -- 'number','percentage','currency','duration'
  module        VARCHAR(100),
  query_key     VARCHAR(150),
  target_value  NUMERIC(15,4),
  warning_threshold NUMERIC(15,4),
  critical_threshold NUMERIC(15,4),
  is_higher_better BOOLEAN DEFAULT TRUE,
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE kpi_snapshots (
  id            SERIAL PRIMARY KEY,
  kpi_id        INT REFERENCES kpi_definitions(id),
  value         NUMERIC(15,4),
  snapshot_date DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kpi_id, snapshot_date)
);

CREATE TABLE dashboard_layouts (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  layout_name   VARCHAR(150) DEFAULT 'Default',
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dashboard_widgets (
  id            SERIAL PRIMARY KEY,
  layout_id     INT REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
  widget_type   VARCHAR(100),
  title         VARCHAR(150),
  config        JSONB,
  position_x    INT DEFAULT 0,
  position_y    INT DEFAULT 0,
  width         INT DEFAULT 4,
  height        INT DEFAULT 3
);

-- ============================================================
-- 10. CHATBOT MODULE
-- ============================================================

CREATE TABLE chatbot_intents (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) UNIQUE NOT NULL,
  description     TEXT,
  patterns        TEXT[],
  response_type   VARCHAR(50) CHECK (response_type IN ('static','api_query','redirect','composite')),
  response_data   JSONB,
  module          VARCHAR(100),
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE chatbot_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  message_count   INT DEFAULT 0,
  satisfaction    INT CHECK (satisfaction BETWEEN 1 AND 5)
);

CREATE TABLE chatbot_messages (
  id              SERIAL PRIMARY KEY,
  session_id      UUID REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(20) CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  intent_id       INT REFERENCES chatbot_intents(id),
  confidence      NUMERIC(5,4),
  entities        JSONB,
  api_response    JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Auth
CREATE INDEX idx_users_email           ON users(email);
CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens(user_id);

-- HR
CREATE INDEX idx_employees_dept        ON employees(department_id);
CREATE INDEX idx_employees_active      ON employees(is_active);
CREATE INDEX idx_employees_manager     ON employees(manager_id);
CREATE INDEX idx_attendance_date       ON employee_attendance(employee_id, date);
CREATE INDEX idx_leave_requests_emp    ON leave_requests(employee_id, status);
CREATE INDEX idx_perf_reviews_emp      ON performance_reviews(employee_id);

-- Finance
CREATE INDEX idx_transactions_date     ON transactions(transaction_date);
CREATE INDEX idx_transactions_dept     ON transactions(department_id);
CREATE INDEX idx_transactions_status   ON transactions(status);
CREATE INDEX idx_annual_budgets_fy     ON annual_budgets(fiscal_year, department_id);

-- Accounting
CREATE INDEX idx_journal_date          ON journal_entries(entry_date);
CREATE INDEX idx_journal_lines_acct    ON journal_lines(account_id);
CREATE INDEX idx_invoices_status       ON invoices(status);
CREATE INDEX idx_invoices_due          ON invoices(due_date);

-- ICT
CREATE INDEX idx_assets_status         ON assets(status);
CREATE INDEX idx_assets_assigned       ON assets(assigned_to);
CREATE INDEX idx_it_tickets_status     ON it_tickets(status, priority);
CREATE INDEX idx_it_tickets_assigned   ON it_tickets(assigned_to);
CREATE INDEX idx_system_health_device  ON system_health_logs(device_id, logged_at);

-- Construction
CREATE INDEX idx_projects_status       ON projects(status);
CREATE INDEX idx_tasks_project         ON project_tasks(project_id, status);
CREATE INDEX idx_material_req_project  ON material_requests(project_id, status);
CREATE INDEX idx_equipment_status      ON equipment_fleet(status);

-- Workforce Analytics
CREATE INDEX idx_attrition_employee    ON attrition_predictions(employee_id);
CREATE INDEX idx_attrition_risk        ON attrition_predictions(risk_level, predicted_at);
CREATE INDEX idx_wf_snapshots_date     ON workforce_snapshots(snapshot_date);

-- Predictive
CREATE INDEX idx_forecasts_metric      ON forecasts(metric_name, forecast_date);
CREATE INDEX idx_prediction_logs_ts    ON prediction_logs(created_at);
CREATE INDEX idx_anomalies_module      ON anomaly_detections(module, detected_at);

-- Alerts
CREATE INDEX idx_alerts_severity       ON alerts(severity, is_resolved);
CREATE INDEX idx_alerts_module         ON alerts(module, triggered_at);
CREATE INDEX idx_alert_rules_module    ON alert_rules(module, is_active);

-- KPI / Dashboard
CREATE INDEX idx_kpi_snapshots_date    ON kpi_snapshots(kpi_id, snapshot_date);

-- Chatbot
CREATE INDEX idx_chatbot_msgs_session  ON chatbot_messages(session_id);
CREATE INDEX idx_chatbot_sessions_user ON chatbot_sessions(user_id);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('admin',    'Full system access — all modules'),
  ('manager',  'Department-level access, approvals'),
  ('analyst',  'Read all analytics, run predictions'),
  ('hr',       'HR and workforce module access'),
  ('finance',  'Finance and accounting module access'),
  ('ict',      'ICT management module access'),
  ('pm',       'Project management and construction access'),
  ('employee', 'Personal dashboard and self-service only');

INSERT INTO leave_types (name, days_allowed, is_paid) VALUES
  ('Annual Leave',    14, TRUE),
  ('Sick Leave',       7, TRUE),
  ('Maternity Leave', 60, TRUE),
  ('Paternity Leave',  5, TRUE),
  ('Unpaid Leave',    30, FALSE),
  ('Emergency Leave',  3, TRUE);

INSERT INTO kpi_definitions (name, description, unit, format, module, query_key, is_higher_better) VALUES
  ('Total Employees',        'Active headcount',             'count',  'number',     'hr',           'hr_headcount',          TRUE),
  ('Attrition Rate',         'Monthly employee turnover %',  '%',      'percentage', 'workforce',    'attrition_rate',        FALSE),
  ('Avg Performance Score',  'Mean performance review',      'score',  'number',     'hr',           'avg_performance',       TRUE),
  ('Avg Satisfaction Score', 'Mean employee satisfaction',   'score',  'number',     'workforce',    'avg_satisfaction',      TRUE),
  ('Open IT Tickets',        'Unresolved helpdesk tickets',  'count',  'number',     'ict',          'open_tickets',          FALSE),
  ('Budget Utilization',     'Spend vs allocated %',         '%',      'percentage', 'finance',      'budget_utilization',    FALSE),
  ('Revenue This Month',     'Total revenue current month',  '$',      'currency',   'finance',      'revenue_current_month', TRUE),
  ('Projects On Track',      '% of active projects on time', '%',      'percentage', 'construction', 'projects_on_track',     TRUE),
  ('Critical Alerts',        'Unresolved critical alerts',   'count',  'number',     'alerts',       'critical_alerts',       FALSE),
  ('Prediction Accuracy',    'Avg ML model accuracy',        '%',      'percentage', 'predictive',   'avg_model_accuracy',    TRUE);

INSERT INTO chatbot_intents (name, description, patterns, response_type, module) VALUES
  ('greeting',          'User greetings',           ARRAY['hello','hi','hey','good morning'], 'static',    NULL),
  ('attrition_query',   'Ask about attrition risk', ARRAY['attrition','who might leave','risk employee'], 'api_query', 'workforce'),
  ('kpi_query',         'Ask about KPIs',           ARRAY['kpi','performance','metrics','how are we doing'], 'api_query', 'dashboard'),
  ('alerts_query',      'Ask about alerts',         ARRAY['alerts','warnings','critical issues'], 'api_query', 'alerts'),
  ('budget_query',      'Ask about budget',         ARRAY['budget','spending','finance','cost'], 'api_query', 'finance'),
  ('project_query',     'Ask about projects',       ARRAY['project','construction','timeline','milestone'], 'api_query', 'construction'),
  ('ticket_query',      'Ask about IT tickets',     ARRAY['ticket','issue','support','helpdesk'], 'api_query', 'ict'),
  ('forecast_query',    'Ask about forecasts',      ARRAY['forecast','predict','next month','future'], 'api_query', 'predictive'),
  ('help',              'User needs help',          ARRAY['help','what can you do','commands'], 'static',    NULL);
