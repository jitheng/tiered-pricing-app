import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';

/**
 * Configuration stored in the discount's `$app/function-configuration` metafield.
 *
 * `customerTags` and `collectionIds` also populate the input query variables
 * (`$customerTags`, `$collectionIds`) via `input_variables` in
 * shopify.extension.toml, driving `hasAnyTag` / `inAnyCollection`.
 *
 * This one function backs all three rule types. Each gate is applied only when
 * its config is present, so the same code handles:
 *   • CUSTOMER_TAG — `customerTags` set (gate on logged-in customer carrying a tag)
 *   • QUANTITY     — `quantityMin`/`quantityMax` set (gate on in-scope quantity range)
 *   • SPEND        — `subtotalMin`/`subtotalMax` set (gate on cart subtotal range)
 *
 * Range gates are INCLUSIVE (min ≤ x ≤ max); a null/absent max means unbounded.
 */
interface Configuration {
  customerTags?: string[];
  collectionIds?: string[];
  productIds?: string[];
  /** SPEND: inclusive cart-subtotal range. */
  subtotalMin?: number | null;
  subtotalMax?: number | null;
  /** QUANTITY: inclusive in-scope quantity range. */
  quantityMin?: number | null;
  quantityMax?: number | null;
  discountType?: 'PERCENTAGE' | 'FIXED';
  value?: number;
  /** Merchant-facing "Display label" shown on the cart/checkout promotion. */
  label?: string;
}

const NO_DISCOUNT: CartLinesDiscountsGenerateRunResult = {operations: []};

/**
 * The customer-facing promotion text (and the order's discount-application title).
 * MUST stay in sync with the reconstruction in app/models/analytics.server.ts,
 * which maps this string back to a `[Tiered] …` title for reporting.
 */
function discountMessage(config: Configuration, isFixed: boolean): string {
  const label = config.label?.trim();
  if (label) return label;

  // CUSTOMER_TAG wording — unchanged; existing live discounts + analytics depend on it.
  if ((config.customerTags?.length ?? 0) > 0) {
    return isFixed ? 'Member discount' : `${config.value}% member discount`;
  }
  // SPEND
  if (config.subtotalMin != null || config.subtotalMax != null) {
    return isFixed ? 'Spend discount' : `${config.value}% off`;
  }
  // QUANTITY (and any other range rule)
  return isFixed ? 'Volume discount' : `${config.value}% off`;
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  // 1. Parse the merchant's configuration from the discount metafield.
  const config = input.discount.metafield?.jsonValue as Configuration | undefined;
  const value = config?.value ?? 0;
  if (!config || value <= 0) {
    return NO_DISCOUNT;
  }

  // 2. Customer-tag gate — applied ONLY when the rule specifies tags. `hasAnyTag`
  //    is resolved against `$customerTags` (populated from the config metafield).
  if ((config.customerTags?.length ?? 0) > 0) {
    const customer = input.cart.buyerIdentity?.customer;
    if (!customer?.hasAnyTag) {
      return NO_DISCOUNT;
    }
  }

  const isFixed = config.discountType === 'FIXED';
  const productIds = new Set(config.productIds ?? []);
  const hasScope =
    (config.productIds?.length ?? 0) > 0 || (config.collectionIds?.length ?? 0) > 0;

  // 3. Resolve which cart lines are in scope. No scope → every line qualifies.
  const inScopeLines = input.cart.lines.filter((line) => {
    if (!hasScope) return true;
    const merchandise = line.merchandise;
    if (merchandise.__typename !== 'ProductVariant') return false;
    return merchandise.product.inAnyCollection || productIds.has(merchandise.product.id);
  });

  if (inScopeLines.length === 0) {
    return NO_DISCOUNT;
  }

  // 4. Quantity-range gate (QUANTITY rules) — total quantity of in-scope lines,
  //    matching the old automatic-basic `greaterThanOrEqualToQuantity` semantics
  //    but now with an enforced upper bound.
  if (config.quantityMin != null || config.quantityMax != null) {
    const quantity = inScopeLines.reduce((sum, line) => sum + line.quantity, 0);
    const min = config.quantityMin ?? 0;
    const max = config.quantityMax ?? Infinity;
    if (quantity < min || quantity > max) {
      return NO_DISCOUNT;
    }
  }

  // 5. Subtotal-range gate (SPEND rules) — whole-cart subtotal, matching the old
  //    `greaterThanOrEqualToSubtotal` semantics with an enforced upper bound.
  if (config.subtotalMin != null || config.subtotalMax != null) {
    const subtotal = parseFloat(input.cart.cost.subtotalAmount.amount) || 0;
    const min = config.subtotalMin ?? 0;
    const max = config.subtotalMax ?? Infinity;
    if (subtotal < min || subtotal > max) {
      return NO_DISCOUNT;
    }
  }

  const inScopeLineIds = inScopeLines.map((line) => line.id);
  const hasOrderClass = input.discount.discountClasses.includes(DiscountClass.Order);
  const hasProductClass = input.discount.discountClasses.includes(DiscountClass.Product);
  const message = discountMessage(config, isFixed);

  // 6a. FIXED amount → order-level discount on the subtotal (applied once).
  if (isFixed && hasOrderClass) {
    return {
      operations: [
        {
          orderDiscountsAdd: {
            candidates: [
              {
                message,
                targets: [{orderSubtotal: {excludedCartLineIds: []}}],
                value: {fixedAmount: {amount: value}},
              },
            ],
            selectionStrategy: OrderDiscountSelectionStrategy.First,
          },
        },
      ],
    };
  }

  // 6b. PERCENTAGE → product-level discount applied to every in-scope cart line.
  if (!isFixed && hasProductClass) {
    return {
      operations: [
        {
          productDiscountsAdd: {
            candidates: [
              {
                message,
                targets: inScopeLineIds.map((id) => ({cartLine: {id}})),
                value: {percentage: {value}},
              },
            ],
            selectionStrategy: ProductDiscountSelectionStrategy.First,
          },
        },
      ],
    };
  }

  return NO_DISCOUNT;
}
