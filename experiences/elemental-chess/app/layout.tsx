import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elemental Chess — Four Nations",
  description:
    "Choose an elemental nation, command a character-inspired army, and play inside its Mint-authored world.",
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
