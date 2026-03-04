import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "AgentOps Observer",
    template: "%s — AgentOps Observer",
  },
  description: "AI Fleet Intelligence - Enterprise-grade observability for autonomous AI agents. Monitor, debug, and optimize your AI agents with real-time tracing, cost analytics, and smart alerts.",
  keywords: ["AI observability", "agent monitoring", "LLM tracing", "AI ops", "agent analytics", "AI debugging"],
  authors: [{ name: "AgentOps" }],
  creator: "AgentOps",
  publisher: "AgentOps",
  metadataBase: new URL("https://agentops-observer.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agentops-observer.vercel.app",
    siteName: "AgentOps Observer",
    title: "AgentOps Observer — AI Fleet Intelligence",
    description: "Enterprise-grade observability for AI agents. Real-time tracing, cost analytics, and smart alerts.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentOps Observer - AI Fleet Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentOps Observer — AI Fleet Intelligence",
    description: "Enterprise-grade observability for AI agents. Real-time tracing, cost analytics, and smart alerts.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
