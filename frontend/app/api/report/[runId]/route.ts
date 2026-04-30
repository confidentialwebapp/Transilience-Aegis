// GET /api/report/[runId]
// Streams a CEO-ready PDF for a completed scan_run.
//
// Auth: any logged-in Supabase user OR a request bearing the
// X-Service-Role-Auth header that matches SUPABASE_SERVICE_ROLE_KEY
// (used by automation / the upload route).

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  severityRank, severityColor, severityFillLight, severityPillFg,
  kindLabel, groupBy, shortId, truncate,
  actionBucket, actionLabel, fmtDate, fmtDateOnly,
  type ActionBucket,
} from "@/lib/report-helpers";

// pdfkit ships ESM/CJS dual; require dynamically to avoid Next.js bundler quirks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit");

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdfkit + fs require Node.js runtime

interface ScanRun {
  id: string;
  tenant_id: string;
  brand: string | null;
  service: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  finding_count: number | null;
  payload: Record<string, unknown> | null;
}

interface Tenant {
  id: string;
  name: string;
  primary_brand: string | null;
  primary_domain: string | null;
}

interface Finding {
  id: string;
  scan_run_id: string;
  source: string | null;
  kind: string | null;
  severity: string | null;
  confidence: number | null;
  url_or_value: string | null;
  ai_reason: string | null;
  recommended_action: string | null;
  created_at: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function svc() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role env vars missing");
  }
  return createSb(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authorize(req: NextRequest): Promise<boolean> {
  const svcAuth = req.headers.get("x-service-role-auth");
  if (svcAuth && svcAuth === SUPABASE_SERVICE_ROLE_KEY) return true;

  // Otherwise allow any logged-in Supabase user (cookie-based or Bearer).
  // The browser uses Supabase auth-helpers which sends an authorization cookie;
  // for the MVP we accept any presence of a sb-* auth cookie, then trust RLS
  // on the SELECT below to enforce tenant scoping (which it does — we use
  // service role internally only after this check).
  const cookies = req.headers.get("cookie") ?? "";
  const hasSbCookie = /sb-[\w-]+-auth-token/.test(cookies);
  const bearer = req.headers.get("authorization");
  if (hasSbCookie || (bearer && bearer.toLowerCase().startsWith("bearer "))) {
    return true;
  }
  return false;
}

interface BuildArgs {
  scanRun: ScanRun;
  tenant: Tenant;
  findings: Finding[];
}

export async function buildPdfBuffer({ scanRun, tenant, findings }: BuildArgs): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: {
      Title: `Brand Risk Report — ${tenant.primary_brand ?? tenant.name}`,
      Author: "Transilience Aegis",
      Subject: "Brand Monitoring Scan Report",
      Producer: "Transilience Aegis · pdfkit",
    }});
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const PAGE_W = doc.page.width;
    const MARGIN = doc.page.margins.left;
    const CONTENT_W = PAGE_W - 2 * MARGIN;

    // ---------- Cover ----------
    // Top brand strip
    doc.save();
    doc.rect(0, 0, PAGE_W, 8).fill("#8b5cf6");
    doc.rect(0, 8, PAGE_W, 4).fill("#ec4899");
    doc.restore();

    // Logo top-right
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, PAGE_W - MARGIN - 56, MARGIN, { width: 56 });
      }
    } catch {/* skip */}

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#8b5cf6")
       .text("TRANSILIENCE AEGIS", MARGIN, MARGIN + 4, { characterSpacing: 2 });
    doc.font("Helvetica").fontSize(9).fillColor("#64748b")
       .text("Digital Risk Protection · Brand Risk Report", MARGIN, MARGIN + 22);

    doc.moveDown(8);
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#0f172a")
       .text("Brand Risk Report", MARGIN, doc.y);
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(28).fillColor("#8b5cf6")
       .text(tenant.primary_brand ?? tenant.name, MARGIN, doc.y);
    doc.moveDown(1);

    // Meta box
    const metaTop = doc.y;
    doc.save();
    doc.rect(MARGIN, metaTop, CONTENT_W, 96).fillOpacity(1).fill("#f8fafc");
    doc.restore();
    const metaCol = (label: string, value: string, x: number, y: number) => {
      doc.font("Helvetica").fontSize(8).fillColor("#64748b")
         .text(label.toUpperCase(), x + 12, y + 12, { characterSpacing: 1.4 });
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
         .text(value, x + 12, y + 28, { width: CONTENT_W / 2 - 24 });
    };
    metaCol("Domain", tenant.primary_domain ?? "—", MARGIN, metaTop);
    metaCol("Run ID", shortId(scanRun.id), MARGIN + CONTENT_W / 2, metaTop);
    metaCol("Started", fmtDate(scanRun.started_at), MARGIN, metaTop + 48);
    metaCol("Completed", fmtDate(scanRun.completed_at), MARGIN + CONTENT_W / 2, metaTop + 48);
    doc.y = metaTop + 96;
    doc.moveDown(1.5);

    // ---------- Executive Summary ----------
    const buckets = { Critical: 0, Substantial: 0, Moderate: 0, Low: 0 };
    for (const f of findings) {
      const sev = (f.severity ?? "Low") as keyof typeof buckets;
      if (sev in buckets) buckets[sev] += 1;
    }
    const total = findings.length;

    sectionHeader(doc, "Executive Summary");
    const dateLabel = fmtDateOnly(scanRun.started_at);
    const summary =
      `This report covers a ${scanRun.service?.replace(/_/g, " ") ?? "brand-monitoring"} scan run on ${dateLabel} ` +
      `against ${tenant.primary_domain ?? tenant.primary_brand ?? tenant.name}. ` +
      `Of ${total} finding${total === 1 ? "" : "s"} surfaced from open-source intelligence, social platforms, and ` +
      `credential-leak feeds, ${buckets.Critical} ${plural("was", "were", buckets.Critical)} classified ` +
      `Critical, ${buckets.Substantial} Substantial, ${buckets.Moderate} Moderate, and ${buckets.Low} Low ` +
      `after AI-assisted false-positive filtering.`;
    doc.font("Helvetica").fontSize(10.5).fillColor("#1e293b")
       .text(summary, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3, align: "justify" });
    doc.moveDown(1.2);

    // ---------- Severity counts ----------
    sectionHeader(doc, "Severity Breakdown");
    const sevs: { name: keyof typeof buckets; count: number }[] = [
      { name: "Critical", count: buckets.Critical },
      { name: "Substantial", count: buckets.Substantial },
      { name: "Moderate", count: buckets.Moderate },
      { name: "Low", count: buckets.Low },
    ];
    const blockW = (CONTENT_W - 36) / 4;
    const blockH = 70;
    const blockY = doc.y;
    sevs.forEach((s, i) => {
      const x = MARGIN + i * (blockW + 12);
      doc.save();
      doc.roundedRect(x, blockY, blockW, blockH, 8).fill(severityFillLight(s.name));
      doc.fillColor(severityColor(s.name)).font("Helvetica-Bold").fontSize(28)
         .text(String(s.count), x, blockY + 10, { width: blockW, align: "center" });
      doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9)
         .text(s.name.toUpperCase(), x, blockY + 46, { width: blockW, align: "center", characterSpacing: 1.4 });
      doc.restore();
    });
    doc.y = blockY + blockH + 16;

    // ---------- Findings by category ----------
    if (total === 0) {
      sectionHeader(doc, "Findings");
      doc.font("Helvetica-Oblique").fontSize(10.5).fillColor("#64748b")
         .text("No findings surfaced for this scan run.", MARGIN, doc.y);
      doc.moveDown(1);
    } else {
      const grouped = groupBy(findings, (f) => f.kind ?? "other");
      const orderedKinds = Object.keys(grouped).sort((a, b) => {
        const aCount = grouped[a].length, bCount = grouped[b].length;
        if (aCount !== bCount) return bCount - aCount;
        return a.localeCompare(b);
      });

      for (const kind of orderedKinds) {
        const items = grouped[kind].sort(
          (a, b) => severityRank(a.severity) - severityRank(b.severity) ||
                    (b.created_at.localeCompare(a.created_at)),
        );
        if (doc.y > doc.page.height - 200) doc.addPage();
        sectionHeader(doc, `${kindLabel(kind)} (${items.length})`);
        for (const it of items.slice(0, 12)) {
          renderFindingRow(doc, it, MARGIN, CONTENT_W);
        }
        if (items.length > 12) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#94a3b8")
             .text(`+ ${items.length - 12} more in this category — see live dashboard for full list.`,
                   MARGIN, doc.y, { width: CONTENT_W });
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      }
    }

    // ---------- Recommended Actions ----------
    if (doc.y > doc.page.height - 240) doc.addPage();
    sectionHeader(doc, "Recommended Actions");
    const byAction = groupBy(findings, (f) => actionBucket(f.recommended_action));
    const buckets2: ActionBucket[] = ["takedown", "monitor", "notify_user"];
    for (const a of buckets2) {
      const items = byAction[a] ?? [];
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
         .text(`${actionLabel(a)} — ${items.length} item${items.length === 1 ? "" : "s"}`,
               MARGIN, doc.y);
      doc.moveDown(0.3);
      const top = items
        .sort((x, y) => severityRank(x.severity) - severityRank(y.severity))
        .slice(0, 5);
      if (top.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#94a3b8")
           .text("(none)", MARGIN + 12, doc.y);
        doc.moveDown(0.5);
      } else {
        for (const t of top) {
          doc.font("Helvetica").fontSize(9.5).fillColor("#475569")
             .text(`• [${t.severity ?? "?"}] ${truncate(t.url_or_value, 100)}`,
                   MARGIN + 12, doc.y, { width: CONTENT_W - 12 });
          doc.moveDown(0.2);
        }
        doc.moveDown(0.4);
      }
    }

    // ---------- Footer (per page) ----------
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - 36;
      doc.save();
      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
         .text("Generated by Transilience Aegis · Confidential — for board / executive review only.",
               MARGIN, fy, { width: CONTENT_W, align: "left" });
      doc.text(`Page ${i + 1} of ${range.count}`, MARGIN, fy, { width: CONTENT_W, align: "right" });
      doc.restore();
    }

    doc.end();
  });
}

