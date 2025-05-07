import { NextResponse } from "next/server";
import { listPrices, listTokens } from "@repo/tokens";
import { CHARISMA_TOKEN_CONTRACT } from "@/constants/contracts";

export const revalidate = 60; // revalidate at most every 60s

export async function GET(req: Request, { params }: { params: { contractId: string } }) {
    try {
        const { contractId } = await params;
        if (!contractId) {
            return NextResponse.json({ error: "Missing contractId" }, { status: 400 });
        }
        const prices = await listPrices();
        const price = prices[contractId] ?? null;
        return NextResponse.json({ price });
    } catch (err) {
        console.error("Failed to fetch CHA price:", err);
        return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
    }
} 