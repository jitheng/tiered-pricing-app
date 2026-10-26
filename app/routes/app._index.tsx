import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
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
import { parseIds } from "../parseIds";
import {
  deleteShopifyDiscountsForRule,
  reconcileOrphanedDiscounts,
  resyncRule,
  toggleShopifyDiscountsForRule,
} from "../models/shopifyDiscount.server";

// ─── Types ──────────────────────────────────────────────────────────────────

type LoaderData = {
  rules: Awaited<ReturnType<typeof getTierRules>>;
};

type ActionData = { ok: boolean; errors?: string[]; message?: string } | null;

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
      const isActive = formData.get("isActive") === "true"; // desired new state

      // Activate/deactivate the existing Shopify discount nodes instead of
      // deleting + recreating them. This keeps each level's shopifyDiscountId,
      // so the toggle is reversible and — critically — never leaves a live,
      // still-applying discount orphaned in Shopify after a failed delete.
      // Levels with no GID (an unsynced / FAILED level) are skipped here and
      // recovered via the "Retry sync" action. toggleShopifyDiscountsForRule
      // reports any Shopify userErrors so we can surface them below.
      const { success, errors } = await toggleShopifyDiscountsForRule(
        admin,
        id,
        isActive,
      );
      await toggleTierRule(id, session.shop, isActive);
      if (!success) {
        return json<ActionData>({ ok: false, errors });
      }
      break;
    }
    case "resync": {
      // Re-create all Shopify discounts for the rule and refresh sync status.
      const result = await resyncRule(admin, id, session.shop);
      if (!result.success) {
        return json<ActionData>({ ok: false, errors: result.errors });
      }
      break;
    }
    case "delete": {
      try {
        await deleteShopifyDiscountsForRule(admin, id);
        await deleteTierRule(id, session.shop);
        // Safety net: if the delete above silently failed, the discount node is
        // now untracked (its rule row is gone) — reconciliation deactivates it so
        // it can't keep applying at checkout.
        await reconcileOrphanedDiscounts(admin, session.shop);
      } catch (err) {
        return json<ActionData>({ ok: false, errors: [String(err)] });
      }
      return redirect("/app");
    }
    case "cleanup": {
      // Find [Tiered] discounts still live in Shopify with no backing rule and
      // deactivate them. Catches orphans created before verified deletes existed.
      const { deactivated, errors } = await reconcileOrphanedDiscounts(
        admin,
        session.shop,
      );
      if (errors.length > 0) {
        return json<ActionData>({ ok: false, errors });
      }
      return json<ActionData>({
        ok: true,
        message:
          deactivated > 0
            ? `Deactivated ${deactivated} orphaned discount${deactivated > 1 ? "s" : ""}.`
            : "No orphaned discounts found — everything is in sync.",
      });
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
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state !== "idle";

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rules);

  const handleToggle = (id: string, currentState: boolean) => {
    const form = new FormData();
    form.set("intent", "toggle");
    form.set("id", id);
    form.set("isActive", String(!currentState));
    submit(form, { method: "POST" });
  };

  const handleResync = (id: string) => {
    const form = new FormData();
    form.set("intent", "resync");
    form.set("id", id);
    submit(form, { method: "POST" });
  };

  const handleCleanup = () => {
    const form = new FormData();
    form.set("intent", "cleanup");
    submit(form, { method: "POST" });
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const idToDelete = deleteTargetId;
    setDeleteTargetId(null);
    const form = new FormData();
    form.set("intent", "delete");
    form.set("id", idToDelete);
    submit(form, { method: "POST" });
  };

  const rowMarkup = rules.map((rule, index) => {
    const productCount = parseIds(rule.productIds).length;
    const collectionCount = parseIds(rule.collectionIds).length;
    const failedCount = rule.levels.filter((l) => l.syncStatus === "FAILED").length;
    const needsSync = rule.isActive && failedCount > 0;
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
          <InlineStack gap="100">
            <Badge tone={rule.isActive ? "success" : undefined}>
              {rule.isActive ? "Active" : "Inactive"}
            </Badge>
            {needsSync && (
              <Tooltip content={`${failedCount} discount level${failedCount > 1 ? "s" : ""} failed to sync with Shopify. Click "Retry sync".`}>
                <Badge tone="critical">Sync failed</Badge>
              </Tooltip>
            )}
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="200">
            {needsSync && (
              <Button
                size="slim"
                tone="critical"
                variant="primary"
                onClick={() => handleResync(rule.id)}
              >
                Retry sync
              </Button>
            )}
            <Button
              size="slim"
              onClick={() => navigate(`/app/tiers/${rule.id}`)}
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
      action={{ content: "Create rule", onAction: () => navigate("/app/tiers/new") }}
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
        <button onClick={handleCleanup}>Clean up orphaned discounts</button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Shopify sync error Banner */}
        {actionData && !actionData.ok && (
          <Banner tone="critical" title="Shopify sync failed">
            <BlockStack gap="100">
              {(actionData.errors ?? []).map((e, i) => (
                <Text key={i} as="p">{e}</Text>
              ))}
            </BlockStack>
          </Banner>
        )}

        {/* Cleanup result Banner */}
        {actionData && actionData.ok && actionData.message && (
          <Banner tone="success" title={actionData.message} />
        )}

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

      <Modal
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title="Delete pricing rule"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmDelete,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setDeleteTargetId(null) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">Are you sure you want to delete this pricing rule? This cannot be undone.</Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
