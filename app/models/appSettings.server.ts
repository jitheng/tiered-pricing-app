import prisma from "../db.server";

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

export async function updateSettings(shop: string, data: AppSettingsInput) {
  return prisma.appSettings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}
