'use client';

import { createRoot } from "react-dom/client";
import DebugApp from "./components/DebugApp";

const root = createRoot(document.getElementById("app")!);
root.render(<DebugApp />); 