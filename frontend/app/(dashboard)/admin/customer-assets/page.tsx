"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2, Tags, Globe, Users, AtSign, Smartphone, MapPin, KeyRound,
  Languages, ShieldAlert, Save, RefreshCw, AlertTriangle,
} from "lucide-react";
import { PageHeader, KPICard, TagPill } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

const CA_GRAMEEN = "23610954-5fd0-482f-8eb0-11edce1f5c58";

interface AssetBundle {
  customer_id: string;
  industry: string;
  country: string;
  primary_entity?: { legal_name?: string; cin?: string; regulator?: string; country?: string; status?: string };
  brand?: {
    primary_name?: string; aliases?: string[]; historical_names?: string[];
    product_brands?: string[]; misspellings?: string[]; transliterations?: string[];
  };
  domains?: { primary?: string; owned?: string[]; watch_keywords?: string[] };
  executives?: { entity_id: string; name: string; title: string }[];
  social_handles?: Record<string, string>;
  mobile_apps?: {
    official_app_ids?: { play?: string[]; appstore?: string[] };
    google_play_publisher?: string;
    apple_developer_id?: string;
    official_apk_signing_cert_sha256?: string;
  };
  branches?: { official_branch_list_csv_url?: string; expected_branch_count?: number; states_covered?: string[] };
  leak_patterns?: { email_patterns?: string[]; internal_hostnames?: string[]; secret_prefixes?: string[]; borrower_id_format?: string };
  regions?: string[];
  languages?: string[];
  fraud_lexicons?: Record<string, string[]>;
  scan_schedule?: Record<string, string>;
}

const isTbd = (v: unknown): boolean => typeof v === "string" && v.startsWith("TBD_");

