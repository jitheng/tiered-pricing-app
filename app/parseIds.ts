/**
 * Parse a JSON string of Shopify GIDs into a string array, tolerating bad input.
 *
 * Lives in a plain (non-`.server`) module so it can be shared by both server
 * code (models/routes loaders) and client component code without pulling a
 * server-only module into the browser bundle.
 */
export function parseIds(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}
