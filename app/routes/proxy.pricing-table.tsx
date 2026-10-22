import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getActiveTierRules } from "../models/tierRule.server";
import { getOrCreateSettings } from "../models/appSettings.server";
import { parseIds } from "../parseIds";

/**
 * App Proxy endpoint for the storefront pricing-table theme block.
 *
 * Storefront calls:  /apps/tiered-pricing/pricing-table?productId=<numeric id>
 * which Shopify proxies (HMAC-signed) to this route (/proxy/pricing-table).
 *
 * Returns the QUANTITY-break tiers that apply to the given product, so the
 * theme block can render a "buy more, save more" table. CUSTOMER_TAG (customer
 * specific) and SPEND (cart-level) rules are intentionally excluded — they
 * can't be represented as a static per-product table.
 */

type TierOut = {
  min: number;
  max: number | null;
  discount: number;
  type: string; // "PERCENTAGE" | "FIXED"
  label: string | null;
};

const PRODUCT_COLLECTIONS_QUERY = `#graphql
  query ProductCollections($id: ID!) {
    product(id: $id) {
      collections(first: 100) {
        nodes { id }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  const empty = json({ enabled: false, currency: "USD", tiers: [] as TierOut[] });
  if (!session) return empty;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return empty;

  const settings = await getOrCreateSettings(session.shop);
  if (!settings.isEnabled || !settings.showPricingTable) return empty;

  const productGid = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const rules = (await getActiveTierRules(session.shop)).filter(
    (r) => r.type === "QUANTITY",
  );
  if (rules.length === 0) {
    return json({ enabled: true, currency: settings.currency, tiers: [] as TierOut[] });
  }

  // Resolve the product's collections once, only if a collection-scoped rule exists.
  const needsCollections = rules.some((r) => parseIds(r.collectionIds).length > 0);
  let productCollectionIds = new Set<string>();
  if (needsCollections && admin) {
    try {
      const res = await admin.graphql(PRODUCT_COLLECTIONS_QUERY, {
        variables: { id: productGid },
      });
      const body = (await res.json()) as {
        data?: { product?: { collections?: { nodes?: { id: string }[] } } };
      };
      productCollectionIds = new Set(
        body.data?.product?.collections?.nodes?.map((n) => n.id) ?? [],
      );
    } catch {
      // On failure, fall back to product/all-products matching only.
      productCollectionIds = new Set();
    }
  }

  const applies = (ruleProductIds: string[], ruleCollectionIds: string[]) => {
    if (ruleProductIds.length === 0 && ruleCollectionIds.length === 0) return true; // all products
    if (ruleProductIds.includes(productGid)) return true;
    return ruleCollectionIds.some((c) => productCollectionIds.has(c));
  };

  // Merge all applicable levels into one tier list, de-duped by min, lowest→highest.
  const tiersByMin = new Map<number, TierOut>();
  for (const rule of rules) {
    if (!applies(parseIds(rule.productIds), parseIds(rule.collectionIds))) continue;
    for (const level of rule.levels) {
      const existing = tiersByMin.get(level.minValue);
      const tier: TierOut = {
        min: level.minValue,
        max: level.maxValue,
        discount: level.discount,
        type: level.type,
        label: level.label,
      };
      // Prefer the bigger discount if two rules define the same min quantity.
      if (!existing || level.discount > existing.discount) {
        tiersByMin.set(level.minValue, tier);
      }
    }
  }

  const tiers = Array.from(tiersByMin.values()).sort((a, b) => a.min - b.min);
  return json({ enabled: true, currency: settings.currency, tiers });
};
