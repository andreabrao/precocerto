import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Curitiba and Itaperuçu geolocalized MVP", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /PreçoCerto Curitiba \| Compare sua cesta/);
  assert.match(html, /Cobertura piloto: Curitiba e Itaperuçu, Paraná/);
  assert.match(html, /preços de demonstração/);
  assert.match(html, /Monte sua cesta/);
  assert.match(html, /perto de você/);
  assert.match(html, /Preferências de comparação/);
  assert.match(html, /Muffato Portão/);
  assert.match(html, /Inteligência de preços/);
  assert.match(html, /Confira o QR Code da sua compra/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /Building your site|react-loading-skeleton|codex-preview/i);
});

test("allows the GitHub Pages frontend to call the separate API", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("cors-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const allowed = await worker.fetch(
    new Request("http://localhost/api/comparison", {
      method: "OPTIONS",
      headers: { Origin: "https://andreabrao.github.io" },
    }),
    env,
    ctx,
  );
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://andreabrao.github.io");

  const denied = await worker.fetch(
    new Request("http://localhost/api/comparison", {
      method: "OPTIONS",
      headers: { Origin: "https://example.invalid" },
    }),
    env,
    ctx,
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("keeps the generated social card, geolocation model, and protected import in the project", async () => {
  const [page, layout, css, schema, bootstrap, queryModule, comparisonRoute, importRoute, geo, nfceQr, rioVerdeFlyer, socialOffers, serviceWorker, manifest, example, community, contributionRoute, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/queries.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/comparison/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/import/observations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/geo.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/nfce-qr.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/rio-verde-flyer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/itaperucu-social-offers.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../examples/authorized-observation.json", import.meta.url), "utf8"),
    readFile(new URL("../db/community.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/community/contributions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/app-icon.svg", import.meta.url));
  await access(new URL("../drizzle/0000_real_sharon_carter.sql", import.meta.url));
  await access(new URL("../drizzle/0001_slippery_centennial.sql", import.meta.url));
  await access(new URL("../drizzle/0002_tranquil_triton.sql", import.meta.url));
  assert.match(page, /useState/);
  assert.match(page, /api\/comparison/);
  assert.match(page, /api\/feedback/);
  assert.match(page, /geolocation/);
  assert.match(page, /radiusKm/);
  assert.match(page, /COMUNIDADE PREÇOCERTO/);
  assert.match(page, /Envie uma etiqueta/);
  assert.match(page, /Abrir consulta oficial da NFC-e/);
  assert.match(page, /serviceWorker\.register/);
  assert.match(page, /Instalar app/);
  assert.match(layout, /manifest/);
  assert.match(page, /Curitiba/);
  assert.match(page, /Itaperuçu/);
  assert.match(page, /Muffato Portão/);
  assert.match(page, /Radar de preço em Curitiba/);
  assert.match(css, /--lime/);
  assert.match(css, /@media/);
  assert.match(schema, /priceObservations/);
  assert.match(schema, /consumerFeedback/);
  assert.match(schema, /communityContributions/);
  assert.match(schema, /consumerPriceAlerts/);
  assert.match(bootstrap, /rioVerdeFlyerItems/);
  assert.match(comparisonRoute, /ensureCuritibaDatabase/);
  assert.match(comparisonRoute, /isWithinPilotCoverage/);
  assert.match(page, /ofertas oficiais ativas/);
  assert.match(bootstrap, /itaperucuSocialOffers/);
  assert.match(queryModule, /activeOfferCount/);
  assert.match(importRoute, /x-import-key/);
  assert.match(importRoute, /IMPORT_API_KEY/);
  assert.match(importRoute, /sourceType/);
  assert.match(geo, /distanceInKm/);
  assert.match(geo, /approximatePoint/);
  assert.match(geo, /getPilotCoverageForPoint/);
  assert.match(nfceQr, /inspectParanaNfceQr/);
  assert.match(nfceQr, /PARANA_FISCAL_HOSTS/);
  assert.match(rioVerdeFlyer, /Rio Verde Supermercados/);
  assert.match(rioVerdeFlyer, /HORTIFRUTI_ENDS_AT/);
  assert.match(socialOffers, /Mercado Ramon/);
  assert.match(socialOffers, /STARTS_15/);
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(manifest, /standalone/);
  assert.match(example, /official_flyer/);
  assert.match(community, /POINTS_PER_VERIFIED_LABEL/);
  assert.match(community, /verifyMatchingContributions/);
  assert.match(contributionRoute, /CONTRIBUTION_IMAGES/);
  assert.match(contributionRoute, /MAX_PHOTO_BYTES/);
  assert.match(hosting, /CONTRIBUTION_IMAGES/);
});

test("connects a selected market to its active offers, source images, and normalized SKUs", async () => {
  const [page, queries, storeOffersRoute, panel, comparisonProducts, flyerPublishRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/queries.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/store-offers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/store-offers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/comparison-products.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/platform/flyers/[id]/publish/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /showStoreOffers/);
  assert.match(page, /StoreOffersPanel/);
  assert.match(queries, /getStoreOffers/);
  assert.match(storeOffersRoute, /ensureCuritibaDatabase/);
  assert.match(panel, /rio-verde-bebidas\.jpeg/);
  assert.match(panel, /Ver encarte/);
  assert.match(page, /Menor em/);
  assert.match(queries, /bestStoreName/);
  assert.match(comparisonProducts, /canonicalProductSku/);
  assert.match(comparisonProducts, /sku-frimesa-linguica-toscana-kg/);
  assert.match(flyerPublishRoute, /canonicalProductSku/);
  await access(new URL("../public/encartes/rio-verde-bebidas.jpeg", import.meta.url));
  await access(new URL("../public/encartes/mercado-ramon.jpeg", import.meta.url));
});
