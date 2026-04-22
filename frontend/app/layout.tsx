import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Transilience AI | Threat Exposure Management Platform",
  description: "Enterprise Security powered by AI Agents — CSPM, CNAPP, CWPP, CTEM workflows. Managed cloud security and compliance without enterprise cost.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Transilience AI | Threat Exposure Management Platform",
    description: "Enterprise Security powered by AI Agents — CSPM, CNAPP, CWPP, CTEM workflows.",
    images: [{ url: "/logo.png" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Transilience AI",
    description: "Enterprise Security powered by AI Agents.",
    images: ["/logo.png"],
  },
};

// Inline script: apply saved user preferences before hydration so theme/density/motion
// render correctly on first paint (prevents flash of default styling).
const APPLY_PREFS_SCRIPT = `
(function(){
  try {
    var uid = localStorage.getItem('tai_user_id') || 'anon';
    var raw = localStorage.getItem('tai:' + uid + ':prefs');
    if (!raw) return;
    var p = JSON.parse(raw);
    var r = document.documentElement;
    if (p.theme) r.dataset.theme = p.theme;
    if (p.density) r.dataset.density = p.density;
    r.dataset.reduceMotion = p.reduceMotion ? 'true' : 'false';
  } catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" data-density="comfortable">
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_PREFS_SCRIPT }} />
      </head>
      <body className={`${inter.className} antialiased`} style={{ background: "var(--bg-primary, #07040B)", color: "#e2e8f0" }}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#110d1a",
              border: "1px solid rgba(139, 92, 246, 0.15)",
              color: "#e2e8f0",
            },
          }}
        />
      </body>
    </html>
  );
}
