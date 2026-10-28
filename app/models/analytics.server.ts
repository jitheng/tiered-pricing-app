/**
 * analytics.server.ts
 *
 * Tier usage + revenue impact, derived from orders. Every discount this app
 * creates is titled `[Tiered] …`, so we scan recent orders' line-item discount
 * allocations and aggregate the ones whose AutomaticDiscountApplication title
 * starts with that prefix.
 *
 * Requires the `read_orders` scope.
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

const TIERED_TITLE_PREFIX = "[Tiered]";

const TIERED_ORDERS_QUERY = `#graphql
  query TieredOrders($cursor: String, $query: String!) {
    orders(first: 50, after: $cursor, query: $query, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        lineItems(first: 50) {
          nodes {
            discountAllocations {
              allocatedAmountSet { shopMoney { amount currencyCode } }
              discountApplication {
                __typename
                ... on AutomaticDiscountApplication { title }
              }
            }
          }
        }
      }
    }
  }
`;

export type TierAnalyticsRow = {
  title: string; // the `[Tiered] …` discount title (rule + level)
  orders: number; // distinct orders that used it
  discountAmount: number; // total amount discounted (revenue impact)
};

export type TierAnalytics = {
  days: number;
  currencyCode: string;
  ordersWithDiscount: number; // distinct orders with any tiered discount
  totalDiscount: number; // total discounted across all tiered rules
  rows: TierAnalyticsRow[]; // per discount title, highest impact first
  truncated: boolean; // true if we hit the page cap (totals are a lower bound)
  error?: string;
};

type OrderNode = {
  id: string;
  lineItems: {
    nodes: {
      discountAllocations: {
        allocatedAmountSet: { shopMoney: { amount: string; currencyCode: string } };
        discountApplication: { __typename: string; title?: string };
      }[];
    }[];
  };
};

const MAX_PAGES = 10; // safety cap: up to ~500 orders per load

/**
 * Aggregate tiered-discount usage over the last `days` days.
 */
export async function getTierAnalytics(
  admin: AdminApiContext["admin"],
  days = 30,
): Promise<TierAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = `created_at:>=${since.toISOString()}`;

  const byTitle = new Map<string, { orders: Set<string>; amount: number }>();
  const ordersWithDiscount = new Set<string>();
  let currencyCode = "USD";
  let totalDiscount = 0;
  let truncated = false;
  let cursor: string | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await admin.graphql(TIERED_ORDERS_QUERY, {
        variables: { cursor, query },
      });
      const body = (await response.json()) as {
        errors?: { message: string }[];
        data?: {
          orders?: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: OrderNode[];
          };
        };
      };

      // Access-scope / Protected-Customer-Data denials come back as a top-level
      // `errors` array with `data: null` (HTTP 200), not a thrown exception —
      // surface the real Shopify message instead of silently returning zeroes.
      if (body.errors?.length) {
        const message = body.errors.map((e) => e.message).join("; ");
        console.error("[TieredPricing] Analytics orders query error:", message);
        return {
          days,
          currencyCode,
          ordersWithDiscount: 0,
          totalDiscount: 0,
          rows: [],
          truncated: false,
          error: message,
        };
      }

      const connection = body.data?.orders;
      if (!connection) break;

      for (const order of connection.nodes) {
        for (const line of order.lineItems.nodes) {
          for (const alloc of line.discountAllocations) {
            const title = alloc.discountApplication?.title ?? "";
            if (
              alloc.discountApplication?.__typename !== "AutomaticDiscountApplication" ||
              !title.startsWith(TIERED_TITLE_PREFIX)
            ) {
              continue;
            }
            const amount = parseFloat(alloc.allocatedAmountSet?.shopMoney?.amount ?? "0") || 0;
            currencyCode = alloc.allocatedAmountSet?.shopMoney?.currencyCode ?? currencyCode;

            const entry = byTitle.get(title) ?? { orders: new Set<string>(), amount: 0 };
            entry.orders.add(order.id);
            entry.amount += amount;
            byTitle.set(title, entry);

            ordersWithDiscount.add(order.id);
            totalDiscount += amount;
          }
        }
      }

      if (!connection.pageInfo.hasNextPage) break;
      cursor = connection.pageInfo.endCursor;
      if (page === MAX_PAGES - 1 && connection.pageInfo.hasNextPage) truncated = true;
    }
  } catch (err) {
    console.error("[TieredPricing] Analytics orders query exception:", err);
    return {
      days,
      currencyCode,
      ordersWithDiscount: 0,
      totalDiscount: 0,
      rows: [],
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const rows: TierAnalyticsRow[] = Array.from(byTitle.entries())
    .map(([title, v]) => ({ title, orders: v.orders.size, discountAmount: v.amount }))
    .sort((a, b) => b.discountAmount - a.discountAmount);

  return {
    days,
    currencyCode,
    ordersWithDiscount: ordersWithDiscount.size,
    totalDiscount,
    rows,
    truncated,
  };
}
