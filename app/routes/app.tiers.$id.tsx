import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  Divider,
  FormLayout,
  Icon,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { PlusCircleIcon, DeleteIcon } from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  createTierRule,
  getTierRule,
  updateTierRule,
  type TierLevelInput,
  type TierType,
  type DiscountType,
} from "../models/tierRule.server";
import {
  createShopifyDiscountsForRule,
  deleteShopifyDiscountsByIds,
  saveDiscountIdsToLevels,
} from "../models/shopifyDiscount.server";

// ─── Types ───────────────────────────────────────────────────────────────────

type LoaderData = {
  rule: Awaited<ReturnType<typeof getTierRule>> | null;
  isNew: boolean;
};

type ActionData = {
  errors?: Record<string, string>;
  ok?: boolean;
};

type PickedProduct = { id: string; title: string; images: { edges: { node: { originalSrc: string } }[] } };
type PickedCollection = { id: string; title: string };

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const isNew = params.id === "new";

  if (isNew) {
    return json<LoaderData>({ rule: null, isNew: true });
  }

  const rule = await getTierRule(params.id!, session.shop);
  if (!rule) throw new Response("Not Found", { status: 404 });

  return json<LoaderData>({ rule, isNew: false });
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as TierType;
  const productIds = JSON.parse((formData.get("productIds") as string) || "[]");
  const collectionIds = JSON.parse((formData.get("collectionIds") as string) || "[]");
  const levelsJson = formData.get("levels") as string;

  // ── Validation ────────────────────────────────────────────────────────────
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  if (!["QUANTITY", "CUSTOMER_TAG", "SPEND"].includes(type)) errors.type = "Invalid type";

  let levels: TierLevelInput[] = [];
  try {
    levels = JSON.parse(levelsJson || "[]");
  } catch {
    errors.levels = "Invalid levels data";
  }

  if (levels.length < 1) errors.levels = "At least one pricing level is required";

  for (const [i, level] of levels.entries()) {
    if (type !== "CUSTOMER_TAG" && (isNaN(level.minValue) || level.minValue < 0)) {
      errors[`level_${i}_min`] = `Level ${i + 1}: minimum value must be ≥ 0`;
    }
    if (isNaN(level.discount) || level.discount <= 0) {
      errors[`level_${i}_discount`] = `Level ${i + 1}: discount must be > 0`;
    }
    if (type === "CUSTOMER_TAG" && !level.tagValue?.trim()) {
      errors[`level_${i}_tag`] = `Level ${i + 1}: tag value is required`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 422 });
  }

  const isNew = params.id === "new";

  if (isNew) {
    // 1. Save rule to DB
    const rule = await createTierRule(session.shop, {
      name, type, productIds, collectionIds, levels,
    });

    // 2. Create actual Shopify automatic discounts for each level
    const discountResults = await createShopifyDiscountsForRule(
      admin, rule.id, name, type, productIds, collectionIds, levels,
    );

    // 3. Store the Shopify discount GIDs back on each level
    await saveDiscountIdsToLevels(rule.id, discountResults);

    // Surface any Shopify errors as a warning (rule is saved, discount may have failed)
    const shopifyErrors = discountResults.filter((r) => r.error);
    if (shopifyErrors.length > 0) {
      console.warn("[TieredPricing] Some discounts failed to create:", shopifyErrors);
      return json<ActionData>({
        errors: {
          shopify: `Rule saved, but ${shopifyErrors.length} discount(s) failed to sync with Shopify: ${shopifyErrors.map((e) => e.error).join("; ")}. Check your app scopes.`,
        },
      });
    }
  } else {
    // 1. Read current discount IDs BEFORE updateTierRule deletes old TierLevel rows
    const oldRule = await getTierRule(params.id!, session.shop);
    const oldDiscountIds = (oldRule?.levels ?? [])
      .map((l) => l.shopifyDiscountId)
      .filter(Boolean) as string[];

    // 2. Delete old Shopify discounts using those IDs (before DB rows are gone)
    if (oldDiscountIds.length > 0) {
      await deleteShopifyDiscountsByIds(admin, oldDiscountIds);
    }

    // 3. Update rule in DB (levels are deleted + recreated inside updateTierRule)
    const rule = await updateTierRule(params.id!, session.shop, {
      name, type, productIds, collectionIds, levels,
    });

    // 4. Create new Shopify discounts for the updated levels
    const discountResults = await createShopifyDiscountsForRule(
      admin, rule.id, name, type, productIds, collectionIds, levels,
    );

    // 5. Store new discount GIDs
    await saveDiscountIdsToLevels(rule.id, discountResults);

    const shopifyErrors = discountResults.filter((r) => r.error);
    if (shopifyErrors.length > 0) {
      console.warn("[TieredPricing] Some discounts failed to sync:", shopifyErrors);
      return json<ActionData>({
        errors: {
          shopify: `Rule updated, but ${shopifyErrors.length} discount(s) failed to sync: ${shopifyErrors.map((e) => e.error).join("; ")}`,
        },
      });
    }
  }

  return redirect("/app");
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_TYPE_OPTIONS = [
  { label: "Quantity Break (e.g. Buy 5+ for 10% off)", value: "QUANTITY" },
  { label: "Customer Tag (e.g. wholesale = 20% off)", value: "CUSTOMER_TAG" },
  { label: "Spend Threshold (e.g. Spend $100+ for 15% off)", value: "SPEND" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { label: "Percentage (%)", value: "PERCENTAGE" },
  { label: "Fixed amount ($)", value: "FIXED" },
];

function blankLevel(type: TierType): TierLevelInput {
  return {
    minValue: 0,
    maxValue: null,
    tagValue: null,
    discount: 10,
    type: "PERCENTAGE",
    label: "",
    sortOrder: 0,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TierRuleForm() {
  const { rule, isNew } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const navigate = useNavigate();
  const isSaving = navigation.state === "submitting";

  // Form state
  const [name, setName] = useState(rule?.name ?? "");
  const [type, setType] = useState<TierType>((rule?.type as TierType) ?? "QUANTITY");
  const [levels, setLevels] = useState<TierLevelInput[]>(
    rule?.levels?.length
      ? rule.levels.map((l) => ({
          id: l.id,
          minValue: l.minValue,
          maxValue: l.maxValue,
          tagValue: l.tagValue,
          discount: l.discount,
          type: l.type as DiscountType,
          label: l.label ?? "",
          sortOrder: l.sortOrder,
        }))
      : [blankLevel(type)],
  );
  const [selectedProducts, setSelectedProducts] = useState<PickedProduct[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<PickedCollection[]>([]);

  // App Bridge v4 uses shopify.resourcePicker() instead of <ResourcePicker />
  const openProductPicker = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: selectedProducts.map((p) => ({ id: p.id })),
    });
    if (selected) setSelectedProducts(selected as PickedProduct[]);
  };

  const openCollectionPicker = async () => {
    const selected = await shopify.resourcePicker({
      type: "collection",
      multiple: true,
      selectionIds: selectedCollections.map((c) => ({ id: c.id })),
    });
    if (selected) setSelectedCollections(selected as PickedCollection[]);
  };

  const errors = actionData?.errors ?? {};

  // ── Level helpers ────────────────────────────────────────────────────────

  const addLevel = () => {
    setLevels((prev) => [
      ...prev,
      { ...blankLevel(type), sortOrder: prev.length },
    ]);
  };

  const removeLevel = (index: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLevel = (index: number, field: keyof TierLevelInput, value: unknown) => {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const form = new FormData();
    form.set("name", name);
    form.set("type", type);
    form.set("productIds", JSON.stringify(selectedProducts.map((p) => p.id)));
    form.set("collectionIds", JSON.stringify(selectedCollections.map((c) => c.id)));
    form.set("levels", JSON.stringify(levels));
    submit(form, { method: "POST" });
  };

  // ── Level rows by type ───────────────────────────────────────────────────

  const renderLevelRow = (level: TierLevelInput, index: number) => {
    if (type === "QUANTITY") {
      return (
        <Card key={index}>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                Level {index + 1}
              </Text>
              {levels.length > 1 && (
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  variant="plain"
                  onClick={() => removeLevel(index)}
                  accessibilityLabel="Remove level"
                />
              )}
            </InlineStack>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Min quantity"
                  type="number"
                  value={String(level.minValue)}
                  onChange={(v) => updateLevel(index, "minValue", parseFloat(v) || 0)}
                  error={errors[`level_${index}_min`]}
                  autoComplete="off"
                  min={0}
                />
                <TextField
                  label="Max quantity (leave empty for unlimited)"
                  type="number"
                  value={level.maxValue != null ? String(level.maxValue) : ""}
                  onChange={(v) => updateLevel(index, "maxValue", v ? parseFloat(v) : null)}
                  autoComplete="off"
                  min={0}
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Discount amount"
                  type="number"
                  value={String(level.discount)}
                  onChange={(v) => updateLevel(index, "discount", parseFloat(v) || 0)}
                  error={errors[`level_${index}_discount`]}
                  autoComplete="off"
                  min={0}
                  suffix={level.type === "PERCENTAGE" ? "%" : "$"}
                />
                <Select
                  label="Discount type"
                  options={DISCOUNT_TYPE_OPTIONS}
                  value={level.type}
                  onChange={(v) => updateLevel(index, "type", v as DiscountType)}
                />
              </FormLayout.Group>
              <TextField
                label="Label (shown on storefront, optional)"
                value={level.label ?? ""}
                onChange={(v) => updateLevel(index, "label", v)}
                autoComplete="off"
                placeholder="e.g. Bulk Deal, Wholesale Price"
              />
            </FormLayout>
          </BlockStack>
        </Card>
      );
    }

    if (type === "CUSTOMER_TAG") {
      return (
        <Card key={index}>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                Level {index + 1}
              </Text>
              {levels.length > 1 && (
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  variant="plain"
                  onClick={() => removeLevel(index)}
                  accessibilityLabel="Remove level"
                />
              )}
            </InlineStack>
            <FormLayout>
              <TextField
                label="Customer tag"
                value={level.tagValue ?? ""}
                onChange={(v) => updateLevel(index, "tagValue", v)}
                error={errors[`level_${index}_tag`]}
                autoComplete="off"
                placeholder="e.g. wholesale, vip, b2b"
                helpText="Customers with this tag will receive the discount"
              />
              <FormLayout.Group>
                <TextField
                  label="Discount amount"
                  type="number"
                  value={String(level.discount)}
                  onChange={(v) => updateLevel(index, "discount", parseFloat(v) || 0)}
                  error={errors[`level_${index}_discount`]}
                  autoComplete="off"
                  min={0}
                  suffix={level.type === "PERCENTAGE" ? "%" : "$"}
                />
                <Select
                  label="Discount type"
                  options={DISCOUNT_TYPE_OPTIONS}
                  value={level.type}
                  onChange={(v) => updateLevel(index, "type", v as DiscountType)}
                />
              </FormLayout.Group>
              <TextField
                label="Display label (optional)"
                value={level.label ?? ""}
                onChange={(v) => updateLevel(index, "label", v)}
                autoComplete="off"
                placeholder="e.g. Wholesale, VIP"
              />
            </FormLayout>
          </BlockStack>
        </Card>
      );
    }

    // SPEND type
    return (
      <Card key={index}>
        <BlockStack gap="300">
          <InlineStack align="space-between">
            <Text as="h3" variant="headingSm">
              Level {index + 1}
            </Text>
            {levels.length > 1 && (
              <Button
                icon={DeleteIcon}
                tone="critical"
                variant="plain"
                onClick={() => removeLevel(index)}
                accessibilityLabel="Remove level"
              />
            )}
          </InlineStack>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Minimum cart total ($)"
                type="number"
                value={String(level.minValue)}
                onChange={(v) => updateLevel(index, "minValue", parseFloat(v) || 0)}
                error={errors[`level_${index}_min`]}
                autoComplete="off"
                min={0}
                prefix="$"
              />
              <TextField
                label="Maximum cart total (optional)"
                type="number"
                value={level.maxValue != null ? String(level.maxValue) : ""}
                onChange={(v) => updateLevel(index, "maxValue", v ? parseFloat(v) : null)}
                autoComplete="off"
                min={0}
                prefix="$"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Discount amount"
                type="number"
                value={String(level.discount)}
                onChange={(v) => updateLevel(index, "discount", parseFloat(v) || 0)}
                error={errors[`level_${index}_discount`]}
                autoComplete="off"
                min={0}
                suffix={level.type === "PERCENTAGE" ? "%" : "$"}
              />
              <Select
                label="Discount type"
                options={DISCOUNT_TYPE_OPTIONS}
                value={level.type}
                onChange={(v) => updateLevel(index, "type", v as DiscountType)}
              />
            </FormLayout.Group>
            <TextField
              label="Label (optional)"
              value={level.label ?? ""}
              onChange={(v) => updateLevel(index, "label", v)}
              autoComplete="off"
              placeholder="e.g. Big Spender Deal"
            />
          </FormLayout>
        </BlockStack>
      </Card>
    );
  };

  return (
    <Page
      backAction={{ content: "Pricing Rules", onAction: () => navigate("/app") }}
      title={isNew ? "Create Pricing Rule" : `Edit: ${rule?.name}`}
    >
      <TitleBar title={isNew ? "Create Pricing Rule" : "Edit Pricing Rule"} />

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Shopify sync warning */}
            {errors.shopify && (
              <Banner tone="warning" title="Shopify sync issue">
                <p>{errors.shopify}</p>
              </Banner>
            )}
            {/* Validation errors banner */}
            {Object.keys(errors).length > 0 && !errors.levels && !errors.shopify && (
              <Banner tone="critical" title="Please fix the errors below" />
            )}
            {errors.levels && (
              <Banner tone="critical" title={errors.levels} />
            )}

            {/* Rule basics */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Rule details
                </Text>
                <TextField
                  label="Rule name"
                  value={name}
                  onChange={setName}
                  error={errors.name}
                  autoComplete="off"
                  placeholder="e.g. Summer Volume Discount"
                />
                <Select
                  label="Pricing type"
                  options={TIER_TYPE_OPTIONS}
                  value={type}
                  onChange={(v) => {
                    setType(v as TierType);
                    setLevels([blankLevel(v as TierType)]);
                  }}
                  helpText="The type of condition that triggers the tiered discount"
                />
              </BlockStack>
            </Card>

            {/* Pricing levels */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Pricing levels
                  </Text>
                  <Badge>{levels.length} level{levels.length !== 1 ? "s" : ""}</Badge>
                </InlineStack>

                <Text as="p" tone="subdued" variant="bodyMd">
                  {type === "QUANTITY" &&
                    "Define quantity ranges and their corresponding discounts. Customers who buy within each range automatically receive the discount."}
                  {type === "CUSTOMER_TAG" &&
                    "Define discount rules per customer tag. Customers with a matching tag receive that discount when logged in."}
                  {type === "SPEND" &&
                    "Define cart total thresholds and discounts. When a customer's cart reaches a threshold, they receive the discount."}
                </Text>

                {type === "CUSTOMER_TAG" && (
                  <Banner tone="warning" title="Important: Shopify limitation with tag-based discounts">
                    <p>
                      Shopify's Automatic Discounts API does not support filtering by customer tag at checkout.
                      This means the discount will apply to <strong>all customers</strong>, regardless of their tag.
                      Tag-based filtering requires a <strong>Shopify Functions</strong> extension, which is on the roadmap.
                      Use this discount type only if you're aware of this current limitation.
                    </p>
                  </Banner>
                )}

                <BlockStack gap="300">
                  {levels.map((level, i) => renderLevelRow(level, i))}
                </BlockStack>

                <Button icon={PlusCircleIcon} onClick={addLevel}>
                  Add level
                </Button>
              </BlockStack>
            </Card>

            {/* Product / Collection scope */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Apply to (optional)
                </Text>
                <Text as="p" tone="subdued" variant="bodyMd">
                  Leave empty to apply this rule to all products. Or select
                  specific products or collections.
                </Text>

                <InlineStack gap="300">
                  <Button onClick={openProductPicker}>
                    Select products{selectedProducts.length > 0 ? ` (${selectedProducts.length})` : ""}
                  </Button>
                  <Button onClick={openCollectionPicker}>
                    Select collections{selectedCollections.length > 0 ? ` (${selectedCollections.length})` : ""}
                  </Button>
                </InlineStack>

                {/* Selected products preview */}
                {selectedProducts.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Selected products</Text>
                    {selectedProducts.map((p) => (
                      <InlineStack key={p.id} gap="200" blockAlign="center">
                        <Thumbnail
                          source={p.images?.edges?.[0]?.node?.originalSrc ?? ""}
                          alt={p.title}
                          size="small"
                        />
                        <Text as="span" variant="bodyMd">{p.title}</Text>
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() =>
                            setSelectedProducts((prev) =>
                              prev.filter((x) => x.id !== p.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}

                {/* Selected collections preview */}
                {selectedCollections.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Selected collections</Text>
                    {selectedCollections.map((c) => (
                      <InlineStack key={c.id} gap="200" blockAlign="center">
                        <Text as="span" variant="bodyMd">{c.title}</Text>
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() =>
                            setSelectedCollections((prev) =>
                              prev.filter((x) => x.id !== c.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Sidebar */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Save rule
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Rules become active immediately after saving.
                </Text>
                <ButtonGroup>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    loading={isSaving}
                  >
                    {isNew ? "Create rule" : "Save changes"}
                  </Button>
                  <Button onClick={() => navigate("/app")}>Cancel</Button>
                </ButtonGroup>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  How tiered pricing works
                </Text>
                <BlockStack gap="200">
                  {type === "QUANTITY" && (
                    <>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        When a customer adds a qualifying quantity to their cart,
                        the discount is automatically applied at checkout using
                        Shopify Automatic Discounts — no code required.
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Example: Buy 1-4 = full price, Buy 5-9 = 10% off, Buy 10+ = 20% off.
                      </Text>
                    </>
                  )}
                  {type === "CUSTOMER_TAG" && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Customers who are logged in and have the specified tag on
                      their account automatically see discounted prices. Great
                      for wholesale and VIP programs.
                    </Text>
                  )}
                  {type === "SPEND" && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      When a customer's cart total reaches a threshold, they
                      automatically receive the discount. Great for encouraging
                      larger orders.
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

    </Page>
  );
}
