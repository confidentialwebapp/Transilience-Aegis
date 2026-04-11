"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setOrgId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Mail, Lock, Loader2 } from "lucide-react";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Try to fetch user's org membership
      if (data.user) {
        try {
          const { data: membership } = await supabase
            .from("org_members")
            .select("org_id")
            .eq("user_id", data.user.id)
            .single();

          if (membership?.org_id) {
            setOrgId(membership.org_id);
          } else {
            // No org membership found, use demo org
            setOrgId(DEMO_ORG_ID);
          }
        } catch {
          // If org_members lookup fails, use demo org
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

  const handleDemoAccess = () => {
    setOrgId(DEMO_ORG_ID);
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-purple-500/20 mb-4">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Transilience</h1>
          <p className="text-slate-400 mt-1">Threat Intelligence Platform</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-cyan-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-2 text-slate-500">or</span>
            </div>
          </div>

          <button
            onClick={handleDemoAccess}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-slate-700/50"
          >
            Continue as Demo User
          </button>

          <p className="text-center text-slate-400 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-purple-400 hover:text-cyan-300">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
