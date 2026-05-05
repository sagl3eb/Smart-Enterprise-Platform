import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Sun, Moon, ExternalLink, BookOpen, Code2 } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import api from "../../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const { mode: themeMode, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const { user, tokens } = res.data.data;
      setAuth(user, tokens, remember);
      navigate("/dashboard");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || "Login failed");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Top-right theme toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="lg:hidden">
          <h1 className="text-2xl font-bold font-serif text-[#5B21B6]">SEP</h1>
          <p className="text-[11px] text-[#9B93B8]">Smart Enterprise Platform</p>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="ml-auto w-9 h-9 rounded-[10px] flex items-center justify-center
            bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
            text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
        >
          {themeMode === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] mb-1">
        Welcome back
      </h2>
      <p className="text-sm text-[#9B93B8] mb-8">
        Sign in to your account to continue
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-[10px] text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-3 rounded-[10px] text-sm
              bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8]
              focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 focus:border-[#5B21B6]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 pr-11 rounded-[10px] text-sm
                bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850]
                text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8]
                focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 focus:border-[#5B21B6]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B93B8] hover:text-[#4C4566]"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-[#E8E4F3] dark:border-[#2E2850] text-[#5B21B6] focus:ring-[#5B21B6]/30"
          />
          <span className="text-sm text-[#4C4566] dark:text-[#B8AEDD]">Remember me</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-[10px] text-sm font-semibold text-white
            bg-[#5B21B6] hover:bg-[#7C3AED] disabled:opacity-50
            transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-center text-xs text-[#9B93B8] mt-6">
        Contact your administrator to get an account
      </p>

      <div className="mt-8 pt-6 border-t border-[#E8E4F3] dark:border-[#2E2850]">
        <p className="text-[10px] uppercase tracking-wider text-[#9B93B8] text-center mb-3">Showcase</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href="/showcase/index.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-medium
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
          >
            <BookOpen size={13} /> Showcase Index <ExternalLink size={11} />
          </a>
          <a
            href="/showcase/04-landing-manifesto.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-medium
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
          >
            <Code2 size={13} /> Platform Manifesto <ExternalLink size={11} />
          </a>
          <a
            href="/showcase/02-dashboard-ledger.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-medium
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
          >
            <BookOpen size={13} /> Dashboard Ledger <ExternalLink size={11} />
          </a>
          <a
            href="/showcase/03-chatbot-signal.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-xs font-medium
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
          >
            <BookOpen size={13} /> Chatbot Signal <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </AuthLayout>
  );
}
