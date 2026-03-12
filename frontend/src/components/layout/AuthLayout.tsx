import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#F8F7FF] dark:bg-[#0E0B1F]">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #13102A 0%, #5B21B6 100%)" }}>
        <div className="text-center z-10 px-12">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
            <span className="text-white text-4xl font-bold font-serif">S</span>
          </div>
          <h1 className="text-4xl font-bold text-white font-serif mb-1">SEP</h1>
          <p className="text-lg text-white/80 mb-2">Smart Enterprise Platform</p>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            AI-powered enterprise management with predictive analytics for smarter decision-making
          </p>
        </div>
        <div className="absolute top-20 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: "#7C3AED" }} />
        <div className="absolute bottom-20 -right-10 w-60 h-60 rounded-full opacity-10" style={{ background: "#7C3AED" }} />
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
