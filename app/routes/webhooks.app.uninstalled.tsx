import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    // Delete sessions
    await db.session.deleteMany({ where: { shop } });

    // Clean up all merchant data
    await db.tierRule.deleteMany({ where: { shop } });
    await db.appSettings.deleteMany({ where: { shop } });

    console.log(`Cleaned up all data for ${shop}`);
  }

  return new Response();
};
