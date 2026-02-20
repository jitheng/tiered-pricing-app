/**
 * Mandatory compliance webhook — shop/redact
 *
 * Shopify sends this 48 hours after a shop uninstalls your app,
 * requesting deletion of all shop data.
 *
 * Required for all public Shopify apps.
 * See: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Compliance] Received ${topic} webhook for ${shop}`);
  console.log(`[Compliance] Shop redact payload:`, JSON.stringify(payload));

  // Delete all data associated with this shop.
  // Note: app/uninstalled already handles immediate cleanup.
  // This is the final confirmation — delete anything remaining.
  try {
    await db.tierRule.deleteMany({ where: { shop } });
    await db.appSettings.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
    console.log(`[Compliance] All data redacted for shop: ${shop}`);
  } catch (error) {
    // Log but don't throw — Shopify expects a 200 response regardless
    console.error(`[Compliance] Error during shop redact for ${shop}:`, error);
  }

  return new Response(null, { status: 200 });
};
