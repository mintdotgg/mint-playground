import type { Metadata } from "next";
import "./globals.css";
import "./memory-constellation.css";

export const metadata: Metadata = {
  title: "Memory Constellation — Your private archive in light",
  description:
    "A local-first private memory archive where meaningful moments become an explorable constellation and an accessible timeline.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
