import { chromium } from "playwright";

const base = process.env.TARGET_URL || "http://localhost:3001";
const slug = `sync-${Date.now().toString(36)}`;
const url = `${base}/w/${slug}`;

const browser = await chromium.launch({ headless: true });

const countPixels = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return -1;
    const ctx = canvas.getContext("2d");
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n += 1;
      return n;
    } catch {
      return -2;
    }
  });

const draw = async (page) => {
  const box = await page.locator('[data-testid="canvas-stage"]').boundingBox();
  if (!box) return false;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 100, cy - 80);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    await page.mouse.move(cx - 100 + i * 20, cy - 80 + i * 14);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  return true;
};

const ctxA = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const ctxB = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();

await Promise.all([
  pageA.goto(url, { waitUntil: "networkidle" }),
  pageB.goto(url, { waitUntil: "networkidle" }),
]);
await pageA.waitForTimeout(2000);
await pageB.waitForTimeout(500);

const before = { a: await countPixels(pageA), b: await countPixels(pageB) };

const drew = await draw(pageA);
await pageA.waitForTimeout(400);
await pageB.waitForTimeout(1200);

const after = { a: await countPixels(pageA), b: await countPixels(pageB) };
const statusB = await pageB.locator("text=Bağlı").count();

console.log(JSON.stringify({ slug, drew, before, after, synced: after.b > 0, statusB }, null, 2));

await browser.close();
