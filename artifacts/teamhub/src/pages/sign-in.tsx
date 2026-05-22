import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Link, useLocation } from "wouter";
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "sign_in" | "magic_link" | "reset_password";

export default function SignInPage() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getRedirectTarget(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "/dashboard";
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setLocation(getRedirectTarget());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${basePath}/dashboard` },
      });
      if (error) setError(error.message);
      else setSuccess("Check your email for the magic link!");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${basePath}/sign-in`,
      });
      if (error) setError(error.message);
      else setSuccess("Password reset email sent. Check your inbox.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,107,53,0.1) 0%, transparent 60%)" }}
    >
      <div className="w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-2">
          <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="h-6 w-6 text-white" fill="white" />
          </div>
          <span className="font-wordmark text-3xl text-foreground tracking-wide">CLASIKO</span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 shadow-2xl shadow-black/50 space-y-5"
          style={{ background: "hsl(226,40%,8%)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["sign_in", "magic_link"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={mode === m
                  ? { background: "hsl(22,100%,60%)", color: "white" }
                  : { color: "rgba(255,255,255,0.45)" }}
              >
                {m === "sign_in" ? "Password" : "Magic Link"}
              </button>
            ))}
          </div>

          {mode === "sign_in" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="coach@team.com"
                    required
                    className="ps-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="ps-9 pe-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setMode("reset_password"); setError(""); setSuccess(""); }}
                className="text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Forgot password?
              </button>

              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          )}

          {mode === "magic_link" && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="coach@team.com"
                    required
                    className="ps-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-xl"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
              {success && <p className="text-sm text-green-400 font-medium">{success}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {loading ? "Sending…" : "Send Magic Link"}
              </Button>
            </form>
          )}

          {mode === "reset_password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-white/50">Enter your email to receive a password reset link.</p>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="coach@team.com"
                    required
                    className="ps-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-xl"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
              {success && <p className="text-sm text-green-400 font-medium">{success}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
              <button
                type="button"
                onClick={() => { setMode("sign_in"); setError(""); setSuccess(""); }}
                className="block w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/30">
          Don't have an account?{" "}
          <Link href="/sign-up">
            <span className="text-primary hover:text-primary/80 cursor-pointer">Request access</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
