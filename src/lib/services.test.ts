import assert from "node:assert/strict";
import { test } from "node:test";
import { configureServices, DEFAULT_SERVICES, services, weatherRequest } from "./services.ts";

test("an unconfigured build uses the free services and shows no support row", () => {
  configureServices(undefined);
  assert.deepEqual(services(), DEFAULT_SERVICES);
  assert.equal(weatherRequest("latitude=48.45"), "https://api.open-meteo.com/v1/forecast?latitude=48.45");
});

test("a paid weather plan brings its own host and key", () => {
  configureServices({
    weatherUrl: "https://customer-api.open-meteo.com/v1/forecast/",
    weatherKey: "k&y",
  });
  assert.equal(
    weatherRequest("latitude=48.45"),
    "https://customer-api.open-meteo.com/v1/forecast?latitude=48.45&apikey=k%26y",
  );
  configureServices(undefined);
});

test("blank values fall back rather than breaking a URL", () => {
  configureServices({ routingUrl: "  ", supportEmail: "", weatherKey: " " });
  assert.equal(services().routingUrl, DEFAULT_SERVICES.routingUrl);
  assert.equal(services().supportEmail, null);
  assert.equal(services().weatherKey, null);
});

test("a routing server of the app's own replaces the community one", async () => {
  configureServices({ routingUrl: "https://routing.example.com/route/v1/foot/" });
  const { legUrl } = await import("./route.ts");
  assert.equal(
    legUrl({ lat: 48.45, lng: 1.49 }, { lat: 48.46, lng: 1.5 }),
    "https://routing.example.com/route/v1/foot/1.490000,48.450000;1.500000,48.460000?overview=full&geometries=geojson",
  );
  configureServices(undefined);
});
