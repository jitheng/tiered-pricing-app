import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>Shopify App</div>
          <h1 className={styles.heroHeading}>
            Tiered Pricing
          </h1>
          <p className={styles.heroSubtitle}>
            Sell more with smart quantity breaks, customer tag pricing, and
            spend-based discounts — applied automatically at checkout. No
            discount codes required.
          </p>

          {showForm ? (
            <Form className={styles.loginForm} method="post" action="/auth/login">
              <label className={styles.loginLabel}>
                <span>Shop domain</span>
                <input
                  className={styles.loginInput}
                  type="text"
                  name="shop"
                  placeholder="my-shop-domain.myshopify.com"
                />
              </label>
              <button className={styles.ctaButton} type="submit">
                Install App
              </button>
            </Form>
          ) : (
            <a
              className={styles.ctaButton}
              href="https://apps.shopify.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started on Shopify →
            </a>
          )}
        </div>
      </header>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.sectionHeading}>Everything you need to reward your customers</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📦</div>
            <h3 className={styles.featureTitle}>Quantity Breaks</h3>
            <p className={styles.featureText}>
              Buy 3, save 10%. Buy 10, save 20%. Set quantity tiers that reward
              bulk purchases and drive higher order values — automatically.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🏷️</div>
            <h3 className={styles.featureTitle}>Customer Tag Pricing</h3>
            <p className={styles.featureText}>
              Offer exclusive rates to VIP, wholesale, or loyalty customers
              using Shopify customer tags. Set it once, and discounts apply
              every time they shop.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>💰</div>
            <h3 className={styles.featureTitle}>Spend Threshold Discounts</h3>
            <p className={styles.featureText}>
              Encourage bigger baskets: automatically apply discounts when
              customers hit a spending target. Great for "Spend $100, save 15%"
              promotions.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionHeading}>Automatic discounts. Zero friction.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <p>Create a pricing rule in the app dashboard</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>2</span>
            <p>Set your discount tiers and conditions</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>3</span>
            <p>Discounts apply automatically at checkout — no codes needed</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Tiered Pricing</p>
        <Link to="/blogs" className={styles.footerLink}>
          Blog
        </Link>
        <Link to="/privacy" className={styles.footerLink}>
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
