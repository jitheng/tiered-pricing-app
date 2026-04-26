import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  {
    title:
      "How to Set Up Tiered Pricing on Shopify (The Simple Way) — Tiered Pricing App",
  },
  {
    name: "description",
    content:
      "Set up tiered pricing on your Shopify store in under 10 minutes. The complete 2026 guide — what it is, why it works, and the three ways to do it.",
  },
  {
    name: "keywords",
    content:
      "tiered pricing Shopify, how to set up tiered pricing on Shopify, Shopify tiered pricing",
  },
];

const APP_STORE_URL = "https://apps.shopify.com/tiered-pricing-7";

export default function Blog1() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/blogs" style={styles.backLink}>← Back to Blog</Link>
          <div style={styles.readingTime}>7 min read</div>
          <h1 style={styles.title}>
            How to Set Up Tiered Pricing on Shopify (The Simple Way)
          </h1>
        </div>

        {/* Article */}
        <div style={styles.content}>
          <p style={styles.intro}>
            Most merchants set up tiered pricing the hard way: a stack of native
            Shopify discounts that don't quite work right, three lines of liquid
            code copied from a forum post, and a half-broken cart page. Six weeks
            later they uninstall it all and start over.
          </p>
          <p style={styles.intro}>
            There's a simpler way. This guide walks through what tiered pricing
            actually is, why it lifts average order value (AOV), and the three
            setup paths — including the one most merchants should pick.
          </p>

          <Section title="What is tiered pricing?">
            <p>
              Tiered pricing is a discount structure where the per-unit price
              drops as the customer buys more. Buy 1: $10 each. Buy 5: $9 each.
              Buy 10: $8 each.
            </p>
            <p>
              The customer pays the <em>full</em> tier price for every unit at
              the quantity they reach. So at 10 units, all 10 cost $8 — not the
              first 4 at $10 and the rest at a lower rate. That latter structure
              is called a <em>volume discount</em>, and we'll cover the difference
              in another post.
            </p>
            <p>
              Tiered pricing is one of the oldest pricing strategies in retail,
              and it works for one simple reason: it converts a "should I add one
              more?" decision into a "should I jump to the next tier?" decision.
              The framing is different. The friction is lower.
            </p>
          </Section>

          <Section title="Why tiered pricing lifts AOV">
            <p>
              Three things happen when you put a tier table on a product page.
            </p>
            <p>
              <strong>Anchoring.</strong> The single-unit price is no longer the
              only number on the page. The customer sees that buying 5 saves them
              $5, and now $10 feels expensive <em>for one</em>.
            </p>
            <p>
              <strong>Loss aversion.</strong> Once a customer has decided to buy,
              leaving the lower per-unit price on the table feels like losing
              money. Most merchants see a measurable lift just from displaying the
              tiers — even when the tier discount is small.
            </p>
            <p>
              <strong>Self-segmentation.</strong> Customers who only need one buy
              one. Customers who need more take the deal. You're not discounting
              the people who would have paid full price anyway — you're upselling
              the ones who would have walked.
            </p>
            <p>
              Most stores see a 12–18% AOV lift in the first 30 days after
              putting tier tables on their top 10 SKUs. Your numbers will vary;
              the direction usually doesn't.
            </p>
          </Section>

          <Section title="The three ways to set up tiered pricing on Shopify">
            <h3 style={styles.h3}>Option 1: Native Shopify discounts</h3>
            <p>
              Shopify's built-in discount engine can do <em>some</em> tiered
              pricing — specifically, percentage-off discounts that apply when a
              customer hits a quantity threshold.
            </p>
            <p>
              What works: simple "buy 5, get 10% off" rules.
            </p>
            <p>
              What breaks: you can't show the tier table on the product page, the
              discount doesn't apply until checkout, and you can only stack so
              many discount codes before they conflict. Customers don't see the
              deal until they're already deciding to leave.
            </p>
            <p>
              <strong>Verdict:</strong> fine if you're testing the concept on one
              SKU. Not viable as a strategy.
            </p>

            <h3 style={styles.h3}>Option 2: Custom theme code</h3>
            <p>
              Edit your theme's <code>product.liquid</code> to render a tier
              table, then write a checkout script (Shopify Plus only) to apply
              the discount.
            </p>
            <p>
              What works: full control over presentation.
            </p>
            <p>
              What breaks: every theme update potentially breaks your code. Every
              checkout extension you add needs to be aware of the script.
              Multi-currency, Shopify Markets, B2B catalogs — every additional
              Shopify feature is another thing your custom code has to handle.
            </p>
            <p>
              <strong>Verdict:</strong> only worth it if you have a full-time
              developer and a strong reason to avoid apps.
            </p>

            <h3 style={styles.h3}>Option 3: A dedicated tiered pricing app</h3>
            <p>
              A purpose-built app handles the rule engine, the product-page
              display, the cart and checkout integration, and the edge cases
              (multi-currency, customer tags, collection scoping) so you don't
              have to.
            </p>
            <p>
              What works: under 10 minutes to first rule live, no code, no theme
              edits, automatic checkout integration.
            </p>
            <p>
              What breaks: you're trusting a third-party developer to keep the
              integration working. Pick an app that's actively maintained and has
              responsive support.
            </p>
            <p>
              <strong>Verdict:</strong> the right choice for the vast majority of
              stores.
            </p>
          </Section>

          <Section title="Step-by-step: your first tiered pricing rule">
            <p>
              Here's the workflow with Tiered Pricing. Adjust slightly for other
              apps; the shape is the same.
            </p>
            <ol style={styles.ol}>
              <li>
                <strong>Install the app from the Shopify App Store.</strong> Most
                apps have a free trial; some have a permanent free plan for
                low-volume stores.
              </li>
              <li>
                <strong>Pick the product or collection.</strong> Don't start with
                your whole catalog. Pick your top-selling SKU or a collection of
                bulk-friendly products (multipacks, supplements, B2B catalog
                items). One rule, one collection.
              </li>
              <li>
                <strong>Set the tiers.</strong> A simple starting structure:
                <ul style={styles.ul}>
                  <li>1–4 units: full price</li>
                  <li>5–9 units: 5% off</li>
                  <li>10–24 units: 10% off</li>
                  <li>25+ units: 15% off</li>
                </ul>
                Adjust the thresholds based on what your customers actually buy.
                If your average order is 3 units, your first tier should be at 5
                — close enough to feel reachable, far enough to lift the order.
              </li>
              <li>
                <strong>Choose where to display the tier table.</strong> On the
                product page, above or below the add-to-cart button. Above
                usually wins; test if you can.
              </li>
              <li>
                <strong>Save and preview.</strong> Open the product page in
                incognito. Add 5 to cart. Confirm the discount applies in cart
                and at checkout. Check the line-item math — this is the most
                common place merchants get tripped up.
              </li>
              <li>
                <strong>Roll out gradually.</strong> Run the rule on one product
                for a week, watch AOV and conversion rate, then expand. Resist the
                urge to put tier tables on every SKU at once — you want to see
                what works before you scale it.
              </li>
            </ol>
          </Section>

          <Section title="Three real examples">
            <p>
              <strong>Supplements brand.</strong> 30-count bottle: $25. Adds
              tiers at 2 ($23), 4 ($20), 6 ($18). AOV lifts from $32 to $44 in
              30 days. Bulk customers self-select.
            </p>
            <p>
              <strong>Apparel multipack.</strong> 3-pack t-shirts: $36. Adds
              tiers at 6 ($66), 12 ($120). AOV lifts; return rate stays flat.
            </p>
            <p>
              <strong>B2B parts catalog.</strong> Per-SKU minimum order quantity
              of 10 with tiered breaks at 50 and 100. Replaces a separate B2B
              store and a manual quote process.
            </p>
          </Section>

          <Section title="Common mistakes">
            <ul style={styles.ul}>
              <li>
                <strong>Starting with the whole catalog.</strong> Tier rules
                interact with other discounts. Start small, expand once you've
                seen the data.
              </li>
              <li>
                <strong>Setting thresholds too high.</strong> If your average
                order is 3 and your first tier is at 25, no one hits it. The
                first tier should feel just slightly out of reach.
              </li>
              <li>
                <strong>Hiding the tier table.</strong> If customers can't see
                the deal on the product page, you're not getting most of the AOV
                lift.
              </li>
              <li>
                <strong>Ignoring multi-currency.</strong> If you sell
                internationally, confirm the tier prices convert correctly. This
                is where DIY code most often breaks.
              </li>
            </ul>
          </Section>

          <Section title="FAQ">
            <p>
              <strong>Will tiered pricing work with my discount codes?</strong>{" "}
              Depends on the app. Most modern apps integrate with Shopify's native
              discount engine so codes still work; some override it. Check before
              you install.
            </p>
            <p>
              <strong>Does this work with Shopify Markets?</strong> Same answer
              — check. The good apps handle currency conversion automatically.
            </p>
            <p>
              <strong>Will this slow down my site?</strong> A well-built app adds
              under 100ms to product page load. A badly-built one can add a
              second. Look at the app's reviews for performance complaints.
            </p>
            <p>
              <strong>
                Can I show different tiers to different customers?
              </strong>{" "}
              Yes — most apps support customer-tag-based rules so you can show
              wholesale tiers only to tagged customers.
            </p>
          </Section>

          <div style={styles.closing}>
            <p>
              That's the playbook. Tiered pricing is one of the
              highest-leverage AOV moves you can make on Shopify, and you don't
              need code or a separate B2B store to do it.
            </p>
          </div>

          {/* CTA */}
          <div style={styles.cta}>
            <p style={styles.ctaText}>
              Skip the setup tax — get your first live tier rule in under five
              minutes. Free trial, no credit card.
            </p>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.ctaButton}
            >
              Install Tiered Pricing on the Shopify App Store →
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

  intro: {
    fontSize: "1rem",
    lineHeight: 1.75,
    color: "#444",
    marginBottom: "1rem",
    padding: "0",
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

  h3: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "1.5rem 0 0.5rem",
  } as React.CSSProperties,

  sectionBody: {
    fontSize: "0.95rem",
    lineHeight: 1.75,
    color: "#444",
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
