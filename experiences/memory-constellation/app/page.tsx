import type { Metadata } from "next";
import MemoryConstellation from "./MemoryConstellation";

export const metadata: Metadata = {
  title: "Memory Constellation — Your private archive in light",
  description:
    "A local-first private memory archive where meaningful moments become an explorable constellation and an accessible timeline.",
};

export default function Home() {
  return <MemoryConstellation />;
}
