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
  createTierRule,
  deleteTierRule,
  getTierRules,
  toggleTierRule,
  type TierType,
  type TierLevelInput,
} from "../models/tierRule.server";
import { parseIds } from "../parseIds";
import {
  createShopifyDiscountsForRule,
  deleteShopifyDiscountsForRule,
  reconcileOrphanedDiscounts,
  resyncRule,
  saveDiscountIdsToLevels,
  toggleShopifyDiscountsForRule,
} from "../models/shopifyDiscount.server";

// ─── Types ──────────────────────────────────────────────────────────────────

type LoaderData = {
  rules: Awaited<ReturnType<typeof getTierRules>>;
  timeZone: string;
};

// Render dashboard timestamps in the store's configured timezone (matching the
// rest of Shopify admin), not the viewer's device timezone.
const SHOP_TIMEZONE_QUERY = `#graphql
  query ShopTimezone {
    shop { ianaTimezone }
  }
`;

type ActionData = { ok: boolean; errors?: string[]; message?: string } | null;

// ─── Loader ─────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const rules = await getTierRules(session.shop);

  // Resolve the store's timezone for displaying timestamps; fall back to UTC.
  let timeZone = "UTC";
  try {
    const res = await admin.graphql(SHOP_TIMEZONE_QUERY);
    const body = (await res.json()) as { data?: { shop?: { ianaTimezone?: string } } };
    timeZone = body.data?.shop?.ianaTimezone || "UTC";
  } catch {
    // keep UTC
  }

  return json<LoaderData>({ rules, timeZone });
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
    case "bulk_toggle": {
      // Enable/disable several rules at once — same per-rule logic as "toggle",
      // run for each selected id. Shopify userErrors are aggregated.
      const ids = parseIds((formData.get("ids") as string) ?? "[]");
      const isActive = formData.get("isActive") === "true";
      const errors: string[] = [];
      for (const ruleId of ids) {
        const { success, errors: ruleErrors } =
          await toggleShopifyDiscountsForRule(admin, ruleId, isActive);
        await toggleTierRule(ruleId, session.shop, isActive);
        if (!success) errors.push(...ruleErrors);
      }
      if (errors.length > 0) {
        return json<ActionData>({ ok: false, errors });
      }
      break;
    }
    case "bulk_delete": {
      // Delete several rules at once, then run a single reconciliation sweep so a
      // silently-failed delete among them can't leave a live, untracked discount.
      const ids = parseIds((formData.get("ids") as string) ?? "[]");
      try {
        for (const ruleId of ids) {
          await deleteShopifyDiscountsForRule(admin, ruleId);
          await deleteTierRule(ruleId, session.shop);
        }
        await reconcileOrphanedDiscounts(admin, session.shop);
      } catch (err) {
        return json<ActionData>({ ok: false, errors: [String(err)] });
      }
      return redirect("/app");
    }
    case "import": {
      // Restore rules from a previously-exported JSON file. Each entry becomes a
      // NEW rule (existing rules are never modified). Malformed entries are
      // skipped with a per-rule error rather than failing the whole import.
      const raw = (formData.get("data") as string) ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return json<ActionData>({ ok: false, errors: ["Invalid JSON — could not parse the file."] });
      }

      const incoming = Array.isArray(parsed)
        ? parsed
        : (parsed as { rules?: unknown })?.rules;
      if (!Array.isArray(incoming)) {
        return json<ActionData>({
          ok: false,
          errors: ["Expected an array of rules, or an object like { \"rules\": [...] }."],
        });
      }

      const VALID_TYPES = ["QUANTITY", "CUSTOMER_TAG", "SPEND"];
      let imported = 0;
      const errors: string[] = [];

      for (const [i, entry] of incoming.entries()) {
        try {
          const r = entry as Record<string, unknown>;
          const name = typeof r.name === "string" ? r.name.trim() : "";
          if (!name) throw new Error("missing name");
          if (typeof r.type !== "string" || !VALID_TYPES.includes(r.type))
            throw new Error(`invalid type "${String(r.type)}"`);
          if (!Array.isArray(r.levels) || r.levels.length === 0)
            throw new Error("no pricing levels");

          const levels: TierLevelInput[] = (r.levels as Record<string, unknown>[]).map(
            (l, idx) => ({
              minValue: Number(l.minValue) || 0,
              maxValue: l.maxValue == null ? null : Number(l.maxValue),
              tagValue: typeof l.tagValue === "string" ? l.tagValue : null,
              discount: Number(l.discount) || 0,
              type: l.type === "FIXED" ? "FIXED" : "PERCENTAGE",
              label: typeof l.label === "string" ? l.label : null,
              sortOrder: typeof l.sortOrder === "number" ? l.sortOrder : idx,
            }),
          );

          const productIds = Array.isArray(r.productIds) ? (r.productIds as string[]) : [];
          const collectionIds = Array.isArray(r.collectionIds) ? (r.collectionIds as string[]) : [];
          const isActive = r.isActive !== false; // default to active
          const startsAt = typeof r.startsAt === "string" ? r.startsAt : null;
          const endsAt = typeof r.endsAt === "string" ? r.endsAt : null;

          const rule = await createTierRule(session.shop, {
            name,
            type: r.type as TierType,
            productIds,
            collectionIds,
            isActive,
            startsAt,
            endsAt,
            levels,
          });

          const discountResults = await createShopifyDiscountsForRule(
            admin, rule.id, rule.name, rule.type as TierType, productIds, collectionIds, levels, startsAt, endsAt,
          );
          await saveDiscountIdsToLevels(rule.id, discountResults);

          // Keep Shopify consistent with an imported-as-inactive rule.
          if (!isActive) {
            await toggleShopifyDiscountsForRule(admin, rule.id, false);
          }

          imported++;
        } catch (err) {
          errors.push(`Rule ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (imported === 0) {
        return json<ActionData>({
          ok: false,
          errors: errors.length > 0 ? errors : ["No rules found to import."],
        });
      }
      return json<ActionData>({
        ok: true,
        message:
          `Imported ${imported} rule${imported !== 1 ? "s" : ""}.` +
          (errors.length > 0 ? ` ${errors.length} skipped.` : ""),
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

// Dates arrive from the loader as ISO strings (JSON-serialised). They are
// rendered in the store's timezone (passed from the loader) so they match the
// rest of Shopify admin. An unknown timeZone would make Intl throw, so build
// options defensively and drop timeZone if it isn't valid.
function dateOptions(
  base: Intl.DateTimeFormatOptions,
  timeZone: string,
): Intl.DateTimeFormatOptions {
  try {
    // Throws a RangeError for an unsupported timeZone.
    new Intl.DateTimeFormat(undefined, { ...base, timeZone });
    return { ...base, timeZone };
  } catch {
    return base;
  }
}

// Cell text: date + time (no timezone label, to stay compact). The tooltip
// (formatDateTime) carries the timezone abbreviation.
function formatDateTimeShort(value: string | Date, timeZone: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(
    undefined,
    dateOptions(
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
      timeZone,
    ),
  );
}

function formatDateTime(value: string | Date, timeZone: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(
    undefined,
    dateOptions(
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      },
      timeZone,
    ),
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { rules, timeZone } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state !== "idle";

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(rules);

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

  const handleExport = (ids?: string[]) => {
    // Export all rules, or only the given ids when a selection is passed. Builds
    // a clean, re-importable snapshot (no shop/db/sync fields) and downloads it
    // client-side as a JSON file.
    const source =
      ids && ids.length > 0 ? rules.filter((r) => ids.includes(r.id)) : rules;
    const exportData = source.map((r) => ({
      name: r.name,
      type: r.type,
      isActive: r.isActive,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      productIds: parseIds(r.productIds),
      collectionIds: parseIds(r.collectionIds),
      levels: r.levels.map((l) => ({
        minValue: l.minValue,
        maxValue: l.maxValue,
        tagValue: l.tagValue,
        discount: l.discount,
        type: l.type,
        label: l.label,
        sortOrder: l.sortOrder,
      })),
    }));
    const blob = new Blob(
      [JSON.stringify({ version: 1, rules: exportData }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const scope = ids && ids.length > 0 ? "selected" : "all";
    a.download = `tiered-pricing-rules-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSelected = () => {
    if (selectedResources.length === 0) return;
    handleExport([...selectedResources]);
    clearSelection();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importText.trim()) return;
    const form = new FormData();
    form.set("intent", "import");
    form.set("data", importText);
    submit(form, { method: "POST" });
    setImportOpen(false);
    setImportText("");
    setImportFileName("");
  };

  const handleBulkToggle = (isActive: boolean) => {
    if (selectedResources.length === 0) return;
    const form = new FormData();
    form.set("intent", "bulk_toggle");
    form.set("isActive", String(isActive));
    form.set("ids", JSON.stringify(selectedResources));
    submit(form, { method: "POST" });
    clearSelection();
  };

  const confirmBulkDelete = () => {
    const ids = [...selectedResources];
    setBulkDeleteOpen(false);
    if (ids.length === 0) return;
    const form = new FormData();
    form.set("intent", "bulk_delete");
    form.set("ids", JSON.stringify(ids));
    submit(form, { method: "POST" });
    clearSelection();
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
    const now = Date.now();
    const scheduled = rule.startsAt ? new Date(rule.startsAt).getTime() > now : false;
    const expired = rule.endsAt ? new Date(rule.endsAt).getTime() < now : false;
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
            {scheduled && (
              <Tooltip content={`Starts ${formatDateTime(rule.startsAt ?? "", timeZone)}`}>
                <Badge tone="info">Scheduled</Badge>
              </Tooltip>
            )}
            {expired && (
              <Tooltip content={`Ended ${formatDateTime(rule.endsAt ?? "", timeZone)}`}>
                <Badge tone="warning">Expired</Badge>
              </Tooltip>
            )}
            {needsSync && (
              <Tooltip content={`${failedCount} discount level${failedCount > 1 ? "s" : ""} failed to sync with Shopify. Click "Retry sync".`}>
                <Badge tone="critical">Sync failed</Badge>
              </Tooltip>
            )}
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Tooltip content={formatDateTime(rule.createdAt, timeZone)}>
            <Text as="span" variant="bodyMd" tone="subdued">
              {formatDateTimeShort(rule.createdAt, timeZone)}
            </Text>
          </Tooltip>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Tooltip content={formatDateTime(rule.updatedAt, timeZone)}>
            <Text as="span" variant="bodyMd" tone="subdued">
              {formatDateTimeShort(rule.updatedAt, timeZone)}
            </Text>
          </Tooltip>
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
        <button onClick={() => setImportOpen(true)}>Import</button>
        <button onClick={() => handleExport()} disabled={rules.length === 0}>
          Export all
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
              promotedBulkActions={[
                { content: "Enable", onAction: () => handleBulkToggle(true) },
                { content: "Disable", onAction: () => handleBulkToggle(false) },
              ]}
              bulkActions={[
                {
                  content: "Export selected",
                  onAction: handleExportSelected,
                },
                {
                  content: "Delete",
                  onAction: () => setBulkDeleteOpen(true),
                },
              ]}
              headings={[
                { title: "Name" },
                { title: "Type" },
                { title: "Levels" },
                { title: "Applies to" },
                { title: "Status" },
                { title: "Created" },
                { title: "Updated" },
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

      <Modal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedResources.length} pricing rule${selectedResources.length !== 1 ? "s" : ""}`}
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmBulkDelete,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setBulkDeleteOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Are you sure you want to delete {selectedResources.length} selected pricing
              rule{selectedResources.length !== 1 ? "s" : ""}? This cannot be undone.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import pricing rules"
        primaryAction={{
          content: "Import",
          onAction: confirmImport,
          disabled: !importText.trim(),
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setImportOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">
              Upload a JSON file previously exported from this app. Each rule is created
              as a <strong>new</strong> rule — existing rules are not modified.
            </Text>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
            />
            {importFileName && (
              <Text as="p" variant="bodyMd" tone="subdued">
                Selected: {importFileName}
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
