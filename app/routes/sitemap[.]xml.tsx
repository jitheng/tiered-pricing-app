import type { LoaderFunctionArgs } from "@remix-run/node";

const BASE_URL = "https://tieredpricingapp.online";

const urls = [
  { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "monthly" },
  { loc: `${BASE_URL}/blogs`, priority: "0.9", changefreq: "weekly" },
  {
    loc: `${BASE_URL}/blogs/tiered-pricing-shopify-guide`,
    priority: "0.8",
    changefreq: "monthly",
  },
  {
    loc: `${BASE_URL}/blogs/tiered-pricing-vs-volume-discount`,
    priority: "0.8",
    changefreq: "monthly",
  },
  {
    loc: `${BASE_URL}/blogs/b2b-pricing-shopify-without-separate-store`,
    priority: "0.8",
    changefreq: "monthly",
  },
  {
    loc: `${BASE_URL}/blogs/quantity-breaks-shopify-guide`,
    priority: "0.8",
    changefreq: "monthly",
  },
];

export async function loader({ request: _request }: LoaderFunctionArgs) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
