import type { Metadata } from "next";
import SeatlineNYC from "./SeatlineNYC";

export const metadata: Metadata = {
  title: "Seatline NYC — Preview Your Seat for The Odyssey",
  description:
    "Choose a New York theater, showtime, and seat, then preview the real 3D sightline before you book The Odyssey.",
};

export default function Home() {
  return <SeatlineNYC />;
}
