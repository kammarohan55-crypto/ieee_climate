import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TerraTrace | Climate intelligence, with evidence",
  description: "Explore real environmental forecasts, plan solar energy, and verify climate data with cryptographic receipts.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
