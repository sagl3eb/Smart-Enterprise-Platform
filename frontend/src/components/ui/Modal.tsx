import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/formatters";

// ─── Modal ─────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative w-full rounded-[16px] max-h-[90vh] overflow-y-auto",
        "bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850]",
        "shadow-xl",
        widths[size]
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E4F3] dark:border-[#2E2850] sticky top-0 bg-white dark:bg-[#16122E] z-10">
          <h2 className="text-base font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] text-[#9B93B8]">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Input ────────────────────────────────────────────

interface InputProps {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export function FormInput({ label, value, onChange, type = "text", placeholder, required, error, disabled }: InputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2.5 rounded-[10px] text-sm",
          "bg-white dark:bg-[#0E0B1F] border text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8]",
          "focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 focus:border-[#5B21B6]",
          error ? "border-red-400" : "border-[#E8E4F3] dark:border-[#2E2850]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Form Select ───────────────────────────────────────────

interface SelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export function FormSelect({ label, value, onChange, options, required, placeholder }: SelectProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Form Textarea ─────────────────────────────────────────

interface TextareaProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}

export function FormTextarea({ label, value, onChange, rows = 3, placeholder, required }: TextareaProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 resize-none"
      />
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function Button({ children, onClick, type = "button", variant = "primary", disabled, loading, className }: ButtonProps) {
  const variants = {
    primary: "bg-[#5B21B6] hover:bg-[#7C3AED] text-white",
    secondary: "bg-[#EDE9FE] dark:bg-[#2D1F5E] hover:bg-[#5B21B6] hover:text-white text-[#5B21B6]",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "bg-transparent hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] text-[#4C4566] dark:text-[#B8AEDD]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "px-4 py-2.5 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2",
        variants[variant],
        className
      )}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", loading }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-[#4C4566] dark:text-[#B8AEDD] mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// ─── Toast notification ────────────────────────────────────

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    error: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    info: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  };

  return (
    <div className={cn("fixed top-4 right-4 z-[100] px-4 py-3 rounded-[12px] text-sm border shadow-lg max-w-sm", colors[type])}>
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
