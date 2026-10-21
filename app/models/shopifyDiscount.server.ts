/**
 * shopifyDiscount.server.ts
 *
 * Responsible for creating, updating, and deleting REAL Shopify discounts
 * via the Admin GraphQL API, based on the tier rules stored in our database.
 *
 * Strategy per type:
 *   QUANTITY     → discountAutomaticBasicCreate with minimumQuantity prerequisite
 *   CUSTOMER_TAG → discountAutomaticBasicCreate with customerSegment filter
 *   SPEND        → discountAutomaticBasicCreate with minimumSubtotal prerequisite
 *
 * Each TierLevel gets its own Shopify automatic discount so they can coexist.
 * The GID is stored back on TierLevel.shopifyDiscountId for future updates/deletes.
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { parseIds, type TierLevelInput, type TierType } from "./tierRule.server";

// ─── CUSTOMER_TAG discount function ──────────────────────────────────────────
//
// CUSTOMER_TAG rules can't use automatic *basic* discounts — those apply to all
// customers. Instead each level is backed by our Shopify Discount Function
// (extensions/customer-tag-discount), which reads this configuration metafield
// at checkout and only discounts customers carrying the configured tag.
//
// The namespace/key MUST match the function's input query + input_variables in
// extensions/customer-tag-discount/{src/*.graphql,shopify.extension.toml}.
const CUSTOMER_TAG_FUNCTION_HANDLE = "customer-tag-discount";
const CONFIG_METAFIELD_NAMESPACE = "$app:tiered-pricing";
const CONFIG_METAFIELD_KEY = "function-configuration";

// ─── GraphQL Mutations ───────────────────────────────────────────────────────

const CREATE_AUTOMATIC_BASIC_DISCOUNT = `#graphql
  mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const CREATE_AUTOMATIC_APP_DISCOUNT = `#graphql
  mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const UPDATE_AUTOMATIC_BASIC_DISCOUNT = `#graphql
  mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const DELETE_AUTOMATIC_DISCOUNT = `#graphql
  mutation discountAutomaticDelete($id: ID!) {
    discountAutomaticDelete(id: $id) {
      deletedAutomaticDiscountId
      userErrors {
        field
        message
      }
    }
  }
`;

const DEACTIVATE_AUTOMATIC_DISCOUNT = `#graphql
  mutation discountAutomaticDeactivate($id: ID!) {
    discountAutomaticDeactivate(id: $id) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVATE_AUTOMATIC_DISCOUNT = `#graphql
  mutation discountAutomaticActivate($id: ID!) {
    discountAutomaticActivate(id: $id) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the `customerGets` part of the discount input.
 * - If specific products/collections are set → apply only to those
 * - Otherwise → apply to all entitled products (ALL_ENTITLED_PRODUCTS)
 */
function buildCustomerGets(
  level: TierLevelInput,
  productIds: string[],
  collectionIds: string[],
) {
  const value =
    level.type === "PERCENTAGE"
      ? { percentage: level.discount / 100 } // Shopify expects 0.0-1.0
      : { discountAmount: { amount: level.discount, appliesOnEachItem: false } };

  const hasScope = productIds.length > 0 || collectionIds.length > 0;

  const items = hasScope
    ? {
        products: {
          ...(productIds.length > 0 ? { productsToAdd: productIds } : {}),
          ...(collectionIds.length > 0 ? { collectionsToAdd: collectionIds } : {}),
        },
      }
    : { all: true };

  return { value, items };
}

/**
 * Build the `minimumRequirement` object for QUANTITY and SPEND rules.
 */
function buildMinimumRequirement(type: TierType, level: TierLevelInput) {
  if (type === "QUANTITY") {
    return {
      quantity: { greaterThanOrEqualToQuantity: String(Math.round(level.minValue)) },
    };
  }
  if (type === "SPEND") {
    return {
      subtotal: { greaterThanOrEqualToSubtotal: String(level.minValue) },
    };
  }
  return null; // CUSTOMER_TAG — no minimum, filtered by customer eligibility
}

