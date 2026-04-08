import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TAI-AEGIS | Threat Intelligence Platform",
  description: "External Threat Intelligence & Digital Risk Monitoring Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased`}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              color: "#f1f5f9",
            },
          }}
        />
      </body>
    </html>
  );
}
