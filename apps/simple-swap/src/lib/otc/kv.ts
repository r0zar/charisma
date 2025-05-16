import { kv } from "@vercel/kv";
import type { Offer } from "./schema";

export const offerKey = (uuid: string) => `otc:offer:${uuid}`;

export const getOffer = (uuid: string) => kv.get<Offer>(offerKey(uuid));
export const saveOffer = (offer: Offer) => kv.set(offerKey(offer.intentUuid), offer);
