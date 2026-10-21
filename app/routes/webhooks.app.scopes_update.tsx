import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        await db.session.update({
            where: {
                id: session.id
            },
            data: {
                scope: current.toString(),
            },
        });
    } else {
        // No session to update — log it so silent scope-tracking drift is visible.
        console.warn(
            `[TieredPricing] ${topic} for ${shop}: no stored session found; ` +
            `scope change (${current.toString()}) was not persisted.`,
        );
    }
    return new Response();
};
