/**
 * Standalone axe matrix runner (Playwright + axe-core).
 * Usage: node scripts/run-a11y-axe.mjs [before|after]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

const phase = process.argv[2] === "after" ? "after" : "before";
const OUT = path.resolve(`docs/_a11y-axe-${phase}.json`);
const BASE = process.env.A11Y_BASE || "http://localhost:3000";
const PASSWORD = "FleetOS-RlsTest-9f3aK2!mQ";
const ADMIN = "rls-admin1@example.invalid";
const VU_A = "rls-vua@example.invalid";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

const PAGES = [
  { name: "login", path: "/login", user: "anon" },
  { name: "dashboard", path: "/dashboard", user: "admin" },
  { name: "vessels-list", path: "/dashboard/vessels", user: "admin" },
  { name: "vessel-detail", path: "/dashboard/vessels", user: "admin", setup: "first-vessel" },
  { name: "certificates-list", path: "/dashboard/certificates", user: "admin" },
  { name: "certificates-detail", path: "/dashboard/certificates", user: "admin", setup: "first-cert" },
  { name: "certificates-new", path: "/dashboard/certificates/new", user: "admin" },
  { name: "crew-list", path: "/dashboard/crew", user: "admin" },
  { name: "crew-detail", path: "/dashboard/crew", user: "admin", setup: "first-crew" },
  { name: "crew-drawer", path: "/dashboard/crew", user: "admin", setup: "crew-drawer" },
  { name: "deficiencies-list", path: "/dashboard/deficiencies", user: "admin" },
  { name: "deficiencies-drawer", path: "/dashboard/deficiencies", user: "admin", setup: "def-drawer" },
  { name: "monthly-forms-list", path: "/dashboard/monthly-forms", user: "vua" },
  { name: "alerts", path: "/dashboard/alerts", user: "admin" },
  { name: "notifications", path: "/dashboard/notifications", user: "admin" },
  { name: "settings-company", path: "/dashboard/settings/company-profile", user: "admin" },
  { name: "settings-users", path: "/dashboard/settings/users", user: "admin" },
  { name: "settings-system-lists", path: "/dashboard/settings/system-lists", user: "admin" },
  { name: "confirm-delete-modal", path: "/dashboard/vessels", user: "admin", setup: "confirm-delete" },
  { name: "mobile-nav-overlay", path: "/dashboard", user: "admin", setup: "mobile-nav" },
];

const COMBOS = [
  { theme: "light", width: 1280, height: 800, label: "light-desktop" },
  { theme: "dark", width: 1280, height: 800, label: "dark-desktop" },
  { theme: "light", width: 390, height: 844, label: "light-mobile" },
  { theme: "dark", width: 390, height: 844, label: "dark-mobile" },
];

async function ensureLoggedIn(page, user) {
  if (user === "anon") {
    await page.context().clearCookies();
    await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
    return;
  }
  const email = user === "vua" ? VU_A : ADMIN;
  await page.context().clearCookies();
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 30000 });
  const emailSel = (await page.$('input[name="email"]')) || (await page.$('input[type="email"]'));
  const passSel = (await page.$('input[name="password"]')) || (await page.$('input[type="password"]'));
  await emailSel.fill(email);
  await passSel.fill(PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    try { localStorage.setItem("theme", t); } catch { /* */ }
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

async function injectAndRunAxe(page) {
  const hasAxe = await page.evaluate(() => typeof window.axe !== "undefined");
  if (!hasAxe) await page.addScriptTag({ path: axePath });
  return page.evaluate(async (tags) => {
    const results = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
    return {
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => ({
          target: n.target,
          summary: (n.failureSummary || "").slice(0, 180),
        })),
        nodeCount: v.nodes.length,
      })),
    };
  }, TAGS);
}

async function runSetup(page, setup, combo) {
  if (!setup) return;
  if (setup === "first-vessel" || setup === "first-cert" || setup === "first-crew") {
    const pattern =
      setup === "first-vessel" ? "/dashboard/vessels/" :
      setup === "first-cert" ? "/dashboard/certificates/" : "/dashboard/crew/";
    const links = page.locator(`a[href*="${pattern}"]`);
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      if (!href || href.endsWith("/new") || href.endsWith("/edit")) continue;
      if (href === pattern.slice(0, -1) || href === pattern) continue;
      await page.goto(BASE + href, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    }
  }
  if (setup === "crew-drawer" || setup === "def-drawer") {
    const newLink = page.locator('a[href$="/new"]').first();
    if (await newLink.count()) {
      await newLink.click();
      await page.waitForTimeout(800);
    }
  }
  if (setup === "confirm-delete") {
    const links = page.locator('a[href*="/dashboard/vessels/"]');
    const count = await links.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const href = await links.nth(i).getAttribute("href");
      if (!href || href.endsWith("/new") || href.endsWith("/edit") || /vessels\/?$/.test(href)) continue;
      await page.goto(BASE + href, { waitUntil: "domcontentloaded", timeout: 60000 });
      break;
    }
    const del = page.getByRole("button", { name: /delete/i }).first();
    if (await del.count()) {
      await del.click();
      await page.waitForTimeout(400);
    }
  }
  if (setup === "mobile-nav" && combo.width < 768) {
    const c = page.getByRole("button", { name: /menu|navigation|open/i }).first();
    if (await c.count()) {
      await c.click().catch(() => {});
      await page.waitForTimeout(350);
    } else {
      const a = page.locator('[aria-label*="menu" i]').first();
      if (await a.count()) await a.click().catch(() => {});
    }
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
let lastUser = null;

try {
  for (const combo of COMBOS) {
    await page.setViewportSize({ width: combo.width, height: combo.height });
    for (const p of PAGES) {
      if (p.setup === "mobile-nav" && combo.width >= 768) continue;
      const user = p.user || "admin";
      if (user !== lastUser) {
        await ensureLoggedIn(page, user);
        lastUser = user;
      }
      process.stdout.write(`${combo.label} ${p.name}… `);
      try {
        await page.goto(BASE + p.path, { waitUntil: "domcontentloaded", timeout: 60000 });
        await setTheme(page, combo.theme);
        await page.waitForTimeout(120);
        await runSetup(page, p.setup, combo);
        await page.waitForTimeout(180);
        const axe = await injectAndRunAxe(page);
        results.push({
          page: p.name,
          path: page.url(),
          combo: combo.label,
          theme: combo.theme,
          viewport: `${combo.width}x${combo.height}`,
          violationCount: axe.violations.length,
          violations: axe.violations,
        });
        console.log(`${axe.violations.length} rules`);
      } catch (err) {
        results.push({
          page: p.name,
          path: page.url(),
          combo: combo.label,
          theme: combo.theme,
          viewport: `${combo.width}x${combo.height}`,
          violationCount: -1,
          violations: [],
          error: String(err && err.message ? err.message : err),
        });
        console.log("ERR", err.message || err);
      }
    }
  }
} finally {
  await browser.close();
}

const byRule = {};
for (const r of results) {
  for (const v of r.violations || []) {
    byRule[v.id] = (byRule[v.id] || 0) + (v.nodeCount || 1);
  }
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), phase, byRule, results }, null, 2));
console.log("Wrote", OUT);
console.log("byRule", byRule);
