import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  {
    title:
      "B2B Pricing on Shopify Without a Separate Store — Tiered Pricing App",
  },
  {
    name: "description",
    content:
      "You don't need Shopify Plus or a separate B2B store to run wholesale pricing. Here's the customer-tag approach that works on any plan.",
  },
  {
    name: "keywords",
    content:
      "B2B pricing Shopify, wholesale pricing Shopify, Shopify wholesale without separate store, customer tag pricing Shopify",
  },
];

const APP_STORE_URL = "https://apps.shopify.com/tiered-pricing-7";

export default function Blog3() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/blogs" style={styles.backLink}>← Back to Blog</Link>
          <div style={styles.readingTime}>7 min read</div>
          <h1 style={styles.title}>
            B2B Pricing on Shopify Without a Separate Store
          </h1>
        </div>

        {/* Article */}
        <div style={styles.content}>
          <p style={styles.introBox}>
            Most B2B advice for Shopify merchants goes the same way: "You'll
            need Shopify Plus and a separate B2B store." This is true if your B2B
            business is large and complex. For most merchants asking the question,
            it's overkill — and a customer-tag-based pricing setup on your
            existing store does the job at a fraction of the cost and complexity.
          </p>
          <p style={styles.bodyText}>
            This post is for the merchant who has a small but growing B2B side of
            the business, wants to serve wholesale customers without a separate
            site, and doesn't want to upgrade to Plus just to do it.
          </p>

          <Section title="The case for one store, not two">
            <p>
              A separate B2B store on Shopify Plus is a real product, and it's
              the right answer when:
            </p>
            <ul style={styles.ul}>
              <li>B2B revenue is over $1M/year</li>
              <li>
                You have a B2B-only catalog with substantially different SKUs
              </li>
              <li>
                Your B2B customers expect a dedicated portal (purchase orders,
                net-30 terms, multi-tenant logins)
              </li>
              <li>
                You're running a sales team that needs separate dashboards
              </li>
            </ul>
            <p>
              If none of those describe you, a separate store creates more
              problems than it solves. You're managing two product catalogs, two
              inventory pools, two analytics dashboards, two support queues, and
              two domains — for a customer base that's likely a fraction of your
              DTC revenue.
            </p>
            <p>
              The customer-tag approach lets you run wholesale on the same store,
              the same products, and the same checkout — with tier prices that
              only show up for tagged customers.
            </p>
          </Section>

          <Section title="What Shopify Plus B2B costs">
            <p>
              Plus starts at around $2,300/month, and the B2B feature set is
              included at that level. If you're already on Plus, separate-store
              B2B is free in software cost — but the operational complexity
              (managing two stores) is real.
            </p>
            <p>
              If you're on Basic, Shopify, or Advanced, upgrading to Plus{" "}
              <em>just</em> for B2B is rarely worth it under ~$500K in projected
              B2B revenue. The math doesn't work.
            </p>
            <p>
              The customer-tag approach on a non-Plus plan costs whatever your
              tiered pricing app costs — typically $10–50/month — and works on
              any Shopify plan.
            </p>
          </Section>

          <Section title="How customer-tag pricing works">
            <p>
              The mechanics are simple. Customer accounts in Shopify can have
              tags (e.g., <code>wholesale</code>, <code>vip</code>,{" "}
              <code>distributor</code>). A tiered-pricing app can scope rules to
              specific tags, so:
            </p>
            <ul style={styles.ul}>
              <li>Untagged customers see retail price</li>
              <li>
                Customers with the <code>wholesale</code> tag see wholesale tier
                prices
              </li>
              <li>
                Customers with the <code>distributor</code> tag see distributor
                tier prices
              </li>
            </ul>
            <p>
              The tag is invisible to the customer. They sign in, the tier table
              they see reflects their tag, the cart and checkout apply the right
              discount automatically.
            </p>
          </Section>

          <Section title="Step-by-step setup">
            <ol style={styles.ol}>
              <li>
                <strong>Define your tags.</strong> Don't over-engineer. Start
                with one tag — <code>wholesale</code> — and add more only when
                you have customers who actually need different tiers.
              </li>
              <li>
                <strong>Tag your existing wholesale customers.</strong> Customers
                → select customer → Tags → add <code>wholesale</code>. Bulk-tag
                with a CSV import if you have many.
              </li>
              <li>
                <strong>Set up the tagged tier rule.</strong> In your tiered
                pricing app, create a rule scoped to the <code>wholesale</code>{" "}
                tag with the tier table you want — typically:
                <ul style={styles.ul}>
                  <li>10–49 units: 25% off retail</li>
                  <li>50–99 units: 35% off retail</li>
                  <li>100+ units: 45% off retail</li>
                </ul>
                Adjust to your margins and category norms.
              </li>
              <li>
                <strong>Test with a real tagged account.</strong> Create a test
                customer, tag them, log in, confirm the tier table appears on the
                product page and the discount applies at checkout.
              </li>
              <li>
                <strong>Onboard new wholesale customers.</strong> Two paths: (a)
                wholesale application form on your site → manual tag review and
                approval, or (b) immediate access via a hidden URL and self-serve
                tagging based on form fields.
              </li>
            </ol>
          </Section>

          <Section title="Hiding wholesale prices from DTC customers">
            <p>
              Default behavior: untagged visitors see retail pricing. The tier
              table only renders when the customer is logged in <em>and</em> has
              the right tag.
            </p>
            <p>
              For extra concealment, some merchants gate the wholesale catalog
              behind a password-protected page or only link to
              wholesale-eligible products from a hidden URL. Both work; both are
              slightly more setup.
            </p>
            <p>
              You can also hide specific products entirely from non-wholesale
              customers using Shopify's product visibility rules combined with
              tag-scoping in your theme.
            </p>
          </Section>

          <Section title="Tax, shipping, and payment differences">
            <p>
              This is where customer-tag pricing has real limits compared to a
              full Plus B2B store.
            </p>
            <p>
              <strong>Tax.</strong> Wholesale customers in many regions are
              tax-exempt with a resale certificate. On Shopify, you mark a
              customer as tax-exempt in their customer record — same store, no
              separate setup needed.
            </p>
            <p>
              <strong>Shipping.</strong> Wholesale orders are heavier and ship
              differently. Use shipping profiles to route based on customer tag
              or order weight. Works on all plans.
            </p>
            <p>
              <strong>Payment terms.</strong> This is the big gap. Native Shopify
              checkout doesn't support net-30 or PO-based payment. You can take
              wholesale payment at checkout (card, ACH) or invoice manually
              outside the store. If you need invoice-on-account at scale, this is
              where you eventually outgrow the customer-tag approach.
            </p>
          </Section>

          <Section title="When you actually do need a separate store">
            <p>Move to a separate Plus B2B store when:</p>
            <ul style={styles.ul}>
              <li>B2B revenue crosses $1M/year and grows over 50% annually</li>
              <li>
                You're losing deals because you can't offer net-30 in-checkout
              </li>
              <li>You need separate inventory pools for B2B vs DTC</li>
              <li>
                You have a sales team that needs dashboards separate from your
                DTC ops
              </li>
            </ul>
            <p>Until then, the same store works fine.</p>
          </Section>

          <Section title="Common mistakes">
            <ul style={styles.ul}>
              <li>
                <strong>Over-segmenting tags too early.</strong> One tag, one
                tier set. Add more only when you have customers who genuinely
                need them.
              </li>
              <li>
                <strong>Forgetting to test as a tagged customer.</strong> Always
                log in as a real tagged account before going live. Most setup
                bugs are discovered this way.
              </li>
              <li>
                <strong>
                  Not handling the customer registration flow.
                </strong>{" "}
                A wholesale customer should sign up, get an immediate "we're
                reviewing your application" message, and a clear path to
                approval. Manual review is fine; silence is not.
              </li>
              <li>
                <strong>Hardcoding wholesale prices in product titles.</strong>{" "}
                Don't put "Wholesale: $X" in the product name. Use the app's
                tagged pricing and let the customer see their price.
              </li>
            </ul>
          </Section>

          <Section title="FAQ">
            <p>
              <strong>Can I do this on the Basic Shopify plan?</strong> Yes.
              Customer tags are available on every plan.
            </p>
            <p>
              <strong>
                What if my wholesale catalog overlaps with my DTC catalog?
              </strong>{" "}
              That's actually the <em>easier</em> case — same products, different
              prices by tag. The customer-tag approach is built for this.
            </p>
            <p>
              <strong>
                What about quoting and PO-based ordering?
              </strong>{" "}
              Not natively. You can take card or ACH at checkout, or invoice
              manually. If you need full quote-to-cash workflows, you'll
              eventually want a separate Plus store or a B2B-specific platform.
            </p>
            <p>
              <strong>Will Google index my wholesale prices?</strong> No — they
              only render for logged-in tagged customers. Public crawlers see the
              retail price.
            </p>
          </Section>

          {/* CTA */}
          <div style={styles.cta}>
            <p style={styles.ctaText}>
              Tiered Pricing supports customer-tag-based pricing on all Shopify
              plans. Set up your wholesale tier table in under 10 minutes — no
              Plus upgrade, no separate store. Free trial.
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
