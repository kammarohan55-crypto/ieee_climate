import type { Metadata } from "next";
import "./globals.css";
import "./planning.css";

export const metadata: Metadata = {
  title: "TerraTrace | Climate intelligence, with evidence",
  description: "Inspect a real city district, compare climate interventions, and preserve environmental evidence with cryptographic receipts.",
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
