"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setOrgId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, User, Loader2, ArrowRight, CheckCircle } from "lucide-react";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create org and membership
        try {
          const { data: org } = await supabase.from("orgs").insert({
            name: name ? `${name}'s Organization` : "My Organization",
          }).select("id").single();

          if (org) {
            await supabase.from("org_members").insert({
              org_id: org.id,
              user_id: data.user.id,
              role: "admin",
            });
            setOrgId(org.id);
          } else {
            setOrgId(DEMO_ORG_ID);
          }
        } catch {
          setOrgId(DEMO_ORG_ID);
        }

        // Check if email confirmation is required
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setSuccess(true);
        }
      }
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.12)" };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-grid-pattern" style={{ background: "#07040B" }}>
        <div className="w-full max-w-md animate-fade-up">
          <div className="card-enterprise p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
            <p className="text-sm text-slate-400 mb-6">We sent a confirmation link to <strong className="text-slate-200">{email}</strong></p>
            <Link href="/login" className="text-purple-400 hover:text-purple-300 text-sm font-medium">Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-grid-pattern" style={{ background: "#07040B" }}>
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
            <Image src="/logo.png" alt="Transilience AI" width={40} height={40} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gradient-brand">Transilience AI</h1>
          <p className="text-slate-500 mt-1 text-sm">Create your account</p>
        </div>

        <div className="card-enterprise p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Register</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Full Name</label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  style={inputStyle} placeholder="Your full name" required />
              </div>
            </div>
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
                  style={inputStyle} placeholder="At least 6 characters" required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 btn-brand rounded-lg font-medium flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">Sign in</Link>
          </p>
        </div>
        <p className="text-center text-[11px] text-slate-700 mt-6">Powered by Transilience AI</p>
      </div>
    </div>
  );
}
