import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mandate - Safe AI Shopping Agent Wallet | PayPal AI Hackathon",
  description: "Autonomous Buyer AI negotiating with Seller AI under strict deterministic guardrails and PayPal Sandbox checkout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
