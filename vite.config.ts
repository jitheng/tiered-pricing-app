import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig, type UserConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

installGlobals({ nativeFetch: true });

// Custom plugin to resolve .prisma/client imports to @prisma/client
function prismaImportPlugin(): Plugin {
  return {
    name: 'prisma-import-resolver',
    enforce: 'pre',
    resolveId(source, importer, options) {
      if (source === '.prisma/client' || source.startsWith('.prisma/client/')) {
        return this.resolve('@prisma/client', importer, { skipSelf: true, ...options });
      }
      return null;
    },
  };
}

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// stop passing in HOST, so we can remove this workaround after the next major release.
if (
    process.env.HOST &&
    (!process.env.SHOPIFY_APP_URL ||
         process.env.SHOPIFY_APP_URL === process.env.HOST)
  ) {
    process.env.SHOPIFY_APP_URL = process.env.HOST;
    delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
    hmrConfig = {
          protocol: "ws",
          host: "localhost",
          port: 64999,
          clientPort: 64999,
    };
} else {
    hmrConfig = {
          protocol: "wss",
          host: host,
          port: parseInt(process.env.FRONTEND_PORT!) || 8002,
          clientPort: 443,
    };
}

export default defineConfig({
    resolve: {
          alias: {
                // Redirect .prisma/client to @prisma/client to fix ESM resolution errors
                // The Shopify session storage package may import from .prisma/client
                ".prisma/client": path.resolve(__dirname, "node_modules/@prisma/client"),
          },
    },
    server: {
          allowedHosts: [host],
          cors: {
                  preflightContinue: true,
          },
          port: Number(process.env.PORT || 3000),
          hmr: hmrConfig,
          fs: {
                  // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
            allow: ["app", "node_modules"],
          },
    },
    plugins: [
          prismaImportPlugin(),
          remix({
                  ignoredRouteFiles: ["**/.*"],
                  future: {
                            v3_fetcherPersist: true,
                            v3_relativeSplatPath: true,
                            v3_throwAbortReason: true,
                            v3_lazyRouteDiscovery: true,
                            v3_singleFetch: false,
                            v3_routeConfig: true,
                  },
          }),
          tsconfigPaths(),
        ],
    build: {
          assetsInlineLimit: 0,
    },
    // Vercel serverless: Do NOT bundle @prisma/client - let it remain external
    // so Node.js can load it properly with named exports. Only bundle the
    // Shopify session storage package which depends on it.
    ssr: {
          noExternal: [
                "@shopify/shopify-app-session-storage-prisma"
          ],
    },
    optimizeDeps: {
          include: ["@shopify/app-bridge-react", "@shopify/polaris"],
    },
}) satisfies UserConfig;
