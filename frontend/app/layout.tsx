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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`} style={{ background: "#07040B", color: "#e2e8f0" }}>
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
