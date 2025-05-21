"use client";

import { Suspense } from "react";
import SublinkWizard from "@/components/sublink/wizard";

export default function SublinkPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SublinkWizard />
        </Suspense>
    );
}