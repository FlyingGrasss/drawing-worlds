import { chromium } from "playwright";

const url = process.env.TARGET_URL || "http://localhost:3000/w/debug-dunya";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const status = await page
  .locator("text=Bağlı")
  .count()
  .catch(() => 0);

const canvasInfo = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const ctx = canvas.getContext("2d");
  let nonTransparent = -1;
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonTransparent += 1;
  } catch {}
  return {
    width: canvas.width,
    height: canvas.height,
    cssWidth: Math.round(rect.width),
    cssHeight: Math.round(rect.height),
    nonTransparent,
  };
});

const stage = page.locator('[data-testid="canvas-stage"]');
const box = await stage.boundingBox();

if (box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy - 60);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(cx - 120 + i * 20, cy - 60 + i * 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const after = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const stageEl = document.querySelector('[data-testid="canvas-stage"]');
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  let nonTransparent = -1;
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonTransparent += 1;
  } catch {}
  return {
    nonTransparent,
    hasStrokes: stageEl?.getAttribute("data-has-strokes") ?? null,
  };
});

console.log(
  JSON.stringify(
    { status: status > 0 ? "connected" : "unknown", canvasInfo, box, after, errors: errors.slice(0, 8) },
    null,
    2,
  ),
);

await browser.close();
