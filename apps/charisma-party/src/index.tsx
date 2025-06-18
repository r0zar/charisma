import "./styles.css";

import { createRoot } from "react-dom/client";
import PriceDashboard from "./client";

const root = createRoot(document.getElementById("app")!);
root.render(<PriceDashboard />); 