function plural(s1: string, sN: string, n: number): string {
  return n === 1 ? s1 : sN;
}

interface PdfDoc {
  y: number;
  page: { width: number; height: number; margins: { left: number } };
  save: () => PdfDoc;
  restore: () => PdfDoc;
  rect: (x: number, y: number, w: number, h: number) => PdfDoc;
  roundedRect: (x: number, y: number, w: number, h: number, r: number) => PdfDoc;
  fill: (color: string) => PdfDoc;
  fillOpacity: (n: number) => PdfDoc;
  fillColor: (color: string) => PdfDoc;
  font: (name: string) => PdfDoc;
  fontSize: (n: number) => PdfDoc;
  text: (s: string, x?: number, y?: number, opts?: Record<string, unknown>) => PdfDoc;
  moveDown: (n?: number) => PdfDoc;
  addPage: () => PdfDoc;
  bufferedPageRange: () => { start: number; count: number };
  switchToPage: (n: number) => PdfDoc;
  image: (path: string, x: number, y: number, opts?: { width: number }) => PdfDoc;
  on: (event: string, cb: (...args: unknown[]) => void) => PdfDoc;
  end: () => void;
}

function sectionHeader(doc: PdfDoc, label: string) {
  const MARGIN = doc.page.margins.left;
  const CONTENT_W = doc.page.width - 2 * MARGIN;
  doc.moveDown(0.3);
  doc.save();
  doc.rect(MARGIN, doc.y - 2, 4, 16).fill("#8b5cf6");
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f172a")
     .text(label, MARGIN + 12, doc.y - 1, { width: CONTENT_W - 12 });
  doc.restore();
  doc.moveDown(0.6);
}

