"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setOrgId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        try {
          localStorage.setItem("tai_user_id", data.user.id);
          const { data: membership } = await supabase
            .from("org_members")
            .select("org_id")
            .eq("user_id", data.user.id)
            .single();
          setOrgId(membership?.org_id || DEMO_ORG_ID);
        } catch {
          setOrgId(DEMO_ORG_ID);
        }
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setDemoLoading(true);
    setError("");
    try {
      const supabase = createClient();
      // Try anonymous sign-in first
      const { error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        // Fallback: sign up/in as demo user
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: "demo@transilience.ai",
          password: "DemoTransilience2024!",
        });
        if (signInErr) {
          await supabase.auth.signUp({
            email: "demo@transilience.ai",
            password: "DemoTransilience2024!",
            options: { data: { role: "demo", name: "Demo User" } },
          });
          await supabase.auth.signInWithPassword({
            email: "demo@transilience.ai",
            password: "DemoTransilience2024!",
          });
        }
      }
      setOrgId(DEMO_ORG_ID);
      router.push("/");
      router.refresh();
    } catch {
      // Last resort: just proceed with demo org
      setOrgId(DEMO_ORG_ID);
      router.push("/");
    } finally {
      setDemoLoading(false);
    }
  };

  const inputStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.12)" };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid-pattern" style={{ background: "#07040B" }}>
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
            <Image src="/logo.png" alt="Transilience AI" width={40} height={40} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gradient-brand">Transilience AI</h1>
          <p className="text-slate-500 mt-1 text-sm">Threat Exposure Management Platform</p>
        </div>

        <div className="card-enterprise p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  style={inputStyle} placeholder="you@company.com" required />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  style={inputStyle} placeholder="Enter your password" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 btn-brand rounded-lg font-medium flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 text-slate-600" style={{ background: "#110d1a" }}>or</span>
            </div>
          </div>

          <button onClick={handleDemoAccess} disabled={demoLoading}
            className="w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-white"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.08)" }}>
            {demoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {demoLoading ? "Starting demo..." : "Explore Demo Environment"}
          </button>

          <p className="text-center text-slate-500 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium">Register</Link>
          </p>
        </div>
        <p className="text-center text-[11px] text-slate-700 mt-6">Powered by Transilience AI</p>
      </div>
    </div>
  );
}
