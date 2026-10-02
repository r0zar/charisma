import { NextResponse } from 'next/server';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';

/**
 * What a wallet signs to post, edit or delete a reply (blaze-sdk signedFetchWithTimestamp wraps it with a timestamp,
 * good for five minutes). Each names its reply and, for posts and edits, the words, so a signature can't be reused
 * for anything else. Swap builds the same strings in src/lib/activity/api.ts.
 */
export const replyMessage = {
    add: (activityId: string, content: string) => `Reply to activity ${activityId}: ${content}`,
    edit: (replyId: string, content: string) => `Edit reply ${replyId}: ${content}`,
    remove: (replyId: string) => `Delete reply ${replyId}`,
};

/** The wallet that signed `message` on this request, or the 401 to send back */
export async function replySigner(request: Request, message: string): Promise<{ signer: string } | { denied: NextResponse }> {
    const auth = await verifySignatureAndGetSignerWithTimestamp(request, { message });
    if (!auth.ok) return { denied: NextResponse.json({ error: `Sign the reply with your wallet: ${auth.error}` }, { status: 401 }) };
    return { signer: auth.signer };
}

/** 403 unless the signer wrote the reply */
export const notAuthor = () => NextResponse.json({ error: 'Only the reply’s author can change it' }, { status: 403 });
