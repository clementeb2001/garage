/* ============================================================
   Autoservice Bettenduerf — Mollie-Bezuel-Worker (Cloudflare Workers)
   ------------------------------------------------------------
   Dës Datei WÄERT NET vun der Websäit (GitHub Pages) servéiert —
   si gëtt separat op Cloudflare Workers deployé (kuck README.md).

   Zweck: de Browser schéckt d'Kuerf-Positiounen (Artikelnummer + Unzuel),
   de Worker rechent de Betrag SELWER (aus der PRICES-Lëscht hei ënnen,
   ni aus dem Browser vertrauen!), leet eng Mollie-Bezuelung un a gëtt
   d'Checkout-URL zréck. Mollie regelt Kaart / Wero / Revolut / SEPA.

   Nout: de Mollie-Schlëssel gëtt NI hei am Code gespäichert, mä als
   Cloudflare-Secret `MOLLIE_API_KEY` (kuck README.md).
   ============================================================ */

// Erlaabt Hierkonft(en) fir CORS — nëmmen déi eege Websäit.
const ALLOWED_ORIGINS = [
  "https://autoservicebettenduerf.lu",
  "https://www.autoservicebettenduerf.lu",
];

// Serverseiteg Präislëscht: Artikelnummer -> Präis a Cent (EUR).
// WICHTEG: dës Lëscht ass d'Autoritéit fir de Betrag. Dréit hei déi
// reell DBA-Präisser an (identesch mat deenen am Shop-Katalog).
// Solaang eng Artikelnummer hei feelt, gëtt se refuséiert.
const PRICES = {
  // "DBA2810E": 8900,   // Beispill: 89,00 €
  // "DB2383SS": 6500,   // Beispill: 65,00 €
};

const CURRENCY = "EUR";

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // --- Bezuelung uleeën ---
    if (request.method === "POST" && url.pathname.endsWith("/create-payment")) {
      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return json({ error: "bad_json" }, 400, origin);
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return json({ error: "empty_cart" }, 400, origin);

      // Betrag serverseiteg berechnen
      let totalCents = 0;
      const lines = [];
      for (const it of items) {
        const cents = PRICES[it.id];
        const qty = Math.max(1, parseInt(it.qty, 10) || 0);
        if (cents == null) return json({ error: "unknown_item", id: it.id }, 400, origin);
        totalCents += cents * qty;
        lines.push({ id: it.id, qty, cents });
      }
      if (totalCents <= 0) return json({ error: "zero_total" }, 400, origin);

      const amount = (totalCents / 100).toFixed(2);
      const locale =
        { lb: "de_DE", de: "de_DE", fr: "fr_FR", en: "en_GB" }[payload.locale] || "de_DE";

      const body = {
        amount: { currency: CURRENCY, value: amount },
        description: "Autoservice Bettenduerf – Bestellung",
        redirectUrl: "https://autoservicebettenduerf.lu/danke.html",
        webhookUrl: url.origin + "/webhook",
        locale,
        metadata: { lines },
        // Methoden, déi Dir am Mollie-Dashboard aktivéiert hutt
        // (Kaart, Wero, Revolut/Bancontact, SEPA-Iwwerweisung …) ginn
        // automatesch am Checkout ugebueden. Optional aschränken:
        // method: ["creditcard", "bancontact", "banktransfer"],
      };

      const res = await fetch("https://api.mollie.com/v2/payments", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.MOLLIE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return json({ error: "mollie_error", status: res.status }, 502, origin);
      }
      const data = await res.json();
      const checkoutUrl = data && data._links && data._links.checkout && data._links.checkout.href;
      if (!checkoutUrl) return json({ error: "no_checkout_url" }, 502, origin);
      return json({ checkoutUrl }, 200, origin);
    }

    // --- Webhook: Mollie mellt de Bezuel-Status ---
    if (request.method === "POST" && url.pathname.endsWith("/webhook")) {
      try {
        const form = await request.formData();
        const id = form.get("id");
        if (id) {
          const r = await fetch("https://api.mollie.com/v2/payments/" + id, {
            headers: { Authorization: "Bearer " + env.MOLLIE_API_KEY },
          });
          const pay = await r.json();
          // TODO: Bestellung späicheren / E-Mail schécken je no pay.status
          // ("paid", "failed", "expired", "canceled").
        }
      } catch (e) {}
      return new Response("ok", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
};
