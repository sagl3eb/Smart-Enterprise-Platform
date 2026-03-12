import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import useAuthStore from "../../store/authStore";
import api from "../../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
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
      setAuth(user, tokens);
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
      <div className="lg:hidden text-center mb-8">
        <h1 className="text-3xl font-bold font-serif text-[#5B21B6]">SEP</h1>
        <p className="text-sm text-[#9B93B8] mt-1">Smart Enterprise Platform</p>
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
    </AuthLayout>
  );
}
