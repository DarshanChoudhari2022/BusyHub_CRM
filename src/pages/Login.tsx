import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter email and password"); return; }
    setLoading(true); setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); }
      else           { toast.success("Welcome back!"); navigate("/"); }
    } catch { setError("An unexpected error occurred"); }
    finally   { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  return (
    /* Outer — light gray page bg like Crisp */
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "hsl(210 20% 96%)" }}
    >
      {/* Card — white, rounded, shadow */}
      <div
        className="w-full max-w-[400px] bg-white rounded-2xl animate-scale-in"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        {/* Blue accent strip */}
        <div className="h-1 bg-blue-600 rounded-t-2xl" />

        <div className="p-8 space-y-6">
          {/* Logo + heading */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-14 w-14 mb-1 flex items-center justify-center">
              <img
                src="/logo-brand.png"
                alt="BuzyHub"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <h1
                className="text-[22px] font-bold tracking-tight text-gray-900"
                style={{ letterSpacing: "-0.02em" }}
              >
                BUZYHUB
              </h1>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase mt-0.5">
                Enterprise CRM Workspace
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[13px] animate-fade-up">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[13px] font-medium text-gray-700"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@BuzyHub.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-9 h-10 text-[13px] bg-gray-50 border-gray-200 rounded-lg
                    focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500
                    placeholder:text-gray-400 text-gray-900 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-medium text-gray-700"
                >
                  Password
                </Label>
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-gray-400" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pl-9 pr-10 h-10 text-[13px] bg-gray-50 border-gray-200 rounded-lg
                    focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500
                    placeholder:text-gray-400 text-gray-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw
                    ? <EyeOff className="h-[15px] w-[15px]" />
                    : <Eye    className="h-[15px] w-[15px]" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px]
                shadow-sm transition-all active:scale-[0.98]"
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing In…</>
                : "Sign In"}
            </Button>
          </form>

          {/* Footer links */}
          <div className="space-y-2 text-center">
            <p className="text-[13px] text-gray-500">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                Sign Up
              </Link>
            </p>
            <p className="text-[11px] text-gray-400">
              Internal access only. Unauthorized entry is prohibited.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom copyright */}
      <div className="fixed bottom-6 text-[11px] text-gray-400 font-medium tracking-widest uppercase">
        © 2026 BuzyHub CRM · v2.0.4
      </div>
    </div>
  );
}
