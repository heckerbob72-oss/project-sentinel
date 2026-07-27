import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/app/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Project Sentinel",
  description:
    "Project Sentinel — the agentic AI project co-ordinator. An explainable control tower for project health, risk, and recovery.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopNav />
              <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
