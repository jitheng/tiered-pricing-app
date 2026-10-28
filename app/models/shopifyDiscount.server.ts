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
import { parseIds } from "../parseIds";

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
  startsAt?: Date | string | null,
  endsAt?: Date | string | null,
) {
  const results: { levelIndex: number; shopifyDiscountId: string | null; error?: string }[] = [];

  // Scheduled-discount window. Shopify natively activates at startsAt and expires
  // at endsAt (status SCHEDULED → ACTIVE → EXPIRED), so no app-side cron is needed.
  const effectiveStartsAt = startsAt
    ? new Date(startsAt).toISOString()
    : new Date().toISOString();
  const endsAtIso = endsAt ? new Date(endsAt).toISOString() : null;

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
        startsAt: effectiveStartsAt,
        ...(endsAtIso ? { endsAt: endsAtIso } : {}),
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
      startsAt: effectiveStartsAt,
      customerGets,
    };

    if (endsAtIso) {
      input.endsAt = endsAtIso;
    }

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

// ─── Delete a single discount node, verifying the result ─────────────────────
//
// Returns an error string if the delete did not succeed (so callers can decide
// whether the discount is still live), or null on success. Previously these
// deletes fired the mutation without reading the response, so a failed delete
// silently left a live, still-applying discount — see reconcileOrphanedDiscounts.
async function deleteDiscountNode(
  admin: AdminApiContext["admin"],
  id: string,
): Promise<string | null> {
  try {
    const response = await admin.graphql(DELETE_AUTOMATIC_DISCOUNT, {
      variables: { id },
    });
    const body = (await response.json()) as {
      data?: {
        discountAutomaticDelete?: {
          deletedAutomaticDiscountId: string | null;
          userErrors: { message: string }[];
        };
      };
    };
    const result = body.data?.discountAutomaticDelete;
    const userErrors = result?.userErrors ?? [];
    if (userErrors.length > 0) {
      const msg = userErrors.map((e) => e.message).join(", ");
      console.error(`[TieredPricing] Shopify error deleting discount ${id}:`, msg);
      return msg;
    }
    if (!result?.deletedAutomaticDiscountId) {
      const msg = `Discount ${id} was not deleted (no id returned)`;
      console.error(`[TieredPricing] ${msg}`);
      return msg;
    }
    return null;
  } catch (err) {
    const msg = String(err);
    console.error(`[TieredPricing] Failed to delete discount ${id}:`, msg);
    return msg;
  }
}

// ─── Delete all Shopify discounts for a rule's levels ────────────────────────

export async function deleteShopifyDiscountsForRule(
  admin: AdminApiContext["admin"],
  ruleId: string,
): Promise<{ success: boolean; errors: string[] }> {
  const levels = await prisma.tierLevel.findMany({
    where: { ruleId, shopifyDiscountId: { not: null } },
    select: { id: true, shopifyDiscountId: true },
  });

  const errors: string[] = [];
  for (const level of levels) {
    if (!level.shopifyDiscountId) continue;
    const error = await deleteDiscountNode(admin, level.shopifyDiscountId);
    if (error) errors.push(error);
  }

  return { success: errors.length === 0, errors };
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
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  for (const id of discountIds) {
    const error = await deleteDiscountNode(admin, id);
    if (error) errors.push(error);
  }
  return { success: errors.length === 0, errors };
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
    rule.startsAt,
    rule.endsAt,
  );
  await saveDiscountIdsToLevels(rule.id, results);

  const errors = results.filter((r) => r.error).map((r) => r.error!);
  return { success: errors.length === 0, errors };
}

// ─── Reconcile orphaned Shopify discounts ────────────────────────────────────
//
// Every discount this app creates is titled `[Tiered] …`. If a rule's discount
// node is ever left live in Shopify without a matching DB record — e.g. a delete
// that silently failed, or (historically) a disable that nulled the stored GID —
// it keeps applying at checkout even though the app no longer knows about it.
//
// This sweep lists every `[Tiered]`-titled automatic discount in the store and
// DEACTIVATES any that is still ACTIVE but is no longer backed by a TierLevel in
// our database. It only ever touches `[Tiered]`-prefixed nodes (never the
// merchant's own code/automatic discounts) and only deactivates (never deletes),
// so it is safe and reversible. Discounts belonging to an existing rule — active
// or intentionally disabled — are left alone; those are managed by the normal
// create/toggle paths.

const TIERED_TITLE_PREFIX = "[Tiered]";

const TIERED_DISCOUNT_NODES_QUERY = `#graphql
  query TieredDiscountNodes($cursor: String) {
    discountNodes(first: 100, after: $cursor, query: "title:Tiered") {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticApp { title status }
          ... on DiscountAutomaticBasic { title status }
        }
      }
    }
  }
`;

export async function reconcileOrphanedDiscounts(
  admin: AdminApiContext["admin"],
  shop: string,
): Promise<{ deactivated: number; errors: string[] }> {
  const errors: string[] = [];

  // GIDs still owned by a rule in our DB (any rule — active or disabled).
  const trackedLevels = await prisma.tierLevel.findMany({
    where: { rule: { shop }, shopifyDiscountId: { not: null } },
    select: { shopifyDiscountId: true },
  });
  const tracked = new Set(trackedLevels.map((l) => l.shopifyDiscountId));

  // Page through every [Tiered]-titled automatic discount node in the store and
  // collect the active ones our DB no longer references.
  const orphanIds: string[] = [];
  let cursor: string | null = null;
  try {
    for (let page = 0; page < 50; page++) {
      const response = await admin.graphql(TIERED_DISCOUNT_NODES_QUERY, {
        variables: { cursor },
      });
      const body = (await response.json()) as {
        data?: {
          discountNodes?: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: {
              id: string;
              discount: { __typename: string; title?: string; status?: string };
            }[];
          };
        };
      };
      const connection = body.data?.discountNodes;
      if (!connection) break;

      for (const node of connection.nodes) {
        const title = node.discount?.title ?? "";
        const status = node.discount?.status ?? "";
        if (!title.startsWith(TIERED_TITLE_PREFIX)) continue; // not ours
        if (tracked.has(node.id)) continue; // still owned by a rule
        if (status !== "ACTIVE") continue; // already inactive — nothing to do
        orphanIds.push(node.id);
      }

      if (!connection.pageInfo.hasNextPage) break;
      cursor = connection.pageInfo.endCursor;
    }
  } catch (err) {
    errors.push(`Failed to list discounts: ${String(err)}`);
  }

  // Deactivate each orphan (never delete — reversible).
  let deactivated = 0;
  for (const id of orphanIds) {
    try {
      const response = await admin.graphql(DEACTIVATE_AUTOMATIC_DISCOUNT, {
        variables: { id },
      });
      const body = (await response.json()) as {
        data?: { discountAutomaticDeactivate?: { userErrors: { message: string }[] } };
      };
      const userErrors = body.data?.discountAutomaticDeactivate?.userErrors ?? [];
      if (userErrors.length > 0) {
        errors.push(userErrors.map((e) => e.message).join(", "));
      } else {
        deactivated++;
      }
    } catch (err) {
      errors.push(String(err));
    }
  }

  return { deactivated, errors };
}
