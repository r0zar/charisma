import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// Interface for the expected request body
interface DeleteRequest {
    uuidToDelete: string;
}

// Interface for the objects stored/retrieved (ensure consistency)
interface QueuedTxIntent { // Basic structure for matching
    uuid: string;
    [key: string]: any; // Allow other properties
}

// Queue key
const TX_QUEUE_KEY = "stacks-tx-queue";

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json() as DeleteRequest;
        const { uuidToDelete } = body;

        if (!uuidToDelete) {
            return NextResponse.json({ error: "Missing uuidToDelete in request body" }, { status: 400 });
        }

        // 1. Fetch all items (expecting objects based on logs)
        const allMessageObjects = await kv.lrange(TX_QUEUE_KEY, 0, -1);
        console.log("Delete API: Fetched items type:", typeof allMessageObjects, "Data:", allMessageObjects);

        let objectToDelete: QueuedTxIntent | null = null;

        // 2. Find the object matching the UUID
        if (Array.isArray(allMessageObjects)) {
            for (const msgObj of allMessageObjects) {
                // Check if it is an object and has the matching UUID
                if (msgObj && typeof msgObj === 'object' && (msgObj as QueuedTxIntent).uuid === uuidToDelete) {
                    objectToDelete = msgObj as QueuedTxIntent;
                    console.log("Delete API: Found matching object:", objectToDelete);
                    break;
                }
            }
        }

        // If not found
        if (!objectToDelete) {
            console.log(`Delete API: Message object with UUID ${uuidToDelete} not found in queue objects.`);
            return NextResponse.json({ error: `Message with UUID ${uuidToDelete} not found in queue.` }, { status: 404 });
        }

        // 3. Re-stringify the found object to get the value needed for LREM
        let valueToDelete: string;
        try {
            valueToDelete = JSON.stringify(objectToDelete);
            console.log("Delete API: Re-stringified value for LREM:", valueToDelete);
        } catch (stringifyError) {
            console.error(`Delete API: Failed to re-stringify found object for UUID ${uuidToDelete}:`, stringifyError);
            return NextResponse.json({ error: "Failed to prepare message for deletion." }, { status: 500 });
        }

        // 4. Remove the specific string value using LREM
        const removeCount = await kv.lrem(TX_QUEUE_KEY, 1, valueToDelete);

        if (removeCount > 0) {
            console.log(`Successfully removed message with UUID: ${uuidToDelete}`);
            return NextResponse.json({ success: true, message: `Message ${uuidToDelete} deleted.` });
        } else {
            console.warn(`LREM command did not remove message ${uuidToDelete} (value: ${valueToDelete}), possibly already processed or data inconsistency.`);
            return NextResponse.json({ error: `Message ${uuidToDelete} found but could not be removed.` }, { status: 409 });
        }

    } catch (error) {
        console.error("Error deleting message from queue:", error);
        const message = error instanceof Error ? error.message : "Unknown server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
