"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setOrgId } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Mail, Lock, Building2, Loader2, CheckCircle } from "lucide-react";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function RegisterPage() {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { org_name: orgName } },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Supabase may require email confirmation
      // If identities is empty, it means the user needs to confirm their email
      if (
        data.user &&
        data.user.identities &&
        data.user.identities.length === 0
      ) {
        setEmailConfirmationSent(true);
        setLoading(false);
        return;
      }

      // If we got a session, the user is confirmed (e.g. email confirmation disabled)
      if (data.user && data.session) {
        try {
          // Create org and membership
          const { data: org, error: orgError } = await supabase
            .from("orgs")
            .insert({ name: orgName, domain: email.split("@")[1] })
            .select()
            .single();

          if (orgError) {
            console.error("Failed to create org:", orgError);
            // Use demo org as fallback
            setOrgId(DEMO_ORG_ID);
          } else if (org) {
            const { error: memberError } = await supabase
              .from("org_members")
              .insert({
                org_id: org.id,
                user_id: data.user.id,
                role: "admin",
              });

            if (memberError) {
              console.error("Failed to create org membership:", memberError);
            }

            // Create default notification settings - non-critical, ignore errors
            await supabase
              .from("notification_settings")
              .insert({
                org_id: org.id,
                email_enabled: true,
                email_recipients: [email],
              })
              .catch(() => {});

            setOrgId(org.id);
          }
        } catch {
          // Non-critical: org creation failed, use demo org
          setOrgId(DEMO_ORG_ID);
        }

        router.push("/");
        router.refresh();
        return;
      }

      // If no session but user exists, email confirmation is likely required
      if (data.user && !data.session) {
        setEmailConfirmationSent(true);
        setLoading(false);
        return;
      }

      // Fallback: just go to dashboard
      setOrgId(DEMO_ORG_ID);
      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Show email confirmation UI
  if (emailConfirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Check Your Email</h1>
            <p className="text-slate-400 mt-2 leading-relaxed">
              We&apos;ve sent a confirmation link to <strong className="text-slate-200">{email}</strong>.
              Please check your inbox and click the link to activate your account.
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">
              After confirming your email, you can sign in to your account.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">TAI-AEGIS</h1>
          <p className="text-slate-400 mt-1">Create your account</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-8">
          <h2 className="text-xl font-semibold mb-6">Register</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Organization Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Acme Corp"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
