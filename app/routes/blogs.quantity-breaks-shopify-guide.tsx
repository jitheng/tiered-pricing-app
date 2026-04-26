import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  {
    title:
      "How to Set Up Quantity Breaks on Shopify (2026 Guide) — Tiered Pricing App",
  },
  {
    name: "description",
    content:
      "Quantity breaks lift Shopify AOV by 10–20% with one rule per product. The 2026 guide — what they are, how to set them up, and the psychology that makes them work.",
  },
  {
    name: "keywords",
    content:
      "quantity breaks Shopify, Shopify quantity discount, how to set up quantity breaks Shopify, quantity break app",
  },
];

const APP_STORE_URL = "https://apps.shopify.com/tiered-pricing-7";

export default function Blog4() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/blogs" style={styles.backLink}>← Back to Blog</Link>
          <div style={styles.readingTime}>8 min read</div>
          <h1 style={styles.title}>
            How to Set Up Quantity Breaks on Shopify (2026 Guide)
          </h1>
        </div>

        {/* Article */}
        <div style={styles.content}>
          <p style={styles.introBox}>
            Quantity breaks are the single highest-leverage AOV move available to
            a Shopify merchant in 2026. One rule per product, no theme code, no
            checkout extension — and most stores see a 10–20% AOV lift in the
            first month after putting them on top SKUs.
          </p>
          <p style={styles.bodyText}>
            This guide covers what a quantity break actually is, how it differs
            from neighboring concepts (tiered pricing, volume discount, bundles),
            and the step-by-step setup that gets you from zero to first rule live
            in under 10 minutes.
          </p>

          <Section title="What is a quantity break?">
            <p>
              A quantity break is a discount that triggers when the customer buys
              above a specified quantity threshold. Buy 5+: 10% off. Buy 10+:
              15% off. The math is simple, the customer signal is clear: "buy
              more, save more."
            </p>
            <p>
              Quantity breaks are usually displayed as a small table on the
              product page, just above or below the add-to-cart button. The
              merchant sets the thresholds; the customer self-selects to the tier
              that matches their need.
            </p>
            <p>
              Unlike a percentage-off discount code, a quantity break doesn't
              require the customer to enter anything at checkout. It's automatic.
              They add the qualifying quantity, the price drops, the deal closes
              itself.
            </p>
          </Section>

          <Section title="Quantity breaks vs related concepts">
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Concept</th>
                    <th style={styles.th}>Mechanism</th>
                    <th style={styles.th}>When to use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}><strong>Quantity break</strong></td>
                    <td style={styles.td}>Per-product threshold discount</td>
                    <td style={styles.td}>Single SKU, AOV lift</td>
                  </tr>
                  <tr style={{ background: "#f9f9fb" }}>
                    <td style={styles.td}>Tiered pricing</td>
                    <td style={styles.td}>All units at one tier price</td>
                    <td style={styles.td}>Bulk catalogs, B2B</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>Volume discount</td>
                    <td style={styles.td}>Cumulative per-unit discount</td>
                    <td style={styles.td}>Add-on, consumable categories</td>
                  </tr>
                  <tr style={{ background: "#f9f9fb" }}>
                    <td style={styles.td}>Bundle</td>
                    <td style={styles.td}>Fixed price for SKU combination</td>
                    <td style={styles.td}>Cross-sell, complementary products</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>BOGO</td>
                    <td style={styles.td}>Buy X, get Y free or discounted</td>
                    <td style={styles.td}>Promotional, seasonal</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "1rem" }}>
              The lines blur in practice — most apps support all five — but the
              simplest way to think about it: quantity breaks are the entry
              point. If you've never used any of these, start with quantity
              breaks on your top 5 SKUs.
            </p>
          </Section>

          <Section title="Why quantity breaks lift AOV">
            <p>Three psychological mechanisms, all well-studied:</p>
            <p>
              <strong>Anchoring.</strong> When the customer sees "1: $10, 5: $9,
              10: $8," the $10 number is no longer the only price on the page.
              The presence of the lower numbers reframes single-unit pricing as
              "the worst deal."
            </p>
            <p>
              <strong>Goal gradient.</strong> Customers who are close to a tier
              threshold disproportionately round up. If your tier-1 is at 5 and
              the customer was going to buy 4, the marginal cost of one more unit
              is small and the saving is concrete.
            </p>
            <p>
              <strong>Loss aversion.</strong> Once a customer has decided to buy,
              leaving the discount on the table feels like losing money. The
              rational frame is "I'd be paying more per unit for buying less."
              Most customers internalize this and increase order size accordingly.
            </p>
            <p>
              The combined effect: AOV typically lifts 10–20% in the first 30
              days when quantity breaks go live on a store's top 10 SKUs. Your
              numbers will vary by category, but the direction holds across DTC
              categories.
            </p>
          </Section>

          <Section title="Native Shopify options and their limits">
            <p>
              Shopify's built-in discount engine supports a "buy X, get Y"
              discount type that can replicate some quantity break behavior. What
              works:
            </p>
            <ul style={styles.ul}>
              <li>Buy 5+, get 10% off</li>
              <li>Buy 3+, get a free item</li>
              <li>Buy 2+, get the second 50% off</li>
            </ul>
            <p>What breaks:</p>
            <ul style={styles.ul}>
              <li>
                The discount doesn't render on the product page — only in cart
                and at checkout
              </li>
              <li>You can't show a tier table to anchor the discount</li>
              <li>
                Multiple thresholds (5 → 10% off, 10 → 15% off) are clunky to
                configure
              </li>
              <li>Stacking with codes is unreliable</li>
            </ul>
            <p>
              The native approach is fine for a single rule on a single product.
              It falls apart fast at scale.
            </p>
          </Section>

          <Section title="App-based setup walkthrough">
            <ol style={styles.ol}>
              <li>
                <strong>
                  Install a quantity break app from the Shopify App Store.
                </strong>{" "}
                Most apps have a free plan or trial. Tiered Pricing is free for
                stores under 50 orders/month.
              </li>
              <li>
                <strong>Pick your starter products.</strong> Don't go
                store-wide. Pick the top 5 SKUs by revenue. Quantity breaks
                compound — adding them to your bestsellers lifts more total
                revenue than putting them on every SKU.
              </li>
              <li>
                <strong>Configure the tier table.</strong> A safe starting
                structure for most categories:
                <ul style={styles.ul}>
                  <li>1 unit: full price (no discount)</li>
                  <li>3+: 10% off</li>
                  <li>6+: 15% off</li>
                  <li>12+: 20% off</li>
                </ul>
                Adjust based on your AOV. If your average order is 1 unit,
                tier-1 should be at 2 or 3, not 5.
              </li>
              <li>
                <strong>Choose where to display the tier table.</strong> On the
                product page, above the add-to-cart button is the
                highest-converting placement in most tests. Below the price,
                above the variant selector, also works.
              </li>
              <li>
                <strong>Save and preview.</strong> Open the product page in
                incognito, add the qualifying quantity, confirm the discount
                applies in cart and at checkout.
              </li>
              <li>
                <strong>Run for 14 days, then expand.</strong> Watch AOV,
                conversion rate, and units-per-order. If the AOV lifts and CR
                holds steady, expand to the next 5 SKUs. If CR drops sharply
                (over 5%), the threshold is wrong — likely too high.
              </li>
            </ol>
          </Section>

          <Section title="Display: where to show the break">
            <p>
              The tier table is the conversion lever. A good tier table:
            </p>
            <ul style={styles.ul}>
              <li>Renders inside the product page, not in a popup</li>
              <li>
                Highlights the customer's current tier (so they see they're "1
                unit away" from the next)
              </li>
              <li>
                Shows the per-unit savings, not just the total discount
              </li>
              <li>
                Updates live as the customer changes the quantity selector
              </li>
            </ul>
            <p>
              Apps differ widely on this. Look at the screenshot in the App
              Store listing — if it doesn't show the tier table inline, it
              probably doesn't.
            </p>
          </Section>

          <Section title="Best practices">
            <p>
              <strong>Threshold setting.</strong> Tier-1 should be at the
              75th-percentile order quantity, roughly. If most customers buy 1,
              tier-1 at 3 is reachable. If most buy 3, tier-1 at 6.
            </p>
            <p>
              <strong>Anchor pricing.</strong> Make sure the single-unit price is
              visible alongside the tier prices. The contrast is what does the
              work.
            </p>
            <p>
              <strong>Rounding.</strong> Round the tier prices to clean numbers
              ($9 not $8.97). Customers respond more to clean numbers in pricing
              tables.
            </p>
            <p>
              <strong>Limit tier count.</strong> Three to four tiers is the sweet
              spot. Five or more confuses customers and dilutes the goal-gradient
              effect.
            </p>
            <p>
              <strong>Test on top sellers first.</strong> A 15% AOV lift on your
              bestseller is worth more than a 30% lift on a slow mover.
            </p>
            <p>
              <strong>Refresh quarterly.</strong> Customer behavior changes.
              Re-evaluate thresholds every quarter and shift them up if more
              customers are clearing the top tier.
            </p>
          </Section>

          <Section title="FAQ">
            <p>
              <strong>
                Will quantity breaks conflict with my discount codes?
              </strong>{" "}
              Depends on the app. Most modern apps integrate with Shopify's
              native discount stacking rules. Test before going live.
            </p>
            <p>
              <strong>Can I run quantity breaks on bundles?</strong> Yes — most
              apps support quantity breaks on bundle SKUs the same way they
              handle individual products.
            </p>
            <p>
              <strong>Do quantity breaks work with subscriptions?</strong> Some
              apps integrate with subscription apps (Recharge, Bold), some don't.
              Check the integration list.
            </p>
            <p>
              <strong>
                Will Shopify Markets display the tier table internationally?
              </strong>{" "}
              Most apps render the tier table in the storefront's currency
              automatically. Confirm by previewing in a different market.
            </p>
            <p>
              <strong>How do I know if my thresholds are right?</strong> After 30
              days, look at the distribution of order quantities. If 10%+ of
              orders are at the top tier, raise it. If under 2% are above tier-1,
              lower it.
            </p>
          </Section>

          <div style={styles.closing}>
            <p>
              Quantity breaks are a 30-minute setup with a 30-day payoff. If you
              only ship one AOV experiment this quarter, ship this one.
            </p>
          </div>

          {/* CTA */}
          <div style={styles.cta}>
            <p style={styles.ctaText}>
              Get your first quantity break rule live in under five minutes. Free
              trial, no credit card.
            </p>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.ctaButton}
            >
              Try Tiered Pricing on the Shopify App Store →
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <Link to="/blogs" style={styles.backLink}>← Back to Blog</Link>
          <Link to="/" style={styles.footerHomeLink}>Home</Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f9f9fb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#1a1a2e",
    padding: "2rem 1rem",
  } as React.CSSProperties,

  container: {
    maxWidth: "760px",
    margin: "0 auto",
  } as React.CSSProperties,

  header: {
    marginBottom: "2.5rem",
  } as React.CSSProperties,

  backLink: {
    display: "inline-block",
    color: "#4f46e5",
    textDecoration: "none",
    fontSize: "0.9rem",
    fontWeight: 500,
    marginBottom: "1rem",
  } as React.CSSProperties,

  readingTime: {
    display: "inline-block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#4f46e5",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "0.75rem",
  } as React.CSSProperties,

  title: {
    fontSize: "2rem",
    fontWeight: 800,
    margin: "0",
    color: "#1a1a2e",
    lineHeight: 1.25,
  } as React.CSSProperties,

  introBox: {
    fontSize: "1rem",
    lineHeight: 1.75,
    color: "#444",
    marginBottom: "1rem",
    padding: "1.25rem 1.5rem",
    background: "#eef2ff",
    borderRadius: "8px",
    borderLeft: "4px solid #4f46e5",
  } as React.CSSProperties,

  bodyText: {
    fontSize: "0.95rem",
    lineHeight: 1.75,
    color: "#444",
    marginBottom: "0",
  } as React.CSSProperties,

  content: {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #e8e5f0",
    padding: "2rem 2.5rem",
  } as React.CSSProperties,

  section: {
    marginBottom: "2.5rem",
    paddingBottom: "2.5rem",
    borderBottom: "1px solid #f0eef8",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 1rem",
  } as React.CSSProperties,

  sectionBody: {
    fontSize: "0.95rem",
    lineHeight: 1.75,
    color: "#444",
  } as React.CSSProperties,

  tableWrapper: {
    overflowX: "auto" as const,
    margin: "0.5rem 0",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  } as React.CSSProperties,

  th: {
    background: "#eef2ff",
    color: "#1a1a2e",
    fontWeight: 700,
    padding: "0.6rem 0.9rem",
    textAlign: "left" as const,
    borderBottom: "2px solid #c7d2fe",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "0.6rem 0.9rem",
    borderBottom: "1px solid #f0eef8",
    color: "#444",
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  ul: {
    paddingLeft: "1.5rem",
    margin: "0.75rem 0",
  } as React.CSSProperties,

  ol: {
    paddingLeft: "1.5rem",
    margin: "0.75rem 0",
  } as React.CSSProperties,

  closing: {
    fontSize: "0.95rem",
    lineHeight: 1.75,
    color: "#444",
    marginBottom: "2rem",
  } as React.CSSProperties,

  cta: {
    background: "#4f46e5",
    borderRadius: "12px",
    padding: "2rem",
    textAlign: "center" as const,
    marginTop: "1rem",
  } as React.CSSProperties,

  ctaText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: "1rem",
    marginBottom: "1.25rem",
    lineHeight: 1.6,
  } as React.CSSProperties,

  ctaButton: {
    display: "inline-block",
    background: "#fff",
    color: "#4f46e5",
    fontWeight: 700,
    fontSize: "0.95rem",
    padding: "0.75rem 1.75rem",
    borderRadius: "8px",
    textDecoration: "none",
  } as React.CSSProperties,

  footer: {
    marginTop: "2rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
  } as React.CSSProperties,

  footerHomeLink: {
    fontSize: "0.9rem",
    color: "#4f46e5",
    textDecoration: "none",
    fontWeight: 500,
  } as React.CSSProperties,
};
