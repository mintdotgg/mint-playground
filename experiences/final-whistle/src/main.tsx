import { createRoot } from "react-dom/client";
import WorldCupFinal from "./WorldCupFinal";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Final Whistle root element is missing.");
}

createRoot(root).render(<WorldCupFinal />);
