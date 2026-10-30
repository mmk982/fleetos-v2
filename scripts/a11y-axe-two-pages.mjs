/**
 * Minimal Playwright + axe smoke after playwright upgrades.
 * Usage: node scripts/a11y-axe-two-pages.mjs
 */
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const BASE = process.env.A11Y_BASE || "http://localhost:3000";
const PASSWORD = "FleetOS-RlsTest-9f3aK2!mQ";
const ADMIN = "rls-admin1@example.invalid";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

const pages = [
  { name: "login", path: "/login", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  for (const p of pages) {
    if (p.auth) {
      await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
      await page.fill('input[name="email"], input[type="email"]', ADMIN);
      await page.fill('input[name="password"], input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), {
        timeout: 45000,
      });
    }
    await page.goto(BASE + p.path, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async (tags) => {
      const r = await window.axe.run(document, {
        runOnly: { type: "tag", values: tags },
      });
      return { violations: r.violations.map((v) => v.id) };
    }, TAGS);
    console.log(p.name, "violations:", result.violations.join(",") || "(none)");
  }
} finally {
  await browser.close();
}
