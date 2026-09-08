import { config, validateConfig } from "./config.js";
import { createApp } from "./app.js";
import { getStore } from "./lib/store.js";

async function main() {
  validateConfig();
  const store = await getStore();
  console.log(`[soundwave] data store: ${store.kind}`);

  const app = createApp();
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[soundwave] API listening on http://0.0.0.0:${config.port} (${config.env})`);
  });
}

main().catch((err) => {
  console.error("[soundwave] fatal startup error:", err);
  process.exit(1);
});
