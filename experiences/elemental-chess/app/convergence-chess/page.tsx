import type { Metadata } from "next";
import ConvergenceChess from "../ConvergenceChess";

export const metadata: Metadata = {
  title: "Elemental Chess — Four Nations",
  description:
    "Choose an elemental nation, command a character-inspired army, and place its Mint Gaussian world around the board.",
};

export default function ConvergenceChessPage() {
  return <ConvergenceChess />;
}
