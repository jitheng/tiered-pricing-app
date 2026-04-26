import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  {
    title:
      "Tiered Pricing vs Volume Discount: Which One Fits Your Store? — Tiered Pricing App",
  },
  {
    name: "description",
    content:
      "Tiered pricing and volume discounts sound the same. They're not. Here's exactly when to use each — and the hybrid that beats both.",
  },
  {
    name: "keywords",
    content:
      "tiered pricing vs volume discount, volume discount vs tiered pricing, Shopify pricing structures",
  },
];

const APP_STORE_URL = "https://apps.shopify.com/tiered-pricing-7";

export default function Blog2() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/blogs" style={styles.backLink}>← Back to Blog</Link>
          <div style={styles.readingTime}>6 min read</div>
          <h1 style={styles.title}>
            Tiered Pricing vs Volume Discount: Which One Fits Your Store?
          </h1>
        </div>

        {/* Article */}
        <div style={styles.content}>
          <p style={styles.introBox}>
            Most merchants use "tiered pricing" and "volume discount"
            interchangeably. They shouldn't. The two structures look identical on
            the surface and behave very differently at the cash register, and
            picking the wrong one for your category can cap your AOV by 10% or
            more.
          </p>
          <p style={{ ...styles.bodyText, marginBottom: "0" }}>
            This post breaks down the difference, when each one wins, and the
            hybrid setup that gets you the upside of both.
          </p>

          <Section title="Quick definitions">
            <p>
              <strong>Tiered pricing</strong> is <em>all-or-nothing per tier</em>
              . If you set tiers at 1, 5, and 10, then a customer buying 7 units
              pays the tier-2 price for <em>all 7</em>. They don't get tier-1
              pricing on the first 4 and tier-2 on the rest. The whole order
              moves to one price tier.
            </p>
            <p>
              <strong>Volume discount</strong> is{" "}
              <em>cumulative per quantity</em>. Same tiers, same 7 units — but
              the customer pays tier-1 price on the first 4 units and tier-2
              price on units 5–7. The discount accumulates.
            </p>
            <p>
              The mechanics are different. The customer psychology is also
              different.
            </p>
          </Section>

          <Section title="Side-by-side comparison">
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Element</th>
                    <th style={styles.th}>Tiered pricing</th>
                    <th style={styles.th}>Volume discount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}>Pricing math</td>
                    <td style={styles.td}>All units at tier price</td>
                    <td style={styles.td}>Each unit at its own tier</td>
                  </tr>
                  <tr style={{ background: "#f9f9fb" }}>
                    <td style={styles.td}>Customer signal</td>
                    <td style={styles.td}>"Jump to the next tier and save"</td>
                    <td style={styles.td}>"Every additional unit saves more"</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>Best for</td>
                    <td style={styles.td}>Bulk SKUs, B2B catalogs, multipacks</td>
                    <td style={styles.td}>Add-on accessories, consumables, repurchase items</td>
                  </tr>
                  <tr style={{ background: "#f9f9fb" }}>
                    <td style={styles.td}>Lifts AOV by</td>
                    <td style={styles.td}>Pulling orders up to the threshold</td>
                    <td style={styles.td}>Encouraging incremental adds</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>Common in</td>
                    <td style={styles.td}>Wholesale, supplements, restaurants</td>
                    <td style={styles.td}>Print, beauty, digital goods</td>
                  </tr>
                  <tr style={{ background: "#f9f9fb" }}>
                    <td style={styles.td}>Setup complexity</td>
                    <td style={styles.td}>Slightly simpler</td>
                    <td style={styles.td}>Slightly more complex</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="When tiered pricing wins">
            <p>
              Tiered pricing wins when your customer has a{" "}
              <em>target quantity in mind</em> and you want to push them to the
              next bracket. The classic case: a customer who knows they need
              around 8 units sees tiers at 5 and 10. Five is too few, but 10
              saves them more per unit, and they're already at 8 — so they round
              up.
            </p>
            <p>
              Tiered pricing also wins when the customer is buying for resale or
              restock — wholesale, B2B, large supplement orders. The bracket
              structure mirrors how they think about their own purchasing: in case
              quantities, not in incremental units.
            </p>
            <p>
              If your category is{" "}
              <strong>bulk-oriented, B2B, or restock-driven</strong>, tiered
              pricing is usually the right call.
            </p>
          </Section>

          <Section title="When volume discount wins">
            <p>
              Volume discount wins when the customer is making an{" "}
              <em>incremental add-on decision</em>. They've decided to buy 1.
              Should they add a 2nd? A 3rd? Each unit's own price drops as they
              add more, so each "should I add one more?" decision feels
              independently rewarded.
            </p>
            <p>
              Volume discounts also tend to outperform tiered pricing when the
              customer doesn't have a preset quantity. If they're browsing and the
              right number is "however many feels good," cumulative discounts let
              them keep adding without feeling like they're far from a threshold.
            </p>
            <p>
              If your category is{" "}
              <strong>consumable, accessory-driven, or impulse-friendly</strong>,
              volume discount is usually the right call.
            </p>
          </Section>

          <Section title="The hybrid: tier display, volume math">
            <p>
              A pattern that's working well in 2026: show a tier table on the
              product page (because it visually anchors the discount and lifts
              perceived value) but apply volume math at checkout (so each unit
              gets its own optimal price).
            </p>
            <p>
              The customer experience: they see the tier table — "5+: 10% off,
              10+: 15% off" — and feel the anchoring. They add 6 to cart. At
              checkout, units 1–4 are at full price and units 5–6 are at 10% off.
              Customer feels like they got a deal <em>and</em> didn't get
              punished for being just over a threshold.
            </p>
            <p>
              This hybrid is what most B2B-optimized stores run today. It's
              slightly more complex to set up but typically out-converts either
              pure structure.
            </p>
          </Section>

          <Section title="By industry">
            <p>
              <strong>Supplements (consumable).</strong> Volume discount or
              hybrid. Customers reorder; cumulative discounts feel like a loyalty
              mechanic.
            </p>
            <p>
              <strong>Apparel (multipack).</strong> Tiered pricing. Customers buy
              in pack sizes (3-pack, 6-pack, 12-pack) and the bracket structure
              matches the SKU structure.
            </p>
            <p>
              <strong>Beauty (mixed).</strong> Hybrid. Some products are bulk
              (palettes, sets), others are accessories (brushes, applicators).
              Different rules per collection.
            </p>
            <p>
              <strong>B2B parts.</strong> Tiered pricing. Buyers think in case
              quantities and order in brackets.
            </p>
            <p>
              <strong>Print on demand.</strong> Volume discount. Customers don't
              have target quantities; they have budgets.
            </p>
            <p>
              <strong>Food and beverage.</strong> Tiered for bulk SKUs (cases of
              wine), volume for consumables (snacks, bars).
            </p>
          </Section>

          <Section title="Decision framework">
            <p>Three questions, in order:</p>
            <ol style={styles.ol}>
              <li>
                <strong>
                  Does my customer have a target quantity in mind before they
                  shop?
                </strong>{" "}
                If yes → tiered. If no → volume.
              </li>
              <li>
                <strong>
                  Is the product a single bulk purchase or an ongoing
                  consumable?
                </strong>{" "}
                Bulk → tiered. Consumable → volume.
              </li>
              <li>
                <strong>Do I sell B2B or wholesale meaningfully?</strong> Yes →
                tiered (matches buyer thinking). No → either.
              </li>
            </ol>
            <p>
              If you score 2 or 3 toward "tiered," start with tiered pricing. If
              you score 2 or 3 toward "volume," start there. If you split, run
              the hybrid.
            </p>
          </Section>

          <Section title="Common mistakes">
            <ul style={styles.ul}>
              <li>
                <strong>Picking based on what your competitors do.</strong> Their
                customer is not your customer. Run the framework.
              </li>
              <li>
                <strong>Switching mid-quarter.</strong> The data is noisy enough
                that a 30-day test is the minimum to read; switching at week 2
                means you'll never know.
              </li>
              <li>
                <strong>
                  Setting bracket thresholds without looking at order data.
                </strong>{" "}
                Your tier-1 should be at the 75th-percentile order quantity,
                roughly. Don't guess.
              </li>
            </ul>
          </Section>

          <Section title="FAQ">
            <p>
              <strong>Can I run both on the same store?</strong> Yes — different
              products or collections, different rules. Most apps support this.
            </p>
            <p>
              <strong>
                Which one is "fairer" to the customer?
              </strong>{" "}
              Volume discount, mathematically — it doesn't penalize being just
              over a tier. But customers don't always perceive it that way.
              Tiered pricing's anchoring effect is stronger in some categories.
            </p>
            <p>
              <strong>
                Will switching from one to the other affect my SEO?
              </strong>{" "}
              No — these are pricing rules, not page structure. They don't affect
              search.
            </p>
          </Section>

          {/* CTA */}
          <div style={styles.cta}>
            <p style={styles.ctaText}>
              Not sure which fits your store? Tiered Pricing supports both
              structures and lets you switch with one click. Free trial, no card
              required.
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
