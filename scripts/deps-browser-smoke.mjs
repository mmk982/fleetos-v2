/**
 * Post-deps-upgrade browser smoke (Playwright).
 * Usage: node scripts/deps-browser-smoke.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.A11Y_BASE || "http://localhost:3000";
const PASSWORD = "FleetOS-RlsTest-9f3aK2!mQ";
const ADMIN = "rls-admin1@example.invalid";
const notes = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    notes.push(`[console.${msg.type()}] ${msg.text().slice(0, 200)}`);
  }
});
page.on("pageerror", (err) => notes.push(`[pageerror] ${err.message}`));

try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"], input[type="email"]', ADMIN);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), {
    timeout: 45000,
  });
  notes.push("login+dashboard ok");

  await page.goto(BASE + "/dashboard/certificates", {
    waitUntil: "domcontentloaded",
  });
  notes.push("certificates list: " + page.url());

  await page.goto(BASE + "/dashboard/crew/new", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const dialog = page.locator('[role="dialog"]');
  notes.push("drawer open: " + ((await dialog.count()) > 0));
  if ((await dialog.count()) > 0) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    notes.push("drawer after Escape count: " + (await dialog.count()));
  }

  await page.goto(BASE + "/dashboard/vessels", {
    waitUntil: "domcontentloaded",
  });
  const links = page.locator('a[href*="/dashboard/vessels/"]');
  const n = await links.count();
  let href = null;
  for (let i = 0; i < n; i++) {
    const h = await links.nth(i).getAttribute("href");
    if (
      h &&
      !h.endsWith("/new") &&
      !h.endsWith("/edit") &&
      !/vessels\/?$/.test(h)
    ) {
      href = h;
      break;
    }
  }
  if (href) {
    await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
    const del = page.getByRole("button", { name: /delete/i }).first();
    if (await del.count()) {
      await del.click();
      await page.waitForTimeout(500);
      notes.push(
        "modal open: " + ((await page.locator('[role="dialog"]').count()) > 0),
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      notes.push(
        "modal after Escape: " + (await page.locator('[role="dialog"]').count()),
      );
    } else {
      notes.push("no delete button");
    }
  } else {
    notes.push("no vessel link");
  }

  const resp = await page.request.get(
    BASE + "/api/export/certificates?format=xlsx",
  );
  const buf = await resp.body();
  notes.push(
    `xlsx status=${resp.status()} bytes=${buf.length} magic=${buf.slice(0, 2).toString()}`,
  );
} finally {
  await browser.close();
}

for (const n of notes) console.log(n);
