/**
 * Mandatory compliance webhook — customers/redact
 *
 * Shopify sends this 10 days after a customer requests deletion (GDPR right to erasure).
 * You must delete or anonymise all personal data stored for that customer.
 *
 * Required for all public Shopify apps.
 * See: https://shopify.dev/docs/apps/build/privacy-law-compliance
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Compliance] Received ${topic} webhook for ${shop}`);
  console.log(`[Compliance] Customer redact payload:`, JSON.stringify(payload));

  // This app stores NO personal customer data directly.
  // TierRule and TierLevel only store shop-level pricing configuration.
  // Sessions store only access tokens (shop-level, not customer-level).
  // Therefore, there is no customer-specific data to redact.

  // If you add customer-specific data in future, delete/anonymise it here.

  return new Response(null, { status: 200 });
};
