import type { Metadata } from "next";
import PogoMan from "./PogoMan";

export const metadata: Metadata = {
  title: "Pogo Man — Double Jump",
  description:
    "A side-view 3D arcade game with two jumps per landing and oversized city traffic.",
};

export default function Home() {
  return <PogoMan />;
}
