import { NextResponse } from "next/server"
import { reset } from "@/lib/stablecoin/state"

export async function POST() {
    await reset()
    return NextResponse.json({ status: 'ok' })
} 