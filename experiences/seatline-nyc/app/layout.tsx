import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seatline NYC — Preview Your Seat for The Odyssey",
  description:
    "A Mint-authored 3D cinema seat preview for New York screenings of The Odyssey.",
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
