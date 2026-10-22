(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(currency, amount) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(amount);
    } catch (e) {
      return (currency || "") + amount;
    }
  }

  function quantityLabel(tier) {
    if (tier.max) return tier.min + "–" + tier.max;
    return tier.min + "+";
  }

  function discountLabel(currency, tier) {
    if (tier.type === "PERCENTAGE") return tier.discount + "% off";
    return formatMoney(currency, tier.discount) + " off";
  }

  function render(root, data) {
    var body = root.querySelector(".tiered-pricing__body");
    if (!body) return;

    if (!data || !data.enabled || !data.tiers || data.tiers.length === 0) {
      root.setAttribute("hidden", "");
      return;
    }

    var rows = data.tiers
      .map(function (tier) {
        var note = tier.label
          ? '<span class="tiered-pricing__note">' + escapeHtml(tier.label) + "</span>"
          : "";
        return (
          "<tr><th scope=\"row\">" +
          escapeHtml(quantityLabel(tier)) +
          "</th><td>" +
          escapeHtml(discountLabel(data.currency, tier)) +
          note +
          "</td></tr>"
        );
      })
      .join("");

    body.innerHTML =
      '<table class="tiered-pricing__table">' +
      "<thead><tr><th scope=\"col\">Quantity</th><th scope=\"col\">Discount</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table>";

    body.removeAttribute("hidden");
    root.removeAttribute("hidden");
  }

  function init(root) {
    var productId = root.getAttribute("data-product-id");
    var proxy = root.getAttribute("data-proxy") || "/apps/tiered-pricing/pricing-table";
    if (!productId) {
      root.setAttribute("hidden", "");
      return;
    }

    fetch(proxy + "?productId=" + encodeURIComponent(productId), {
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        render(root, data);
      })
      .catch(function () {
        root.setAttribute("hidden", "");
      });
  }

  function boot() {
    var roots = document.querySelectorAll("[data-tiered-pricing]");
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