function StringInput({ value, onChange, label, hint }: { value: string; onChange: (v: string) => void; label: string; hint?: string }) {
  const tbd = isTbd(value);
  return (
    <div>
      <label className="text-[10.5px] text-slate-500 uppercase tracking-wider font-medium block mb-1">{label}</label>
      <input
        value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className={`w-full text-[12px] px-2 py-1.5 rounded border font-mono ${tbd ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-200"}`}
      />
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function ListInput({ values, onChange, label, hint, placeholder }: { values: string[]; onChange: (v: string[]) => void; label: string; hint?: string; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (draft.trim()) {
      onChange([...values, draft.trim()]);
      setDraft("");
    }
  };
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div>
      <label className="text-[10.5px] text-slate-500 uppercase tracking-wider font-medium block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {values.map((v, i) => (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${isTbd(v) ? "bg-amber-500/15 text-amber-200 border border-amber-500/40" : "bg-purple-500/15 text-purple-200 border border-purple-500/30"}`}>
            {v}
            <button onClick={() => remove(i)} className="text-slate-500 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder ?? "type and press Enter"}
          className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono"
        />
        <button onClick={add} className="text-[11px] px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">+</button>
      </div>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-purple-300" />
        <h3 className="text-[12px] font-semibold text-slate-200 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function CustomerAssetsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [bundle, setBundle] = useState<AssetBundle | null>(null);
  const [version, setVersion] = useState("");
  const [tbdCount, setTbdCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void fetch(`/api/admin/customer-assets?tenant_id=${CA_GRAMEEN}`)
      .then(r => r.json())
      .then(d => {
        if (d.bundle) {
          setBundle(d.bundle.asset_bundle as AssetBundle);
          setVersion(d.bundle.version);
          setTbdCount(d.bundle.tbd_count);
          setUpdatedAt(d.bundle.updated_at);
        }
      });
  }, []);

  const save = async () => {
    if (!bundle) return;
    setSaving(true);
    const res = await fetch("/api/admin/customer-assets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: CA_GRAMEEN, asset_bundle: bundle, updated_by: "admin" }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.ok) {
      setTbdCount(j.tbd_count);
      setDirty(false);
      alert(`Saved. TBD remaining: ${j.tbd_count}\nDenormalized: ${j.denormalized.inserted} new asset rows (deleted ${j.denormalized.deleted} stale).`);
    } else {
      alert(`Failed: ${j.error}`);
    }
  };

  const update = (updater: (b: AssetBundle) => AssetBundle) => {
    if (!bundle) return;
    setBundle(updater({ ...bundle }));
    setDirty(true);
  };

  if (!bundle) return <p className="text-slate-500 text-[12px] p-4">Loading bundle…</p>;

  return (
    <>
      <PageHeader
        title="Customer Asset Bundle"
        description="Source of truth for what the platform monitors. Edit any section and Save — denormalized into aegis_assets immediately. TBD_ fields highlighted in amber must be filled before scans go live."
        actions={
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`px-3 py-1.5 text-[12px] rounded inline-flex items-center gap-1.5 font-semibold border ${dirty ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : dirty ? "Save changes" : "No changes"}
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Bundle version" value={version} accent="purple" icon={Building2} />
        <KPICard label="TBD fields" value={tbdCount} accent={tbdCount > 0 ? "amber" : "green"} icon={AlertTriangle} />
        <KPICard label="Watch keywords" value={bundle.domains?.watch_keywords?.length ?? 0} accent="blue" icon={Tags} />
        <KPICard label="Last updated" value={updatedAt ? new Date(updatedAt).toLocaleString() : "—"} accent="purple" />
      </div>

      {tbdCount > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[12px]">
          <strong>{tbdCount} TBD field(s)</strong> still need customer input before relevant scans can run reliably (Twitter handle, YouTube channel, Apple developer ID, signing cert SHA256, branch CSV, internal hostnames, secret prefixes, borrower ID format).
        </div>
      )}

      {/* Primary entity */}
      <Section title="Primary entity" icon={Building2}>
        <StringInput label="Legal name" value={bundle.primary_entity?.legal_name ?? ""} onChange={(v) => update((b) => ({...b, primary_entity: {...(b.primary_entity ?? {}), legal_name: v}}))} />
        <StringInput label="CIN" value={bundle.primary_entity?.cin ?? ""} onChange={(v) => update((b) => ({...b, primary_entity: {...(b.primary_entity ?? {}), cin: v}}))} hint="Corporate Identification Number" />
        <StringInput label="Regulator" value={bundle.primary_entity?.regulator ?? ""} onChange={(v) => update((b) => ({...b, primary_entity: {...(b.primary_entity ?? {}), regulator: v}}))} hint="RBI / SEBI / IRDAI" />
        <StringInput label="Country" value={bundle.primary_entity?.country ?? ""} onChange={(v) => update((b) => ({...b, primary_entity: {...(b.primary_entity ?? {}), country: v}}))} />
      </Section>

      {/* Brand */}
      <Section title="Brand" icon={Tags}>
        <StringInput label="Primary name" value={bundle.brand?.primary_name ?? ""} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), primary_name: v}}))} />
        <ListInput label="Aliases" values={bundle.brand?.aliases ?? []} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), aliases: v}}))} hint="alternate brand spellings, abbreviations" />
        <ListInput label="Historical names" values={bundle.brand?.historical_names ?? []} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), historical_names: v}}))} />
        <ListInput label="Product brands" values={bundle.brand?.product_brands ?? []} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), product_brands: v}}))} />
        <ListInput label="Common misspellings" values={bundle.brand?.misspellings ?? []} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), misspellings: v}}))} />
        <ListInput label="Transliterations" values={bundle.brand?.transliterations ?? []} onChange={(v) => update((b) => ({...b, brand: {...(b.brand ?? {}), transliterations: v}}))} hint="Hindi, Kannada, Tamil, Telugu, Marathi, Bengali" />
      </Section>

      {/* Domains */}
      <Section title="Domains" icon={Globe}>
        <StringInput label="Primary" value={bundle.domains?.primary ?? ""} onChange={(v) => update((b) => ({...b, domains: {...(b.domains ?? {}), primary: v}}))} />
        <ListInput label="Owned domains" values={bundle.domains?.owned ?? []} onChange={(v) => update((b) => ({...b, domains: {...(b.domains ?? {}), owned: v}}))} />
        <div className="md:col-span-2">
          <ListInput label="Watch keywords" values={bundle.domains?.watch_keywords ?? []} onChange={(v) => update((b) => ({...b, domains: {...(b.domains ?? {}), watch_keywords: v}}))} hint="strings to scan SERP, social, dark-web for" />
        </div>
      </Section>

      {/* Executives */}
      <Section title="Executives" icon={Users}>
        <div className="md:col-span-2 space-y-1.5">
          {(bundle.executives ?? []).map((e, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 items-center">
              <input value={e.name} onChange={(ev) => update((b) => { const xs = [...(b.executives ?? [])]; xs[i] = {...xs[i], name: ev.target.value}; return {...b, executives: xs}; })} className="text-[11px] px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200" />
              <input value={e.title} onChange={(ev) => update((b) => { const xs = [...(b.executives ?? [])]; xs[i] = {...xs[i], title: ev.target.value}; return {...b, executives: xs}; })} className="text-[11px] px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300" />
              <code className="text-[10px] text-slate-500 font-mono">{e.entity_id}</code>
            </div>
          ))}
          <button onClick={() => update((b) => ({...b, executives: [...(b.executives ?? []), { entity_id: `exec_new_${Date.now()}`, name: "", title: "" }]}))} className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-400 hover:bg-slate-800">+ add executive</button>
        </div>
      </Section>

      {/* Social handles */}
      <Section title="Social handles" icon={AtSign}>
        {Object.entries(bundle.social_handles ?? {}).map(([platform, handle]) => (
          <StringInput key={platform} label={platform} value={handle} onChange={(v) => update((b) => ({...b, social_handles: {...(b.social_handles ?? {}), [platform]: v}}))} />
        ))}
      </Section>

      {/* Mobile apps */}
      <Section title="Mobile apps" icon={Smartphone}>
        <ListInput label="Google Play app IDs" values={bundle.mobile_apps?.official_app_ids?.play ?? []} onChange={(v) => update((b) => ({...b, mobile_apps: {...(b.mobile_apps ?? {}), official_app_ids: {...(b.mobile_apps?.official_app_ids ?? {}), play: v}}}))} />
        <ListInput label="App Store app IDs" values={bundle.mobile_apps?.official_app_ids?.appstore ?? []} onChange={(v) => update((b) => ({...b, mobile_apps: {...(b.mobile_apps ?? {}), official_app_ids: {...(b.mobile_apps?.official_app_ids ?? {}), appstore: v}}}))} />
        <StringInput label="Google Play publisher" value={bundle.mobile_apps?.google_play_publisher ?? ""} onChange={(v) => update((b) => ({...b, mobile_apps: {...(b.mobile_apps ?? {}), google_play_publisher: v}}))} />
        <StringInput label="Apple developer ID" value={bundle.mobile_apps?.apple_developer_id ?? ""} onChange={(v) => update((b) => ({...b, mobile_apps: {...(b.mobile_apps ?? {}), apple_developer_id: v}}))} />
        <div className="md:col-span-2">
          <StringInput label="Official APK signing cert SHA256" value={bundle.mobile_apps?.official_apk_signing_cert_sha256 ?? ""} onChange={(v) => update((b) => ({...b, mobile_apps: {...(b.mobile_apps ?? {}), official_apk_signing_cert_sha256: v}}))} hint="Critical for FEAT-001/003 — without this, fake-app detection fires false positives." />
        </div>
      </Section>

      {/* Branches */}
      <Section title="Branches" icon={MapPin}>
        <StringInput label="Official branch CSV URL" value={bundle.branches?.official_branch_list_csv_url ?? ""} onChange={(v) => update((b) => ({...b, branches: {...(b.branches ?? {}), official_branch_list_csv_url: v}}))} />
        <StringInput label="Expected branch count" value={String(bundle.branches?.expected_branch_count ?? "")} onChange={(v) => update((b) => ({...b, branches: {...(b.branches ?? {}), expected_branch_count: parseInt(v, 10) || 0}}))} />
        <div className="md:col-span-2">
          <ListInput label="States covered" values={bundle.branches?.states_covered ?? []} onChange={(v) => update((b) => ({...b, branches: {...(b.branches ?? {}), states_covered: v}}))} />
        </div>
      </Section>

      {/* Leak patterns */}
      <Section title="Leak patterns" icon={KeyRound}>
        <ListInput label="Email patterns" values={bundle.leak_patterns?.email_patterns ?? []} onChange={(v) => update((b) => ({...b, leak_patterns: {...(b.leak_patterns ?? {}), email_patterns: v}}))} />
        <ListInput label="Internal hostnames" values={bundle.leak_patterns?.internal_hostnames ?? []} onChange={(v) => update((b) => ({...b, leak_patterns: {...(b.leak_patterns ?? {}), internal_hostnames: v}}))} />
        <ListInput label="Secret prefixes" values={bundle.leak_patterns?.secret_prefixes ?? []} onChange={(v) => update((b) => ({...b, leak_patterns: {...(b.leak_patterns ?? {}), secret_prefixes: v}}))} hint="e.g. CAGL_API_, sk-cagl-" />
        <StringInput label="Borrower ID format" value={bundle.leak_patterns?.borrower_id_format ?? ""} onChange={(v) => update((b) => ({...b, leak_patterns: {...(b.leak_patterns ?? {}), borrower_id_format: v}}))} hint="regex or example pattern" />
      </Section>

      {/* Languages + regions */}
      <Section title="Languages & regions" icon={Languages}>
        <ListInput label="Languages (ISO 639-1)" values={bundle.languages ?? []} onChange={(v) => update((b) => ({...b, languages: v}))} />
        <ListInput label="Regions (ISO country codes)" values={bundle.regions ?? []} onChange={(v) => update((b) => ({...b, regions: v}))} />
      </Section>

      {/* Fraud lexicons */}
      <Section title="Fraud lexicons" icon={ShieldAlert}>
        {Object.entries(bundle.fraud_lexicons ?? {}).map(([key, vals]) => (
          <div key={key} className="md:col-span-2">
            <ListInput label={key} values={vals} onChange={(v) => update((b) => ({...b, fraud_lexicons: {...(b.fraud_lexicons ?? {}), [key]: v}}))} />
          </div>
        ))}
      </Section>
    </>
  );
}
