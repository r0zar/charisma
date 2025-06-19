'use client';

import "./styles.css";

import { createRoot } from "react-dom/client";
import SimpleBlazeTest from "./simple-blaze-test";

const root = createRoot(document.getElementById("app")!);
root.render(<SimpleBlazeTest />); 