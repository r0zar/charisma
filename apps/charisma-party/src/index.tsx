'use client';

import { createRoot } from "react-dom/client";
import WrappedPriceTheater from "./wrapped-price-theater";

const root = createRoot(document.getElementById("app")!);
root.render(<WrappedPriceTheater />); 