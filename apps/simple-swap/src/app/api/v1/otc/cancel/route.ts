// unlist an offer
// only the creator can unlist an offer

import { NextRequest, NextResponse } from 'next/server';
import { getOffer } from '@/lib/otc/kv';
import { saveOffer } from '@/lib/otc/kv';
import { verifySignatureAndGetSigner } from '@repo/stacks';


export async function DELETE(req: NextRequest) {

    const { offerId } = await req.json();

    const verified = await verifySignatureAndGetSigner(req, {
        message: offerId,
    });

    if (verified.status !== 200) {
        return NextResponse.json({ success: false, error: "Invalid signature." }, { status: 401 });
    }

    const offer = await getOffer(offerId);
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

    if (verified.signer !== offer?.offerCreatorAddress) {
        return NextResponse.json({ success: false, error: "You are not the creator of this offer." }, { status: 401 });
    }
    offer.status = 'cancelled';
    await saveOffer(offer);

    return NextResponse.json({ success: true, offer });
}
