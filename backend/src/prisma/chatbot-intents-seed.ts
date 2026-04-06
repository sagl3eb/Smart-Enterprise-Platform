// SEP — Chatbot Intents Seed Data
// Add this array to your seed.ts file and upsert into chatbot_intents table
// Author: Saqqaf Al-Yazidi (TP075880)

export const chatbotIntents = [
  // ==================== HR MODULE ====================
  {
    intentName: 'hr_stats',
    patterns: ['how many employees', 'employee count', 'total employees', 'hr stats', 'hr statistics', 'workforce size', 'headcount', 'staff count', 'number of employees'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/hr/stats', method: 'GET', format: 'hr_stats' },
    module: 'hr',
    priority: 10,
    isActive: true,
  },
  {
    intentName: 'hr_search_employee',
    patterns: ['find employee', 'search employee', 'look up employee', 'employee details', 'who is', 'employee info', 'employee profile'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/hr/employees', method: 'GET', format: 'employee_list', params: { search: '$entity' } },
    module: 'hr',
    priority: 8,
    isActive: true,
  },
  {
    intentName: 'hr_departments',
    patterns: ['list departments', 'show departments', 'how many departments', 'department list', 'all departments', 'which departments'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/hr/departments', method: 'GET', format: 'department_list' },
    module: 'hr',
    priority: 7,
    isActive: true,
  },
  {
    intentName: 'hr_leave_requests',
    patterns: ['pending leaves', 'leave requests', 'who is on leave', 'leave status', 'pending leave requests', 'show leaves', 'leave applications'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/hr/leave-requests', method: 'GET', format: 'leave_list', params: { status: 'pending' } },
    module: 'hr',
    priority: 8,
    isActive: true,
  },
  {
    intentName: 'hr_create_employee',
    patterns: ['create employee', 'add employee', 'new employee', 'hire employee', 'register employee', 'add new staff', 'onboard employee'],
    responseType: 'action',
    responseData: { action: 'create_employee', endpoint: '/api/v1/hr/employees', method: 'POST', requiresConfirmation: true },
    module: 'hr',
    priority: 9,
    isActive: true,
  },
  {
    intentName: 'hr_approve_leave',
    patterns: ['approve leave', 'accept leave', 'approve leave request', 'grant leave'],
    responseType: 'action',
    responseData: { action: 'approve_leave', endpoint: '/api/v1/hr/leave-requests/:id/approve', method: 'PUT', requiresConfirmation: true },
    module: 'hr',
    priority: 9,
    isActive: true,
  },
  {
    intentName: 'hr_reject_leave',
    patterns: ['reject leave', 'deny leave', 'decline leave request', 'refuse leave'],
    responseType: 'action',
    responseData: { action: 'reject_leave', endpoint: '/api/v1/hr/leave-requests/:id/reject', method: 'PUT', requiresConfirmation: true },
    module: 'hr',
    priority: 9,
    isActive: true,
  },

  // ==================== FINANCE MODULE ====================
  {
    intentName: 'finance_budget_summary',
    patterns: ['budget summary', 'budget overview', 'how is the budget', 'total budget', 'budget status', 'financial summary', 'budget report', 'spending overview'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/finance/budgets/summary', method: 'GET', format: 'budget_summary' },
    module: 'finance',
    priority: 10,
    isActive: true,
  },
  {
    intentName: 'finance_transactions',
    patterns: ['recent transactions', 'show transactions', 'transaction list', 'last transactions', 'financial transactions', 'money flow'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/finance/transactions', method: 'GET', format: 'transaction_list' },
    module: 'finance',
    priority: 8,
    isActive: true,
  },
  {
    intentName: 'finance_create_transaction',
    patterns: ['create transaction', 'add transaction', 'new transaction', 'record expense', 'record income', 'log transaction', 'add expense'],
    responseType: 'action',
    responseData: { action: 'create_transaction', endpoint: '/api/v1/finance/transactions', method: 'POST', requiresConfirmation: true },
    module: 'finance',
    priority: 9,
    isActive: true,
  },
  {
    intentName: 'finance_variance',
    patterns: ['variance analysis', 'budget variance', 'over budget', 'under budget', 'spending variance', 'budget deviation'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/finance/variance-analysis', method: 'GET', format: 'variance_analysis' },
    module: 'finance',
    priority: 7,
    isActive: true,
  },

  // ==================== ACCOUNTING MODULE ====================
  {
    intentName: 'accounting_invoices',
    patterns: ['show invoices', 'invoice list', 'pending invoices', 'unpaid invoices', 'overdue invoices', 'invoice status', 'accounts receivable'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/accounting/invoices', method: 'GET', format: 'invoice_list' },
    module: 'accounting',
    priority: 8,
    isActive: true,
  },
  {
    intentName: 'accounting_trial_balance',
    patterns: ['trial balance', 'account balances', 'trial balance report', 'financial statement'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/accounting/trial-balance', method: 'GET', format: 'trial_balance' },
    module: 'accounting',
    priority: 7,
    isActive: true,
  },

  // ==================== ICT MODULE ====================
  {
    intentName: 'ict_tickets',
    patterns: ['open tickets', 'show tickets', 'support tickets', 'it tickets', 'ticket list', 'pending tickets', 'unresolved tickets', 'help desk'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/ict/tickets', method: 'GET', format: 'ticket_list', params: { status: 'open' } },
    module: 'ict',
    priority: 9,
    isActive: true,
  },
  {
    intentName: 'ict_create_ticket',
    patterns: ['create ticket', 'new ticket', 'submit ticket', 'report issue', 'log ticket', 'raise ticket', 'create support ticket', 'i have an issue', 'something is broken'],
    responseType: 'action',
    responseData: { action: 'create_ticket', endpoint: '/api/v1/ict/tickets', method: 'POST', requiresConfirmation: true },
    module: 'ict',
    priority: 10,
    isActive: true,
  },
  {
    intentName: 'ict_assets',
    patterns: ['show assets', 'it assets', 'asset list', 'equipment list', 'asset inventory', 'hardware list', 'company assets'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/ict/assets', method: 'GET', format: 'asset_list' },
    module: 'ict',
    priority: 7,
    isActive: true,
  },

  // ==================== PROJECT/CONSTRUCTION MODULE ====================
  {
    intentName: 'project_status',
    patterns: ['project status', 'show projects', 'active projects', 'project list', 'project progress', 'how are the projects', 'construction projects', 'project overview'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/construction/projects', method: 'GET', format: 'project_list' },
    module: 'construction',
    priority: 9,
    isActive: true,
  },
  {
    intentName: 'project_update_progress',
    patterns: ['update project', 'update progress', 'change project status', 'mark project complete', 'project milestone'],
    responseType: 'action',
    responseData: { action: 'update_project', endpoint: '/api/v1/construction/projects/:id', method: 'PUT', requiresConfirmation: true },
    module: 'construction',
    priority: 8,
    isActive: true,
  },

  // ==================== WORKFORCE/ATTRITION MODULE ====================
  {
    intentName: 'attrition_summary',
    patterns: ['attrition risk', 'attrition summary', 'who might leave', 'flight risk', 'employee turnover', 'retention risk', 'attrition rate', 'churn risk'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/workforce/attrition/summary', method: 'GET', format: 'attrition_summary' },
    module: 'workforce',
    priority: 10,
    isActive: true,
  },

  // ==================== ALERTS MODULE ====================
  {
    intentName: 'alerts_unread',
    patterns: ['show alerts', 'unread alerts', 'any alerts', 'notifications', 'warnings', 'what alerts', 'pending alerts', 'new alerts'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/alerts', method: 'GET', format: 'alert_list', params: { isRead: 'false' } },
    module: 'alerts',
    priority: 10,
    isActive: true,
  },
  {
    intentName: 'alerts_evaluate',
    patterns: ['run alerts', 'check alerts', 'evaluate alerts', 'trigger alert check', 'scan for issues'],
    responseType: 'action',
    responseData: { action: 'evaluate_alerts', endpoint: '/api/v1/alerts/evaluate', method: 'POST' },
    module: 'alerts',
    priority: 8,
    isActive: true,
  },

  // ==================== PREDICTIVE ANALYTICS MODULE ====================
  {
    intentName: 'ml_train_model',
    patterns: ['train model', 'retrain model', 'train attrition model', 'train ml', 'start training', 'train machine learning'],
    responseType: 'action',
    responseData: { action: 'train_model', endpoint: '/api/v1/predictive/attrition/train', method: 'POST' },
    module: 'predictive',
    priority: 8,
    isActive: true,
  },
  {
    intentName: 'ml_models_list',
    patterns: ['show models', 'ml models', 'model list', 'what models', 'model status', 'prediction models', 'machine learning models'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/predictive/models', method: 'GET', format: 'model_list' },
    module: 'predictive',
    priority: 7,
    isActive: true,
  },
  {
    intentName: 'ml_forecast',
    patterns: ['generate forecast', 'show forecast', 'predict revenue', 'forecast headcount', 'predict future', 'forecasting', 'time series forecast'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/predictive/forecast/sample/revenue', method: 'GET', format: 'forecast' },
    module: 'predictive',
    priority: 7,
    isActive: true,
  },

  // ==================== DASHBOARD MODULE ====================
  {
    intentName: 'dashboard_summary',
    patterns: ['dashboard summary', 'executive summary', 'overview', 'company overview', 'business summary', 'kpi summary', 'show dashboard', 'how is the company'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/dashboard/summary', method: 'GET', format: 'dashboard_summary' },
    module: 'dashboard',
    priority: 10,
    isActive: true,
  },
  {
    intentName: 'dashboard_kpis',
    patterns: ['show kpis', 'key metrics', 'performance indicators', 'kpi cards', 'latest kpis', 'key performance'],
    responseType: 'api_query',
    responseData: { endpoint: '/api/v1/dashboard/kpis/latest', method: 'GET', format: 'kpi_cards' },
    module: 'dashboard',
    priority: 8,
    isActive: true,
  },

  // ==================== NAVIGATION / HELP ====================
  {
    intentName: 'navigate_module',
    patterns: ['go to', 'open', 'navigate to', 'take me to', 'show me', 'where is', 'how do i find', 'where can i find'],
    responseType: 'static',
    responseData: {
      text: 'I can help you navigate! Here are the available modules:\n\n' +
        '📊 **Dashboard** — /dashboard\n' +
        '👥 **HR Management** — /hr\n' +
        '💰 **Finance** — /finance\n' +
        '📋 **Accounting** — /accounting\n' +
        '🖥️ **ICT Management** — /ict\n' +
        '🏗️ **Construction Logistics** — /construction\n' +
        '📈 **Workforce Analytics** — /workforce\n' +
        '🤖 **Predictive Analytics** — /predictive\n' +
        '⚠️ **Alerts** — /alerts\n' +
        '⚙️ **Settings** — /settings\n\n' +
        'Just tell me which module you want to open!'
    },
    module: 'navigation',
    priority: 5,
    isActive: true,
  },
  {
    intentName: 'help_capabilities',
    patterns: ['what can you do', 'help', 'capabilities', 'what do you know', 'how can you help', 'what are your features', 'commands', 'what commands'],
    responseType: 'static',
    responseData: {
      text: 'I can help you with many things across the SEP platform! Here\'s what I can do:\n\n' +
        '**📊 Data Queries:**\n' +
        '• Check employee count, department info, leave requests\n' +
        '• View budget summaries, transactions, invoices\n' +
        '• See open tickets, assets, project status\n' +
        '• Check alerts and KPIs\n\n' +
        '**🔧 Actions:**\n' +
        '• Create IT support tickets\n' +
        '• Create new employees\n' +
        '• Approve or reject leave requests\n' +
        '• Create financial transactions\n' +
        '• Update project progress\n' +
        '• Train ML models\n\n' +
        '**🤖 Analytics:**\n' +
        '• Check attrition risk predictions\n' +
        '• Generate forecasts\n' +
        '• View model performance\n\n' +
        '**🧭 Navigation:**\n' +
        '• Navigate to any module\n' +
        '• Answer questions about the platform\n\n' +
        'Just ask me anything!'
    },
    module: 'help',
    priority: 15,
    isActive: true,
  },
];

// --- How to add this to your seed.ts ---
// Import this file and add the following to your seed function:
//
// import { chatbotIntents } from './chatbot-intents-seed';
//
// for (const intent of chatbotIntents) {
//   await prisma.chatbotIntent.upsert({
//     where: { intentName: intent.intentName },
//     update: {
//       patterns: intent.patterns,
//       responseType: intent.responseType,
//       responseData: intent.responseData,
//       module: intent.module,
//       priority: intent.priority,
//       isActive: intent.isActive,
//     },
//     create: {
//       intentName: intent.intentName,
//       patterns: intent.patterns,
//       responseType: intent.responseType,
//       responseData: intent.responseData,
//       module: intent.module,
//       priority: intent.priority,
//       isActive: intent.isActive,
//     },
//   });
// }
// console.log(`Seeded ${chatbotIntents.length} chatbot intents`);
