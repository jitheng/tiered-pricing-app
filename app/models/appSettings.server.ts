import prisma from "../db.server";
import { isSupportedCurrency } from "../currencies";

export interface AppSettingsInput {
  isEnabled?: boolean;
  showPricingTable?: boolean;
  currency?: string;
}

export async function getOrCreateSettings(shop: string) {
  return prisma.appSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

/**
 * Persist settings after sanitising input. Booleans are only applied when they
 * are actually booleans, and `currency` is validated against the supported
 * allowlist — invalid input is rejected so a crafted request can't write an
 * unsupported currency or a non-boolean flag to the database.
 */
export async function updateSettings(shop: string, data: AppSettingsInput) {
  const clean: AppSettingsInput = {};

  if (typeof data.isEnabled === "boolean") clean.isEnabled = data.isEnabled;
  if (typeof data.showPricingTable === "boolean")
    clean.showPricingTable = data.showPricingTable;

  if (data.currency !== undefined) {
    if (!isSupportedCurrency(data.currency)) {
      throw new Error(`Unsupported currency: ${String(data.currency)}`);
    }
    clean.currency = data.currency;
  }

  return prisma.appSettings.upsert({
    where: { shop },
    create: { shop, ...clean },
    update: clean,
  });
}