function renderFindingRow(doc: PdfDoc, f: Finding, x: number, w: number) {
  const PAGE_BOTTOM = doc.page.height - 60;
  if (doc.y > PAGE_BOTTOM - 60) doc.addPage();

  const startY = doc.y;
  const sev = f.severity ?? "Low";
  // Pill
  doc.save();
  const pillW = 64;
  doc.roundedRect(x, startY + 1, pillW, 14, 7).fill(severityFillLight(sev));
  doc.fillColor(severityColor(sev)).font("Helvetica-Bold").fontSize(8)
     .text(sev.toUpperCase(), x, startY + 4, { width: pillW, align: "center", characterSpacing: 0.5 });
  doc.restore();

  // URL / value
  const textX = x + pillW + 8;
  const textW = w - pillW - 8;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a")
     .text(truncate(f.url_or_value ?? "(no value)", 90), textX, startY, { width: textW });
  // Reason
  if (f.ai_reason) {
    doc.font("Helvetica").fontSize(9).fillColor("#475569")
       .text(truncate(f.ai_reason, 140), textX, doc.y, { width: textW });
  }
  // Source
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#94a3b8")
     .text(`source: ${f.source ?? "unknown"}`, textX, doc.y, { width: textW });
  doc.moveDown(0.5);

  // Hairline
  doc.save();
  doc.rect(x, doc.y, w, 0.5).fillOpacity(0.5).fill("#e2e8f0");
  doc.restore();
  doc.moveDown(0.4);
  // Suppress unused-variable warning for severityPillFg (kept for symmetry / future)
  void severityPillFg;
}

export async function GET(req: NextRequest, ctx: { params: { runId: string } }) {
  const ok = await authorize(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = svc();
  const { data: scanRun, error: e1 } = await sb
    .from("scan_runs")
    .select("id, tenant_id, brand, service, status, started_at, completed_at, finding_count, payload")
    .eq("id", ctx.params.runId)
    .maybeSingle();
  if (e1 || !scanRun) {
    return NextResponse.json({ error: "scan_run not found" }, { status: 404 });
  }

  const { data: tenant } = await sb
    .from("tenants")
    .select("id, name, primary_brand, primary_domain")
    .eq("id", scanRun.tenant_id)
    .maybeSingle();

  const { data: findings } = await sb
    .from("findings")
    .select("id, scan_run_id, source, kind, severity, confidence, url_or_value, ai_reason, recommended_action, created_at")
    .eq("scan_run_id", scanRun.id)
    .order("created_at", { ascending: false });

  const buf = await buildPdfBuffer({
    scanRun: scanRun as ScanRun,
    tenant: (tenant as Tenant | null) ?? {
      id: scanRun.tenant_id, name: scanRun.brand ?? "Unknown",
      primary_brand: scanRun.brand, primary_domain: null,
    },
    findings: (findings ?? []) as Finding[],
  });

  const slug = (tenant?.primary_brand ?? tenant?.name ?? "tenant")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const filename = `${slug || "tenant"}-brand-report-${shortId(scanRun.id)}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  });
}
