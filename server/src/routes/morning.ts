// ── Morning Setup ───────────────────────────────────────────────────────────
//   GET  /api/v1/morning           settings (+ the weather city in use)        ┐ the desktop
//   PUT  /api/v1/morning           { city?, items?, openFromPhone?, ideas? }   │ app's own
//   POST /api/v1/morning/weather   { city? } → today's weather (the "Check")   │ window only
//   POST /api/v1/morning/run       run it: open items, briefing (the chip)     ┘
// The phone runs it through its encrypted channel (lib/companion, op "morning").

import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { ApiError } from "../middleware/error.js";
import { localAppGuard } from "../middleware/localApp.js";
import { validate } from "../middleware/validate.js";
import { normalizeUrl } from "../lib/brain/pc.js";
import {
  MAX_MORNING_ITEMS,
  itemLabel,
  loadMorningSettings,
  morningCity,
  morningWeather,
  runMorningSetup,
  saveMorningSettings,
  type MorningItem,
} from "../lib/morning.js";

const router = Router();
router.use(localAppGuard(() => config.desktopApp || config.memoryAvailable, "Morning Setup is only available in the desktop app."));

function view() {
  const settings = loadMorningSettings();
  const { city, auto } = morningCity(settings);
  return {
    ...settings,
    items: settings.items.map((i) => ({ ...i, label: itemLabel(i) })),
    weatherCity: city,
    weatherCityAuto: auto,
    canOpen: config.desktopApp,
    canOpenApps: config.desktopApp && process.platform === "win32",
    maxItems: MAX_MORNING_ITEMS,
  };
}

router.get("/", (_req, res) => {
  res.json(view());
});

const itemSchema = z.object({ kind: z.enum(["website", "app"]), value: z.string().trim().min(1).max(300) });
const putSchema = z.object({
  city: z.string().trim().max(80).nullable().optional(),
  items: z.array(itemSchema).max(MAX_MORNING_ITEMS).optional(),
  openFromPhone: z.boolean().optional(),
  ideas: z.boolean().optional(),
});

router.put("/", validate({ body: putSchema }), (req, res) => {
  const body = req.body as z.infer<typeof putSchema>;
  let items: MorningItem[] | undefined;
  if (body.items) {
    items = [];
    for (const item of body.items) {
      if (item.kind === "website") {
        const url = normalizeUrl(item.value);
        if (!url) throw new ApiError(400, "BAD_ITEM", `“${item.value.slice(0, 80)}” isn't a web address (use something like https://studio.youtube.com).`);
        items.push({ kind: "website", value: url });
      } else {
        items.push({ kind: "app", value: item.value.slice(0, 80) });
      }
    }
  }
  saveMorningSettings({
    ...(body.city !== undefined ? { city: body.city } : {}),
    ...(items ? { items } : {}),
    ...(body.openFromPhone !== undefined ? { openFromPhone: body.openFromPhone } : {}),
    ...(body.ideas !== undefined ? { ideas: body.ideas } : {}),
  });
  res.json(view());
});

const weatherSchema = z.object({ city: z.string().trim().max(80).optional() });

router.post("/weather", validate({ body: weatherSchema }), async (req, res, next) => {
  try {
    const city = (req.body as z.infer<typeof weatherSchema>).city || morningCity().city;
    const { weather, note } = await morningWeather(city ?? null);
    res.json({ ok: Boolean(weather), city, weather, ...(note ? { error: note } : {}) });
  } catch (err) {
    next(err);
  }
});

router.post("/run", async (req, res, next) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  try {
    res.json(await runMorningSetup({ via: "pc", signal: controller.signal }));
  } catch (err) {
    next(err);
  }
});

export default router;
