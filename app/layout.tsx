import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "Synapse",
  title: {
    default: "Synapse — Persistent Graph Memory for AI Agents",
    template: "%s | Synapse",
  },
  description:
    "Give AI conversations lasting context. Synapse stores useful memories in FalkorDB, connects people and projects, and retrieves relevant knowledge through a visual graph.",
  keywords: [
    "Synapse",
    "AI memory",
    "graph memory",
    "AI agents",
    "FalkorDB",
    "knowledge graph",
    "persistent context",
  ],
  openGraph: {
    title: "Synapse — Persistent Graph Memory for AI Agents",
    description:
      "A personal knowledge workspace that connects memories, people, and projects with FalkorDB-powered graph retrieval.",
    siteName: "Synapse",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Synapse — Persistent Graph Memory for AI Agents",
    description:
      "Give AI conversations lasting context with graph-backed memory and visual knowledge exploration.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {publishableKey ? <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
