import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  Text,
  Tooltip,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  deleteTierRule,
  getTierRules,
  toggleTierRule,
} from "../models/tierRule.server";
import {
  deleteShopifyDiscountsForRule,
  toggleShopifyDiscountsForRule,
} from "../models/shopifyDiscount.server";

// Helper to parse JSON arrays stored as strings in SQLite
function parseIds(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type LoaderData = {
  rules: Awaited<ReturnType<typeof getTierRules>>;
};

// ─── Loader ─────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await getTierRules(session.shop);
  return json<LoaderData>({ rules });
};

// ─── Action ─────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const id = formData.get("id") as string;

  switch (intent) {
    case "toggle": {
      const isActive = formData.get("isActive") === "true";
      // Toggle in DB
      await toggleTierRule(id, session.shop, isActive);
      // Toggle on Shopify (activate = !isActive because isActive is the OLD state)
      await toggleShopifyDiscountsForRule(admin, id, !isActive);
      break;
    }
    case "delete": {
      // Delete Shopify discounts first (needs level GIDs from DB before deletion)
      await deleteShopifyDiscountsForRule(admin, id);
      // Then delete from DB (cascades to TierLevel)
      await deleteTierRule(id, session.shop);
      break;
    }
  }

  return json({ ok: true });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  QUANTITY: "Quantity Break",
  CUSTOMER_TAG: "Customer Tag",
  SPEND: "Spend Threshold",
};

const TYPE_BADGE: Record<string, "info" | "success" | "warning"> = {
  QUANTITY: "info",
  CUSTOMER_TAG: "success",
  SPEND: "warning",
};

function formatLevelSummary(
  levels: { minValue: number; maxValue: number | null; discount: number; type: string; tagValue: string | null }[],
  ruleType: string,
) {
  if (levels.length === 0) return "No levels defined";
  const first = levels[0];
  const last = levels[levels.length - 1];

  if (ruleType === "CUSTOMER_TAG") {
    const tags = levels
      .map((l) => l.tagValue)
      .filter(Boolean)
      .join(", ");
    return `Tags: ${tags}`;
  }

  const unit = ruleType === "SPEND" ? "$" : "qty";
  const discountStr =
    last.type === "PERCENTAGE" ? `${last.discount}%` : `$${last.discount}`;

  return `${unit} ${first.minValue}+ → up to ${discountStr} off`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { rules } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state !== "idle";

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rules);

  const handleToggle = (id: string, currentState: boolean) => {
    const form = new FormData();
    form.set("intent", "toggle");
    form.set("id", id);
    form.set("isActive", String(!currentState));
    submit(form, { method: "POST" });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this pricing rule? This cannot be undone.")) return;
    const form = new FormData();
    form.set("intent", "delete");
    form.set("id", id);
    submit(form, { method: "POST" });
  };

  const rowMarkup = rules.map((rule, index) => {
    const productCount = parseIds(rule.productIds).length;
    const collectionCount = parseIds(rule.collectionIds).length;
    const scopeLabel =
      productCount + collectionCount === 0
        ? "All products"
        : [
            productCount ? `${productCount} product${productCount > 1 ? "s" : ""}` : "",
            collectionCount ? `${collectionCount} collection${collectionCount > 1 ? "s" : ""}` : "",
          ]
            .filter(Boolean)
            .join(", ");

    return (
      <IndexTable.Row
        id={rule.id}
        key={rule.id}
        selected={selectedResources.includes(rule.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {rule.name}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={TYPE_BADGE[rule.type] ?? "info"}>
            {TYPE_LABELS[rule.type] ?? rule.type}
          </Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {rule.levels.length} level{rule.levels.length !== 1 ? "s" : ""}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Tooltip content={formatLevelSummary(rule.levels, rule.type)}>
            <Text as="span" variant="bodyMd" tone="subdued">
              {scopeLabel}
            </Text>
          </Tooltip>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={rule.isActive ? "success" : undefined}>
            {rule.isActive ? "Active" : "Inactive"}
          </Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              url={`/app/tiers/${rule.id}`}
              size="slim"
            >
              Edit
            </Button>
            <Button
              size="slim"
              tone={rule.isActive ? "critical" : undefined}
              onClick={() => handleToggle(rule.id, rule.isActive)}
            >
              {rule.isActive ? "Disable" : "Enable"}
            </Button>
            <Button
              size="slim"
              tone="critical"
              onClick={() => handleDelete(rule.id)}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyState = (
    <EmptyState
      heading="Set up your first tiered pricing rule"
      action={{ content: "Create rule", url: "/app/tiers/new" }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Create quantity breaks, customer-tag-based pricing, or spend thresholds
        to automatically discount products for your customers.
      </p>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="Tiered Pricing">
        <button variant="primary" onClick={() => navigate("/app/tiers/new")}>
          Create rule
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Summary Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Total Rules
                </Text>
                <Text as="p" variant="heading2xl">
                  {rules.length}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Active Rules
                </Text>
                <Text as="p" variant="heading2xl">
                  {rules.filter((r) => r.isActive).length}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Tier Types
                </Text>
                <InlineStack gap="200">
                  {Object.keys(TYPE_LABELS).map((type) => {
                    const count = rules.filter((r) => r.type === type).length;
                    return count > 0 ? (
                      <Badge key={type} tone={TYPE_BADGE[type]}>
                        {count} {TYPE_LABELS[type]}
                      </Badge>
                    ) : null;
                  })}
                  {rules.length === 0 && (
                    <Text as="span" tone="subdued" variant="bodyMd">
                      None yet
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Rules Table */}
        <Card padding="0">
          {rules.length === 0 ? (
            emptyState
          ) : (
            <IndexTable
              resourceName={{ singular: "rule", plural: "rules" }}
              itemCount={rules.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Name" },
                { title: "Type" },
                { title: "Levels" },
                { title: "Applies to" },
                { title: "Status" },
                { title: "Actions" },
              ]}
              loading={isLoading}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
