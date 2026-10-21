import prisma from "../db.server";

export type TierType = "QUANTITY" | "CUSTOMER_TAG" | "SPEND";
export type DiscountType = "PERCENTAGE" | "FIXED";

export interface TierLevelInput {
  id?: string;
  minValue: number;
  maxValue?: number | null;
  tagValue?: string | null;
  discount: number;
  type: DiscountType;
  label?: string | null;
  sortOrder?: number;
}

export interface TierRuleInput {
  name: string;
  type: TierType;
  productIds?: string[];
  collectionIds?: string[];
  isActive?: boolean;
  levels: TierLevelInput[];
}

// ─── READ ───────────────────────────────────────────────────────────────────

export async function getTierRules(shop: string) {
  return prisma.tierRule.findMany({
    where: { shop },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTierRule(id: string, shop: string) {
  return prisma.tierRule.findFirst({
    where: { id, shop },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getTierRuleCount(shop: string) {
  return prisma.tierRule.count({ where: { shop } });
}

export async function getActiveTierRules(shop: string) {
  return prisma.tierRule.findMany({
    where: { shop, isActive: true },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  });
}

// ─── WRITE ──────────────────────────────────────────────────────────────────

export async function createTierRule(shop: string, input: TierRuleInput) {
  const { levels, productIds = [], collectionIds = [], ...rest } = input;

  return prisma.tierRule.create({
    data: {
      ...rest,
      shop,
      productIds: JSON.stringify(productIds),
      collectionIds: JSON.stringify(collectionIds),
      levels: {
        create: levels.map((level, i) => ({
          ...level,
          sortOrder: level.sortOrder ?? i,
        })),
      },
    },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function updateTierRule(
  id: string,
  shop: string,
  input: Partial<TierRuleInput>,
) {
  const { levels, productIds, collectionIds, ...rest } = input;

  // Atomic: delete old levels and recreate them in the same transaction as the
  // rule update, so a failure can't leave the rule with a half-rebuilt level set.
  return prisma.$transaction(async (tx) => {
    if (levels) {
      await tx.tierLevel.deleteMany({ where: { ruleId: id } });
    }

    return tx.tierRule.update({
      where: { id },
      data: {
        ...rest,
        ...(productIds !== undefined
          ? { productIds: JSON.stringify(productIds) }
          : {}),
        ...(collectionIds !== undefined
          ? { collectionIds: JSON.stringify(collectionIds) }
          : {}),
        ...(levels
          ? {
              levels: {
                create: levels.map((level, i) => ({
                  ...level,
                  id: undefined, // let Prisma generate new IDs
                  sortOrder: level.sortOrder ?? i,
                })),
              },
            }
          : {}),
      },
      include: { levels: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

/**
 * Deactivate a rule and reset the Shopify sync state of all its levels in one
 * transaction. Callers should delete the Shopify discounts BEFORE calling this.
 */
export async function deactivateRule(id: string, shop: string) {
  const rule = await prisma.tierRule.findFirst({ where: { id, shop } });
  if (!rule) throw new Error("Tier rule not found");

  return prisma.$transaction(async (tx) => {
    await tx.tierLevel.updateMany({
      where: { ruleId: id },
      data: { shopifyDiscountId: null, syncStatus: "PENDING" },
    });
    return tx.tierRule.update({ where: { id }, data: { isActive: false } });
  });
}

export async function toggleTierRule(id: string, shop: string, isActive: boolean) {
  return prisma.tierRule.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteTierRule(id: string, shop: string) {
  // Verify ownership before deleting
  const rule = await prisma.tierRule.findFirst({ where: { id, shop } });
  if (!rule) throw new Error("Tier rule not found");
  return prisma.tierRule.delete({ where: { id } });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function parseIds(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

/**
 * Given a quantity, customer tags, or cart total, find the matching tier level
 * for a given rule.
 */
export function matchTierLevel(
  rule: { type: string; levels: { minValue: number; maxValue: number | null; tagValue: string | null }[] },
  opts: { quantity?: number; tags?: string[]; cartTotal?: number },
) {
  const { quantity, tags = [], cartTotal } = opts;

  for (const level of rule.levels) {
    if (rule.type === "QUANTITY" && quantity !== undefined) {
      const withinMax = level.maxValue === null || quantity <= level.maxValue;
      if (quantity >= level.minValue && withinMax) return level;
    } else if (rule.type === "CUSTOMER_TAG" && level.tagValue) {
      if (tags.includes(level.tagValue)) return level;
    } else if (rule.type === "SPEND" && cartTotal !== undefined) {
      const withinMax = level.maxValue === null || cartTotal <= level.maxValue;
      if (cartTotal >= level.minValue && withinMax) return level;
    }
  }
  return null;
}