// ─── GraphQL call with bounded retry/backoff for transient failures ──────────
//
// Retries network exceptions and HTTP 429/5xx with exponential backoff, and
// guards response parsing. Permanent errors (e.g. userErrors, bad input) are
// surfaced to the caller rather than retried.
async function graphqlWithRetry<T>(
  admin: AdminApiContext["admin"],
  query: string,
  variables: Record<string, unknown>,
  { retries = 2, baseDelayMs = 300 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await admin.graphql(query, { variables });
      const status = (response as { status?: number }).status;
      if (status === 429 || (typeof status === "number" && status >= 500)) {
        throw new Error(`Shopify API returned HTTP ${status}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// ─── Core: Create discounts for all levels of a rule ─────────────────────────
//
// NOTE on CUSTOMER_TAG type:
// DiscountAutomaticBasicInput does NOT support customerSelection — automatic
// discounts apply to all customers by definition. Tag-based restriction is
// handled at the storefront/checkout level (e.g. a Theme App Extension or
// Shopify Functions). The discount title includes the tag so merchants can
// identify it in the Shopify admin.

export async function createShopifyDiscountsForRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
  ruleName: string,
  type: TierType,
  productIds: string[],
  collectionIds: string[],
  levels: TierLevelInput[],
) {
  const results: { levelIndex: number; shopifyDiscountId: string | null; error?: string }[] = [];

  for (const [i, level] of levels.entries()) {
    // For CUSTOMER_TAG, include the tag in the title so it's identifiable in admin
    const levelLabel = level.label || (type === "CUSTOMER_TAG" && level.tagValue
      ? `Tag: ${level.tagValue}`
      : `Level ${i + 1}`);
    const title = `[Tiered] ${ruleName} – ${levelLabel}`;

    // ── CUSTOMER_TAG → Shopify Discount Function (tag-gated app discount) ─────
    if (type === "CUSTOMER_TAG") {
      const tag = (level.tagValue || "").trim();
      if (!tag) {
        results.push({ levelIndex: i, shopifyDiscountId: null, error: `Level ${i + 1}: missing customer tag` });
        continue;
      }

      // FIXED → order-subtotal discount (ORDER class); PERCENTAGE → product discount.
      const discountClasses = level.type === "FIXED" ? ["ORDER"] : ["PRODUCT"];
      const config = {
        customerTags: [tag],
        collectionIds,
        productIds,
        discountType: level.type,
        value: level.discount,
        label: level.label ?? null,
      };

      const appInput = {
        title,
        functionHandle: CUSTOMER_TAG_FUNCTION_HANDLE,
        discountClasses,
        startsAt: new Date().toISOString(),
        metafields: [
          {
            namespace: CONFIG_METAFIELD_NAMESPACE,
            key: CONFIG_METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      };

      try {
        const json = await graphqlWithRetry<{
          data?: {
            discountAutomaticAppCreate?: {
              automaticAppDiscount: { discountId: string } | null;
              userErrors: { field: string[]; message: string }[];
            };
          };
        }>(admin, CREATE_AUTOMATIC_APP_DISCOUNT, { automaticAppDiscount: appInput });

        const result = json.data?.discountAutomaticAppCreate;
        const userErrors = result?.userErrors ?? [];
        if (userErrors.length > 0) {
          console.error(`[TieredPricing] Shopify error creating tag discount for level ${i}:`, userErrors);
          results.push({ levelIndex: i, shopifyDiscountId: null, error: userErrors.map((e) => e.message).join(", ") });
        } else if (result?.automaticAppDiscount) {
          results.push({ levelIndex: i, shopifyDiscountId: result.automaticAppDiscount.discountId });
        } else {
          results.push({ levelIndex: i, shopifyDiscountId: null, error: "Unexpected Shopify response (no discount returned)" });
        }
      } catch (err) {
        console.error(`[TieredPricing] Exception creating tag discount for level ${i}:`, err);
        results.push({ levelIndex: i, shopifyDiscountId: null, error: String(err) });
      }
      continue;
    }

    const customerGets = buildCustomerGets(level, productIds, collectionIds);
    const minimumRequirement = buildMinimumRequirement(type, level);

    // DiscountAutomaticBasicInput does NOT accept customerSelection —
    // only title, startsAt, endsAt, customerGets, minimumRequirement are valid
    const input: Record<string, unknown> = {
      title,
      startsAt: new Date().toISOString(),
      customerGets,
    };

    if (minimumRequirement) {
      input.minimumRequirement = minimumRequirement;
    }

    try {
      const json = await graphqlWithRetry<{
        data?: {
          discountAutomaticBasicCreate?: {
            automaticDiscountNode: { id: string } | null;
            userErrors: { field: string[]; message: string }[];
          };
        };
      }>(admin, CREATE_AUTOMATIC_BASIC_DISCOUNT, { automaticBasicDiscount: input });

      const result = json.data?.discountAutomaticBasicCreate;
      const userErrors = result?.userErrors ?? [];

      if (userErrors.length > 0) {
        console.error(`[TieredPricing] Shopify error creating discount for level ${i}:`, userErrors);
        results.push({ levelIndex: i, shopifyDiscountId: null, error: userErrors.map(e => e.message).join(", ") });
      } else if (result?.automaticDiscountNode) {
        results.push({ levelIndex: i, shopifyDiscountId: result.automaticDiscountNode.id });
      } else {
        results.push({ levelIndex: i, shopifyDiscountId: null, error: "Unexpected Shopify response (no discount returned)" });
      }
    } catch (err) {
      console.error(`[TieredPricing] Exception creating discount for level ${i}:`, err);
      results.push({ levelIndex: i, shopifyDiscountId: null, error: String(err) });
    }
  }

  return results;
}

// ─── Delete all Shopify discounts for a rule's levels ────────────────────────

export async function deleteShopifyDiscountsForRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
) {
  const levels = await prisma.tierLevel.findMany({
    where: { ruleId, shopifyDiscountId: { not: null } },
    select: { id: true, shopifyDiscountId: true },
  });

  for (const level of levels) {
    if (!level.shopifyDiscountId) continue;
    try {
      await admin.graphql(DELETE_AUTOMATIC_DISCOUNT, {
        variables: { id: level.shopifyDiscountId },
      });
    } catch (err) {
      console.error(`[TieredPricing] Failed to delete discount ${level.shopifyDiscountId}:`, err);
    }
  }
}

// ─── Toggle (activate/deactivate) all discounts for a rule ───────────────────

export async function toggleShopifyDiscountsForRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
  activate: boolean,
): Promise<{ success: boolean; errors: string[] }> {
  const levels = await prisma.tierLevel.findMany({
    where: { ruleId, shopifyDiscountId: { not: null } },
    select: { shopifyDiscountId: true },
  });

  const mutation = activate ? ACTIVATE_AUTOMATIC_DISCOUNT : DEACTIVATE_AUTOMATIC_DISCOUNT;
  const errors: string[] = [];

  for (const level of levels) {
    if (!level.shopifyDiscountId) continue;
    try {
      const response = await admin.graphql(mutation, {
        variables: { id: level.shopifyDiscountId },
      });
      const json = await response.json() as {
        data: {
          discountAutomaticActivate?: { userErrors: { message: string }[] };
          discountAutomaticDeactivate?: { userErrors: { message: string }[] };
        };
      };
      const userErrors =
        json.data.discountAutomaticActivate?.userErrors ??
        json.data.discountAutomaticDeactivate?.userErrors ??
        [];
      if (userErrors.length > 0) {
        const msg = userErrors.map((e) => e.message).join(", ");
        console.error(`[TieredPricing] Shopify error toggling discount ${level.shopifyDiscountId}:`, msg);
        errors.push(msg);
      }
    } catch (err) {
      const msg = String(err);
      console.error(`[TieredPricing] Failed to toggle discount ${level.shopifyDiscountId}:`, msg);
      errors.push(msg);
    }
  }

  return { success: errors.length === 0, errors };
}

// ─── Sync: Delete old + create new (used on rule update) ─────────────────────

export async function syncShopifyDiscountsForRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
  ruleName: string,
  type: TierType,
  productIds: string[],
  collectionIds: string[],
  levels: TierLevelInput[],
) {
  // Delete old Shopify discounts first
  await deleteShopifyDiscountsForRule(admin, ruleId);

  // Create new ones
  return createShopifyDiscountsForRule(
    admin,
    ruleId,
    ruleName,
    type,
    productIds,
    collectionIds,
    levels,
  );
}

// ─── Delete discounts by a pre-collected list of GIDs (no DB query needed) ───

export async function deleteShopifyDiscountsByIds(
  admin: AdminApiContext["admin"],
  discountIds: string[],
): Promise<void> {
  for (const id of discountIds) {
    try {
      await admin.graphql(DELETE_AUTOMATIC_DISCOUNT, {
        variables: { id },
      });
    } catch (err) {
      console.error(`[TieredPricing] Failed to delete discount ${id}:`, err);
    }
  }
}

// ─── Clear shopifyDiscountId on all TierLevels for a rule ────────────────────

export async function clearDiscountIdsForRule(ruleId: string): Promise<void> {
  await prisma.tierLevel.updateMany({
    where: { ruleId },
    data: { shopifyDiscountId: null, syncStatus: "PENDING" },
  });
}

// ─── Write discount IDs back to the DB ───────────────────────────────────────

export async function saveDiscountIdsToLevels(
  ruleId: string,
  results: { levelIndex: number; shopifyDiscountId: string | null; error?: string }[],
) {
  const levels = await prisma.tierLevel.findMany({
    where: { ruleId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  // Persist the per-level outcome atomically: a level is SYNCED only when it has
  // a Shopify discount id and no error; otherwise it's FAILED so the UI can flag
  // it and offer a retry. Relying on shopifyDiscountId != null alone hid gaps.
  const updates = results
    .map(({ levelIndex, shopifyDiscountId, error }) => {
      const level = levels[levelIndex];
      if (!level) return null;
      const synced = !!shopifyDiscountId && !error;
      return prisma.tierLevel.update({
        where: { id: level.id },
        data: {
          shopifyDiscountId: synced ? shopifyDiscountId : null,
          syncStatus: synced ? "SYNCED" : "FAILED",
        },
      });
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

// ─── Re-sync a rule's discounts from scratch (used by the "Retry sync" action) ─
//
// Deletes any existing Shopify discounts for the rule, clears local state, then
// recreates one discount per level and records the new sync status. This brings
// the rule back to a fully-consistent state after a partial failure.
export async function resyncRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
  shop: string,
): Promise<{ success: boolean; errors: string[] }> {
  const rule = await prisma.tierRule.findFirst({
    where: { id: ruleId, shop },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  });
  if (!rule) return { success: false, errors: ["Rule not found"] };

  await deleteShopifyDiscountsForRule(admin, ruleId);
  await clearDiscountIdsForRule(ruleId);

  const results = await createShopifyDiscountsForRule(
    admin,
    rule.id,
    rule.name,
    rule.type as TierType,
    parseIds(rule.productIds),
    parseIds(rule.collectionIds),
    rule.levels as unknown as TierLevelInput[],
  );
  await saveDiscountIdsToLevels(rule.id, results);

  const errors = results.filter((r) => r.error).map((r) => r.error!);
  return { success: errors.length === 0, errors };
}
