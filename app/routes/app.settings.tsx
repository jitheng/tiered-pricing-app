import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Divider,
  Layout,
  Page,
  Select,
  SettingToggle,
  Text,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import {
  getOrCreateSettings,
  updateSettings,
} from "../models/appSettings.server";
import { getTierRuleCount } from "../models/tierRule.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [settings, ruleCount] = await Promise.all([
    getOrCreateSettings(session.shop),
    getTierRuleCount(session.shop),
  ]);
  return json({ settings, ruleCount, shop: session.shop });
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "toggle_app": {
      const isEnabled = formData.get("isEnabled") === "true";
      await updateSettings(session.shop, { isEnabled: !isEnabled });
      break;
    }
    case "update_currency": {
      const currency = formData.get("currency") as string;
      await updateSettings(session.shop, { currency });
      break;
    }
  }

  return json({ ok: true });
};

// ─── Component ───────────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { label: "USD – US Dollar", value: "USD" },
  { label: "EUR – Euro", value: "EUR" },
  { label: "GBP – British Pound", value: "GBP" },
  { label: "CAD – Canadian Dollar", value: "CAD" },
  { label: "AUD – Australian Dollar", value: "AUD" },
  { label: "JPY – Japanese Yen", value: "JPY" },
  { label: "INR – Indian Rupee", value: "INR" },
];

export default function Settings() {
  const { settings, ruleCount, shop } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [currency, setCurrency] = useState(settings.currency);
  const isSaving = navigation.state === "submitting";

  const handleToggleApp = () => {
    const form = new FormData();
    form.set("intent", "toggle_app");
    form.set("isEnabled", String(settings.isEnabled));
    submit(form, { method: "POST" });
  };

  const handleCurrencyUpdate = () => {
    const form = new FormData();
    form.set("intent", "update_currency");
    form.set("currency", currency);
    submit(form, { method: "POST" });
    shopify.toast.show("Currency updated");
  };

  return (
    <Page
      backAction={{ content: "Pricing Rules", url: "/app" }}
      title="Settings"
    >
      <TitleBar title="Settings" />

      <Layout>
        <Layout.AnnotatedSection
          title="App status"
          description="Enable or disable tiered pricing across your entire store. Disabling will stop all discounts from being applied."
        >
          <SettingToggle
            action={{
              content: settings.isEnabled ? "Disable app" : "Enable app",
              tone: settings.isEnabled ? "critical" : undefined,
              onAction: handleToggleApp,
              loading: isSaving,
            }}
            enabled={settings.isEnabled}
          >
            Tiered pricing is currently{" "}
            <Badge tone={settings.isEnabled ? "success" : undefined}>
              {settings.isEnabled ? "enabled" : "disabled"}
            </Badge>
            . You have{" "}
            <strong>{ruleCount}</strong> pricing rule{ruleCount !== 1 ? "s" : ""} configured.
          </SettingToggle>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Storefront pricing table"
          description="Show a pricing table on your product pages so customers can see the tiered discounts before adding items to their cart."
        >
          <Card>
            <BlockStack gap="300">
              <Badge tone="attention">Coming soon</Badge>
              <Text as="p" variant="bodyMd" tone="subdued">
                The storefront pricing table will display tiered discount information directly on your product pages.
                This feature requires a Theme App Extension, which is currently in development.
              </Text>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Default currency"
          description="Used for displaying fixed-amount discounts on the storefront pricing table."
        >
          <Card>
            <BlockStack gap="400">
              <Select
                label="Currency"
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={setCurrency}
              />
              <Button
                variant="primary"
                onClick={handleCurrencyUpdate}
                loading={isSaving}
              >
                Save currency
              </Button>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Store information"
          description="Details about the connected Shopify store."
        >
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Shop domain
                </Text>
                <Text as="p" variant="bodyMd">
                  {shop}
                </Text>
              </BlockStack>
              <Divider />
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Active pricing rules
                </Text>
                <Text as="p" variant="bodyMd">
                  {ruleCount} rule{ruleCount !== 1 ? "s" : ""}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
