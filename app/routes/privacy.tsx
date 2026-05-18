import { Link } from "@remix-run/react";

const LAST_UPDATED = "March 10, 2026";
const APP_NAME = "Tiered Pricing";
const CONTACT_EMAIL = "support@tiered-pricing-app.com";
const APP_URL = "https://tieredpricingapp.online";

export default function Privacy() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Back to Home</Link>
          <h1 style={styles.title}>Privacy Policy</h1>
          <p style={styles.meta}>
            <strong>{APP_NAME}</strong> · Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div style={styles.content}>
          <p style={styles.intro}>
            This Privacy Policy explains how {APP_NAME} ("we", "us", or "our")
            collects, uses, and handles information when you install and use our
            Shopify app. We are committed to protecting the privacy of merchants
            and their customers in compliance with applicable privacy laws,
            including GDPR and CCPA.
          </p>

          <Section title="1. Information We Collect">
            <p>
              When you install and use {APP_NAME}, we collect only the minimum
              data necessary to provide our service:
            </p>
            <ul>
              <li>
                <strong>Shop domain</strong> — Your Shopify store's{" "}
                <code>.myshopify.com</code> domain, used to identify your store
                in our system.
              </li>
              <li>
                <strong>OAuth access token</strong> — A Shopify-issued access
                token that allows the app to create and manage automatic
                discounts on your behalf via the Shopify Admin API.
              </li>
              <li>
                <strong>Pricing rule configurations</strong> — The discount
                rules, tiers, and settings you create within the app (e.g.,
                quantity break thresholds, customer tag conditions, spend
                targets). This is merchant-created configuration data, not
                personal data.
              </li>
            </ul>
            <p>
              <strong>We do not collect personal data about your customers.</strong>{" "}
              We do not access, store, or process customer names, email
              addresses, payment details, or any other personally identifiable
              information about your shoppers.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect solely to:</p>
            <ul>
              <li>
                Create, update, activate, deactivate, and delete automatic
                Shopify discounts on your store as configured by you.
              </li>
              <li>
                Authenticate your store and maintain a secure session between
                the app and Shopify.
              </li>
              <li>
                Provide and improve the core functionality of {APP_NAME}.
              </li>
            </ul>
            <p>
              We do not sell, rent, or share your data with third parties for
              marketing purposes. We do not use your data for any purpose other
              than operating the app.
            </p>
          </Section>

          <Section title="3. Data Storage and Retention">
            <p>
              Your pricing rule configurations and session data are stored in a
              PostgreSQL database hosted on{" "}
              <strong>Neon (neon.tech)</strong>, a serverless database provider
              located in the United States.
            </p>
            <p>Data retention:</p>
            <ul>
              <li>
                <strong>On app uninstall:</strong> We immediately delete all
                your store's data — pricing rules, settings, and sessions — when
                we receive the <code>app/uninstalled</code> webhook from
                Shopify.
              </li>
              <li>
                <strong>48 hours after uninstall:</strong> Shopify sends a{" "}
                <code>shop/redact</code> webhook requesting final deletion of all
                remaining shop data. We process this request and permanently
                delete any remaining records associated with your store.
              </li>
              <li>
                <strong>During active use:</strong> Data is retained as long as
                the app is installed on your store.
              </li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p>
              {APP_NAME} relies on the following third-party services to
              operate:
            </p>
            <ul>
              <li>
                <strong>Shopify</strong> — The platform through which the app is
                distributed and on which discounts are created. Shopify's own
                Privacy Policy applies to data processed through their platform.
              </li>
              <li>
                <strong>Neon (neon.tech)</strong> — Serverless PostgreSQL
                database provider where app configuration data is stored.
              </li>
              <li>
                <strong>Vercel</strong> — Cloud hosting provider where the app
                is deployed and served.
              </li>
            </ul>
            <p>
              These providers are contractually obligated to protect your data
              and comply with applicable privacy regulations.
            </p>
          </Section>

          <Section title="5. GDPR and CCPA Compliance">
            <p>
              We have implemented Shopify's mandatory compliance webhooks to
              support your obligations under GDPR, CCPA, and similar privacy
              laws:
            </p>
            <ul>
              <li>
                <strong>customers/data_request</strong> — We respond to requests
                to view stored customer data. Since we store no customer personal
                data, there is nothing to report.
              </li>
              <li>
                <strong>customers/redact</strong> — We respond to customer
                deletion requests. Since we store no customer personal data,
                there is no data to redact.
              </li>
              <li>
                <strong>shop/redact</strong> — We permanently delete all
                merchant data upon receiving this webhook, 48 hours after
                uninstall.
              </li>
            </ul>
            <p>
              As a merchant using {APP_NAME}, you have the right to:
            </p>
            <ul>
              <li>Request access to the data we hold about your store.</li>
              <li>Request correction of inaccurate data.</li>
              <li>
                Request deletion of your data (uninstalling the app will
                trigger automatic deletion).
              </li>
            </ul>
          </Section>

          <Section title="6. Data Security">
            <p>
              We take reasonable technical and organizational measures to protect
              your data, including:
            </p>
            <ul>
              <li>HTTPS encryption for all data in transit.</li>
              <li>
                Database connections secured with SSL (
                <code>sslmode=require</code>).
              </li>
              <li>
                Access tokens stored securely and scoped to only the Shopify
                permissions required by the app.
              </li>
            </ul>
          </Section>

          <Section title="7. Contact Us">
            <p>
              If you have any questions about this Privacy Policy or wish to
              exercise your privacy rights, please contact us:
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={styles.link}>
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              <strong>App URL:</strong>{" "}
              <a href={APP_URL} style={styles.link}>
                {APP_URL}
              </a>
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will
              notify merchants of significant changes by updating the "Last
              updated" date at the top of this page. Continued use of the app
              after changes constitutes acceptance of the updated policy.
            </p>
          </Section>
        </div>

        <div style={styles.footer}>
          <Link to="/" style={styles.backLink}>← Back to Home</Link>
          <p style={styles.footerText}>
            © {new Date().getFullYear()} {APP_NAME}
          </p>
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

  title: {
    fontSize: "2rem",
    fontWeight: 800,
    margin: "0 0 0.5rem",
    color: "#1a1a2e",
  } as React.CSSProperties,

  meta: {
    fontSize: "0.9rem",
    color: "#666",
    margin: 0,
  } as React.CSSProperties,

  intro: {
    fontSize: "1rem",
    lineHeight: 1.75,
    color: "#444",
    marginBottom: "2rem",
    padding: "1.25rem 1.5rem",
    background: "#eef2ff",
    borderRadius: "8px",
    borderLeft: "4px solid #4f46e5",
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
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#1a1a2e",
    margin: "0 0 1rem",
  } as React.CSSProperties,

  sectionBody: {
    fontSize: "0.95rem",
    lineHeight: 1.75,
    color: "#444",
  } as React.CSSProperties,

  link: {
    color: "#4f46e5",
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

  footerText: {
    fontSize: "0.85rem",
    color: "#999",
    margin: 0,
  } as React.CSSProperties,
};
