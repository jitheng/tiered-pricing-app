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
import type { TierLevelInput, TierType } from "./tierRule.server";

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

function parseIds(json: string): string[] {
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

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
      const response = await admin.graphql(CREATE_AUTOMATIC_BASIC_DISCOUNT, {
        variables: { automaticBasicDiscount: input },
      });

      const json = await response.json() as {
        data: {
          discountAutomaticBasicCreate: {
            automaticDiscountNode: { id: string } | null;
            userErrors: { field: string[]; message: string }[];
          };
        };
      };

      const { automaticDiscountNode, userErrors } =
        json.data.discountAutomaticBasicCreate;

      if (userErrors.length > 0) {
        console.error(`[TieredPricing] Shopify error creating discount for level ${i}:`, userErrors);
        results.push({ levelIndex: i, shopifyDiscountId: null, error: userErrors.map(e => e.message).join(", ") });
      } else if (automaticDiscountNode) {
        results.push({ levelIndex: i, shopifyDiscountId: automaticDiscountNode.id });
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
    data: { shopifyDiscountId: null },
  });
}

// ─── Write discount IDs back to the DB ───────────────────────────────────────

export async function saveDiscountIdsToLevels(
  ruleId: string,
  results: { levelIndex: number; shopifyDiscountId: string | null }[],
) {
  const levels = await prisma.tierLevel.findMany({
    where: { ruleId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await Promise.all(
    results.map(async ({ levelIndex, shopifyDiscountId }) => {
      const level = levels[levelIndex];
      if (!level || !shopifyDiscountId) return;
      await prisma.tierLevel.update({
        where: { id: level.id },
        data: { shopifyDiscountId },
      });
    }),
  );
}
