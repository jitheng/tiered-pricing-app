import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Blog — Tiered Pricing for Shopify" },
  {
    name: "description",
    content:
      "Practical guides on tiered pricing, quantity breaks, volume discounts, and B2B pricing for Shopify merchants.",
  },
];

const posts = [
  {
    slug: "tiered-pricing-shopify-guide",
    title: "How to Set Up Tiered Pricing on Shopify (The Simple Way)",
    description:
      "Set up tiered pricing on your Shopify store in under 10 minutes. The complete 2026 guide — what it is, why it works, and the three ways to do it.",
    readingTime: "7 min read",
  },
  {
    slug: "tiered-pricing-vs-volume-discount",
    title: "Tiered Pricing vs Volume Discount: Which One Fits Your Store?",
    description:
      "Tiered pricing and volume discounts sound the same. They're not. Here's exactly when to use each — and the hybrid that beats both.",
    readingTime: "6 min read",
  },
  {
    slug: "b2b-pricing-shopify-without-separate-store",
    title: "B2B Pricing on Shopify Without a Separate Store",
    description:
      "You don't need Shopify Plus or a separate B2B store to run wholesale pricing. Here's the customer-tag approach that works on any plan.",
    readingTime: "7 min read",
  },
  {
    slug: "quantity-breaks-shopify-guide",
    title: "How to Set Up Quantity Breaks on Shopify (2026 Guide)",
    description:
      "Quantity breaks lift Shopify AOV by 10–20% with one rule per product. The 2026 guide — what they are, how to set them up, and the psychology that makes them work.",
    readingTime: "8 min read",
  },
];

export default function BlogIndex() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Back to Home</Link>
          <h1 style={styles.title}>Blog</h1>
          <p style={styles.subtitle}>
            Practical guides on tiered pricing, quantity breaks, and B2B
            pricing for Shopify merchants.
          </p>
        </div>

        {/* Post grid */}
        <div style={styles.grid}>
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blogs/${post.slug}`}
              style={styles.card}
            >
              <div style={styles.cardMeta}>{post.readingTime}</div>
              <h2 style={styles.cardTitle}>{post.title}</h2>
              <p style={styles.cardDescription}>{post.description}</p>
              <span style={styles.readMore}>Read article →</span>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <Link to="/" style={styles.backLink}>← Back to Home</Link>
          <p style={styles.footerText}>
            © {new Date().getFullYear()} Tiered Pricing
          </p>
        </div>
      </div>
    </div>
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
    maxWidth: "900px",
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

  title: {
    fontSize: "2.5rem",
    fontWeight: 800,
    margin: "0 0 0.75rem",
    color: "#1a1a2e",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "1.05rem",
    color: "#555",
    margin: 0,
    lineHeight: 1.6,
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
    gap: "1.5rem",
    marginBottom: "3rem",
  } as React.CSSProperties,

  card: {
    display: "block",
    background: "#fff",
    border: "1px solid #e8e5f0",
    borderRadius: "12px",
    padding: "1.75rem 2rem",
    textDecoration: "none",
    color: "inherit",
    transition: "box-shadow 0.2s, transform 0.2s",
    cursor: "pointer",
  } as React.CSSProperties,

  cardMeta: {
    fontSize: "0.8rem",
    color: "#4f46e5",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "0.75rem",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: "1.15rem",
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 0.75rem",
    lineHeight: 1.4,
  } as React.CSSProperties,

  cardDescription: {
    fontSize: "0.9rem",
    color: "#555",
    lineHeight: 1.65,
    margin: "0 0 1.25rem",
  } as React.CSSProperties,

  readMore: {
    fontSize: "0.9rem",
    color: "#4f46e5",
    fontWeight: 600,
  } as React.CSSProperties,

  footer: {
    marginTop: "2rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
  } as React.CSSProperties,

  footerText: {
    fontSize: "0.85rem",
    color: "#999",
    margin: 0,
  } as React.CSSProperties,
};
