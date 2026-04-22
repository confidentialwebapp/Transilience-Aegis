"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X, Shield, ExternalLink, Github } from "lucide-react";

// ─── Shared marketing layout ──────────────────────────────────────────────────
// Wraps /security, /privacy, /terms, /changelog with the same sticky header
// and footer used on the landing page. No sidebar — public pages only.

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-grid-pattern" style={{ background: "#07040B" }}>

      {/* ── STICKY HEADER ──────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14"
        style={{
          background: "rgba(7,4,11,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(139,92,246,0.1)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo.png" alt="Transilience AI" width={28} height={28} className="object-contain" />
          <span className="text-sm font-bold text-white hidden xs:inline">
            Transilience <span className="text-gradient-brand">AEGIS</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/security" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            Security
          </Link>
          <Link href="/changelog" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            Changelog
          </Link>
          <Link href="/#pricing" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            Pricing
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-1.5 text-xs text-slate-300 hover:text-white transition-colors font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="btn-brand px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            Get started free
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-x-0 top-14 z-40 px-4 py-4 md:hidden"
          style={{
            background: "rgba(13,10,20,0.97)",
            borderBottom: "1px solid rgba(139,92,246,0.1)",
            backdropFilter: "blur(16px)",
          }}
        >
          <nav className="flex flex-col gap-1">
            {[
              { label: "Security", href: "/security" },
              { label: "Changelog", href: "/changelog" },
              { label: "Pricing", href: "/#pricing" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t mt-2 pt-3" style={{ borderColor: "rgba(139,92,246,0.1)" }}>
              <Link
                href="/login"
                className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="block mt-1 px-3 py-2.5 btn-brand rounded-lg text-sm font-semibold text-center"
              >
                Get started free
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* ── PAGE CONTENT ───────────────────────────────────────────────────── */}
      <main className="pt-14">
        {children}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer
        className="px-4 sm:px-6 lg:px-8 py-12 border-t"
        style={{ borderColor: "rgba(139,92,246,0.08)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-3">
                <Image src="/logo.png" alt="Transilience AI" width={24} height={24} className="object-contain" />
                <span className="text-sm font-bold text-white">
                  Transilience <span className="text-gradient-brand">AEGIS</span>
                </span>
              </Link>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Flare-grade threat intelligence at SMB pricing. Built for the 99% of companies that aren&apos;t Fortune 500.
              </p>
              <a
                href="https://github.com/confidentialwebapp/Transilience-Aegis"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Product</h4>
              <ul className="space-y-2">
                {[
                  { label: "Features", href: "/#features" },
                  { label: "Pricing", href: "/#pricing" },
                  { label: "Changelog", href: "/changelog" },
                  { label: "Sign in", href: "/login" },
                  { label: "Sign up", href: "/register" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</h4>
              <ul className="space-y-2">
                {[
                  { label: "About", href: "/" },
                  { label: "Contact", href: "mailto:fde@transilienceai.com" },
                ].map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Legal</h4>
              <ul className="space-y-2">
                {[
                  { label: "Security", href: "/security" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Changelog", href: "/changelog" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t"
            style={{ borderColor: "rgba(139,92,246,0.07)" }}
          >
            <p className="text-[11px] text-slate-600">
              &copy; 2026 Transilience AI &mdash; Built with paranoia.
            </p>
            {/* Cross-page quick links */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {[
                { label: "Security", href: "/security" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Changelog", href: "/changelog" },
                { label: "Sign in", href: "/login" },
                { label: "Sign up", href: "/register" },
              ].map((l, i, arr) => (
                <span key={l.label} className="flex items-center gap-4">
                  <Link href={l.href} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                    {l.label}
                  </Link>
                  {i < arr.length - 1 && (
                    <span className="text-[11px] text-slate-700">&middot;</span>
                  )}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="status-live inline-block" />
              <span className="text-[11px] text-slate-600">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
