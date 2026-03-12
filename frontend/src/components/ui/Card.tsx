import { ReactNode } from "react";
import { cn } from "../../utils/formatters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Card ──────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[16px] bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850]",
        "shadow-[0_1px_4px_rgba(91,33,182,0.08),0_4px_16px_rgba(91,33,182,0.05)]",
        "dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)]",
        onClick && "cursor-pointer hover:border-[#5B21B6]/30 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4 border-b border-[#E8E4F3] dark:border-[#2E2850]", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

// ─── Badge ─────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  className?: string;
}

const badgeVariants: Record<string, string> = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  purple: "bg-[#EDE9FE] text-[#5B21B6] dark:bg-[#2D1F5E] dark:text-[#B8AEDD]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-xs font-medium",
      badgeVariants[variant],
      className
    )}>
      {children}
    </span>
  );
}

// ─── StatCard ──────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  icon?: ReactNode;
  format?: "number" | "currency" | "percent";
  sparkline?: number[];
}

export function StatCard({ title, value, change, subtitle, icon }: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <Card>
      <CardBody className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-[#9B93B8] dark:text-[#6B5F8F] mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-[#1E1B2E] dark:text-[#EDE9FE] font-serif">
            {value}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {!isNeutral && (
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                isPositive && "text-emerald-600 dark:text-emerald-400",
                isNegative && "text-red-600 dark:text-red-400",
              )}>
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(change!).toFixed(1)}%
              </span>
            )}
            {isNeutral && change !== undefined && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-[#9B93B8]">
                <Minus size={12} />0%
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-[#9B93B8] dark:text-[#6B5F8F]">{subtitle}</span>
            )}
          </div>
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-[12px] bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-[#5B21B6]">
            {icon}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Loading Spinner ───────────────────────────────────────

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-10 h-10" : "w-7 h-7";
  return (
    <div className="flex items-center justify-center py-12">
      <div className={cn("border-2 border-[#E8E4F3] dark:border-[#2E2850] border-t-[#5B21B6] rounded-full animate-spin", sizeClass)} />
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-[#9B93B8]">{icon}</div>}
      <p className="text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD]">{title}</p>
      {description && <p className="text-xs text-[#9B93B8] mt-1">{description}</p>}
    </div>
  );
}
