import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import {
  BlockStack,
  Banner,
  Card,
  EmptyState,
  IndexTable,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getTierAnalytics } from "../models/analytics.server";

const ALLOWED_DAYS = [7, 30, 90] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const requested = parseInt(url.searchParams.get("days") ?? "30", 10);
  const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 30;

  const analytics = await getTierAnalytics(admin, days);
  return json({ analytics });
};

export default function Analytics() {
  const { analytics } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: analytics.currencyCode || "USD",
      }).format(amount);
    } catch {
      return `${analytics.currencyCode} ${amount.toFixed(2)}`;
    }
  };

  const avg =
    analytics.ordersWithDiscount > 0
      ? analytics.totalDiscount / analytics.ordersWithDiscount
      : 0;

  const rows = analytics.rows.map((row, index) => (
    <IndexTable.Row id={row.title} key={row.title} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="bold">
          {row.title.replace(/^\[Tiered\]\s*/, "")}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{row.orders}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{money(row.discountAmount)}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const summaryCard = (label: string, value: string, help?: string) => (
    <Layout.Section variant="oneThird">
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm" tone="subdued">{label}</Text>
          <Text as="p" variant="heading2xl">{value}</Text>
          {help && <Text as="p" variant="bodySm" tone="subdued">{help}</Text>}
        </BlockStack>
      </Card>
    </Layout.Section>
  );

  // read_orders is newly added — if the merchant hasn't re-approved yet, the
  // orders query fails. Surface a clear re-authorize hint.
  const needsReauth =
    !!analytics.error && /access|scope|permission|unauthorized|403/i.test(analytics.error);

  return (
    <Page
      backAction={{ content: "Pricing Rules", url: "/app" }}
      title="Analytics"
    >
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        {analytics.error && (
          <Banner tone={needsReauth ? "warning" : "critical"} title={needsReauth ? "Permission needed" : "Couldn't load analytics"}>
            <p>
              {needsReauth
                ? "This report needs the Orders permission. Close and reopen the app to approve the updated access, then try again."
                : analytics.error}
            </p>
          </Banner>
        )}

        {analytics.truncated && !analytics.error && (
          <Banner tone="info" title="Showing a sample">
            <p>There were more orders than we scan in one view, so totals are a lower bound for this period.</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Select
              label="Time period"
              labelInline
              options={ALLOWED_DAYS.map((d) => ({ label: `Last ${d} days`, value: String(d) }))}
              value={String(analytics.days)}
              onChange={(value) => navigate(`/app/analytics?days=${value}`)}
              disabled={isLoading}
            />
          </BlockStack>
        </Card>

        <Layout>
          {summaryCard("Orders with a tiered discount", String(analytics.ordersWithDiscount))}
          {summaryCard("Total discount given", money(analytics.totalDiscount), "Revenue impact across all tiered rules")}
          {summaryCard("Avg discount / order", money(avg))}
        </Layout>

        <Card padding="0">
          {analytics.rows.length === 0 ? (
            <EmptyState
              heading="No tiered-discount orders yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Once customers place orders that use your tiered pricing rules,
                usage and revenue impact will appear here.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "tier", plural: "tiers" }}
              itemCount={analytics.rows.length}
              selectable={false}
              headings={[
                { title: "Rule / tier" },
                { title: "Orders" },
                { title: "Discount given" },
              ]}
              loading={isLoading}
            >
              {rows}
            </IndexTable>
          )}
        </Card>

        <Text as="p" variant="bodySm" tone="subdued">
          Based on orders from the selected period. Order-level fixed-amount
          discounts may be under-counted.
        </Text>
      </BlockStack>
    </Page>
  );
}
