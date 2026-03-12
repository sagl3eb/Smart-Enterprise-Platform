-- ============================================================
-- Smart Enterprise Platform — Full Database Schema
-- TP075880 | Saqqaf Al-Yazidi | APU FYP 2025
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS & MODULE ACCESS
-- ============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE org_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_name VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, module_name)
);

CREATE TABLE user_module_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    has_access BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, module_name)
);

-- ============================================================
-- AUTH
-- ============================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(500),
    role_id UUID NOT NULL REFERENCES roles(id),
    organization_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- HR
-- ============================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    manager_id UUID,
    parent_id UUID REFERENCES departments(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    employee_code VARCHAR(20) UNIQUE NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    position VARCHAR(100) NOT NULL,
    hire_date TIMESTAMP NOT NULL,
    salary DECIMAL(12,2) NOT NULL,
    employment_type VARCHAR(20) DEFAULT 'full_time',
    status VARCHAR(20) DEFAULT 'active',
    manager_id UUID REFERENCES employees(id),
    date_of_birth TIMESTAMP,
    address TEXT,
    emergency_contact VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employee_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present',
    hours_worked DECIMAL(5,2),
    overtime DECIMAL(5,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    default_days INT DEFAULT 0,
    is_paid BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL,
    review_period VARCHAR(20) NOT NULL,
    overall_score DECIMAL(3,1) NOT NULL,
    goals JSONB,
    strengths TEXT,
    improvements TEXT,
    comments TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    review_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE training_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    provider VARCHAR(200),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    max_participants INT,
    cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employee_trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    training_program_id UUID NOT NULL REFERENCES training_programs(id),
    enrollment_date TIMESTAMP DEFAULT NOW(),
    completion_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'enrolled',
    score DECIMAL(5,2),
    certificate VARCHAR(500),
    UNIQUE(employee_id, training_program_id)
);

CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- FINANCE
-- ============================================================

CREATE TABLE budget_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE annual_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES budget_categories(id),
    fiscal_year INT NOT NULL,
    allocated_amount DECIMAL(14,2) NOT NULL,
    spent_amount DECIMAL(14,2) DEFAULT 0,
    remaining_amount DECIMAL(14,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category_id, fiscal_year)
);

CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    department_id UUID REFERENCES departments(id),
    budget_limit DECIMAL(14,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    reference VARCHAR(100),
    cost_center_id UUID REFERENCES cost_centers(id),
    transaction_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE financial_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    data JSONB NOT NULL,
    generated_by UUID,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTING
-- ============================================================

CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    parent_id UUID REFERENCES chart_of_accounts(id),
    balance DECIMAL(14,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft',
    total_debit DECIMAL(14,2) DEFAULT 0,
    total_credit DECIMAL(14,2) DEFAULT 0,
    created_by UUID,
    approved_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit DECIMAL(14,2) DEFAULT 0,
    credit DECIMAL(14,2) DEFAULT 0,
    description TEXT
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(255),
    issue_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL,
    paid_amount DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(14,2) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id),
    amount DECIMAL(14,2) NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tax_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    taxable_amount DECIMAL(14,2) NOT NULL,
    tax_amount DECIMAL(14,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    filing_date TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ICT MANAGEMENT
-- ============================================================

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_tag VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    purchase_date TIMESTAMP,
    purchase_price DECIMAL(12,2),
    warranty_expiry TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    assigned_to VARCHAR(200),
    location VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE software_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    software_name VARCHAR(200) NOT NULL,
    vendor VARCHAR(200),
    license_key VARCHAR(500),
    license_type VARCHAR(50) NOT NULL,
    total_seats INT NOT NULL,
    used_seats INT DEFAULT 0,
    purchase_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP,
    annual_cost DECIMAL(12,2),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE it_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    reported_by VARCHAR(200) NOT NULL,
    assigned_to VARCHAR(200),
    resolution TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE network_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    location VARCHAR(200),
    status VARCHAR(20) DEFAULT 'online',
    manufacturer VARCHAR(100),
    firmware VARCHAR(100),
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE system_health_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES network_devices(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'normal',
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CONSTRUCTION LOGISTICS
-- ============================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    client_name VARCHAR(200),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    estimated_budget DECIMAL(14,2),
    actual_budget DECIMAL(14,2),
    status VARCHAR(20) DEFAULT 'planning',
    progress DECIMAL(5,2) DEFAULT 0,
    manager_id UUID,
    location VARCHAR(300),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(200),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'todo',
    start_date TIMESTAMP,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_hours DECIMAL(6,1),
    actual_hours DECIMAL(6,1),
    parent_task_id UUID REFERENCES project_tasks(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    stock_qty DECIMAL(12,2) DEFAULT 0,
    reorder_level DECIMAL(12,2) DEFAULT 0,
    supplier VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE material_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    requested_by VARCHAR(200) NOT NULL,
    approved_by VARCHAR(200),
    delivery_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE equipment_fleet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    registration_number VARCHAR(50) UNIQUE,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    year_manufactured INT,
    status VARCHAR(20) DEFAULT 'available',
    current_location VARCHAR(200),
    last_maintenance TIMESTAMP,
    next_maintenance TIMESTAMP,
    hourly_rate DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE site_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    weather VARCHAR(50),
    workforce_count INT,
    summary TEXT NOT NULL,
    issues TEXT,
    safety_notes TEXT,
    photos JSONB,
    created_by VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- WORKFORCE ANALYTICS
-- ============================================================

CREATE TABLE attrition_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    risk_score DECIMAL(5,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    top_factors JSONB NOT NULL,
    predicted_at TIMESTAMP DEFAULT NOW(),
    model_version VARCHAR(50)
);

CREATE TABLE workforce_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id),
    snapshot_date DATE NOT NULL,
    headcount INT NOT NULL,
    avg_satisfaction DECIMAL(3,2),
    avg_performance DECIMAL(3,2),
    turnover_rate DECIMAL(5,2),
    avg_tenure DECIMAL(5,1),
    overtime_hours DECIMAL(8,1),
    open_positions INT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(department_id, snapshot_date)
);

CREATE TABLE workforce_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE survey_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES workforce_surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    options JSONB,
    is_required BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0
);

CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    respondent_id UUID,
    answer TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PREDICTIVE ANALYTICS
-- ============================================================

CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    parameters JSONB,
    file_path VARCHAR(500),
    trained_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE(model_id, version)
);

CREATE TABLE prediction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ml_models(id),
    input_data JSONB NOT NULL,
    prediction JSONB NOT NULL,
    confidence DECIMAL(5,4),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric VARCHAR(100) NOT NULL,
    target_date DATE NOT NULL,
    predicted_value DECIMAL(14,2) NOT NULL,
    lower_bound DECIMAL(14,2),
    upper_bound DECIMAL(14,2),
    actual_value DECIMAL(14,2),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE anomaly_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric VARCHAR(100) NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    value DECIMAL(14,2) NOT NULL,
    expected_range JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ALERTS & OPTIMIZATION
-- ============================================================

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    module VARCHAR(50) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    condition VARCHAR(20) NOT NULL,
    threshold DECIMAL(14,2) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    cooldown_minutes INT DEFAULT 60,
    last_triggered TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    module VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE TABLE alert_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    channel VARCHAR(20) DEFAULT 'in_app',
    UNIQUE(rule_id, user_id, channel)
);

CREATE TABLE optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(20) NOT NULL,
    effort VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DASHBOARD & KPIs
-- ============================================================

CREATE TABLE kpi_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    unit VARCHAR(20),
    target DECIMAL(14,2),
    format VARCHAR(20) DEFAULT 'number',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE kpi_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    value DECIMAL(14,2) NOT NULL,
    snapshot_date DATE NOT NULL,
    previous_value DECIMAL(14,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(kpi_id, snapshot_date)
);

CREATE TABLE dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    layout JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layout_id UUID NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
    widget_type VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,
    position JSONB NOT NULL,
    size JSONB NOT NULL
);

-- ============================================================
-- CHATBOT
-- ============================================================

CREATE TABLE chatbot_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intent_name VARCHAR(100) UNIQUE NOT NULL,
    patterns JSONB NOT NULL,
    response_type VARCHAR(20) NOT NULL,
    response_data JSONB NOT NULL,
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE chatbot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    metadata JSONB
);

CREATE TABLE chatbot_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    intent VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEED: Default roles
-- ============================================================

