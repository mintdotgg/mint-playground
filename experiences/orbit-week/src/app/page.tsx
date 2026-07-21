import type { Metadata } from "next";
import OrbitWeek from "./OrbitWeek";

export const metadata: Metadata = {
  title: "Orbit Week — Plan Your Universe",
  description:
    "A planet-per-day weekly to-do list. Scroll through the solar system, plan each day, and keep your week in orbit.",
};

export default function Home() {
  return <OrbitWeek />;
}
