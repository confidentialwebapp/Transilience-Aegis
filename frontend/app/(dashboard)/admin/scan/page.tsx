"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, AlertTriangle, Building2, Globe, AtSign, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

// Prefer NEXT_PUBLIC_N8N_WEBHOOK_BASE (n8n root URL); fall back to the deployed Modal URL
const N8N_ROOT =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE ??
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ??
  "https://transilience--aegis-n8n-server.modal.run";

type Service = "brand_monitoring" | "data_loss_recovery";

interface Tenant {
  id: string;
  name: string;
  primary_brand: string | null;
  primary_domain: string | null;
}

function webhookUrlFor(service: Service): string {
  const path = service === "brand_monitoring" ? "run-brand-sweep" : "run-dlr-sweep";
  return `${N8N_ROOT.replace(/\/$/, "")}/webhook/${path}`;
}

export default function AdminScanPage() {
  const router = useRouter();
  const params = useSearchParams();
  const queryTenantId = params.get("tenant_id");
  const supabase = useMemo(() => createClient(), []);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantId, setTenantId] = useState<string>(queryTenantId ?? "");
  const [service, setService] = useState<Service>("brand_monitoring");
  const [brand, setBrand] = useState("");
  const [ownedDomains, setOwnedDomains] = useState("");
  const [whitelistedHandles, setWhitelistedHandles] = useState("");
  const [executiveEmails, setExecutiveEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tenants
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, primary_brand, primary_domain")
        .order("name", { ascending: true });
      if (!alive) return;
      if (error) setError(error.message);
      else setTenants((data ?? []) as Tenant[]);
      setLoadingTenants(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // Auto-fill from selected tenant
  useEffect(() => {
    if (!tenantId) return;
    const t = tenants.find((x) => x.id === tenantId);
    if (!t) return;
    setBrand((cur) => cur || t.primary_brand || t.name);
    setOwnedDomains((cur) => cur || (t.primary_domain ?? ""));
  }, [tenantId, tenants]);

  const handleSubmit = async () => {
    if (!tenantId) {
      setError("Pick a tenant first.");
      return;
    }
    if (!brand.trim()) {
      setError("Brand is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const triggeredBy = session.session?.user.id ?? null;

      const ownedDomainsArr = ownedDomains.split(",").map((s) => s.trim()).filter(Boolean);
      const whitelistedArr = whitelistedHandles.split(",").map((s) => s.trim()).filter(Boolean);
      const executivesArr = executiveEmails.split(",").map((s) => s.trim()).filter(Boolean);

      const payload = {
        brand: brand.trim(),
        owned_domains: ownedDomainsArr,
        whitelisted_handles: whitelistedArr,
        executive_emails: executivesArr,
      };

      const { data: run, error: insertErr } = await supabase
        .from("scan_runs")
        .insert({
          tenant_id: tenantId,
          brand: brand.trim(),
          service,
          trigger: "admin_manual",
          triggered_by: triggeredBy,
          status: "running",
          payload,
        })
        .select("id")
        .single();

      if (insertErr || !run) {
        setError(insertErr?.message ?? "Failed to create scan run.");
        setSubmitting(false);
        return;
      }

      const webhookUrl = webhookUrlFor(service);
      const webhookBody = {
        run_id: run.id,
        tenant_id: tenantId,
        ...payload,
      };
      // Fire-and-forget — n8n may take ~60s; we navigate to the run page immediately
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookBody),
      }).catch(() => {
        /* n8n PATCH on failure handled server-side */
      });

      router.push(`/admin/runs/${run.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Run Scan"
        description="Trigger an OSINT brand-monitoring sweep against a tenant. Findings appear live on the customer dashboard within 60-90 seconds."
      />

      <div
        className="rounded-xl p-5 max-w-3xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="space-y-4">
          {/* Tenant */}
          <Field label="Tenant" icon={Building2}>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={loadingTenants || submitting}
              className="w-full bg-transparent text-[12.5px] text-slate-200 outline-none"
            >
              <option value="" className="bg-[#0d0a14]">
                {loadingTenants ? "Loading…" : "— Pick a tenant —"}
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0d0a14]">
                  {t.name} {t.primary_domain ? `(${t.primary_domain})` : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* Service */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Service</label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ServiceTile
                value="brand_monitoring"
                active={service === "brand_monitoring"}
                onClick={() => setService("brand_monitoring")}
                label="Brand Monitoring"
                desc="Apify + Sherlock + Anthropic filter"
              />
              <ServiceTile
                value="data_loss_recovery"
                active={service === "data_loss_recovery"}
                onClick={() => setService("data_loss_recovery")}
                label="Data Loss Recovery"
                desc="HIBP credential breach sweep"
              />
            </div>
          </div>

          {/* Brand */}
          <Field label="Brand" icon={Building2}>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="CreditAccess Grameen"
              className="w-full bg-transparent text-[12.5px] text-slate-200 outline-none placeholder:text-slate-600"
            />
          </Field>

          {/* Owned domains */}
          <Field label="Owned Domains (comma-separated)" icon={Globe}>
            <textarea
              value={ownedDomains}
              onChange={(e) => setOwnedDomains(e.target.value)}
              placeholder="creditaccessgrameen.in"
              rows={2}
              className="w-full bg-transparent text-[12.5px] text-slate-200 outline-none resize-none placeholder:text-slate-600"
            />
          </Field>

          {/* Whitelisted handles */}
          <Field label="Whitelisted Handles (optional)" icon={AtSign}>
            <textarea
              value={whitelistedHandles}
              onChange={(e) => setWhitelistedHandles(e.target.value)}
              placeholder="@creditaccessgrameen, @cag_official"
              rows={2}
              className="w-full bg-transparent text-[12.5px] text-slate-200 outline-none resize-none placeholder:text-slate-600"
            />
          </Field>

          {/* Executive emails */}
          <Field label="Executive Emails (optional, for HIBP/Holehe)" icon={UserCircle}>
            <textarea
              value={executiveEmails}
              onChange={(e) => setExecutiveEmails(e.target.value)}
              placeholder="ceo@creditaccessgrameen.in, ciso@creditaccessgrameen.in"
              rows={2}
              className="w-full bg-transparent text-[12.5px] text-slate-200 outline-none resize-none placeholder:text-slate-600"
            />
          </Field>

          {error && (
            <div
              className="px-3 py-2 rounded-lg flex items-start gap-2 text-[11.5px]"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !tenantId}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
          >
            <Zap className="w-4 h-4" /> {submitting ? "Running…" : "Run Now"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
      <div
        className="mt-1.5 flex items-start gap-2 px-3 py-2 rounded-lg"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.15)" }}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function ServiceTile({
  active,
  onClick,
  label,
  desc,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left px-3 py-2.5 rounded-lg transition-all"
      style={{
        background: active ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.025)",
        border: active ? "1px solid rgba(139,92,246,0.40)" : "1px solid rgba(139,92,246,0.10)",
      }}
    >
      <p className={`text-[12.5px] font-semibold ${active ? "text-purple-200" : "text-slate-300"}`}>{label}</p>
      <p className="text-[10.5px] text-slate-500 mt-0.5">{desc}</p>
    </button>
  );
}
