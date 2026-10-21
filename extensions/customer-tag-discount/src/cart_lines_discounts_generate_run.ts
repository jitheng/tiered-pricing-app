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
 * The same metafield is referenced by `input_variables` in shopify.extension.toml,
 * so `customerTags` and `collectionIds` also populate the input query variables
 * (`$customerTags`, `$collectionIds`) used by `hasAnyTag` / `inAnyCollection`.
 */
interface Configuration {
  customerTags?: string[];
  collectionIds?: string[];
  productIds?: string[];
  discountType?: 'PERCENTAGE' | 'FIXED';
  value?: number;
  /** Merchant-facing "Display label" shown on the cart/checkout promotion. */
  label?: string;
}

const NO_DISCOUNT: CartLinesDiscountsGenerateRunResult = {operations: []};

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  // 1. Customer eligibility — must be signed in AND carry one of the configured
  //    tags. `hasAnyTag` is resolved against the `$customerTags` variable, which
  //    Shopify populates from the configuration metafield at runtime.
  const customer = input.cart.buyerIdentity?.customer;
  if (!customer?.hasAnyTag) {
    return NO_DISCOUNT;
  }

  // 2. Parse the merchant's configuration from the discount metafield.
  const config = input.discount.metafield?.jsonValue as Configuration | undefined;
  const value = config?.value ?? 0;
  if (!config || value <= 0) {
    return NO_DISCOUNT;
  }
  const isFixed = config.discountType === 'FIXED';
  const productIds = new Set(config.productIds ?? []);
  const hasScope =
    (config.productIds?.length ?? 0) > 0 || (config.collectionIds?.length ?? 0) > 0;

  // 3. Resolve which cart lines are in scope. No scope → every line qualifies.
  const inScopeLineIds = input.cart.lines
    .filter((line) => {
      if (!hasScope) return true;
      const merchandise = line.merchandise;
      if (merchandise.__typename !== 'ProductVariant') return false;
      return merchandise.product.inAnyCollection || productIds.has(merchandise.product.id);
    })
    .map((line) => line.id);

  if (inScopeLineIds.length === 0) {
    return NO_DISCOUNT;
  }

  const hasOrderClass = input.discount.discountClasses.includes(DiscountClass.Order);
  const hasProductClass = input.discount.discountClasses.includes(DiscountClass.Product);

  // Use the merchant's "Display label" as the cart/checkout promotion text when
  // provided; otherwise fall back to a generated description.
  const label = config.label?.trim();

  // 4a. FIXED amount → order-level discount on the subtotal (applied once),
  //     mirroring the previous automatic-basic behaviour (appliesOnEachItem: false).
  if (isFixed && hasOrderClass) {
    return {
      operations: [
        {
          orderDiscountsAdd: {
            candidates: [
              {
                message: label || `Member discount`,
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

  // 4b. PERCENTAGE → product-level discount applied to every in-scope cart line.
  if (!isFixed && hasProductClass) {
    return {
      operations: [
        {
          productDiscountsAdd: {
            candidates: [
              {
                message: label || `${value}% member discount`,
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
