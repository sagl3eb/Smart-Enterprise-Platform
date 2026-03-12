import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
    case "high": return "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30";
    case "medium": return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
    case "low": return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
    case "info": return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
    default: return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "active": case "completed": case "approved": case "paid": case "resolved": case "online":
      return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30";
    case "pending": case "in_progress": case "draft": case "partially_paid":
      return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
    case "inactive": case "rejected": case "cancelled": case "terminated": case "overdue": case "offline":
      return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
    default:
      return "text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
  }
}

export const MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "hr", label: "HR Management", icon: "Users" },
  { key: "finance", label: "Finance", icon: "DollarSign" },
  { key: "accounting", label: "Accounting", icon: "Calculator" },
  { key: "ict", label: "ICT Management", icon: "Monitor" },
  { key: "construction", label: "Construction", icon: "HardHat" },
  { key: "workforce", label: "Workforce Analytics", icon: "BarChart3" },
  { key: "predictive", label: "Predictive Analytics", icon: "TrendingUp" },
  { key: "alerts", label: "Alerts", icon: "Bell" },
] as const;
