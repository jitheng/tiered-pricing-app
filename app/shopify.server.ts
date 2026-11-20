// Patch globalThis.fetch to route through the static-IP egress proxy (no-op
// unless SHOPIFY_EGRESS_PROXY_URL is set). Imported first as a belt-and-braces
// measure; the authoritative hook is setAbstractFetchFunc below, since bundlers
// may reorder this relative to the adapter's own globalThis.fetch capture.
import "./egress-proxy.server";
import "@shopify/shopify-app-remix/adapters/node";
import { setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import db from "./db.server";
import { getProxiedFetch } from "./egress-proxy.server";

// The Shopify node adapter (imported above) sets the SDK's abstract fetch to the
// built-in globalThis.fetch. Override it with our proxy-bound fetch so ALL
// Admin API / OAuth calls traverse the static-IP proxy, regardless of import
// order in the bundle. No-op when the proxy is disabled.
const proxiedFetch = getProxiedFetch();
if (proxiedFetch) {
  setAbstractFetchFunc(proxiedFetch as never);
}

/**
 * Fail fast on missing configuration instead of booting with empty credentials
 * and failing cryptically at the first auth attempt.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[TieredPricing] Missing required environment variable: ${name}. ` +
        `Set it in your .env (local) or the hosting provider's environment settings.`,
    );
  }
  return value;
}

const shopify = shopifyApp({
  apiKey: requireEnv("SHOPIFY_API_KEY"),
  apiSecretKey: requireEnv("SHOPIFY_API_SECRET"),
  apiVersion: ApiVersion.April26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: requireEnv("SHOPIFY_APP_URL"),
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(db),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
