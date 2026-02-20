/**
 * Mandatory compliance webhook — customers/data_request
 *
 * Shopify sends this when a customer requests their data under GDPR/CCPA.
 * You must respond with the data your app stores for that customer.
 *
 * Required for all public Shopify apps.
 * See: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Compliance] Received ${topic} webhook for ${shop}`);
  console.log(`[Compliance] Customer data request payload:`, JSON.stringify(payload));

  // This app stores NO personal customer data directly.
  // TierRule and TierLevel only store shop-level pricing configuration.
  // Sessions store only access tokens (shop-level, not customer-level).
  // Therefore, there is no customer-specific data to report.

  // If you add customer-specific data in future, retrieve and report it here.

  return new Response(null, { status: 200 });
};