INSERT INTO roles (name, description, permissions) VALUES
('super_admin', 'Platform super administrator', '{"all": true, "manage_orgs": true}'),
('admin', 'Organization administrator', '{"all": true}'),
('manager', 'Department manager with elevated access', '{"read": true, "write": true, "approve": true}'),
('employee', 'Regular employee with standard access', '{"read": true, "write_own": true}'),
('viewer', 'Read-only access for stakeholders', '{"read": true}');

-- ============================================================
-- SEED: Default leave types
-- ============================================================

INSERT INTO leave_types (name, default_days, is_paid, requires_approval, description) VALUES
('Annual Leave', 21, TRUE, TRUE, 'Standard annual vacation leave'),
('Sick Leave', 14, TRUE, FALSE, 'Leave for medical reasons'),
('Personal Leave', 5, TRUE, TRUE, 'Leave for personal matters'),
('Maternity Leave', 90, TRUE, TRUE, 'Leave for maternity'),
('Paternity Leave', 14, TRUE, TRUE, 'Leave for paternity'),
('Unpaid Leave', 0, FALSE, TRUE, 'Leave without pay');

-- ============================================================
-- SEED: Default chatbot intents
-- ============================================================

INSERT INTO chatbot_intents (intent_name, patterns, response_type, response_data, priority) VALUES
('greeting', '["hello", "hi", "hey", "good morning", "good afternoon", "howdy", "greetings"]', 'static', '{"text": "Hello! I''m your Smart Enterprise assistant. I can help you with HR queries, financial data, project updates, IT tickets, and more. What would you like to know?"}', 10),
('help', '["help", "what can you do", "commands", "features", "assist", "support"]', 'static', '{"text": "I can help with: employee info, leave status, budget data, project updates, IT tickets, KPIs, alerts, and forecasts. Just ask me a question!"}', 9),
('attrition_query', '["attrition", "turnover", "employee risk", "flight risk", "retention", "leaving"]', 'api_query', '{"endpoint": "/api/v1/workforce/attrition/summary", "method": "GET", "format": "attrition_summary"}', 8),
('kpi_query', '["kpi", "performance indicator", "metrics", "dashboard stats", "key metrics"]', 'api_query', '{"endpoint": "/api/v1/dashboard/kpis/latest", "method": "GET", "format": "kpi_list"}', 8),
('alerts_query', '["alerts", "warnings", "notifications", "unread alerts", "recent alerts"]', 'api_query', '{"endpoint": "/api/v1/alerts?isRead=false&limit=5", "method": "GET", "format": "alert_list"}', 7),
('budget_query', '["budget", "spending", "expenses", "financial", "money", "funds"]', 'api_query', '{"endpoint": "/api/v1/finance/budgets/summary", "method": "GET", "format": "budget_summary"}', 7),
('project_query', '["project", "construction", "milestone", "project status", "site"]', 'api_query', '{"endpoint": "/api/v1/construction/projects/summary", "method": "GET", "format": "project_summary"}', 7),
('ticket_query', '["ticket", "it ticket", "support ticket", "issue", "tech support"]', 'api_query', '{"endpoint": "/api/v1/ict/tickets/summary", "method": "GET", "format": "ticket_summary"}', 7),
('forecast_query', '["forecast", "prediction", "predict", "future", "trend", "projection"]', 'api_query', '{"endpoint": "/api/v1/predictive/forecasts/latest", "method": "GET", "format": "forecast_summary"}', 6),
('goodbye', '["bye", "goodbye", "see you", "thanks", "thank you", "exit", "quit"]', 'static', '{"text": "Goodbye! Feel free to come back anytime you need assistance."}', 5);

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_attendance_date ON employee_attendance(date);
CREATE INDEX idx_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_it_tickets_status ON it_tickets(status);
CREATE INDEX idx_it_tickets_priority ON it_tickets(priority);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_alerts_read ON alerts(is_read);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created ON alerts(created_at);
CREATE INDEX idx_kpi_snapshots_date ON kpi_snapshots(snapshot_date);
CREATE INDEX idx_forecasts_metric ON forecasts(metric);
CREATE INDEX idx_anomaly_metric ON anomaly_detections(metric);
CREATE INDEX idx_health_logs_recorded ON system_health_logs(recorded_at);
CREATE INDEX idx_chatbot_messages_session ON chatbot_messages(session_id);
