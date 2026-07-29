import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polysaccharide Research Database",
  description: "A curated database for polysaccharide research records.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
